/**
 * バトルパス。ビンゴのように、真ん中から外へ向かって埋めていく。
 *
 *   ・真ん中の1マスは最初から空いている(フリー)
 *   ・挑戦できるのは、クリア済みのマスに縦横で隣り合うマスだけ
 *   ・進むのは「相手の駒を取ったとき」。取った駒の中身でマスごとに数える
 *   ・クリアしたマスはひっくり返せる
 *   ・裏の絵はばらばらの順序で現れ、全部めくって組み上がると手に入る
 *
 * ミッションIDは旧配置の保存キーを維持し、表示位置(row/col)とは分ける。
 * オンライン限定のマスは実際の通信対戦での撃破だけを追加する。
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
 * IDはミッション固有の保存キー(旧配置由来)。配置変更後も進捗・達成を引き継ぐ。
 * 中央の十字は少数撃破、内側の斜めは中程度、外周は特殊条件・多数撃破。
 * 同じ種類が連続しない固定配置にして、再読込のたびには動かさない。
 */
function buildCells() {
  const missions = {
    "1-2": ["any", 3, "駒を3枚取る"],
    "2-1": ["any", 5, "駒を5枚取る"],
    "2-3": ["multi", 1, "1手で2枚まとめて取る"],
    "3-2": ["king", 1, "相手の王を討つ"],
    "1-1": ["rank:2", 2, "2を2枚取る"],
    "1-3": ["rank:3", 2, "3を2枚取る"],
    "3-1": ["rank:4", 2, "4を2枚取る"],
    "3-3": ["rank:5", 2, "5を2枚取る"],
    "0-0": ["any", 10, "駒を10枚取る"],
    "0-1": ["any", 15, "駒を15枚取る"],
    "0-2": ["any", 20, "駒を20枚取る", true],
    "0-3": ["any", 30, "駒を30枚取る"],
    "0-4": ["rank:6", 3, "6を3枚取る"],
    "1-0": ["rank:7", 3, "7を3枚取る"],
    "1-4": ["rank:8", 3, "8を3枚取る"],
    "2-0": ["rank:9", 3, "9を3枚取る"],
    "2-4": ["rank:10", 3, "10を3枚取る", true],
    "3-0": ["rank:J", 2, "Jを2枚取る"],
    "3-4": ["rank:Q", 2, "Qを2枚取る"],
    "4-0": ["rank:K", 2, "Kを2枚取る"],
    "4-1": ["rank:A", 2, "Aを2枚取る"],
    "4-2": ["multi", 3, "1手で2枚まとめて取る(3回)", true],
    "4-3": ["king", 3, "相手の王を討つ(3回)", true],
    "4-4": ["king", 5, "相手の王を討つ(5回)"],
  };
  const layout = [
    ["4-4", "1-0", "2-4", "3-4", "0-3"],
    ["1-4", "0-0", "1-2", "3-1", "0-4"],
    ["3-2", "2-1", centerId, "1-1", "2-3"],
    ["4-1", "3-3", "1-3", "0-1", "4-0"],
    ["4-2", "2-0", "0-2", "3-0", "4-3"],
  ];
  return layout.flatMap((line, row) =>
    line.map((id, col) => {
      if (id === centerId)
        return { id, row, col, free: true, name: "はじまりの地" };
      const [track, goal, title, onlineOnly = false] = missions[id];
      const dr = Math.abs(row - CENTER),
        dc = Math.abs(col - CENTER);
      const ring = Math.max(dr, dc);
      return {
        id,
        row,
        col,
        free: false,
        track,
        goal,
        onlineOnly,
        name: `${onlineOnly ? "オンライン対戦で" : ""}${title}`,
        shortName: onlineOnly
          ? title
              .replace("1手で2枚まとめて取る(3回)", "2枚まとめ取り(3回)")
              .replace("相手の王を討つ", "王を討つ")
          : title,
        ring,
        group: ring > 1 ? "far" : dr + dc === 1 ? "first" : "near",
      };
    }),
  );
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
export function applyCaptures(state, captured, { online = false } = {}) {
  const gain = gainOf(captured);
  const open = openCells(state);
  const progress = { ...state.progress };
  const cleared = [...state.cleared];
  let changed = false;
  for (const cell of open) {
    if (cell.onlineOnly && !online) continue;
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
