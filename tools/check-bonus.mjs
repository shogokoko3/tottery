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
import {
  isStraight,
  isFlush,
  fortressCorner,
  twinWingsMatch,
  FORMATIONS,
  formationMatch,
  matchFormations,
} from "../src/game/bonus.js";

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

/**
 * サイコロと引き直しを通して、布陣の場面まで進める。
 *
 * reducer が「その手を受け取ってよい場面か」を見るようになったので、
 * 途中を飛ばして布陣の確定だけ送ることはできない(通信で飛ばされると
 * 相手の対局を巻き戻せてしまうため、わざと塞いである)。
 * 目は 6 と 1 に固定する。乱数のままだと先手が毎回変わり、
 * 「先手と後手が入れ替わる」の検査が当てにならない
 */
function toSetup(s) {
  let guard = 0;
  while (s.phase !== "setup" && guard++ < 60) {
    if (s.interstitial) {
      s = reducer(s, { type: "DISMISS_INTERSTITIAL" });
      continue;
    }
    if (s.phase === "dice")
      s = reducer(
        s,
        s.dice[s.diceIdx] === null
          ? { type: "ROLL_DICE_SINGLE", value: s.diceIdx === 0 ? 6 : 1 }
          : s.diceIdx === 2
            ? { type: "GOTO_MULLIGAN" }
            : s.diceIdx === 3
              ? { type: "REROLL_DICE" }
              : { type: "NEXT_DICE_STEP" },
      );
    else if (s.phase === "mulligan")
      s = reducer(s, { type: "CONFIRM_MULLIGAN", discardIds: [] });
    else break;
  }
  return s;
}

