import { RANKS } from "./constants.js";
export const noteSquare = (p) => `${p.row},${p.col}`;
export function cleanNote(note) {
  const ranks = RANKS.filter((r) => note?.ranks?.includes(r));
  return {
    ranks,
    king: note?.king === true,
    counter: note?.counter === true,
    text: typeof note?.text === "string" ? note.text.trim().slice(0, 40) : "",
  };
}
export const hasNote = (n) =>
  !!(n && (n.ranks.length || n.king || n.counter || n.text));
export function noteTarget(state, square, viewer) {
  if (![0, 1].includes(viewer) || state.phase !== "play") return false;
  const [row, col] = square.split(",").map(Number),
    p = state.board[row]?.[col];
  return !!p?.alive && p.owner !== viewer && !p.revealed;
}
// メモはマスに結び付ける。隠された駒ID・数字・シャッフル順では追跡しない。
export function advanceNotes(notes, before, after, viewer) {
  if (after.phase !== "play" || ![0, 1].includes(viewer)) return {};
  const next = { ...notes };
  if (after.lastSwap && after.lastSwap !== before.lastSwap) {
    for (const cell of after.lastSwap.cells) delete next[noteSquare(cell)];
  } else if (after.lastMove && after.lastMove !== before.lastMove) {
    const move = after.lastMove,
      from = noteSquare(move.from),
      to = noteSquare(move.to);
    const note = next[from];
    delete next[from];
    delete next[to];
    if (note && move.owner !== viewer) next[to] = note;
  }
  for (const square of Object.keys(next))
    if (!noteTarget(after, square, viewer)) delete next[square];
  return next;
}
