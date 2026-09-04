/**
 * チュートリアル。
 *
 * 台本は完全に固定で、山札もサイコロの目も引き直す札も、相手の指し手も決まっている。
 * プレイヤーは指示された操作だけを行うので、**毎回まったく同じ盤面**になる。
 *
 * 台本の1枚(step)は次の形をとる。
 *   text   短い説明。2行までに収める
 *   need   プレイヤーにやってほしい操作。無ければ「次へ」で読み進めるだけ
 *   focus  光らせる場所(手札のカード・盤のマス・盤の駒・確定ボタン)
 *   at     出す場面の条件。無ければ前の step が終わり次第すぐ出す
 *   end    最後の1枚。閉じるとチュートリアルを抜ける
 */
import { CARD_POOLS, PLAYER_META, SUITS } from "./constants.js";

const SUIT_OF = { S: "spade", H: "heart", D: "diamond", C: "club" };

/** "10S" のような並びから、順番の決まった山札を組む */
function deckOf(codes) {
  return codes.map((code, i) => ({
    id: `t${i}`,
    rank: code.slice(0, -1),
    suit: SUIT_OF[code.slice(-1)],
  }));
}

/** 使わなかったカードを予備札として後ろに足す */
function fill(codes, pool) {
  const used = new Set(codes);
  const rest = [];
  for (const suit of SUITS)
    for (const rank of pool) {
      const code = `${rank}${suit[0].toUpperCase()}`;
      if (!used.has(code)) rest.push(code);
    }
  return deckOf([...codes, ...rest]);
}

/** 山札の中から札を探して id を返す。"7H" のような並びで指す */
function idOf(deck, code) {
  const rank = code.slice(0, -1);
  const suit = SUIT_OF[code.slice(-1)];
  const card = deck.find((c) => c.rank === rank && c.suit === suit);
  if (!card) throw new Error(`${code} が山札に無い`);
  return card.id;
}

/**
 * 予備札の山。末尾が「Kの力で最初に出てくる1枚」になる。
 *
 * 引き直しは先頭から引き(reducer の CONFIRM_MULLIGAN)、Kの力は末尾から
 * 引く(removePiece の reserve.pop)。既定の並びだと末尾がクラブのKなので、
 * 「Kは王にするときだけ1枚」と教えた直後に2枚目のKを渡すことになる。
 * 採用枚数の判定は布陣のときしか働かないので、盤にKが2枚並んでしまう。
 */
function reserveEndingPlain(deck, handSize) {
  const rest = deck.slice(handSize * 2).map((c) => c.id);
  const plain = deck.find(
    (c) => rest.includes(c.id) && !["A", "J", "Q", "K"].includes(c.rank),
  );
  if (!plain) return rest;
  return [...rest.filter((id) => id !== plain.id), plain.id];
}

/**
 * 引き直しの山の並び。
 *
 * 相手が先に引き直すので、その枚数だけ先に消える。狙いの札は
 * そのぶん後ろに置かないと、相手が持っていってしまう。
 */
function reserveWith(deck, foeDraws, wanted) {
  const rest = deck.slice(14).map((c) => c.id);
  const wantedIds = wanted.map((code) => idOf(deck, code));
  const others = rest.filter((id) => !wantedIds.includes(id));
  return [
    ...others.slice(0, foeDraws),
    ...wantedIds,
    ...others.slice(foeDraws),
  ];
}

/* ---------------- 場面の見分け方 ---------------- */

const atMulligan = (s) => s.phase === "mulligan" && s.mulliganIdx === 0;
const atPlace = (s) => s.phase === "setup" && s.setupSteps[0] === "place";
const atKing = (s) => s.phase === "setup" && s.setupSteps[0] === "king";
const myTurn = (s) => s.phase === "play" && s.currentTurn === 0;
const atEnd = (s) => s.phase === "gameover";
/** こちらの番に戻ってから出す。決着していればいつでも出す */
const myTurnOrEnd = (s) =>
  s.phase === "gameover" ||
  (s.phase === "play" && s.currentTurn === 0 && !s.captureReveal);

/* ---------------- 第1話 ---------------- */

/**
 * はじめの一局。
 *
 * 覚えることを「一局を終える」だけに絞ってある。サイコロ、引き直し、
 * 布陣、王を決める、駒を動かす、相手を取る、相手の王を討つ。ここまで。
 *
 * 王位の継承も道連れも、この回では起こらない。相手の王を 2♦ にして、
 * 相手の軍に2をもう1枚置かないので継承が起きない。王が4でも5でも
 * ないので道連れも起きない。「王を取られたら負け」と言った同じ回で
 * 「取られたけど負けていない」を見せると、初めての人には矛盾に映る。
 * その2つは第2話でまとめて扱う。
 */
const EP1_DECK = fill(
  [
    // あなたの手札6枚。5♥ が余分
    "2S",
    "3S",
    "4S",
    "5S",
    "2H",
    "5H",
    // 相手の手札6枚。王は 2♦。2 はこの1枚だけなので王位を継ぐ駒がいない
    "2D",
    "3D",
    "4D",
    "5D",
    "3H",
    "4H",
  ],
  CARD_POOLS.basic,
);

const EP1 = {
  id: 1,
  level: 1,
  // 終えると入る経験値。次のレベルまでちょうど届く量にして、1話ずつ開く
  xp: 100,
  title: "第1話 はじめの一局",
  subtitle: "並べて、動かして、王を討つ",
  pool: CARD_POOLS.basic,
  poolLabel: "2 〜 5",
  boardSize: 5,
  handSize: 6,
  // あなたが先手。はじめの回は待たせない
  dice: [6, 2],
  deck: EP1_DECK,
  reserveOrder: EP1_DECK.slice(12).map((c) => c.id),
  foe: {
    discardIds: [],
    // 王は c5 の 2♦
    //
    // 4♦ を c4 に置く。ここから c3 へ降りてくるので、王の 4♠ は素の射程
    // (縦横2マス)だけで討ち取れる。4・5の王は自分の距離が伸びないので、
    // ここは素の動きだけで話が済む(伸びるのは王以外の同じ数字のほう)
    placement: {
      t6: { row: 0, col: 2 },
      t8: { row: 1, col: 2 },
      t7: { row: 0, col: 0 },
      t9: { row: 1, col: 0 },
      t10: { row: 0, col: 4 },
    },
    kingId: "t6",
    // こちらの駒を取りには来ない
    moves: [
      { pieceId: "t8", row: 2, col: 2 },
      { pieceId: "t10", row: 1, col: 3 },
    ],
  },
  steps: [
    {
      text: "相手の王を取れば勝ちです。まずサイコロで先手を決めます。",
      need: { type: "ROLL_DICE_SINGLE" },
      focus: { button: true },
    },
    {
      at: atMulligan,
      text: "いらない札は捨てて引き直せます。5 は 5♠ で足りるので、光った 5♥ をタップ。",
      need: { type: "TOGGLE_MULLIGAN_CARD", cardId: "t5" },
      focus: { cards: ["t5"] },
    },
    {
      text: "「引き直して確定」を押します。",
      need: { type: "CONFIRM_MULLIGAN" },
      focus: { button: true },
    },
    {
      at: atPlace,
      text: "6枚から5枚を自陣にならべます。4♠ は縦横に2マスまで。光ったマス c1 へ。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t2", row: 4, col: 2 },
      focus: { cards: ["t2"], cells: [{ row: 4, col: 2 }] },
    },
    {
      text: "5♠ を c2 へ。カードを持つと、動ける先が光ります。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t3", row: 3, col: 2 },
      focus: { cards: ["t3"], cells: [{ row: 3, col: 2 }] },
    },
    {
      text: "2♠ を b1 へ。2は縦横に1マス動けます。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t0", row: 4, col: 1 },
      focus: { cards: ["t0"], cells: [{ row: 4, col: 1 }] },
    },
    {
      text: "3♠ を d1 へ。3は斜めに1マス。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t1", row: 4, col: 3 },
      focus: { cards: ["t1"], cells: [{ row: 4, col: 3 }] },
    },
    {
      text: "2♥ を a1 へ。これで5枚そろいます。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t4", row: 4, col: 0 },
      focus: { cards: ["t4"], cells: [{ row: 4, col: 0 }] },
    },
    {
      text: "「王を選ぶ」を押します。",
      need: { type: "SETUP_GOTO_KING_STEP" },
      focus: { button: true },
    },
    {
      at: atKing,
      text: "取られたら負けの1枚を決めます。光った c1 の 4♠ をタップ。",
      need: { type: "SETUP_PICK_KING", cardId: "t2" },
      focus: { cells: [{ row: 4, col: 2 }] },
    },
    {
      text: "「布陣を確定」を押します。",
      need: { type: "SETUP_CONFIRM" },
      focus: { button: true },
    },
    {
      at: myTurn,
      text: "駒をタップしてから、光ったマスをタップして動かします。",
    },
    {
      text: "c2 の 5♠ は斜めに2マス。a4 の相手を取ります。",
      need: { type: "MOVE_PIECE", pieceId: "t3", row: 1, col: 0 },
      focus: {
        cells: [
          { row: 3, col: 2 },
          { row: 1, col: 0 },
        ],
      },
    },
    {
      at: myTurn,
      text: "取る手には必ず確認が出ます。相手の札は取るまで分かりません。王がどれかも同じです。",
    },
    {
      text: "王も動かせます。c1 の 4♠ を c3 へ。2マス進んで相手を取ります。",
      need: { type: "MOVE_PIECE", pieceId: "t2", row: 2, col: 2 },
      focus: {
        cells: [
          { row: 4, col: 2 },
          { row: 2, col: 2 },
        ],
      },
    },
    {
      at: myTurn,
      text: "ここでは教えます。2マス先が相手の王です。4♠ を c5 へ。",
      need: { type: "MOVE_PIECE", pieceId: "t2", row: 0, col: 2 },
      focus: {
        cells: [
          { row: 2, col: 2 },
          { row: 0, col: 2 },
        ],
      },
    },
    {
      at: atEnd,
      text: "相手の王を討って勝ちです。これが一局の流れです。",
      end: true,
    },
  ],
};

/* ---------------- 第2話 ---------------- */

/**
 * 王位の継承。
 *
 * 自分の王が取られて、自分の駒が継ぐ。受け身ではなく自分の側で起きるので、
 * 「取られても終わらない」がそのまま手に残る。
 *
 * 王は 2♠。同じ 2♥ を軍に入れてあるので、王が倒れると 2♥ が継ぐ。
 * 継ぐ駒は1枚だけにしてあるので、選ぶ画面は出ない。
 *
 * 道連れはこの回では起こらない。相手の王を 2♦ にしてあるので、
 * 4 や 5 を取っても巻き添えは出ない。道連れは第3話で扱う。
 */
