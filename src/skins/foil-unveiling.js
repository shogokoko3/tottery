// Gacha reveals the identity of an already-foiled card. Crafting keeps its
// separate normal-to-foil acquisition animation.
export function foilUnveilingPlan(legend = false, fromGrid = false) {
  const unveiling = legend
    ? { seal: 1800, hush: 3200, reveal: 4200, settle: 5000, complete: 6450 }
    : { seal: 1300, hush: 1850, reveal: 2850, settle: 3600, complete: 5000 };
  return fromGrid
    ? {
        lift: 700,
        gather: 1800,
        ...Object.fromEntries(
          Object.entries(unveiling).map(([phase, time]) => [
            phase,
            time + 1800,
          ]),
        ),
      }
    : unveiling;
}

export function foilUnveilingFrame(
  elapsed,
  { legend = false, reduce = false, fromGrid = false } = {},
) {
  const plan = foilUnveilingPlan(legend, fromGrid);
  const phase =
    reduce || elapsed >= plan.complete
      ? "complete"
      : elapsed >= plan.settle
        ? "settle"
        : elapsed >= plan.reveal
          ? "reveal"
          : elapsed >= plan.hush
            ? "hush"
            : elapsed >= plan.seal
              ? "seal"
              : fromGrid && elapsed < plan.lift
                ? "select"
                : fromGrid && elapsed < plan.gather
                  ? "lift"
                  : "gather";
  return {
    phase,
    identityVisible: ["reveal", "settle", "complete"].includes(phase),
    complete: phase === "complete",
  };
}

export function scheduleFoilUnveiling({
  legend = false,
  reduce = false,
  fromGrid = false,
  onFrame,
  onComplete,
  now = () => performance.now(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  const start = now(),
    timers = new Set();
  let stopped = false;
  const cancel = () => {
    stopped = true;
    timers.forEach(clearTimer);
    timers.clear();
  };
  const notify = (boundary = 0) => {
    if (stopped) return;
    const frame = foilUnveilingFrame(Math.max(boundary, now() - start), {
      legend,
      reduce,
      fromGrid,
    });
    onFrame?.(frame);
    if (frame.complete && !stopped) {
      cancel();
      onComplete?.();
    }
  };
  notify();
  if (!stopped)
    for (const boundary of Object.values(foilUnveilingPlan(legend, fromGrid))) {
      const timer = setTimer(() => {
        timers.delete(timer);
        notify(boundary);
      }, boundary);
      timers.add(timer);
    }
  return cancel;
}
