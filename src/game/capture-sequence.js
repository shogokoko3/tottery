// Timing shared by the board, renderer and sound. No hidden rank/king information
// is consulted until the back has completely broken apart.
export function captureMoveMs(move) {
  if (!move?.from || !move?.to) return 0;
  const dr = Math.abs(move.to.row - move.from.row);
  const dc = Math.abs(move.to.col - move.from.col);
  if (!dr && !dc) return 0;
  if ((dr === 1 && dc === 2) || (dr === 2 && dc === 1)) return 350;
  return dr && dc ? 280 : 260;
}

export function captureTiming(move, count = 1, reduced = false) {
  const hit = captureMoveMs(move);
  const q = reduced
    ? {
        hit,
        lift: hit,
        ready: hit,
        crack: hit + 80,
        melt: hit + 180,
        reveal: hit + 360,
      }
    : {
        hit,
        lift: hit + 90,
        ready: hit + 320,
        crack: hit + 430,
        melt: hit + 950,
        reveal: hit + 1590,
      };
  return { ...q, gap: reduced ? 320 : 520, count, reduced };
}

export function captureFrame(t, q, cards) {
  const shown = Math.min(
    q.count,
    Math.max(0, 1 + Math.floor((t - q.reveal) / q.gap)),
  );
  const index = shown - 1;
  // The unrevealed cards are deliberately not inspected here.
  const king = index >= 0 && !!cards[index]?.isKing;
  const at = q.reveal + index * q.gap;
  const royal = king && t >= at + 220;
  const collect = at + (king ? 1100 : 650);
  const done = shown === q.count && t >= collect + 280;
  const collected = done ? shown : Math.max(0, shown - 1);
  return { shown, collected, index, king, royal, at, collect, done };
}

export function captureCues(q) {
  if (q.reduced)
    return [
      [q.hit, "hit"],
      [q.reveal, "open"],
    ];
  return [
    [q.hit * 0.24, "dash"],
    [q.hit, "hit"],
    [q.crack, "crack"],
    [q.crack + 32, "charge"],
    [q.crack + 175, "crack2"],
    [q.crack + 325, "crack3"],
    [q.melt - 85, "hush"],
    [q.melt, "break"],
    [q.reveal, "open"],
  ];
}

export function capturedCells(cells = [], capturedBy) {
  // Counterattack victims are presented by their ability sequence, after reveal.
  return cells
    .filter((c) => c.owner !== capturedBy)
    .map(({ row, col, owner }) => ({ row, col, owner }));
}