const EP2_DECK = fill(
  [
    // あなたの手札6枚。2 が2枚あるのが今回の鍵。5♥ が余分
    "2S",
    "2H",
    "3S",
    "4S",
    "5S",
    "5H",
    // 相手の手札6枚。王は 2♦。王が4でも5でもないので道連れは起きない
    "2D",
    "3D",
    "4D",
    "5D",
    "3H",
    "4H",
  ],
  CARD_POOLS.basic,
);

const EP2 = {
  id: 2,
  level: 2,
  // 終えると入る経験値。次のレベルまでちょうど届く量にして、1話ずつ開く
  xp: 300,
  title: "第2話 王が継ぐ",
  subtitle: "王を取られても、終わらない",
  pool: CARD_POOLS.basic,
  poolLabel: "2 〜 5",
  boardSize: 5,
  handSize: 6,
  dice: [6, 2],
  deck: EP2_DECK,
  reserveOrder: EP2_DECK.slice(12).map((c) => c.id),
  foe: {
    discardIds: ["t11"],
    // 王は c5 の 2♦
    placement: {
      t6: { row: 0, col: 2 },
      t7: { row: 1, col: 3 },
      t8: { row: 0, col: 1 },
      t9: { row: 1, col: 1 },
      t10: { row: 1, col: 4 },
    },
    kingId: "t6",
    moves: [
      // こちらの王を取りに来る手。ここで王位の継承が起きる
      { pieceId: "t7", row: 2, col: 2 },
      { pieceId: "t10", row: 2, col: 3 },
    ],
  },
  steps: [
    {
      text: "王を取られても、負けないことがあります。まずサイコロを。",
      need: { type: "ROLL_DICE_SINGLE" },
      focus: { button: true },
    },
    {
      at: atMulligan,
      text: "5 は 5♠ で足ります。余る 5♥ をタップ。",
      need: { type: "TOGGLE_MULLIGAN_CARD", cardId: "t5" },
      focus: { cards: ["t5"] },
    },
    {
      text: "「引き直して確定」を押します。",
      need: { type: "CONFIRM_MULLIGAN" },
      focus: { button: true },
    },
    {
      at: atPlace,
      text: "2♠ を c2 へ。この駒を王にします。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t0", row: 3, col: 2 },
      focus: { cards: ["t0"], cells: [{ row: 3, col: 2 }] },
    },
    {
      text: "もう1枚の 2♥ を c1 へ。同じ数字を2枚持つのが今回の鍵です。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t1", row: 4, col: 2 },
      focus: { cards: ["t1"], cells: [{ row: 4, col: 2 }] },
    },
    {
      text: "4♠ を a1 へ。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t3", row: 4, col: 0 },
      focus: { cards: ["t3"], cells: [{ row: 4, col: 0 }] },
    },
    {
      text: "5♠ を b1 へ。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t4", row: 4, col: 1 },
      focus: { cards: ["t4"], cells: [{ row: 4, col: 1 }] },
    },
    {
      text: "3♠ を d1 へ。これで5枚そろいます。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t2", row: 4, col: 3 },
      focus: { cards: ["t2"], cells: [{ row: 4, col: 3 }] },
    },
    {
      text: "「王を選ぶ」を押します。",
      need: { type: "SETUP_GOTO_KING_STEP" },
      focus: { button: true },
    },
    {
      at: atKing,
      text: "c2 の 2♠ を王にします。タップしてください。",
      need: { type: "SETUP_PICK_KING", cardId: "t0" },
      focus: { cells: [{ row: 3, col: 2 }] },
    },
    {
      text: "2か3の王は、採用した枚数×2マスぶん遠くまで動けます。2♠ は2枚なので1+2×2で5マス。",
      need: { type: "SETUP_CONFIRM" },
      focus: { button: true },
    },
    {
      at: myTurn,
      text: "王を前に出してみます。c2 の 2♠ を c3 へ。",
      need: { type: "MOVE_PIECE", pieceId: "t0", row: 2, col: 2 },
      focus: {
        cells: [
          { row: 3, col: 2 },
          { row: 2, col: 2 },
        ],
      },
    },
    {
      at: myTurn,
      text: "王を取られました。それでも負けていません。",
    },
    {
      text: "2か3の王が倒れると、盤に出した同じ数字が王位を継ぎます。c1 の 2♥ が新しい王です。",
      focus: { cells: [{ row: 4, col: 2 }] },
    },
    {
      // 王を討った駒はその場で表になる。ここは相手の駒がめくれるのが
      // はっきり見える唯一の場面なので、黙って通すと「なぜ1枚だけ表なのか」
      // が分からないまま残る。次の手で取り返す相手でもあるので、ここで言う
      text: "王を討った駒は、その場で表になって名乗りを上げます。c3 の 3♦ がそれです。",
      focus: { cells: [{ row: 2, col: 2 }] },
    },
    {
      text: "名乗った 3♦ を、新しい王で取り返します。c1 の 2♥ を c3 へ。",
      need: { type: "MOVE_PIECE", pieceId: "t1", row: 2, col: 2 },
      focus: {
        cells: [
          { row: 4, col: 2 },
          { row: 2, col: 2 },
        ],
      },
    },
    {
      at: myTurn,
      text: "2マス先が相手の王です。2♥ を c5 へ。",
      need: { type: "MOVE_PIECE", pieceId: "t1", row: 0, col: 2 },
      focus: {
        cells: [
          { row: 2, col: 2 },
          { row: 0, col: 2 },
        ],
      },
    },
    {
      at: atEnd,
      text: "王が2か3なら、同じ数字を盤に出しておくと粘れます。",
      end: true,
    },
  ],
};

/* ---------------- 第3話 ---------------- */

/**
 * 道連れ。
 *
 * 自分の王を 4♠ にして、同じ 4♥ を軍に入れてある。相手が 4♥ を取ると、
 * 取った駒も一緒に倒れる。こちらの仕掛けとして働くので、
 * 「取られたのに得をした」がそのまま手に残る。
 *
 * あなたは後手。相手が先に 4♥ を取りに来る。
 * 王位の継承はこの回では起こらない。王が4なので継ぐ駒がいない。
 */
const EP3_DECK = fill(
  [
    // あなたの手札6枚。4 が2枚あるのが今回の鍵。5♥ が余分
    "4S",
    "4H",
    "2S",
    "3S",
    "5S",
    "5H",
    // 相手の手札6枚。王は 3♦。3 はこの1枚だけ
    "3D",
    "4D",
    "2D",
    "5D",
    "2H",
    "3H",
  ],
  CARD_POOLS.basic,
);

const EP3 = {
  id: 3,
  level: 3,
  // 終えると入る経験値。次のレベルまでちょうど届く量にして、1話ずつ開く
  xp: 500,
  title: "第3話 道連れ",
  subtitle: "取られた駒が、相手を道連れにする",
  pool: CARD_POOLS.basic,
  poolLabel: "2 〜 5",
  boardSize: 5,
  handSize: 6,
  // 後手。相手が先に取りに来る
  dice: [2, 6],
  deck: EP3_DECK,
  reserveOrder: EP3_DECK.slice(12).map((c) => c.id),
  foe: {
    discardIds: ["t11"],
    // 王は c5 の 3♦。c4 の 4♦ がこちらの 4♥ を取りに来る
    placement: {
      t6: { row: 0, col: 2 },
      t7: { row: 1, col: 2 },
      t8: { row: 0, col: 0 },
      t9: { row: 1, col: 0 },
      t10: { row: 0, col: 4 },
    },
    kingId: "t6",
    moves: [
      { pieceId: "t10", row: 1, col: 4 },
      // こちらの 4♥ を取りに来る手。ここで道連れが起きる
      { pieceId: "t7", row: 3, col: 2 },
      // 王は2マスずつしか進めないので、討つまでに1手はさまる。
      // その間の相手の手。盤の隅を動くだけで、こちらの道はふさがない
      { pieceId: "t10", row: 1, col: 3 },
    ],
  },
  steps: [
    {
      text: "取られた駒が、相手を道連れにすることがあります。サイコロを。",
      need: { type: "ROLL_DICE_SINGLE" },
      focus: { button: true },
    },
    {
      at: atMulligan,
      text: "5 は 5♠ で足ります。余る 5♥ をタップ。",
      need: { type: "TOGGLE_MULLIGAN_CARD", cardId: "t5" },
      focus: { cards: ["t5"] },
    },
    {
      text: "「引き直して確定」を押します。",
      need: { type: "CONFIRM_MULLIGAN" },
      focus: { button: true },
    },
    {
      at: atPlace,
      text: "4♠ を c1 へ。この駒を王にします。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t0", row: 4, col: 2 },
      focus: { cards: ["t0"], cells: [{ row: 4, col: 2 }] },
    },
    {
      text: "もう1枚の 4♥ を c2 へ。王の前に置きます。今回の鍵です。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t1", row: 3, col: 2 },
      focus: { cards: ["t1"], cells: [{ row: 3, col: 2 }] },
    },
    {
      text: "2♠ を b1 へ。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t2", row: 4, col: 1 },
      focus: { cards: ["t2"], cells: [{ row: 4, col: 1 }] },
    },
    {
      text: "3♠ を d1 へ。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t3", row: 4, col: 3 },
      focus: { cards: ["t3"], cells: [{ row: 4, col: 3 }] },
    },
    {
      text: "5♠ を e1 へ。これで5枚そろいます。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t4", row: 4, col: 4 },
      focus: { cards: ["t4"], cells: [{ row: 4, col: 4 }] },
    },
    {
      text: "「王を選ぶ」を押します。",
      need: { type: "SETUP_GOTO_KING_STEP" },
      focus: { button: true },
    },
    {
      at: atKing,
      text: "c1 の 4♠ を王にします。タップしてください。",
      need: { type: "SETUP_PICK_KING", cardId: "t0" },
      focus: { cells: [{ row: 4, col: 2 }] },
    },
    {
      text: "4か5の王には仕掛けがあります。「布陣を確定」を押します。",
      need: { type: "SETUP_CONFIRM" },
      focus: { button: true },
    },
    {
      at: myTurn,
      text: "あなたは後手。相手が1手指しました。",
    },
    {
      text: "d1 の 3♠ を e2 へ。相手が c2 の 4♥ を取りに来るのを待ちます。",
      need: { type: "MOVE_PIECE", pieceId: "t3", row: 3, col: 4 },
      focus: {
        cells: [
          { row: 4, col: 3 },
          { row: 3, col: 4 },
        ],
      },
    },
    {
      at: myTurn,
      text: "4♥ を取られましたが、取った相手も一緒に倒れました。",
    },
    {
      text: "王が4か5のとき、盤に出した同じ数字が取られると、取った駒を道連れにします。",
    },
    {
      // 4・5の王は、自分ではなく「王以外の同じ数字」を伸ばす。
      // ここを言わないと、王が4マス進めると思われて計算が合わなくなる
      text: "4か5が王のとき、遠くまで動けるのは王ではなく、王以外の同じ数字のほうです。",
      focus: { cells: [{ row: 4, col: 2 }] },
    },
    {
      text: "王の 4♠ は2マスのまま。道は空きましたが、一気には届きません。c1 から c3 へ。",
      need: { type: "MOVE_PIECE", pieceId: "t0", row: 2, col: 2 },
      focus: {
        cells: [
          { row: 4, col: 2 },
          { row: 2, col: 2 },
        ],
      },
    },
    {
      at: myTurn,
      text: "もう2マス。c3 から c5 へ。相手の王を討ちます。",
      need: { type: "MOVE_PIECE", pieceId: "t0", row: 0, col: 2 },
      focus: {
        cells: [
          { row: 2, col: 2 },
          { row: 0, col: 2 },
        ],
      },
    },
    {
      at: atEnd,
      text: "4か5を王にしたら、同じ数字を前に置きます。道連れで守られ、その駒は遠くまで動けます。",
      end: true,
    },
  ],
};

