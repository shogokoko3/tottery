export const FOIL_ACQUISITION_MS = 2350;
export const FOIL_IMAGE_TIMEOUT_MS = 2500;
export const FOIL_ACQUISITION_STEPS = Object.freeze([
  260,
  850,
  1900,
  FOIL_ACQUISITION_MS,
]);

/** The permanent foil image is revealed once; only the acquisition uses this sweep. */
export function foilAcquisitionFrame(
  elapsedMs,
  { play = true, reduce = false, ready = true, failed = false } = {},
) {
  if (!play || reduce)
    return {
      phase: "complete",
      progress: 1,
      complete: true,
      reason: "disabled",
    };
  if (failed)
    return {
      phase: "complete",
      progress: 1,
      complete: true,
      reason: "image-error",
    };
  if (!ready)
    return { phase: "waiting", progress: 0, complete: false, reason: null };
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const phase =
    elapsed < 260
      ? "normal"
      : elapsed < 850
        ? "gather"
        : elapsed < 1900
          ? "reveal"
          : elapsed < FOIL_ACQUISITION_MS
            ? "settle"
            : "complete";
  return {
    phase,
    progress: Math.max(0, Math.min(1, (elapsed - 850) / 1050)),
    complete: phase === "complete",
    reason: phase === "complete" ? "complete" : null,
  };
}

/** A few boundary timers drive the component; CSS handles the moving light. */
export function scheduleFoilAcquisition({
  onFrame,
  onComplete,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  now = () => performance.now(),
  play = true,
  reduce = false,
}) {
  const started = now();
  const timers = new Set();
  let stopped = false;
  let completed = false;
  function cancel() {
    stopped = true;
    for (const timer of timers) clearTimer(timer);
    timers.clear();
  }
  function notify(boundary = 0) {
    if (stopped || completed) return;
    // Timer resolution may fire just before its requested boundary.
    const frame = foilAcquisitionFrame(Math.max(boundary, now() - started), {
      play,
      reduce,
    });
    onFrame?.(frame);
    if (frame.complete) {
      completed = true;
      for (const timer of timers) clearTimer(timer);
      timers.clear();
      if (!stopped) onComplete?.(frame);
    }
  }
  notify();
  if (!completed) {
    for (const boundary of FOIL_ACQUISITION_STEPS) {
      const timer = setTimer(() => {
        timers.delete(timer);
        notify(boundary);
      }, boundary);
      timers.add(timer);
    }
  }
  return cancel;
}
