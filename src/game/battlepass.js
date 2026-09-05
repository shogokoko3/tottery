/**
 * バトルパス。ビンゴのように、真ん中から外へ向かって埋めていく。
 *
 *   ・真ん中の1マスは最初から空いている(フリー)
 *   ・挑戦できるのは、クリア済みのマスに縦横で隣り合うマスだけ
 *   ・進むのは「相手の駒を取ったとき」。取った駒の中身でマスごとに数える
 *   ・クリアしたマスはひっくり返せる
 *   ・裏の絵はばらばらの順序で現れ、全部めくって組み上がると手に入る
 *
 * マスの条件(CELLS の track と goal)は仮置き。中身が決まったらこの表だけ
 * 差し替えれば、進み方も画面もそのまま動く。
 */
import { byId } from "../skins/catalog.js";

/** 盤の一辺。奇数にすること(真ん中が1マスに決まる) */
export const SIZE = 5;
export const CENTER = (SIZE - 1) / 2;
export const centerId = `${CENTER}-${CENTER}`;

/** 全部そろえたときに手に入るスキン。差し替えるならここだけ */
export const REWARD_SKIN = "genie-magician";

/**
 * 進みの数え方。
 * 1手で取った駒の一覧から、それぞれいくつ増えるかを返す。
 *   any    取った枚数
 *   king   相手の王を取った回数
 *   multi  1手で2枚以上まとめて取った回数
 *   rank:X その数字を取った枚数
 */
export function gainOf(captured) {
  const list = Array.isArray(captured) ? captured : [];
  const gain = { any: list.length, king: 0, multi: list.length >= 2 ? 1 : 0 };
  for (const c of list) {
    if (!c) continue;
    if (c.wasKing) gain.king += 1;
    const key = `rank:${c.rank}`;
    gain[key] = (gain[key] || 0) + 1;
  }
  return gain;
}

/**
 * マスの並び。真ん中から開く順に、やさしいものから置いていく(仮置き)。
 *   first 真ん中の縦横4マス。いちばん先に開く
 *   near  その斜め4マス
 *   far   外側の16マス
 */
function buildCells() {
  const first = [
    ["any", 3, "駒を3枚取る"],
    ["any", 5, "駒を5枚取る"],
    ["multi", 1, "1手で2枚まとめて取る"],
    ["king", 1, "相手の王を討つ"],
  ];
  const near = [
    ["rank:2", 2, "2を2枚取る"],
    ["rank:3", 2, "3を2枚取る"],
    ["rank:4", 2, "4を2枚取る"],
    ["rank:5", 2, "5を2枚取る"],
  ];
  const far = [
    ["any", 10, "駒を10枚取る"],
    ["any", 15, "駒を15枚取る"],
    ["any", 20, "駒を20枚取る"],
    ["any", 30, "駒を30枚取る"],
    ["rank:6", 3, "6を3枚取る"],
    ["rank:7", 3, "7を3枚取る"],
    ["rank:8", 3, "8を3枚取る"],
    ["rank:9", 3, "9を3枚取る"],
    ["rank:10", 3, "10を3枚取る"],
    ["rank:J", 2, "Jを2枚取る"],
    ["rank:Q", 2, "Qを2枚取る"],
    ["rank:K", 2, "Kを2枚取る"],
    ["rank:A", 2, "Aを2枚取る"],
    ["multi", 3, "1手で2枚まとめて取る(3回)"],
    ["king", 3, "相手の王を討つ(3回)"],
    ["king", 5, "相手の王を討つ(5回)"],
  ];
  const pick = { first: 0, near: 0, far: 0 };
  const cells = [];
  for (let row = 0; row < SIZE; row++)
    for (let col = 0; col < SIZE; col++) {
      const id = `${row}-${col}`;
      if (id === centerId) {
        cells.push({ id, row, col, free: true, name: "はじまりの地" });
        continue;
      }
      const dr = Math.abs(row - CENTER);
      const dc = Math.abs(col - CENTER);
      const ring = Math.max(dr, dc);
      const group = ring > 1 ? "far" : dr + dc === 1 ? "first" : "near";
      const src = { first, near, far }[group];
      const [track, goal, name] = src[pick[group]++];
      cells.push({ id, row, col, free: false, track, goal, name, ring, group });
    }
  return cells;
}

export const CELLS = buildCells();
export const cellById = (id) => CELLS.find((c) => c.id === id) || null;

/** 1つの巡回置換にして、全片が元の位置と違う順序を必ず作る。 */
function newPuzzleOrder() {
  const order = CELLS.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * i);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
const validPuzzleOrder = (order) =>
  Array.isArray(order) &&
  order.length === CELLS.length &&
  new Set(order).size === CELLS.length &&
  order.every(
    (piece, i) =>
      Number.isSafeInteger(piece) &&
      piece >= 0 &&
      piece < CELLS.length &&
      piece !== i,
  );