/* ---------------- 第4話 ---------------- */

/**
 * ふさがれる道。
 *
 * 6 と 8 だけを扱う。どちらも縦横で、6は偶数マス、8は奇数マス。
 * この2枚に絞ったのは、覚えることを「偶数か奇数か」の一点にしたいため。
 * 斜めの 7・9 は第5話で、同じ理屈のまま向きだけ変えて出す。
 *
 * 盤の上では 6♠ の真上に味方の 8♠ を置いてある。6♠ は行き先が
 * ひとつも光らない。読まなくても、触れば分かる。
 */
const EP4_DECK = fill(
  [
    // あなたの手札7枚。王は 4♠。5♦ が余分
    "6S",
    "8S",
    "4S",
    "2S",
    "3S",
    "5S",
    "5D",
    // 相手の手札7枚。王は 2♥。2 はこの1枚だけなので王位を継ぐ駒がいない
    "4H",
    "2H",
    "3H",
    "5H",
    "3D",
    "2C",
    "4C",
  ],
  CARD_POOLS.mid,
);

const EP4 = {
  id: 4,
  level: 4,
  // 終えると入る経験値。次のレベルまでちょうど届く量にして、1話ずつ開く
  xp: 700,
  title: "第4話 ふさがれる道",
  subtitle: "6は偶数、8は奇数",
  pool: CARD_POOLS.mid,
  poolLabel: "2 〜 9",
  boardSize: 5,
  handSize: 7,
  dice: [5, 3],
  deck: EP4_DECK,
  reserveOrder: EP4_DECK.slice(14).map((c) => c.id),
  foe: {
    discardIds: [],
    placement: {
      t7: { row: 0, col: 1 },
      t8: { row: 0, col: 2 },
      t9: { row: 1, col: 2 },
      t10: { row: 1, col: 3 },
      t11: { row: 0, col: 3 },
    },
    kingId: "t8",
    moves: [
      // c4 から b3 へ。6♠ のちょうど2マス先に出てくる
      { pieceId: "t9", row: 2, col: 1 },
      { pieceId: "t10", row: 2, col: 2 },
    ],
  },
  steps: [
    {
      text: "第4話から 6・7・8・9 が加わります。まずサイコロ。",
      need: { type: "ROLL_DICE_SINGLE" },
      focus: { button: true },
    },
    {
      at: atMulligan,
      text: "盤には5枚しか置けません。余る 5♦ をタップ。",
      need: { type: "TOGGLE_MULLIGAN_CARD", cardId: "t6" },
      focus: { cards: ["t6"] },
    },
    {
      text: "捨てた札は相手に見えます。「引き直して確定」を押します。",
      need: { type: "CONFIRM_MULLIGAN" },
      focus: { button: true },
    },
    {
      at: atPlace,
      text: "4♠ を c1 へ。ここまでに覚えた、縦横に動く駒です。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t2", row: 4, col: 2 },
      focus: { cards: ["t2"], cells: [{ row: 4, col: 2 }] },
    },
    {
      text: "8♠ を b2 へ。8は縦横に奇数マス。1・3・5マス先に降ります。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t1", row: 3, col: 1 },
      focus: { cards: ["t1"], cells: [{ row: 3, col: 1 }] },
    },
    {
      text: "6♠ を b1 へ。6は縦横に偶数マス。8♠ の真後ろになります。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t0", row: 4, col: 1 },
      focus: { cards: ["t0"], cells: [{ row: 4, col: 1 }] },
    },
    {
      text: "2♠ を d1 へ。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t3", row: 4, col: 3 },
      focus: { cards: ["t3"], cells: [{ row: 4, col: 3 }] },
    },
    {
      text: "3♠ を d2 へ。これで5枚そろいます。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t4", row: 3, col: 3 },
      focus: { cards: ["t4"], cells: [{ row: 3, col: 3 }] },
    },
    {
      text: "「王を選ぶ」を押します。",
      need: { type: "SETUP_GOTO_KING_STEP" },
      focus: { button: true },
    },
    {
      at: atKing,
      text: "c1 の 4♠ を王にします。タップしてください。",
      need: { type: "SETUP_PICK_KING", cardId: "t2" },
      focus: { cells: [{ row: 4, col: 2 }] },
    },
    {
      text: "「布陣を確定」を押します。",
      need: { type: "SETUP_CONFIRM" },
      focus: { button: true },
    },
    {
      at: myTurn,
      text: "b1 の 6♠ は、いま行き先がひとつもありません。",
      focus: { pieces: ["t0"] },
    },
    {
      at: myTurn,
      text: "6は2マス先に降ります。その手前の b2 に味方の 8♠ がいて、越えられません。",
      focus: { pieces: ["t0", "t1"] },
    },
    {
      at: myTurn,
      text: "先に 8♠ を動かします。b2 から b5 へ3マス。奇数なので届きます。",
      need: { type: "MOVE_PIECE", pieceId: "t1", row: 0, col: 1 },
      focus: { pieces: ["t1"], cells: [{ row: 0, col: 1 }] },
    },
    {
      at: myTurn,
      text: "道が空きました。相手も b3 へ出てきています。ちょうど2マス先です。",
      focus: { pieces: ["t0"], cells: [{ row: 2, col: 1 }] },
    },
    {
      at: myTurn,
      text: "6♠ を b3 へ。2マス進んで相手を取ります。",
      need: { type: "MOVE_PIECE", pieceId: "t0", row: 2, col: 1 },
      focus: { pieces: ["t0"], cells: [{ row: 2, col: 1 }] },
    },
    {
      at: myTurn,
      text: "b5 の 8♠ で、隣の c5 にいる王を取ります。1マスも奇数です。",
      need: { type: "MOVE_PIECE", pieceId: "t1", row: 0, col: 2 },
      focus: { pieces: ["t1"], cells: [{ row: 0, col: 2 }] },
    },
    {
      at: atEnd,
      text: "6は偶数マス、8は奇数マス。どちらも味方に道を塞がれます。",
      end: true,
    },
  ],
};

/* ---------------- 第5話 ---------------- */

/**
 * ななめの兄弟。
 *
 * 7 と 9 は、第4話の 6 と 8 を斜めにしただけ。新しく覚えることは
 * 向きひとつなので、ここに王のまとめ取りを重ねられる。
 *
 * 王の 6〜9 は、同じ線に並んだ相手を手前からまとめて取る。7♠ を王に
 * すると 2マス先と4マス先が取れる。偶数マスという決まりが、そのまま
 * まとめ取りの形になって見える。
 */
const EP5_DECK = fill(
  [
    // あなたの手札7枚。王は 7♠。9♦ が余分
    "7S",
    "9S",
    "7H",
    "2S",
    "3S",
    "4S",
    "9D",
    // 相手の手札7枚。王は 2♥。2 はこの1枚だけ
    "2H",
    "3H",
    "4H",
    "5H",
    "3D",
    "6C",
    "8C",
  ],
  CARD_POOLS.mid,
);

const EP5 = {
  id: 5,
  level: 5,
  // 終えると入る経験値。次のレベルまでちょうど届く量にして、1話ずつ開く
  xp: 900,
  title: "第5話 ななめの兄弟",
  subtitle: "7と9、そして王のまとめ取り",
  pool: CARD_POOLS.mid,
  poolLabel: "2 〜 9",
  boardSize: 5,
  handSize: 7,
  dice: [6, 2],
  deck: EP5_DECK,
  reserveOrder: EP5_DECK.slice(14).map((c) => c.id),
  foe: {
    discardIds: [],
    placement: {
      t7: { row: 0, col: 4 },
      t8: { row: 1, col: 1 },
      t9: { row: 0, col: 2 },
      t10: { row: 0, col: 3 },
      t11: { row: 0, col: 0 },
    },
    kingId: "t7",
    moves: [
      // b4 から c3 へ。7♠ の斜め2マス先、王と同じ線に並ぶ
      { pieceId: "t8", row: 2, col: 2 },
      { pieceId: "t9", row: 0, col: 1 },
    ],
  },
  steps: [
    {
      text: "第5話は 7 と 9 を見ます。サイコロを振ります。",
      need: { type: "ROLL_DICE_SINGLE" },
      focus: { button: true },
    },
    {
      at: atMulligan,
      text: "9 は1枚あれば足ります。余る 9♦ をタップ。",
      need: { type: "TOGGLE_MULLIGAN_CARD", cardId: "t6" },
      focus: { cards: ["t6"] },
    },
    {
      text: "「引き直して確定」を押します。",
      need: { type: "CONFIRM_MULLIGAN" },
      focus: { button: true },
    },
    {
      at: atPlace,
      text: "7♠ を a1 へ。角に置きます。この駒を王にします。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t0", row: 4, col: 0 },
      focus: { cards: ["t0"], cells: [{ row: 4, col: 0 }] },
    },
    {
      text: "9♠ を a2 へ。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t1", row: 3, col: 0 },
      focus: { cards: ["t1"], cells: [{ row: 3, col: 0 }] },
    },
    {
      text: "7♥ を b1 へ。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t2", row: 4, col: 1 },
      focus: { cards: ["t2"], cells: [{ row: 4, col: 1 }] },
    },
    {
      text: "2♠ を c1 へ。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t3", row: 4, col: 2 },
      focus: { cards: ["t3"], cells: [{ row: 4, col: 2 }] },
    },
    {
      text: "3♠ を d1 へ。これで5枚そろいます。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t4", row: 4, col: 3 },
      focus: { cards: ["t4"], cells: [{ row: 4, col: 3 }] },
    },
    {
      text: "「王を選ぶ」を押します。",
      need: { type: "SETUP_GOTO_KING_STEP" },
      focus: { button: true },
    },
    {
      at: atKing,
      text: "a1 の 7♠ を王にします。タップしてください。",
      need: { type: "SETUP_PICK_KING", cardId: "t0" },
      focus: { cells: [{ row: 4, col: 0 }] },
    },
    {
      text: "「布陣を確定」を押します。",
      need: { type: "SETUP_CONFIRM" },
      focus: { button: true },
    },
    {
      at: myTurn,
      text: "7と9は、前回の 6と8 を斜めにした駒です。7が偶数マス、9が奇数マス。",
      focus: { pieces: ["t2", "t1"] },
    },
    {
      at: myTurn,
      text: "b1 の 7♥ を d3 へ。斜めに2マス、偶数です。",
      need: { type: "MOVE_PIECE", pieceId: "t2", row: 2, col: 3 },
      focus: { pieces: ["t2"], cells: [{ row: 2, col: 3 }] },
    },
    {
      at: myTurn,
      text: "a2 の 9♠ を d5 へ。斜めに3マス、奇数です。相手を取ります。",
      need: { type: "MOVE_PIECE", pieceId: "t1", row: 0, col: 3 },
      focus: { pieces: ["t1"], cells: [{ row: 0, col: 3 }] },
    },
    {
      at: myTurn,
      text: "ここからが王の力です。6〜9 の王は、同じ線に並んだ相手をまとめて取れます。",
      focus: { pieces: ["t0"] },
    },
    {
      at: myTurn,
      text: "a1 の 7♠ から斜めを見ます。2マス先の c3 と、4マス先の e5。どちらも偶数マス。",
      focus: {
        pieces: ["t0"],
        cells: [
          { row: 2, col: 2 },
          { row: 0, col: 4 },
        ],
      },
    },
    {
      at: myTurn,
      text: "7♠ を e5 へ。途中の c3 ごと、2枚まとめて取ります。",
      need: { type: "MOVE_PIECE", pieceId: "t0", row: 0, col: 4 },
      focus: { pieces: ["t0"], cells: [{ row: 0, col: 4 }] },
    },
    {
      at: atEnd,
      text: "7は斜めの偶数、9は斜めの奇数。王なら、その線の相手をまとめて討てます。",
      end: true,
    },
  ],
};

