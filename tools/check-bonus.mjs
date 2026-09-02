/**
 * 布陣ボーナスを検査する。
 *
 *   ストレート … 先手と後手が入れ替わる。両者そろえば元に戻る
 *   フラッシュ … 相手の王以外の駒が公開される(5×5は1枚、9×9は3枚)
 *
 * 判定は盤に出した札すべてで行う。5×5なら5枚、9×9なら9枚。
 * 公開する駒は乱数で選ばないので、確定の順番を入れ替えても同じ駒が出る。
 */
import { reducer, autoPickKing } from "../src/game/reducer.js";
import { buildDeck, territoryRows, totalSlots } from "../src/game/board.js";
import { isStraight, isFlush } from "../src/game/bonus.js";

let ok = 0;
const fails = [];
function is(label, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) {
    ok++;
    console.log(`  ok   ${label}`);
  } else {
    fails.push(`${label}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`);
    console.log(
      `  NG   ${label}  ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`,
    );
  }
}

/** 好きな札を手札の先頭に積んだ山を作る */
function stack(hand0, hand1, size) {
  const full = buildDeck(null);
  const take = (spec) =>
    spec.map(([rank, suit]) => {
      const i = full.findIndex((c) => c.rank === rank && c.suit === suit);
      if (i < 0) throw new Error(`${rank}${suit} が無い`);
      return full.splice(i, 1)[0];
    });
  const h0 = take(hand0);
  const h1 = take(hand1);
  const handSize = Math.max(h0.length, h1.length);
  while (h0.length < handSize) h0.push(full.shift());
  while (h1.length < handSize) h1.push(full.shift());
  return { deck: [...h0, ...h1, ...full], handSize, size };
}

/** 山を積んで布陣まで進める。placeCount 枚を自陣に順に並べる */
function play(setup, order = [0, 1]) {
  let s = reducer(
    { phase: "intro" },
    {
      type: "START_SETUP",
      size: setup.size,
      setupMode: "simultaneous",
      deck: setup.deck,
      handSize: setup.handSize,
    },
  );
  const slots = totalSlots(setup.size);
  const acts = [0, 1].map((i) => {
    const [lo] = territoryRows(setup.size, i);
    const placement = {};
    s.players[i].hand.slice(0, slots).forEach((c, n) => {
      placement[c.id] = {
        row: lo + Math.floor(n / setup.size),
        col: n % setup.size,
      };
    });
    return {
      type: "SETUP_CONFIRM",
      player: i,
      placement,
      kingId: autoPickKing(s, i, placement),
    };
  });
  for (const i of order) s = reducer(s, acts[i]);
  return s;
}

const S5 = [
  ["2", "spade"],
  ["3", "heart"],
  ["4", "diamond"],
  ["5", "club"],
  ["6", "spade"],
];
const NOT5 = [
  ["2", "heart"],
  ["4", "club"],
  ["7", "spade"],
  ["9", "diamond"],
  ["K", "heart"],
];
const NOT5B = [
  ["3", "spade"],
  ["6", "heart"],
  ["8", "diamond"],
  ["10", "club"],
  ["Q", "spade"],
];
const F5 = [
  ["2", "club"],
  ["5", "club"],
  ["8", "club"],
  ["J", "club"],
  ["K", "club"],
];

const S5B = [
  ["8", "heart"],
  ["9", "club"],
  ["10", "spade"],
  ["J", "diamond"],
  ["Q", "heart"],
];

console.log("ストレート");
{
  const plain = play(stack(NOT5, NOT5B, 5));
  const s = play(stack(S5, NOT5, 5));
  is("ストレートとして数えている", s.setupEffects.straights, [true, false]);
  is("入れ替えたと記録している", s.setupEffects.swapped, true);
  is("先手と後手が入れ替わる", s.currentTurn, 1 - plain.currentTurn);
  is(
    "記録には効果だけが残り、ストレートとは書かない",
    [
      s.log.some((l) => l.includes("先手と後手が入れ替わった")),
      s.log.some((l) => l.includes("ストレート")),
    ],
    [true, false],
  );
}
{
  const s = play(stack(S5, S5B, 5));
  is("両者ストレート", s.setupEffects.straights, [true, true]);
  is("両者ストレートなら入れ替えない", s.setupEffects.swapped, false);
  is(
    "両者ストレートなら記録にも残さない",
    s.log.some((l) => l.includes("入れ替わった")),
    false,
  );
}

console.log("フラッシュ");
{
  const s = play(stack(F5, NOT5, 5));
  const shown = Object.values(s.pieces).filter((p) => p.revealed);
  is("フラッシュとして数えている", s.setupEffects.flushes, [true, false]);
  is("公開は1枚", shown.length, 1);
  is(
    "公開されるのは相手の駒",
    shown.every((p) => p.owner === 1),
    true,
  );
  is(
    "王は公開されない",
    shown.every((p) => !p.isKing),
    true,
  );
  is(
    "盤の駒も公開されている",
    shown.every((p) => s.board[p.row][p.col].revealed === true),
    true,
  );
  is(
    "記録には効果だけが残り、フラッシュとは書かない",
    [
      s.log.some((l) => l.includes("駒が1枚公開された")),
      s.log.some((l) => l.includes("フラッシュ")),
    ],
    [true, false],
  );
}
{
  const a = play(stack(F5, NOT5, 5), [0, 1]);
  const b = play(stack(F5, NOT5, 5), [1, 0]);
  const ids = (s) =>
    Object.values(s.pieces)
      .filter((p) => p.revealed)
      .map((p) => p.id)
      .sort();
  is("確定の順番を変えても同じ駒が公開される", ids(a), ids(b));
  is("確定の順番を変えても先手は同じ", a.currentTurn, b.currentTurn);
}

console.log("9×9");
{
  const S9 = "A,2,3,4,5,6,7,8,9"
    .split(",")
    .map((r, i) => [r, ["spade", "heart", "diamond", "club"][i % 4]]);
  const F9 = "2,4,6,8,10,J,Q,K,A".split(",").map((r) => [r, "diamond"]);
  // S9・F9 と札がぶつからず、ストレートでもフラッシュでもない並び
  const NOT9 = [
    ["10", "heart"],
    ["J", "heart"],
    ["K", "heart"],
    ["3", "club"],
    ["5", "club"],
    ["7", "club"],
    ["9", "club"],
    ["Q", "club"],
    ["2", "spade"],
  ];
  is(
    "9枚のストレートを見る",
    isStraight(S9.map(([rank, suit]) => ({ rank, suit }))),
    true,
  );
  is(
    "9枚のフラッシュを見る",
    isFlush(F9.map(([rank, suit]) => ({ rank, suit }))),
    true,
  );
  const s = play(stack(F9, NOT9, 9));
  const shown = Object.values(s.pieces).filter((p) => p.revealed);
  is("9×9の公開は3枚", shown.length, 3);
  is(
    "王は公開されない",
    shown.every((p) => !p.isKing),
    true,
  );
  const t = play(stack(S9, NOT9, 9));
  is("9枚のストレートで入れ替わる", t.setupEffects.swapped, true);
}

console.log("効果が無ければ知らせない");
{
  const s = play(stack(NOT5, NOT5B, 5));
  is("何も起きない", s.setupEffects, null);
}

console.log(`\n${ok} ok / ${fails.length} fail`);
if (fails.length) process.exit(1);