/** 山を積んで布陣まで進める。placeCount 枚を自陣に順に並べる */
function play(setup, order = [0, 1]) {
  let s = toSetup(
    reducer(
      { phase: "intro" },
      {
        type: "START_SETUP",
        size: setup.size,
        setupMode: "simultaneous",
        deck: setup.deck,
        handSize: setup.handSize,
      },
    ),
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
    "誰の布陣が揃ったかと、効果の両方を記録に残す",
    [
      s.log.some((l) => l.includes("赤の布陣はストレート!")),
      s.log.some((l) => l.includes("先手と後手が入れ替わった")),
      s.log.some((l) => l.includes("青の布陣はストレート!")),
    ],
    [true, true, false],
  );
}
{
  const s = play(stack(S5, S5B, 5));
  is("両者ストレート", s.setupEffects.straights, [true, true]);
  is("両者ストレートなら入れ替えない", s.setupEffects.swapped, false);
  is(
    "両者ストレートなら、そのままだと伝える",
    [
      s.log.some((l) => l.includes("入れ替わった")),
      s.log.some((l) => l.includes("両者ストレートのため、先手はそのまま")),
    ],
    [false, true],
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
    "誰の布陣がフラッシュかと、公開枚数を記録に残す",
    s.log.some((l) =>
      l.includes("赤の布陣はフラッシュ! 青の駒が1枚公開された"),
    ),
    true,
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

console.log("隅の要塞");
{
  const army = (cells, kingIdx, owner = 0) =>
    Object.fromEntries(
      cells.map(([row, col], i) => [
        `${owner}p${i}`,
        { id: `${owner}p${i}`, row, col, owner, alive: true, isKing: i === kingIdx },
      ]),
    );
  const block = (rows, col0) =>
    rows.flatMap((row) => [0, 1, 2].map((d) => [row, col0 + d]));
  const left = block([6, 7, 8], 0); // 赤(下)の左隅。最後の [8,0] が奥の隅
  is("左隅に王を奥で組む", fortressCorner(army(left, 6), 9, 0), 0);
  is("王が奥の隅でなければ要塞ではない", fortressCorner(army(left, 7), 9, 0), null);
  is("王が前列なら要塞ではない", fortressCorner(army(left, 0), 9, 0), null);
  is("右隅も要塞", fortressCorner(army(block([6, 7, 8], 6), 8), 9, 0), 6);
  is("隅から1列ずれると要塞ではない", fortressCorner(army(block([6, 7, 8], 1), 6), 9, 0), null);
  is("青(上)は0行目の隅が奥", fortressCorner(army(block([0, 1, 2], 0), 0, 1), 9, 1), 0);
  is("青の王が2行目なら要塞ではない", fortressCorner(army(block([0, 1, 2], 0), 6, 1), 9, 1), null);
  const dead = army(left, 6);
  dead["0p1"] = { ...dead["0p1"], alive: false };
  is("倒れた駒があれば要塞ではない", fortressCorner(dead, 9, 0), null);
  is("5×5には無い", fortressCorner(army(block([3, 4], 0).slice(0, 5), 4), 5, 0), null);
  const both = { ...army(left, 6, 0), ...army(block([0, 1, 2], 6), 2, 1) };
  is("相手の駒が混ざっていても自分の側だけ見る", fortressCorner(both, 9, 0), 0);
  is("相手側(右隅)も判定できる", fortressCorner(both, 9, 1), 6);
}

console.log("双翼の陣");
{
  // 赤(下): 前列6行目 Q J J Q、中列7行目 8 2 4 . 10、後列8行目 [10]。dx=3 から
  const layout = (dx, mirror = false, owner = 0, kingIdx = 8, rankAt = null) => {
    const spec = [[6, 0, "Q"], [6, 1, "J"], [6, 2, "J"], [6, 3, "Q"], [7, 0, "8"], [7, 1, "2"], [7, 2, "4"], [7, 4, "10"], [8, 2, "10"]];
    const pieces = {};
    spec.forEach(([row, c, rank], i) => {
      const col = mirror ? 8 - (c + dx) : c + dx;
      const r = owner === 0 ? row : 8 - row;
      pieces[`w${i}`] = { id: `w${i}`, row: r, col, owner, alive: true, isKing: i === kingIdx, rank: rankAt && rankAt[i] ? rankAt[i] : rank };
    });
    return pieces;
  };
  const st = (pieces, area = "sky", owner = 0) => ({ boardSize: 9, pieces, areas: owner === 0 ? [{ type: area }, null] : [null, { type: area }] });
  is("空で決まった形なら一致", twinWingsMatch(st(layout(3)), 0), { mirror: false, dx: 3 });
  is("横にずらしても同じ形", twinWingsMatch(st(layout(0)), 0), { mirror: false, dx: 0 });
  is("鏡写しも同じ形", twinWingsMatch(st(layout(2, true)), 0), { mirror: true, dx: 2 });
  is("青(上)でも判定できる", twinWingsMatch(st(layout(3, false, 1), "sky", 1), 1), { mirror: false, dx: 3 });
  is("空でなければ出ない", twinWingsMatch(st(layout(3), "ice"), 0), null);
  is("エリア無しでは出ない", twinWingsMatch({ boardSize: 9, pieces: layout(3), areas: [null, null] }, 0), null);
  is("王が中列の10なら違う", twinWingsMatch(st(layout(3, false, 0, 7)), 0), null);
  is("1枚でも違う札なら違う", twinWingsMatch(st(layout(3, false, 0, 8, { 4: "3" })), 0), null);
  const off = layout(3);
  off.w0 = { ...off.w0, row: 7, col: 8 };
  is("1枚でも位置が違えば違う", twinWingsMatch(st(off), 0), null);
  is("5×5には無い", twinWingsMatch({ ...st(layout(0)), boardSize: 5 }, 0), null);
}

console.log("継承の狩り・消去法の詰め");
{
  const build = (def, { dx = 0, mirror = false, owner = 0, area = def.area, tweak = null } = {}) => {
    const pieces = {};
    def.cells.forEach(([depth, c, rank, king], i) => {
      const col = mirror ? 8 - (c + dx) : c + dx;
      const row = owner === 0 ? 6 + depth : 2 - depth;
      pieces[`f${i}`] = { id: `f${i}`, row, col, owner, alive: true, isKing: !!king, rank };
    });
    if (tweak) tweak(pieces);
    return { boardSize: 9, pieces, areas: owner === 0 ? [{ type: area }, null] : [null, { type: area }] };
  };
  const earth = FORMATIONS.find((d) => d.id === "heir-hunt"), forest = FORMATIONS.find((d) => d.id === "elimination");
  is("型は5つ", FORMATIONS.map((d) => d.id), ["twin-wings", "heir-hunt", "elimination", "kamikaze", "royal-road"]);
  const pal = FORMATIONS.find((d) => d.id === "royal-road");
  is("昇格の砦: 宮殿で決まった形なら一致", formationMatch(build(pal, { dx: 1 }), 0, pal), { mirror: false, dx: 1 });
  is("昇格の砦: 鏡写しも一致", formationMatch(build(pal, { dx: 0, mirror: true }), 0, pal), { mirror: true, dx: 0 });
  is("昇格の砦: 宮殿でなければ出ない", formationMatch(build(pal, { dx: 1, area: "sky" }), 0, pal), null);
  is("昇格の砦: 王がQなら違う", formationMatch(build(pal, { dx: 1, tweak: (p) => { p.f8.rank = "Q"; } }), 0, pal), null);
  const sea = FORMATIONS.find((d) => d.id === "kamikaze");
  is("道連れの特攻: 海で決まった形なら一致", formationMatch(build(sea, { dx: 0 }), 0, sea), { mirror: false, dx: 0 });
  is("道連れの特攻: 横にずらしても一致", formationMatch(build(sea, { dx: 4 }), 0, sea), { mirror: false, dx: 4 });
  is("道連れの特攻: 鏡写しも一致", formationMatch(build(sea, { dx: 2, mirror: true }), 0, sea), { mirror: true, dx: 2 });
  is("道連れの特攻: 海でなければ出ない", formationMatch(build(sea, { area: "sky" }), 0, sea), null);
  is("道連れの特攻: 王が前列の4なら違う", formationMatch(build(sea, { tweak: (p) => { p.f7.isKing = false; p.f2.isKing = true; } }), 0, sea), null);
  is("道連れの特攻: 5では違う", formationMatch(build(sea, { tweak: (p) => { for (const k of Object.keys(p)) if (p[k].rank === "4") p[k].rank = "5"; } }), 0, sea), null);
  is("継承の狩り: 土で決まった形なら一致", formationMatch(build(earth, { dx: 3 }), 0, earth), { mirror: false, dx: 3 });
  is("継承の狩り: 鏡写しも一致", formationMatch(build(earth, { dx: 1, mirror: true }), 0, earth), { mirror: true, dx: 1 });
  is("継承の狩り: 土でなければ出ない", formationMatch(build(earth, { dx: 3, area: "forest" }), 0, earth), null);
  is("継承の狩り: 王が後列の2なら違う", formationMatch(build(earth, { dx: 3, tweak: (p) => { p.f4.isKing = false; p.f6.isKing = true; } }), 0, earth), null);
  is("消去法の詰め: 森で左隅なら一致", formationMatch(build(forest), 0, forest), { mirror: false, dx: 0 });
  is("消去法の詰め: 右隅(鏡写し)も一致", formationMatch(build(forest, { mirror: true }), 0, forest), { mirror: true, dx: 0 });
  is("消去法の詰め: 隅からずれると違う", formationMatch(build(forest, { dx: 1 }), 0, forest), null);
  is("消去法の詰め: 青(上)でも判定できる", formationMatch(build(forest, { owner: 1 }), 1, forest), { mirror: false, dx: 0 });
  is("消去法の詰め: 7王では違う", formationMatch(build(forest, { tweak: (p) => { p.f6.rank = "7"; } }), 0, forest), null);
  is("matchFormations は組めた型だけ返す", matchFormations(build(forest), 0).map((h) => h.def.id), ["elimination"]);
  is("matchFormations: 何も組めていなければ空", matchFormations(build(forest, { dx: 1 }), 0), []);
}

console.log(`\n${ok} ok / ${fails.length} fail`);
if (fails.length) process.exit(1);