/* ---------------- 第6話 ---------------- */

/**
 * 跳ぶ駒。
 *
 * 10 だけを扱う。縦に2・横に1(またはその逆)の8方向へ、間に何がいても跳ぶ。
 * 「桂馬」とは書かない。将棋の桂馬は前の2方向にしか跳べないので、
 * 知っている人にはかえって間違いを教えることになる。
 * 第4話で「味方に塞がれる」を体で覚えた直後だからこそ、塞がれない駒の
 * ありがたみが出る。だから 10♠ は最初から味方に囲ませてある。
 *
 * 王の10 は1つの手番で2回動ける。跳んで、跳んで、届く。
 */
const EP6_DECK = fill(
  [
    // あなたの手札7枚。王は 10♠。6♠ が余分
    "10S",
    "4S",
    "5S",
    "3S",
    "2S",
    "9S",
    "6S",
    // 相手の手札7枚。王は 2♥。2 はこの1枚だけ
    "2H",
    "4H",
    "3H",
    "5H",
    "3D",
    "7C",
    "9C",
  ],
  CARD_POOLS.numbers,
);

const EP6 = {
  id: 6,
  level: 6,
  // 終えると入る経験値。次のレベルまでちょうど届く量にして、1話ずつ開く
  xp: 1100,
  title: "第6話 跳ぶ駒",
  subtitle: "10は、塞がれない",
  pool: CARD_POOLS.numbers,
  poolLabel: "2 〜 10",
  boardSize: 5,
  handSize: 7,
  dice: [6, 2],
  deck: EP6_DECK,
  reserveOrder: EP6_DECK.slice(14).map((c) => c.id),
  foe: {
    discardIds: [],
    placement: {
      t7: { row: 0, col: 2 },
      t8: { row: 1, col: 2 },
      t9: { row: 1, col: 1 },
      t10: { row: 1, col: 3 },
      t11: { row: 0, col: 0 },
    },
    kingId: "t7",
    moves: [{ pieceId: "t8", row: 2, col: 2 }],
  },
  steps: [
    {
      text: "第6話で 10 が加わります。サイコロを振ります。",
      need: { type: "ROLL_DICE_SINGLE" },
      focus: { button: true },
    },
    {
      at: atMulligan,
      text: "盤には5枚。余る 6♠ をタップして捨てます。",
      need: { type: "TOGGLE_MULLIGAN_CARD", cardId: "t6" },
      focus: { cards: ["t6"] },
    },
    {
      text: "「引き直して確定」を押します。",
      need: { type: "CONFIRM_MULLIGAN" },
      focus: { button: true },
    },
    {
      at: atPlace,
      text: "10♠ を c1 へ。10は縦に2・横に1(またはその逆)へ跳びます。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t0", row: 4, col: 2 },
      focus: { cards: ["t0"], cells: [{ row: 4, col: 2 }] },
    },
    {
      text: "4♠ を b2 へ。10♠ の斜め前です。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t1", row: 3, col: 1 },
      focus: { cards: ["t1"], cells: [{ row: 3, col: 1 }] },
    },
    {
      text: "5♠ を c2 へ。10♠ の真ん前を塞ぎます。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t2", row: 3, col: 2 },
      focus: { cards: ["t2"], cells: [{ row: 3, col: 2 }] },
    },
    {
      text: "3♠ を d2 へ。反対の斜め前も塞ぎます。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t3", row: 3, col: 3 },
      focus: { cards: ["t3"], cells: [{ row: 3, col: 3 }] },
    },
    {
      text: "2♠ を b1 へ。10♠ は味方に囲まれました。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t4", row: 4, col: 1 },
      focus: { cards: ["t4"], cells: [{ row: 4, col: 1 }] },
    },
    {
      text: "「王を選ぶ」を押します。",
      need: { type: "SETUP_GOTO_KING_STEP" },
      focus: { button: true },
    },
    {
      at: atKing,
      text: "c1 の 10♠ を王にします。タップしてください。",
      need: { type: "SETUP_PICK_KING", cardId: "t0" },
      focus: { cells: [{ row: 4, col: 2 }] },
    },
    {
      text: "「布陣を確定」を押します。",
      need: { type: "SETUP_CONFIRM" },
      focus: { button: true },
    },
    {
      at: myTurn,
      text: "前回までの駒なら、こう囲まれると出られません。10は跳び越えます。",
      focus: { pieces: ["t0"] },
    },
    {
      at: myTurn,
      text: "c1 の 10♠ を e2 へ。縦に1つ、横に2つ。間に何がいても関係ありません。",
      need: { type: "MOVE_PIECE", pieceId: "t0", row: 3, col: 4 },
      focus: { pieces: ["t0"], cells: [{ row: 3, col: 4 }] },
    },
    {
      at: myTurn,
      text: "王の10には、もうひとつ力があります。1つの手番で2回動けます。",
      focus: { pieces: ["t0"] },
    },
    {
      at: myTurn,
      text: "続けて e2 から d4 へ。跳んだ先の相手を取ります。",
      need: { type: "MOVE_PIECE", pieceId: "t0", row: 1, col: 3 },
      focus: { pieces: ["t0"], cells: [{ row: 1, col: 3 }] },
    },
    {
      at: myTurn,
      text: "相手が c3 へ出てきました。もう一度あなたの番です。",
      focus: { pieces: ["t0"] },
    },
    {
      at: myTurn,
      text: "d4 から b3 へ跳びます。",
      need: { type: "MOVE_PIECE", pieceId: "t0", row: 2, col: 1 },
      focus: { pieces: ["t0"], cells: [{ row: 2, col: 1 }] },
    },
    {
      at: myTurn,
      text: "2回目です。b3 から c5 へ跳んで、王を取ります。",
      need: { type: "MOVE_PIECE", pieceId: "t0", row: 0, col: 2 },
      focus: { pieces: ["t0"], cells: [{ row: 0, col: 2 }] },
    },
    {
      at: atEnd,
      text: "10は味方も相手も跳び越えます。王の10なら、1つの手番で2回。",
      end: true,
    },
  ],
};

/* ---------------- 第7話 ---------------- */

/**
 * 果てまで走る。
 *
 * J と Q。動ける距離に上限が無いぶん、進路を塞がれることの重みが増す。
 * 布陣の時点で Q♠ の真ん前に味方の 3♠ を置かせてある。開幕の Q♠ は
 * 行き先がひとつも無い。どかしてから走らせる、という順番を手で覚える。
 */
const EP7_DECK = fill(
  [
    // あなたの手札7枚。王は 4♠。6♠ が余分
    "JS",
    "QS",
    "3S",
    "4S",
    "2S",
    "5S",
    "6S",
    // 相手の手札7枚。王は 2♥。2 はこの1枚だけ
    "3H",
    "4H",
    "2H",
    "5H",
    "3D",
    "7C",
    "8C",
  ],
  CARD_POOLS.high,
);