/** 保存の形をそろえる。知らない id や壊れた数は落とす */
export function normalize(raw) {
  const v = raw && typeof raw === "object" ? raw : {};
  const known = new Set(CELLS.map((c) => c.id));
  const progress = {};
  for (const [id, n] of Object.entries(v.progress || {}))
    if (known.has(id) && Number.isSafeInteger(n) && n > 0) progress[id] = n;
  const keep = (list) =>
    Array.isArray(list) ? list.filter((id) => known.has(id)) : [];
  // 真ん中は最初から空いている
  const cleared = new Set([centerId, ...keep(v.cleared)]);
  const flipped = new Set(keep(v.flipped).filter((id) => cleared.has(id)));
  // 旧報酬(報酬IDの無いv1はKの天使)の受取済みでは、新報酬を塞がない。
  const claimed = v.rewardId === REWARD_SKIN && v.claimed === true;
  return {
    version: 3,
    rewardId: REWARD_SKIN,
    progress,
    cleared: [...cleared],
    flipped: [...flipped],
    puzzleOrder: validPuzzleOrder(v.puzzleOrder)
      ? [...v.puzzleOrder]
      : newPuzzleOrder(),
    // v2では受取後にも条件へ戻せた。受取済みならめくり数によらず完成扱い。
    assembled:
      claimed || (v.assembled === true && flipped.size === CELLS.length),
    claimed,
  };
}

/** 縦横に隣り合うか */
const adjacent = (a, b) =>
  Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;

/** いま挑戦できるマス。クリア済みに縦横で隣り合う、まだのマス */
export function openCells(state) {
  const done = new Set(state.cleared);
  return CELLS.filter(
    (c) =>
      !done.has(c.id) && CELLS.some((o) => done.has(o.id) && adjacent(c, o)),
  );
}

/** マス1つの様子 */
export function statusOf(cell, state) {
  const cleared = state.cleared.includes(cell.id);
  const open = !cleared && openCells(state).some((c) => c.id === cell.id);
  const now = Math.min(state.progress[cell.id] || 0, cell.goal || 0);
  return {
    ...cell,
    now,
    cleared,
    open,
    flipped: state.flipped.includes(cell.id),
    ratio: cell.goal ? now / cell.goal : 1,
  };
}

/**
 * 1手ぶんの取った駒を反映する。
 *
 * 進むのは、その時点で挑戦できるマスすべて。1手ぶんは1回だけ数える。
 * この手で新しく開いたマスは、次の手から進む。
 */
export function applyCaptures(state, captured) {
  const gain = gainOf(captured);
  const open = openCells(state);
  const progress = { ...state.progress };
  const cleared = [...state.cleared];
  let changed = false;
  for (const cell of open) {
    const add = gain[cell.track] || 0;
    if (!add) continue;
    progress[cell.id] = (progress[cell.id] || 0) + add;
    changed = true;
    if (progress[cell.id] >= cell.goal) cleared.push(cell.id);
  }
  return changed ? { ...state, progress, cleared } : state;
}

/**
 * クリアしたマスをひっくり返す。全部開くまではもう一度押すと戻せる。
 * クリアしていないマスと、全25片を開いた後の絵は返せない。
 */
export function toggleFlip(state, id) {
  if (state.assembled || allFlipped(state) || !state.cleared.includes(id))
    return state;
  const on = state.flipped.includes(id);
  return {
    ...state,
    flipped: on
      ? state.flipped.filter((x) => x !== id)
      : [...state.flipped, id],
  };
}

/** クリア済みをまとめて返す / まとめて戻す */
export function flipAll(state, on) {
  if (state.assembled || allFlipped(state)) return state;
  return { ...state, flipped: on ? [...state.cleared] : [] };
}

/** 全部クリアしたか */
export const allCleared = (state) => state.cleared.length === CELLS.length;
/** 全部ひっくり返したか。ここから絵の完成処理に進む */
export const allFlipped = (state) => state.flipped.length === CELLS.length;
/** 絵の完成処理が終わった。まだ開いていないマスがあれば変更しない。 */
export function markAssembled(state) {
  return allFlipped(state) && !state.assembled
    ? { ...state, assembled: true }
    : state;
}
/** 褒美を受け取れるか */
export const canClaim = (state) =>
  allFlipped(state) && state.assembled === true && !state.claimed;

/** 褒美のスキン。台帳に無ければ null */
export const rewardSkin = () => byId(REWARD_SKIN);

/**
 * その1手で、自分が取った相手の駒。
 *
 * 盤の駒を前後で見比べるので、ふつうの移動でも、まとめ取りでも、Aの包囲でも
 * 同じように拾える。自分の手番での変化だけを見る(道連れで消えた自分の駒は
 * 相手のものではないので入らない)。
 */
export function capturedIn(before, after, viewer) {
  if (!before || !after || before.currentTurn !== viewer) return null;
  const gone = Object.values(before.pieces || {}).filter(
    (p) =>
      p.alive &&
      p.owner !== viewer &&
      after.pieces &&
      after.pieces[p.id] &&
      after.pieces[p.id].alive === false,
  );
  return gone.length
    ? gone.map((p) => ({ rank: p.rank, wasKing: !!p.isKing }))
    : null;
}
