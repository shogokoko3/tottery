// Serialize music and speculative SE decodes, preferring requested audio.
// A requested
// SE may use one urgent lane while a long music decode is in progress.
const queues = new WeakMap();

function pump(queue) {
  if (!queue.jobs.length) return;
  queue.jobs.sort((a, b) => b.priority - a.priority);
  let lane = "active";
  if (queue.active) {
    if (queue.active.priority !== 2 || queue.urgent || queue.jobs[0].priority < 3) return;
    lane = "urgent";
  }
  const job = queue.jobs.shift();
  queue[lane] = job;
  Promise.resolve().then(() => queue.context.decodeAudioData(job.raw))
    .then(job.resolve, job.reject)
    .finally(() => { queue[lane] = null; pump(queue); });
}

export function decodeAudio(context, raw, priority = 0, key = null) {
  let queue = queues.get(context);
  if (!queue) {
    queue = { context, jobs: [], active: null, urgent: null };
    queues.set(context, queue);
  }
  return new Promise((resolve, reject) => {
    queue.jobs.push({ raw, priority, key, resolve, reject });
    pump(queue);
  });
}

export function prioritizeDecode(context, key, priority) {
  const queue = queues.get(context);
  if (!queue) return;
  for (const job of queue.jobs)
    if (job.key === key) job.priority = Math.max(job.priority, priority);
  pump(queue);
}