const EP7 = {
  id: 7,
  level: 7,
  // 終えると入る経験値。次のレベルまでちょうど届く量にして、1話ずつ開く
  xp: 1300,
  title: "第7話 果てまで走る",
  subtitle: "J は縦横、Q は斜め",
  pool: CARD_POOLS.high,
  poolLabel: "2 〜 Q",
  boardSize: 5,
  handSize: 7,
  dice: [6, 2],
  deck: EP7_DECK,
  reserveOrder: EP7_DECK.slice(14).map((c) => c.id),
  foe: {
    discardIds: [],
    placement: {
      t7: { row: 0, col: 0 },
      t8: { row: 1, col: 1 },
      t9: { row: 0, col: 2 },
      t10: { row: 1, col: 3 },
      t11: { row: 0, col: 4 },
    },
    kingId: "t9",
    moves: [
      { pieceId: "t10", row: 3, col: 1 },
      { pieceId: "t11", row: 1, col: 3 },
      { pieceId: "t10", row: 2, col: 0 },
    ],
  },
  steps: [
    {
      text: "第7話で J と Q が加わります。サイコロを振ります。",
      need: { type: "ROLL_DICE_SINGLE" },
      focus: { button: true },
    },
    {
      at: atMulligan,
      text: "盤には5枚。余る 6♠ をタップして捨てます。",
      need: { type: "TOGGLE_MULLIGAN_CARD", cardId: "t6" },
      focus: { cards: ["t6"] },
    },
    {
      text: "「引き直して確定」を押します。",
      need: { type: "CONFIRM_MULLIGAN" },
      focus: { button: true },
    },
    {
      at: atPlace,
      text: "J♠ を a1 へ。Jは縦横に、どこまでも進みます。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t0", row: 4, col: 0 },
      focus: { cards: ["t0"], cells: [{ row: 4, col: 0 }] },
    },
    {
      text: "Q♠ を e1 へ。Qは斜めに、どこまでも。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t1", row: 4, col: 4 },
      focus: { cards: ["t1"], cells: [{ row: 4, col: 4 }] },
    },
    {
      text: "3♠ を d2 へ。Q♠ の斜め前になります。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t2", row: 3, col: 3 },
      focus: { cards: ["t2"], cells: [{ row: 3, col: 3 }] },
    },
    {
      text: "4♠ を c1 へ。この駒を王にします。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t3", row: 4, col: 2 },
      focus: { cards: ["t3"], cells: [{ row: 4, col: 2 }] },
    },
    {
      text: "2♠ を b1 へ。これで5枚そろいます。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t4", row: 4, col: 1 },
      focus: { cards: ["t4"], cells: [{ row: 4, col: 1 }] },
    },
    {
      text: "「王を選ぶ」を押します。",
      need: { type: "SETUP_GOTO_KING_STEP" },
      focus: { button: true },
    },
    {
      at: atKing,
      text: "c1 の 4♠ を王にします。タップしてください。",
      need: { type: "SETUP_PICK_KING", cardId: "t3" },
      focus: { cells: [{ row: 4, col: 2 }] },
    },
    {
      text: "「布陣を確定」を押します。",
      need: { type: "SETUP_CONFIRM" },
      focus: { button: true },
    },
    {
      at: myTurn,
      text: "e1 の Q♠ は、どこまでも進めるはずなのに行き先がひとつもありません。",
      focus: { pieces: ["t1"] },
    },
    {
      at: myTurn,
      text: "斜め前の d2 に味方の 3♠ がいるからです。距離に上限が無くても、塞がれます。",
      focus: { pieces: ["t1", "t2"] },
    },
    {
      at: myTurn,
      text: "先に J♠ を走らせます。a1 から a5 まで4マス、まっすぐ進んで取ります。",
      need: { type: "MOVE_PIECE", pieceId: "t0", row: 0, col: 0 },
      focus: { pieces: ["t0"], cells: [{ row: 0, col: 0 }] },
    },
    {
      at: myTurn,
      text: "次に 3♠ を e3 へ動かして、Q♠ の道を空けます。",
      need: { type: "MOVE_PIECE", pieceId: "t2", row: 2, col: 4 },
      focus: { pieces: ["t2"], cells: [{ row: 2, col: 4 }] },
    },
    {
      at: myTurn,
      text: "道が空きました。Q♠ から斜めに見ると、3マス先に相手がいます。",
      focus: { pieces: ["t1"], cells: [{ row: 1, col: 1 }] },
    },
    {
      at: myTurn,
      text: "Q♠ を b4 へ。斜めに3マス走って取ります。",
      need: { type: "MOVE_PIECE", pieceId: "t1", row: 1, col: 1 },
      focus: { pieces: ["t1"], cells: [{ row: 1, col: 1 }] },
    },
    {
      at: myTurn,
      text: "a5 の J♠ を横に2マス。c5 の王を取ります。",
      need: { type: "MOVE_PIECE", pieceId: "t0", row: 0, col: 2 },
      focus: { pieces: ["t0"], cells: [{ row: 0, col: 2 }] },
    },
    {
      at: atEnd,
      text: "Jは縦横、Qは斜め。どちらも果てまで進めて、どちらも塞がれます。",
      end: true,
    },
  ],
};

/* ---------------- 第8話 ---------------- */

/**
 * K の王。
 *
 * K は王にするときだけ1枚だけ採用できる。そのぶん J と Q も1枚ずつに
 * 減る。引き直しで2枚目の J を捨てさせるのは、この決まりを手で
 * 覚えてもらうため。
 *
 * K の王の力は、自分の J か Q が倒されるたびに予備札を1枚呼べること。
 * 損をした瞬間に得が返ってくるので、わざと J♠ を取らせる筋にしてある。
 */
const EP8_DECK = fill(
  [
    // あなたの手札7枚。王は K♠。2枚目の J♥ が余分
    "KS",
    "JS",
    "QS",
    "2S",
    "3S",
    "4S",
    "JH",
    // 相手の手札7枚。王は 2♥。2 はこの1枚だけ
    "2H",
    "JD",
    "3H",
    "4H",
    "5H",
    "6C",
    "7C",
  ],
  CARD_POOLS.court,
);

const EP8 = {
  id: 8,
  level: 8,
  // 終えると入る経験値。次のレベルまでちょうど届く量にして、1話ずつ開く
  xp: 1500,
  title: "第8話 Kの王",
  subtitle: "失うほど、湧いてくる",
  pool: CARD_POOLS.court,
  poolLabel: "2 〜 K",
  boardSize: 5,
  handSize: 7,
  dice: [6, 2],
  deck: EP8_DECK,
  // Kの力で出てくる1枚が2枚目のKにならないよう、末尾を数字札にする
  reserveOrder: reserveEndingPlain(EP8_DECK, 7),
  foe: {
    discardIds: [],
    placement: {
      t7: { row: 0, col: 2 },
      t8: { row: 1, col: 2 },
      t9: { row: 1, col: 1 },
      t10: { row: 1, col: 3 },
      t11: { row: 0, col: 0 },
    },
    kingId: "t7",
    moves: [
      // J♦ が降りてきて、あなたの J♠ を取る。ここで予備札が来る
      { pieceId: "t8", row: 2, col: 2 },
      { pieceId: "t9", row: 2, col: 0 },
    ],
  },
  steps: [
    {
      text: "第8話で K が加わります。サイコロを振ります。",
      need: { type: "ROLL_DICE_SINGLE" },
      focus: { button: true },
    },
    {
      at: atMulligan,
      text: "王をKにすると、JとQは1枚ずつしか置けません。2枚目の J♥ をタップ。",
      need: { type: "TOGGLE_MULLIGAN_CARD", cardId: "t6" },
      focus: { cards: ["t6"] },
    },
    {
      text: "「引き直して確定」を押します。",
      need: { type: "CONFIRM_MULLIGAN" },
      focus: { button: true },
    },
    {
      at: atPlace,
      text: "K♠ を c1 へ。Kは縦横も斜めも走り、10と同じ跳び方もできます。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t0", row: 4, col: 2 },
      focus: { cards: ["t0"], cells: [{ row: 4, col: 2 }] },
    },
    {
      text: "J♠ を c2 へ。K♠ の真ん前です。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t1", row: 3, col: 2 },
      focus: { cards: ["t1"], cells: [{ row: 3, col: 2 }] },
    },
    {
      text: "Q♠ を b1 へ。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t2", row: 4, col: 1 },
      focus: { cards: ["t2"], cells: [{ row: 4, col: 1 }] },
    },
    {
      text: "2♠ を d1 へ。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t3", row: 4, col: 3 },
      focus: { cards: ["t3"], cells: [{ row: 4, col: 3 }] },
    },
    {
      text: "3♠ を a1 へ。これで5枚そろいます。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t4", row: 4, col: 0 },
      focus: { cards: ["t4"], cells: [{ row: 4, col: 0 }] },
    },
    {
      text: "「王を選ぶ」を押します。",
      need: { type: "SETUP_GOTO_KING_STEP" },
      focus: { button: true },
    },
    {
      at: atKing,
      text: "Kを置くと、そのKが王になります。c1 の K♠ をタップ。",
      need: { type: "SETUP_PICK_KING", cardId: "t0" },
      focus: { cells: [{ row: 4, col: 2 }] },
    },
    {
      text: "「布陣を確定」を押します。",
      need: { type: "SETUP_CONFIRM" },
      focus: { button: true },
    },
    {
      at: myTurn,
      text: "Kの王には力があります。J か Q が倒されるたび、配られなかった山(予備札)から1枚呼べます。",
      focus: { pieces: ["t1"] },
    },
    {
      at: myTurn,
      text: "確かめます。c2 の J♠ を c3 へ、わざと前に出します。",
      need: { type: "MOVE_PIECE", pieceId: "t1", row: 2, col: 2 },
      focus: { pieces: ["t1"], cells: [{ row: 2, col: 2 }] },
    },
    {
      // 撃破カードが盤を覆っている間に出すと、光るマスがどこにも無い。閉じてから
      at: (s) =>
        s.phase === "play" &&
        s.currentTurn === 0 &&
        !!s.kPlacement &&
        !s.captureReveal,
      text: "取られました。予備札が1枚来ています。光った b2 をタップして出します。",
      need: { type: "PLACE_RESERVE_CARD", row: 3, col: 1 },
      focus: { cells: [{ row: 3, col: 1 }] },
    },
    {
      at: myTurn,
      text: "取られたのに、盤の駒は減っていません。失うほど戦力が湧く王です。",
      focus: { pieces: ["t0"] },
    },
    {
      at: myTurn,
      text: "K♠ で c3 の相手を取り返します。",
      need: { type: "MOVE_PIECE", pieceId: "t0", row: 2, col: 2 },
      focus: { pieces: ["t0"], cells: [{ row: 2, col: 2 }] },
    },
    {
      at: myTurn,
      text: "そのまま c5 の王を取ります。縦にどこまでも走れます。",
      need: { type: "MOVE_PIECE", pieceId: "t0", row: 0, col: 2 },
      focus: { pieces: ["t0"], cells: [{ row: 0, col: 2 }] },
    },
    {
      at: atEnd,
      text: "Kは全方向へ走り、10と同じ跳び方もできる。JかQを失うたび、予備札が来ます。",
      end: true,
    },
  ],
};

/* ---------------- 第9話 ---------------- */

/**
 * 動かない駒。
 *
 * A は一歩も動けない。代わりに、盤の駒を3つ選んで位置をぐるりと
 * 入れ替える。相手の駒も選べるので、守りを剥がして自分の攻め駒を
 * その場所に置く、という使い方ができる。
 *
 * この回は入れ替えだけを扱う。3つとも味方にすると包囲で取れてしまう
 * ので、わざと相手の駒を1つ混ぜた選び方にしてある。包囲は第10話。
 */
const EP9_DECK = fill(
  [
    // あなたの手札7枚。王は 4♠。2枚目の A♥ が余分
    "AS",
    "4S",
    "8S",
    "2S",
    "3S",
    "AH",
    "6S",
    // 相手の手札7枚。王は 2♥。2 はこの1枚だけ
    "2H",
    "4H",
    "3H",
    "5H",
    "3D",
    "7C",
    "9C",
  ],
  CARD_POOLS.full,
);

const EP9 = {
  id: 9,
  level: 9,
  // 終えると入る経験値。次のレベルまでちょうど届く量にして、1話ずつ開く
  xp: 800,
  title: "第9話 動かない駒",
  subtitle: "A は、盤ごと組み替える",
  pool: CARD_POOLS.full,
  poolLabel: "A 〜 K",
  boardSize: 5,
  handSize: 7,
  dice: [6, 2],
  deck: EP9_DECK,
  reserveOrder: EP9_DECK.slice(14).map((c) => c.id),
  // 入れ替えの並び順。固定しないと毎回ちがう配置になる
  shuffleOrder: [2, 0, 1],
  foe: {
    discardIds: [],
    placement: {
      t7: { row: 0, col: 2 },
      t8: { row: 1, col: 2 },
      t9: { row: 1, col: 1 },
      t10: { row: 1, col: 3 },
      t11: { row: 0, col: 0 },
    },
    kingId: "t7",
    moves: [{ pieceId: "t9", row: 2, col: 2 }],
  },
  steps: [
    {
      text: "最後に A が加わり、52枚すべてがそろいます。サイコロを振ります。",
      need: { type: "ROLL_DICE_SINGLE" },
      focus: { button: true },
    },
    {
      at: atMulligan,
      text: "A は動けない駒です。2枚は要りません。A♥ をタップして捨てます。",
      need: { type: "TOGGLE_MULLIGAN_CARD", cardId: "t5" },
      focus: { cards: ["t5"] },
    },
    {
      text: "「引き直して確定」を押します。",
      need: { type: "CONFIRM_MULLIGAN" },
      focus: { button: true },
    },
    {
      at: atPlace,
      text: "A♠ を b1 へ。A は一歩も動けません。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t0", row: 4, col: 1 },
      focus: { cards: ["t0"], cells: [{ row: 4, col: 1 }] },
    },
    {
      text: "4♠ を c1 へ。この駒を王にします。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t1", row: 4, col: 2 },
      focus: { cards: ["t1"], cells: [{ row: 4, col: 2 }] },
    },
    {
      text: "8♠ を d1 へ。縦横に奇数マス進む駒でした。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t2", row: 4, col: 3 },
      focus: { cards: ["t2"], cells: [{ row: 4, col: 3 }] },
    },
    {
      text: "2♠ を a1 へ。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t3", row: 4, col: 0 },
      focus: { cards: ["t3"], cells: [{ row: 4, col: 0 }] },
    },
    {
      text: "3♠ を e1 へ。これで5枚そろいます。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t4", row: 4, col: 4 },
      focus: { cards: ["t4"], cells: [{ row: 4, col: 4 }] },
    },
    {
      text: "「王を選ぶ」を押します。",
      need: { type: "SETUP_GOTO_KING_STEP" },
      focus: { button: true },
    },
    {
      at: atKing,
      text: "c1 の 4♠ を王にします。タップしてください。",
      need: { type: "SETUP_PICK_KING", cardId: "t1" },
      focus: { cells: [{ row: 4, col: 2 }] },
    },
    {
      text: "「布陣を確定」を押します。",
      need: { type: "SETUP_CONFIRM" },
      focus: { button: true },
    },
    {
      at: myTurn,
      text: "b1 の A♠ は行き先がありません。A は動きません。",
      focus: { pieces: ["t0"] },
    },
    {
      at: myTurn,
      text: "代わりに A は、自分をふくむ3つの駒の位置をぐるりと入れ替えます。相手の駒も選べます。",
      focus: { pieces: ["t0"] },
    },
    {
      at: myTurn,
      text: "相手の王 c5 は、真下の c4 に守られています。d1 の 8♠ では届きません。",
      focus: {
        cells: [
          { row: 0, col: 2 },
          { row: 1, col: 2 },
        ],
        pieces: ["t2"],
      },
    },
    {
      at: myTurn,
      text: "A♠ をタップして入れ替えを始めます。次に、守っている c4 の相手をタップ。",
      need: { type: "TOGGLE_SHUFFLE_PICK", id: "t8" },
      focus: { pieces: ["t0", "t8"] },
    },
    {
      at: myTurn,
      text: "もう1つ、d1 の 8♠ をタップ。これで3つそろいます。",
      need: { type: "TOGGLE_SHUFFLE_PICK", id: "t2" },
      focus: { pieces: ["t2"] },
    },
    {
      at: myTurn,
      text: "確定を押します。3つの駒が、ぐるりと場所を入れ替えます。",
      need: { type: "CONFIRM_SHUFFLE" },
      focus: { button: true },
    },
    {
      at: myTurn,
      text: "守っていた駒は b1 へ飛び、8♠ が c4 に立ちました。A♠ も d1 へ動いています。",
      focus: { pieces: ["t2"] },
    },
    {
      at: myTurn,
      text: "8♠ で、真上の c5 にいる王を取ります。",
      need: { type: "MOVE_PIECE", pieceId: "t2", row: 0, col: 2 },
      focus: { pieces: ["t2"], cells: [{ row: 0, col: 2 }] },
    },
    {
      at: atEnd,
      text: "A は自分から歩けないだけで、入れ替えでは動きます。相手の守りも剥がせます。",
      end: true,
    },
  ],
};

/* ---------------- 第10話 ---------------- */

/**
 * 囲んで討つ。
 *
 * 第9話の入れ替えで、3つとも味方を選ぶとどうなるか。3つの駒が作る
 * 三角形の内側にいる相手は、そのまま倒れる。
 *
 * 相手の王をわざと自陣まで踏み込ませ、三角形の内側に入れてある。
 * 「囲むと取れる」を、王を討つ形で一度だけ見せる。
 */
const EP10_DECK = fill(
  [
    // あなたの手札7枚。王は 3♠。K♠ は置くと王がKに決まってしまうので捨てる
    "AS",
    "4S",
    "5S",
    "3S",
    "6S",
    "KS",
    "2S",
    // 相手の手札7枚。王は J♥（Jは継承しないので、囲んで取れば決着）
    "JH",
    "10H",
    "9H",
    "6H",
    "2H",
    "QH",
    "KH",
  ],
  CARD_POOLS.full,
);

const EP10 = {
  id: 10,
  level: 9,
  // 終えると入る経験値。次のレベルまでちょうど届く量にして、1話ずつ開く
  xp: 900,
  title: "第10話 囲んで討つ",
  subtitle: "三角形の内側は、倒れる",
  pool: CARD_POOLS.full,
  poolLabel: "A 〜 K",
  boardSize: 5,
  handSize: 7,
  dice: [6, 1],
  deck: EP10_DECK,
  reserveOrder: EP10_DECK.slice(14).map((c) => c.id),
  // 入れ替えの並び順。固定しないと毎回ちがう配置になる
  shuffleOrder: [1, 2, 0],
  foe: {
    discardIds: [],
    placement: {
      t7: { row: 0, col: 2 },
      t8: { row: 0, col: 1 },
      t9: { row: 1, col: 1 },
      t10: { row: 1, col: 3 },
      t11: { row: 1, col: 0 },
    },
    kingId: "t7",
    // 王が c2 まで踏み込んでくる。三角形の内側に入る
    moves: [{ pieceId: "t7", row: 3, col: 2 }],
  },
  steps: [
    {
      text: "第10話も52枚すべてで戦います。サイコロを振ります。",
      need: { type: "ROLL_DICE_SINGLE" },
      focus: { button: true },
    },
    {
      at: atMulligan,
      // K を布陣に入れると王が K に固定される。3 を王にしたいので捨てさせる
      text: "Kを置くと王はKに決まります。今回は3を王にするので、K♠ をタップ。",
      need: { type: "TOGGLE_MULLIGAN_CARD", cardId: "t5" },
      focus: { cards: ["t5"] },
    },
    {
      text: "「引き直して確定」を押します。",
      need: { type: "CONFIRM_MULLIGAN" },
      focus: { button: true },
    },
    {
      at: atPlace,
      text: "A♠ を b2 へ。入れ替えの起点になります。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t0", row: 3, col: 1 },
      focus: { cards: ["t0"], cells: [{ row: 3, col: 1 }] },
    },
    {
      text: "4♠ を c1 へ。A♠ と三角形をつくる位置です。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t1", row: 4, col: 2 },
      focus: { cards: ["t1"], cells: [{ row: 4, col: 2 }] },
    },
    {
      text: "5♠ を d2 へ。これで3点が三角形に並びます。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t2", row: 3, col: 3 },
      focus: { cards: ["t2"], cells: [{ row: 3, col: 3 }] },
    },
    {
      text: "3♠ を b1 へ。この駒を王にします。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t3", row: 4, col: 1 },
      focus: { cards: ["t3"], cells: [{ row: 4, col: 1 }] },
    },
    {
      text: "6♠ を e1 へ。これで5枚そろいます。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t4", row: 4, col: 4 },
      focus: { cards: ["t4"], cells: [{ row: 4, col: 4 }] },
    },
    {
      text: "「王を選ぶ」を押します。",
      need: { type: "SETUP_GOTO_KING_STEP" },
      focus: { button: true },
    },
    {
      at: atKing,
      text: "b1 の 3♠ を王にします。タップしてください。",
      need: { type: "SETUP_PICK_KING", cardId: "t3" },
      focus: { cells: [{ row: 4, col: 1 }] },
    },
    {
      text: "「布陣を確定」を押します。",
      need: { type: "SETUP_CONFIRM" },
      focus: { button: true },
    },
    {
      at: myTurn,
      text: "前回は入れ替えに相手の駒を混ぜました。今回は3つとも味方で選びます。",
      focus: { pieces: ["t0"] },
    },
    {
      at: myTurn,
      text: "まず1手ようすを見ます。e1 の 6♠ を e3 へ。",
      need: { type: "MOVE_PIECE", pieceId: "t4", row: 2, col: 4 },
      focus: { pieces: ["t4"], cells: [{ row: 2, col: 4 }] },
    },
    {
      at: myTurn,
      text: "相手の王が c2 まで踏み込みました。A♠・4♠・5♠ が囲む三角形の内側です。",
      focus: {
        cells: [{ row: 3, col: 2 }],
        pieces: ["t0", "t1", "t2"],
      },
    },
    {
      at: myTurn,
      text: "b2 の A♠ をタップし、続けて c1 の 4♠ をタップ。",
      need: { type: "TOGGLE_SHUFFLE_PICK", id: "t1" },
      focus: { pieces: ["t0", "t1"] },
    },
    {
      at: myTurn,
      text: "もう1つ、d2 の 5♠ をタップ。これで3点が決まります。",
      need: { type: "TOGGLE_SHUFFLE_PICK", id: "t2" },
      focus: { pieces: ["t2"] },
    },
    {
      at: myTurn,
      text: "3つとも味方なら、囲んだ内側が倒れます。線の上も内側です。確定を押します。",
      need: { type: "CONFIRM_SHUFFLE" },
      focus: { button: true },
    },
    {
      at: atEnd,
      text: "3点で囲んだ内側(線の上もふくむ)は倒れます。Aを王にすると1手番に2回。",
      end: true,
    },
  ],
};

/* ---------------- 第11話 ---------------- */

/**
 * 布陣ボーナスの回。ストレートを狙う。
 *
 * サイコロは必ず後手になる目にしてある。後手のままでは相手に先に指される。
 * ストレートがそろえば先手と後手が入れ替わるので、そこを取りに行く。
 *
 * 後手だと相手が先に引き直すので、その捨て札を見てから決められる。
 * 捨て札に 7 が無い＝まだ残っている、と読めるようにしてある。
 * こちらの手札は 5・6・8・9 と、7 だけが抜けた並び。引き直しで 7♥ を
 * 引くとストレートがそろう。
 *
 * 相手の布陣はわざと何もそろえていない。この回で覚えることを
 * ストレートひとつに絞りたいため。フラッシュは第8話で扱う。
 *
 * 盤の上では 8♣ の進路を味方の 6♦ が塞いでいる。どかしてから進むと
 * 相手が取れる。
 */
const EP11_DECK = fill(
  [
    // あなたの手札7枚。5・6・8・9 と、7 だけが抜けている。K♦ が余分
    "5H",
    "6D",
    "8C",
    "9C",
    "KD",
    "2C",
    "3S",
    // 相手の手札7枚。マークも数字もばらけさせて、効果が出ないようにする。
    // この話はストレートだけを教えたいので、相手側では何も起こさない
    "QH",
    "JD",
    "10C",
    "9S",
    "3H",
    "4D",
    "6C",
  ],
  CARD_POOLS.court,
);

const EP11_SEVEN = idOf(EP11_DECK, "7H");

const EP11 = {
  id: 11,
  level: 10,
  // 終えると入る経験値。次のレベルまでちょうど届く量にして、1話ずつ開く
  xp: 800,
  title: "第11話 布陣の妙",
  // 読んでから決める回なので、説明は前面に出して先に読ませる
  readFirst: true,
  subtitle: "数字をそろえて、先手を取り返す",
  pool: CARD_POOLS.court,
  poolLabel: "2 〜 K",
  boardSize: 5,
  handSize: 7,
  // 必ず後手になる目。相手の引き直しを先に見せたい
  dice: [2, 6],
  deck: EP11_DECK,
  bonus: true,
  reserveOrder: reserveWith(EP11_DECK, 2, ["7H"]),
  foe: {
    // ハート以外の2枚を捨てる。「ハートを集めている」と読める
    discardIds: ["t12", "t13"],
    // 王は c5 の Q♥。その手前 c4 に J♥
    placement: {
      t7: { row: 0, col: 2 },
      t8: { row: 1, col: 2 },
      t9: { row: 0, col: 0 },
      t10: { row: 1, col: 0 },
      t11: { row: 1, col: 4 },
    },
    kingId: "t7",
    moves: [
      { pieceId: "t10", row: 2, col: 1 },
      { pieceId: "t11", row: 2, col: 3 },
    ],
  },
  steps: [
    {
      text: "布陣がそろうと、対局前に効果が起きます。まずサイコロを。",
      need: { type: "ROLL_DICE_SINGLE" },
      focus: { button: true },
    },
    {
      at: atMulligan,
      text: "あなたは後手。このままでは相手に先に指されます。",
    },
    {
      text: "ストレートがそろえば先手と後手が入れ替わります。先手を取りに行けます。",
    },
    {
      text: "相手が先に引き直しました。捨て札に 7 はありません。山に残っている見込みがあります。",
    },
    {
      text: "手札は 5・6・8・9。7 を引ければ並びます。光った K♦ をタップ。",
      need: { type: "TOGGLE_MULLIGAN_CARD", cardId: "t4" },
      focus: { cards: ["t4"] },
    },
    {
      text: "「引き直して確定」を押します。",
      need: { type: "CONFIRM_MULLIGAN" },
      focus: { button: true },
    },
    {
      at: atPlace,
      text: "7♥ が来ました。5・6・7・8・9 で並びます。8♣ を c1 へ。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t2", row: 4, col: 2 },
      focus: { cards: ["t2"], cells: [{ row: 4, col: 2 }] },
    },
    {
      text: "6♦ を c2 へ。8 のすぐ前です。あとで効いてきます。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t1", row: 3, col: 2 },
      focus: { cards: ["t1"], cells: [{ row: 3, col: 2 }] },
    },
    {
      text: "9♣ を a1 へ。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t3", row: 4, col: 0 },
      focus: { cards: ["t3"], cells: [{ row: 4, col: 0 }] },
    },
    {
      text: "7♥ を a2 へ。",
      need: { type: "SETUP_PLACE_CARD", cardId: EP11_SEVEN, row: 3, col: 0 },
      focus: { cards: [EP11_SEVEN], cells: [{ row: 3, col: 0 }] },
    },
    {
      text: "5♥ を e1 へ。これで 5・6・7・8・9 がそろいました。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t0", row: 4, col: 4 },
      focus: { cards: ["t0"], cells: [{ row: 4, col: 4 }] },
    },
    {
      text: "「王を選ぶ」へ進みます。",
      need: { type: "SETUP_GOTO_KING_STEP" },
      focus: { button: true },
    },
    {
      at: atKing,
      text: "e1 の 5♥ を王にします。タップしてください。",
      need: { type: "SETUP_PICK_KING", cardId: "t0" },
      focus: { cells: [{ row: 4, col: 4 }] },
    },
    {
      text: "「布陣を確定」を押します。",
      need: { type: "SETUP_CONFIRM" },
      focus: { button: true },
    },
    {
      at: (s) => !!s.setupEffects,
      text: "狙いどおりストレート。先手と後手が入れ替わります。",
      need: { type: "DISMISS_SETUP_EFFECTS" },
      focus: { button: true },
    },
    {
      at: myTurn,
      text: "後手だったあなたが、先に指せるようになりました。",
    },
    {
      text: "c1 の 8♣ は縦横に奇数マス。でも前に味方の 6♦ がいて進めません。",
    },
    {
      text: "先に 6♦ をどかします。c2 の 6♦ を e2 へ。6 は縦横に偶数マス。",
      need: { type: "MOVE_PIECE", pieceId: "t1", row: 3, col: 4 },
      focus: {
        cells: [
          { row: 3, col: 2 },
          { row: 3, col: 4 },
        ],
      },
    },
    {
      at: myTurn,
      text: "道が空きました。8♣ を3マス先の c4 へ。相手なら取れます。",
      need: { type: "MOVE_PIECE", pieceId: "t2", row: 1, col: 2 },
      focus: {
        cells: [
          { row: 4, col: 2 },
          { row: 1, col: 2 },
        ],
      },
    },
    {
      at: myTurn,
      text: "もう1マス先が相手の王です。8♣ を c5 へ。",
      need: { type: "MOVE_PIECE", pieceId: "t2", row: 0, col: 2 },
      focus: {
        cells: [
          { row: 1, col: 2 },
          { row: 0, col: 2 },
        ],
      },
    },
    {
      at: atEnd,
      text: "先に指せたぶん、1手早く王に届きました。ストレートは先手を取り返す手です。",
      end: true,
    },
  ],
};

/* ---------------- 第12話 ---------------- */

/**
 * フラッシュの回。
 *
 * こちらも必ず後手。相手の捨て札には ♠ が1枚も無いので、
 * 「♠ はまだ場に残っている＝狙う価値がある」と読める。
 *
 * 引き直しで J♠ を引くとマークがそろい、相手の駒が1枚めくれる。
 * めくれた駒は動ける先まで読めるので、それを確かめてから踏み込む。
 * 分かった1枚をどう使うかが、この回のねらい。
 */
const EP12_DECK = fill(
  [
    // あなたの手札7枚。スペードが4枚
    "3S",
    "6S",
    "9S",
    "QS",
    "4H",
    "7D",
    "2H",
    // 相手の手札7枚。マークも数字もばらばら。捨てる2枚に ♠ を入れない
    "KH",
    "10D",
    "8C",
    "5H",
    "2D",
    "4C",
    "3D",
  ],
  CARD_POOLS.court,
);

const EP12_JACK = idOf(EP12_DECK, "JS");

const EP12 = {
  id: 12,
  level: 10,
  // 終えると入る経験値。次のレベルまでちょうど届く量にして、1話ずつ開く
  xp: 900,
  title: "第12話 見えた1枚",
  // 読んでから決める回なので、説明は前面に出して先に読ませる
  readFirst: true,
  subtitle: "捨て札を読んで、マークをそろえる",
  pool: CARD_POOLS.court,
  poolLabel: "2 〜 K",
  boardSize: 5,
  handSize: 7,
  dice: [2, 6],
  deck: EP12_DECK,
  bonus: true,
  reserveOrder: reserveWith(EP12_DECK, 2, ["JS"]),
  foe: {
    // ♠ を含まない2枚を捨てる
    discardIds: ["t12", "t13"],
    // 王は e5 の K♥。その手前 d4 に 2♦ を置いて斜めの道を塞ぐ
    placement: {
      t7: { row: 0, col: 4 },
      t8: { row: 0, col: 0 },
      t9: { row: 1, col: 0 },
      t10: { row: 1, col: 2 },
      t11: { row: 1, col: 3 },
    },
    kingId: "t7",
    moves: [
      { pieceId: "t10", row: 2, col: 1 },
      { pieceId: "t9", row: 2, col: 0 },
    ],
  },
  steps: [
    {
      text: "今回はマークをそろえます。まずサイコロを。",
      need: { type: "ROLL_DICE_SINGLE" },
      focus: { button: true },
    },
    {
      at: atMulligan,
      text: "また後手。相手の捨て札を先に見られます。",
    },
    {
      text: "5枚とも同じマークならフラッシュ。対局前に、相手の駒が1枚めくれます。",
    },
    {
      text: "捨てられたのは ♣ と ♦。♠ は1枚も出ていません。まだ場に残っています。",
    },
    {
      text: "手札はスペードが4枚。あと1枚でフラッシュ。狙う価値があります。",
    },
    {
      text: "光った 4♥ をタップして捨てます。",
      need: { type: "TOGGLE_MULLIGAN_CARD", cardId: "t4" },
      focus: { cards: ["t4"] },
    },
    {
      text: "「引き直して確定」を押します。",
      need: { type: "CONFIRM_MULLIGAN" },
      focus: { button: true },
    },
    {
      at: atPlace,
      text: "J♠ が来ました。スペード5枚を並べます。Q♠ を a1 へ。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t3", row: 4, col: 0 },
      focus: { cards: ["t3"], cells: [{ row: 4, col: 0 }] },
    },
    {
      text: "9♠ を b1 へ。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t2", row: 4, col: 1 },
      focus: { cards: ["t2"], cells: [{ row: 4, col: 1 }] },
    },
    {
      text: "J♠ を c1 へ。",
      need: { type: "SETUP_PLACE_CARD", cardId: EP12_JACK, row: 4, col: 2 },
      focus: { cards: [EP12_JACK], cells: [{ row: 4, col: 2 }] },
    },
    {
      text: "3♠ を d2 へ。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t0", row: 3, col: 3 },
      focus: { cards: ["t0"], cells: [{ row: 3, col: 3 }] },
    },
    {
      text: "6♠ を e1 へ。これで5枚ともスペードです。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t1", row: 4, col: 4 },
      focus: { cards: ["t1"], cells: [{ row: 4, col: 4 }] },
    },
    {
      text: "「王を選ぶ」へ進みます。",
      need: { type: "SETUP_GOTO_KING_STEP" },
      focus: { button: true },
    },
    {
      at: atKing,
      text: "e1 の 6♠ を王にします。タップしてください。",
      need: { type: "SETUP_PICK_KING", cardId: "t1" },
      focus: { cells: [{ row: 4, col: 4 }] },
    },
    {
      text: "「布陣を確定」を押します。",
      need: { type: "SETUP_CONFIRM" },
      focus: { button: true },
    },
    {
      at: (s) => !!s.setupEffects,
      text: "狙いどおりフラッシュ。相手の駒が1枚めくれました。",
      need: { type: "DISMISS_SETUP_EFFECTS" },
      focus: { button: true },
    },
    {
      at: myTurn,
      text: "めくれた駒だけは正体が分かります。伏せた駒とは違います。",
    },
    {
      text: "めくれたのは 10♦。10 は縦2横1へしか跳べず、d4 には届きません。だから d4 は安全です。",
      focus: { cells: [{ row: 1, col: 3 }] },
    },
    {
      text: "安全と分かった d4 へ。a1 の Q♠ を斜めに進めて相手を取ります。",
      need: { type: "MOVE_PIECE", pieceId: "t3", row: 1, col: 3 },
      focus: {
        cells: [
          { row: 4, col: 0 },
          { row: 1, col: 3 },
        ],
      },
    },
    {
      at: myTurn,
      text: "そのまま斜め1マス先が相手の王です。Q♠ を e5 へ。",
      need: { type: "MOVE_PIECE", pieceId: "t3", row: 0, col: 4 },
      focus: {
        cells: [
          { row: 1, col: 3 },
          { row: 0, col: 4 },
        ],
      },
    },
    {
      at: atEnd,
      text: "捨て札で狙いを決め、めくった1枚で踏み込む。布陣は情報戦です。",
      end: true,
    },
  ],
};

export const TUTORIALS = [
  EP1,
  EP2,
  EP3,
  EP4,
  EP5,
  EP6,
  EP7,
  EP8,
  EP9,
  EP10,
  EP11,
  EP12,
];

export function tutorialById(id) {
  return TUTORIALS.find((t) => t.id === id) || null;
}

/* =========================================================================
   台本を動かすための道具
   ========================================================================= */

/** その操作が、いま求められているものか */
export function matchesNeed(need, action) {
  if (!need) return false;
  if (need.type !== action.type) return false;
  for (const key of Object.keys(need)) {
    if (key === "type") continue;
    if (action[key] !== need[key]) return false;
  }
  return true;
}

/**
 * 説明だけの札を見ているとき、この先に控えている操作を返す。
 *
 * 説明中でも、指示された手をそのまま指せば案内は先へ進む。
 * ただし台本にない手まで通してしまうと盤面がずれるので、
 * 「次にやること」だけを通す関門として使う。
 */
export function upcomingNeedStep(tut, from, state) {
  for (let i = from; i < tut.steps.length; i++) {
    const step = tut.steps[i];
    if (!step.need) continue;
    if (step.at && !step.at(state)) return null;
    return step;
  }
  return null;
}

/** 台本が止まらないよう、いつでも通す操作 */
export const FREE_ACTIONS = new Set([
  // 対局を組み立てる側の操作。プレイヤーの操作ではないので必ず通す
  "START_SETUP",
  "NEXT_DICE_STEP",
  "GOTO_MULLIGAN",
  "VIEW_LOG",
  "CLOSE_LOG",
  "SELECT_PIECE",
  "CANCEL_SELECTION",
  "DISMISS_INTERSTITIAL",
  "DISMISS_CAPTURE",
  "ACK_KING_CHOICE",
  "SETUP_UNPLACE_CARD",
  "SETUP_BACK_TO_PLACE",
  "RESIGN",
  "NEW_GAME",
]);

/**
 * 相手(青)の手。すべて台本どおりで、考えることはしない。
 * moveIdx は、すでに指した手の数。
 */
export function foeAction(state, tut, moveIdx, legalMovesOf) {
  if (state.phase === "gameover") return null;
  if (state.captureReveal) return null;

  if (state.phase === "dice") {
    if (state.diceIdx !== 1) return null;
    return state.dice[1] === null
      ? { type: "ROLL_DICE_SINGLE", value: tut.dice[1] }
      : { type: "NEXT_DICE_STEP" };
  }

  if (state.phase === "mulligan") {
    if (state.mulliganIdx !== 1) return null;
    return {
      type: "CONFIRM_MULLIGAN",
      discardIds: [...tut.foe.discardIds],
      reserveOrder: [...tut.reserveOrder],
    };
  }

  if (state.phase === "setup") {
    if (state.setupDone[1]) return null;
    return {
      type: "SETUP_CONFIRM",
      player: 1,
      placement: tut.foe.placement,
      kingId: tut.foe.kingId,
    };
  }

  if (state.phase === "play") {
    if (state.pendingKingChoice && state.pendingKingChoice.owner === 1)
      return state.pendingKingChoice.acknowledged
        ? { type: "CHOOSE_HEIR", id: state.pendingKingChoice.candidateIds[0] }
        : { type: "ACK_KING_CHOICE" };
    if (state.currentTurn !== 1) return null;
    if (state.kPlacement && state.kPlacement.owner === 1)
      return { type: "SKIP_RESERVE_PLACEMENT" };

    const planned = tut.foe.moves[moveIdx];
    if (!planned) return null;
    const piece = state.pieces[planned.pieceId];
    if (!piece || !piece.alive) return null;
    const legal = legalMovesOf(piece);
    const hit = legal.find(
      (m) => m.row === planned.row && m.col === planned.col,
    );
    if (!hit) return null;
    return {
      type: "MOVE_PIECE",
      pieceId: planned.pieceId,
      row: planned.row,
      col: planned.col,
      captures: hit.captures,
    };
  }

  return null;
}

/* ---------------- 案内を画面に追従させる ---------------- */

/** いまの場面が、対局のどこまで進んでいるか */
function sceneRank(s) {
  // 対局が始まる前。ここを「いちばん後ろ」と数えると台本を丸ごと飛ばしてしまう
  if (s.phase === "intro" || !s.setupSteps) return -1;
  if (s.phase === "dice") return 0;
  if (s.phase === "mulligan") return 1;
  if (s.phase === "setup") {
    if (s.setupDone[0]) return 3.5;
    return s.setupSteps[0] === "place" ? 2 : 3;
  }
  if (s.phase === "play") return 4;
  return 5;
}

/** その操作が、どの場面のものか */
const NEED_RANK = {
  ROLL_DICE_SINGLE: 0,
  TOGGLE_MULLIGAN_CARD: 1,
  CONFIRM_MULLIGAN: 1,
  SETUP_PLACE_CARD: 2,
  SETUP_GOTO_KING_STEP: 2,
  SETUP_PICK_KING: 3,
  SETUP_CONFIRM: 3,
  DISMISS_SETUP_EFFECTS: 4,
  MOVE_PIECE: 4,
  PLACE_RESERVE_CARD: 4,
  TOGGLE_SHUFFLE_PICK: 4,
  CONFIRM_SHUFFLE: 4,
};

/**
 * あなたが入れ替えを済ませたか。
 *
 * 盤の lastSwap は演出用で、手番が移ると消える。それを見ていると
 * 済んだはずの案内が「まだ」に戻ってしまう。記録は増える一方なので、
 * こちらを見る。1話に入れ替えが2回ある台本では、数え方を足すこと。
 */
const swapDone = (s) =>
  s.log.some((l) =>
    l.startsWith(`${PLAYER_META[0].name}が3つの駒の位置を入れ替えた`),
  );

/**
 * その操作がもう済んでいるか。
 * 案内はこれを見て自動で次へ進むので、どんな触り方をされても画面とずれない。
 */
export function needDone(need, s) {
  const want = NEED_RANK[need.type];
  if (want === undefined) return false;
  const now = sceneRank(s);
  if (now < want) return false; // まだその場面に来ていない
  if (now > want) return true; // もう通り過ぎた

  switch (need.type) {
    case "ROLL_DICE_SINGLE":
      return s.dice[0] !== null;
    case "TOGGLE_MULLIGAN_CARD":
      return (s.players[0]._mulliganSelected || []).includes(need.cardId);
    case "CONFIRM_MULLIGAN":
      return false; // 場面が変われば now > want になる
    case "SETUP_PLACE_CARD": {
      const at = s.setupPlacements[0][need.cardId];
      return !!at && at.row === need.row && at.col === need.col;
    }
    case "SETUP_GOTO_KING_STEP":
      return false;
    case "SETUP_PICK_KING":
      return s.setupPickKings[0] === need.cardId;
    case "SETUP_CONFIRM":
      return false;
    case "TOGGLE_SHUFFLE_PICK":
      // 入れ替えが済んでいれば、選び直しの段階はもう過ぎている
      if (swapDone(s)) return true;
      return !!s.shuffleMode && s.shuffleMode.picks.includes(need.id);
    case "CONFIRM_SHUFFLE":
      return swapDone(s);
    case "PLACE_RESERVE_CARD": {
      // 「置く札が無い」だけだと、引く前と置いた後を区別できない。
      // 指定のマスに自分の駒が立ったかで見る
      if (need.row === undefined) return !s.kPlacement;
      const here = s.board[need.row] && s.board[need.row][need.col];
      return !!here && here.owner === 0;
    }
    case "DISMISS_SETUP_EFFECTS":
      return !s.setupEffects;
    case "MOVE_PIECE": {
      const piece = s.pieces[need.pieceId];
      if (!piece) return false;
      return !piece.alive || (piece.row === need.row && piece.col === need.col);
    }
    default:
      return false;
  }
}

/**
 * 布陣の途中で札を手札に戻されたら、案内をその札の指示まで戻す。
 *
 * 「この駒を手札に戻す」と盤外へのドラッグは FREE_ACTIONS なのでいつでも通る。
 * ところが案内は先へしか進まないので、戻した札の指示はもう過ぎている。すると
 * 置き直しが「台本にない操作」として無言で弾かれ、5枚そろわないまま
 * 「王を選ぶ」も押せず、投げ出す以外に出口が無くなる。
 *
 * 済んだかどうかは needDone を通さずに盤から直に見る。王を選ぶ場面まで
 * 進んでいると needDone は「もう通り過ぎた」と答えてしまい、欠けに気づけない。
 */
function rewoundForPlacement(tut, s, from) {
  if (s.phase !== "setup" || !s.setupPlacements || s.setupDone[0]) return from;
  const placed = s.setupPlacements[0];
  for (let i = 0; i < from && i < tut.steps.length; i++) {
    const need = tut.steps[i].need;
    if (!need || need.type !== "SETUP_PLACE_CARD") continue;
    const at = placed[need.cardId];
    if (!at || at.row !== need.row || at.col !== need.col) return i;
  }
  return from;
}

/**
 * いま出すべき台本の位置。
 * from から始めて、盤面を見て「もう済んだ」ものを飛ばす。
 */
export function currentStepIndex(tut, s, from) {
  let i = Math.max(
    0,
    rewoundForPlacement(tut, s, Math.min(from, tut.steps.length)),
  );
  while (i < tut.steps.length) {
    const step = tut.steps[i];
    if (step.need) {
      if (!needDone(step.need, s)) break;
      i++;
      continue;
    }
    // 説明だけの札。この先の操作がもう済んでいるなら、
    // 読まずに進んだものとして案内も先へ送る
    let j = i + 1;
    while (j < tut.steps.length && !tut.steps[j].need) j++;
    if (j < tut.steps.length && needDone(tut.steps[j].need, s)) {
      i++;
      continue;
    }
    break;
  }
  return i;
}
