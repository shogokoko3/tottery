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
import { CARD_POOLS, SUITS } from "./constants.js";

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

const EP1_DECK = fill(
  [
    // あなたの手札6枚
    "2S",
    "2H",
    "3S",
    "4S",
    "5S",
    "5H",
    // 相手の手札6枚。王は 4♥ にする。
    // 同じ4がもう1枚あるので、4♦ を取ると「道連れ」が起きる
    "4H",
    "4D",
    "3H",
    "3D",
    "2D",
    "5D",
  ],
  CARD_POOLS.basic,
);

const EP1 = {
  id: 1,
  level: 1,
  title: "第1話 王を討つ",
  subtitle: "遊び方をひと通り",
  pool: CARD_POOLS.basic,
  poolLabel: "2 〜 5",
  boardSize: 5,
  handSize: 6,
  dice: [6, 2],
  deck: EP1_DECK,
  // 引き直しで引く札の順。配り終えた残りをそのまま使う
  reserveOrder: EP1_DECK.slice(12).map((c) => c.id),
  foe: {
    discardIds: [],
    // 王は c5 の 4♥。その手前 c4 に、もう1枚の 4♦ を置く
    placement: {
      t6: { row: 0, col: 2 },
      t7: { row: 1, col: 2 },
      t8: { row: 0, col: 1 },
      t9: { row: 1, col: 1 },
      t10: { row: 1, col: 3 },
    },
    kingId: "t6",
    // 台本どおりの3手。使い切ったあとはCPUが引き継ぐので、止まることはない
    moves: [
      { pieceId: "t9", row: 2, col: 0 },
      { pieceId: "t10", row: 2, col: 3 },
      // あなたの王を取りに来る手。ここで王位継承が起きる
      { pieceId: "t6", row: 2, col: 2 },
    ],
  },
  steps: [
    {
      text: "相手の王を取れば勝ちです。まずサイコロを振ります。",
      need: { type: "ROLL_DICE_SINGLE" },
      focus: { button: true },
    },
    {
      at: atMulligan,
      text: "いらない札は捨てて引き直せます。光った 5♥ をタップ。",
      need: { type: "TOGGLE_MULLIGAN_CARD", cardId: "t5" },
      focus: { cards: ["t5"] },
    },
    {
      text: "捨てた札は相手に見えます。「引き直して確定」を押します。",
      need: { type: "CONFIRM_MULLIGAN" },
      focus: { button: true },
    },
    {
      at: atPlace,
      text: "自陣に5枚ならべます。光った 2♠ を、光ったマス c1 へドラッグ。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t0", row: 4, col: 2 },
      focus: { cards: ["t0"], cells: [{ row: 4, col: 2 }] },
    },
    {
      text: "もう1枚の 2♥ を b1 へ。同じ数字を2枚持つ意味は、あとで分かります。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t1", row: 4, col: 1 },
      focus: { cards: ["t1"], cells: [{ row: 4, col: 1 }] },
    },
    {
      text: "4♠ を c2 へ。4は縦横に2マスまで動けます。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t3", row: 3, col: 2 },
      focus: { cards: ["t3"], cells: [{ row: 3, col: 2 }] },
    },
    {
      text: "5♠ を b2 へ。5は斜めに2マスまで。カードを持つと動ける先が光ります。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t4", row: 3, col: 1 },
      focus: { cards: ["t4"], cells: [{ row: 3, col: 1 }] },
    },
    {
      text: "3♠ を d2 へ。これで5枚そろいます。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t2", row: 3, col: 3 },
      focus: { cards: ["t2"], cells: [{ row: 3, col: 3 }] },
    },
    {
      text: "「王を選ぶ」を押します。",
      need: { type: "SETUP_GOTO_KING_STEP" },
      focus: { button: true },
    },
    {
      at: atKing,
      text: "取られたら負けの1枚を決めます。光った c1 の 2♠ をタップ。",
      need: { type: "SETUP_PICK_KING", cardId: "t0" },
      focus: { cells: [{ row: 4, col: 2 }] },
    },
    {
      text: "王になると力が変わります。2の王は、軍の2の枚数だけ遠くへ動けます。「布陣を確定」を押します。",
      need: { type: "SETUP_CONFIRM" },
      focus: { button: true },
    },
    {
      at: myTurn,
      text: "光った駒をタップして、光ったマスをタップ。4♠ を c3 へ。",
      need: { type: "MOVE_PIECE", pieceId: "t3", row: 2, col: 2 },
      focus: { pieces: ["t3"], cells: [{ row: 2, col: 2 }] },
    },
    {
      at: myTurn,
      text: "c4 の相手の駒を取ります。取る手には必ず確認が出ます。",
      need: { type: "MOVE_PIECE", pieceId: "t3", row: 1, col: 2 },
      focus: { pieces: ["t3"], cells: [{ row: 1, col: 2 }] },
    },
    {
      at: myTurnOrEnd,
      text: "あなたの 4♠ も一緒に倒れました。相手の王が4だと、4を取ると道連れにされます。",
      focus: { pieces: ["t0"], cells: [{ row: 2, col: 2 }] },
    },
    {
      at: myTurn,
      text: "王も自分で動かせます。2の王は2マス先まで届きます。c1 の王を c3 へ。",
      need: { type: "MOVE_PIECE", pieceId: "t0", row: 2, col: 2 },
      focus: { pieces: ["t0"], cells: [{ row: 2, col: 2 }] },
    },
    {
      at: myTurnOrEnd,
      text: "王を取られました。でも負けていません。2か3の王は、同じ数字が王位を継ぎます。",
    },
    {
      at: myTurn,
      text: "c3 に出てきた駒を、5♠ で取ります。",
      need: { type: "MOVE_PIECE", pieceId: "t4", row: 2, col: 2 },
      focus: { pieces: ["t4"], cells: [{ row: 2, col: 2 }] },
    },
    {
      at: atEnd,
      text: "勝ちです。王を討つ、道連れ、王位の継承。これがトッタリーの土台です。",
      end: true,
    },
  ],
};

/* ---------------- 第2話 ---------------- */

const EP2_DECK = fill(
  [
    // あなたの手札9枚。王は 6♠ にする
    "6S",
    "6H",
    "8S",
    "10S",
    "4S",
    "2S",
    "3S",
    "5S",
    "9S",
    // 相手の手札9枚。王は 7♥（7は継承しないので、取れば決着）
    "7H",
    "7D",
    "9H",
    "10H",
    "2H",
    "3H",
    "4H",
    "5H",
    "8H",
  ],
  CARD_POOLS.numbers,
);

const EP2 = {
  id: 2,
  level: 3,
  title: "第2話 まとめて討つ",
  subtitle: "飛び越える駒と、王のまとめ取り",
  pool: CARD_POOLS.numbers,
  poolLabel: "2 〜 10",
  boardSize: 5,
  handSize: 9,
  dice: [5, 3],
  deck: EP2_DECK,
  reserveOrder: EP2_DECK.slice(18).map((c) => c.id),
  foe: {
    discardIds: [],
    placement: {
      t9: { row: 0, col: 2 },
      t10: { row: 0, col: 1 },
      t11: { row: 1, col: 1 },
      t12: { row: 1, col: 3 },
      t13: { row: 1, col: 2 },
    },
    kingId: "t9",
    moves: [
      // c4 から c3 へ出てくる。王の6の射線に2体並ぶ形になる
      { pieceId: "t13", row: 2, col: 2 },
      { pieceId: "t12", row: 2, col: 1 },
    ],
  },
  steps: [
    {
      text: "第2話は 2〜10 の36枚で戦います。サイコロを振ります。",
      need: { type: "ROLL_DICE_SINGLE" },
      focus: { button: true },
    },
    {
      at: atMulligan,
      text: "いらない札は捨てて引き直せます。光った 2♠ をタップ。",
      need: { type: "TOGGLE_MULLIGAN_CARD", cardId: "t5" },
      focus: { cards: ["t5"] },
    },
    {
      text: "捨てた札は相手に見えます。「引き直して確定」を押します。",
      need: { type: "CONFIRM_MULLIGAN" },
      focus: { button: true },
    },
    {
      at: atPlace,
      text: "9枚から5枚を選んで並べます。光った 6♠ を c1 へドラッグ。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t0", row: 4, col: 2 },
      focus: { cards: ["t0"], cells: [{ row: 4, col: 2 }] },
    },
    {
      text: "8♠ を b1 へ。8は縦横に奇数マス動けます。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t2", row: 4, col: 1 },
      focus: { cards: ["t2"], cells: [{ row: 4, col: 1 }] },
    },
    {
      text: "9♠ は a2 へ。8♠ の前を塞ぐと進めなくなるので、避けて置きます。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t8", row: 3, col: 0 },
      focus: { cards: ["t8"], cells: [{ row: 3, col: 0 }] },
    },
    {
      text: "10♠ を d2 へ。10は将棋の桂馬と同じ跳び方をします。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t3", row: 3, col: 3 },
      focus: { cards: ["t3"], cells: [{ row: 3, col: 3 }] },
    },
    {
      text: "6♥ を d1 へ。これで5枚そろいます。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t1", row: 4, col: 3 },
      focus: { cards: ["t1"], cells: [{ row: 4, col: 3 }] },
    },
    {
      text: "「王を選ぶ」を押します。",
      need: { type: "SETUP_GOTO_KING_STEP" },
      focus: { button: true },
    },
    {
      at: atKing,
      text: "今回は6を王にします。光った c1 の 6♠ をタップ。",
      need: { type: "SETUP_PICK_KING", cardId: "t0" },
      focus: { cells: [{ row: 4, col: 2 }] },
    },
    {
      text: "王の6は、同じ線に並んだ相手をまとめて取れます。「布陣を確定」を押します。",
      need: { type: "SETUP_CONFIRM" },
      focus: { button: true },
    },
    {
      at: myTurn,
      text: "6〜9は進路を塞がれます。味方が前にいると止まり、相手なら取って止まります。",
      // 読まずにそのまま指しても進めるよう、次に触る場所を光らせておく
      focus: { pieces: ["t2"], cells: [{ row: 1, col: 1 }] },
    },
    {
      at: myTurn,
      text: "b列は空いています。b1 の 8♠ で、b4 の相手を取ります。",
      need: { type: "MOVE_PIECE", pieceId: "t2", row: 1, col: 1 },
      focus: { pieces: ["t2"], cells: [{ row: 1, col: 1 }] },
    },
    {
      at: myTurn,
      text: "10の跳び方も見ておきます。d2 の 10♠ を e4 へ。",
      need: { type: "MOVE_PIECE", pieceId: "t3", row: 1, col: 4 },
      focus: { pieces: ["t3"], cells: [{ row: 1, col: 4 }] },
    },
    {
      at: myTurn,
      text: "c列が空きました。王の 6♠ で、c3 と c5 をまとめて取ります。",
      need: { type: "MOVE_PIECE", pieceId: "t0", row: 0, col: 2 },
      focus: { pieces: ["t0"], cells: [{ row: 0, col: 2 }] },
    },
    {
      at: atEnd,
      text: "2体まとめて取って決着です。数字の駒はこれで全部そろいました。",
      end: true,
    },
  ],
};

/* ---------------- 第3話 ---------------- */

const EP3_DECK = fill(
  [
    // あなたの手札13枚。王は K♠
    "KS",
    "JS",
    "QS",
    "10S",
    "5S",
    "9S",
    "8S",
    "7S",
    "6S",
    "4S",
    "3S",
    "2S",
    "JH",
    // 相手の手札13枚。王は Q♥（Qは継承しないので、取れば決着）
    "QH",
    "10H",
    "9H",
    "8H",
    "7H",
    "6H",
    "5H",
    "4H",
    "3H",
    "2H",
    "JD",
    "QD",
    "KH",
  ],
  CARD_POOLS.court,
);

const EP3 = {
  id: 3,
  level: 5,
  title: "第3話 宮廷の札",
  subtitle: "J・Q・K と、失って増える王",
  pool: CARD_POOLS.court,
  poolLabel: "2 〜 K",
  boardSize: 5,
  handSize: 13,
  dice: [4, 2],
  deck: EP3_DECK,
  reserveOrder: EP3_DECK.slice(26).map((c) => c.id),
  foe: {
    discardIds: [],
    placement: {
      t13: { row: 0, col: 2 },
      t23: { row: 1, col: 2 },
      t14: { row: 1, col: 1 },
      t15: { row: 1, col: 3 },
      t16: { row: 0, col: 1 },
    },
    kingId: "t13",
    moves: [
      // あなたの J♠ を取りに来る。ここで K の王の力が働く
      { pieceId: "t23", row: 2, col: 2 },
      { pieceId: "t14", row: 0, col: 3 },
      { pieceId: "t16", row: 1, col: 1 },
    ],
  },
  steps: [
    {
      text: "第3話は J・Q・K が加わります。サイコロを振ります。",
      need: { type: "ROLL_DICE_SINGLE" },
      focus: { button: true },
    },
    {
      at: atMulligan,
      // Kを王にすると J と Q は1枚ずつ。余った J♥ を捨てさせる
      text: "Kを王にすると J と Q は1枚ずつしか使えません。余る J♥ をタップ。",
      need: { type: "TOGGLE_MULLIGAN_CARD", cardId: "t12" },
      focus: { cards: ["t12"] },
    },
    {
      text: "捨てた札は相手に見えます。「引き直して確定」を押します。",
      need: { type: "CONFIRM_MULLIGAN" },
      focus: { button: true },
    },
    {
      at: atPlace,
      text: "K♠ を c1 へ。Kは王にするときだけ1枚採用できます。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t0", row: 4, col: 2 },
      focus: { cards: ["t0"], cells: [{ row: 4, col: 2 }] },
    },
    {
      text: "J♠ を c2 へ。Jは縦横にどこまでも動けます。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t1", row: 3, col: 2 },
      focus: { cards: ["t1"], cells: [{ row: 3, col: 2 }] },
    },
    {
      text: "Q♠ を b1 へ。Qは斜めにどこまでも。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t2", row: 4, col: 1 },
      focus: { cards: ["t2"], cells: [{ row: 4, col: 1 }] },
    },
    {
      text: "10♠ を d1 へ。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t3", row: 4, col: 3 },
      focus: { cards: ["t3"], cells: [{ row: 4, col: 3 }] },
    },
    {
      text: "5♠ を d2 へ。これで5枚そろいます。",
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
      text: "Kを置いているので、王はKになります。c1 の K♠ をタップ。",
      need: { type: "SETUP_PICK_KING", cardId: "t0" },
      focus: { cells: [{ row: 4, col: 2 }] },
    },
    {
      text: "Kの王は、自分のJかQが倒されるたびに予備札を1枚出せます。「布陣を確定」を押します。",
      need: { type: "SETUP_CONFIRM" },
      focus: { button: true },
    },
    {
      at: myTurn,
      text: "c2 の J♠ を c3 へ。縦横なら何マスでも進めます。",
      need: { type: "MOVE_PIECE", pieceId: "t1", row: 2, col: 2 },
      focus: { pieces: ["t1"], cells: [{ row: 2, col: 2 }] },
    },
    {
      // 相手が J♠ を取ると、予備札を置く画面が出る
      at: (s) => s.phase === "play" && s.currentTurn === 0 && !!s.kPlacement,
      text: "J♠ を取られました。王がKなので予備札を1枚出せます。光った b2 をタップ。",
      need: { type: "PLACE_RESERVE_CARD", row: 3, col: 1 },
      focus: { cells: [{ row: 3, col: 1 }] },
    },
    {
      at: myTurn,
      text: "失うほど戦力が湧く王です。K♠ で c3 の相手を取り返します。",
      need: { type: "MOVE_PIECE", pieceId: "t0", row: 2, col: 2 },
      focus: { pieces: ["t0"], cells: [{ row: 2, col: 2 }] },
    },
    {
      at: myTurn,
      text: "c5 の駒を K♠ で取ります。",
      need: { type: "MOVE_PIECE", pieceId: "t0", row: 0, col: 2 },
      focus: { pieces: ["t0"], cells: [{ row: 0, col: 2 }] },
    },
    {
      at: atEnd,
      text: "Aを除く全部のカードが出そろいました。最後はAを扱います。",
      end: true,
    },
  ],
};

/* ---------------- 第4話 ---------------- */

const EP4_DECK = fill(
  [
    // あなたの手札13枚。王は 3♠
    "AS",
    "AH",
    "KS",
    "QS",
    "JS",
    "10S",
    "9S",
    "8S",
    "7S",
    "6S",
    "5S",
    "4S",
    "3S",
    // 相手の手札13枚。王は J♥（Jは継承しないので、囲んで取れば決着）
    "AD",
    "KH",
    "QH",
    "JH",
    "10H",
    "9H",
    "8H",
    "7H",
    "6H",
    "5H",
    "4H",
    "3H",
    "2H",
  ],
  CARD_POOLS.full,
);

const EP4 = {
  id: 4,
  level: 7,
  title: "第4話 A の理",
  subtitle: "動かない駒と、囲んでの撃破",
  pool: CARD_POOLS.full,
  poolLabel: "A 〜 K",
  boardSize: 5,
  handSize: 13,
  dice: [6, 1],
  deck: EP4_DECK,
  reserveOrder: EP4_DECK.slice(26).map((c) => c.id),
  // 入れ替えの並び順。固定しないと毎回ちがう配置になる
  shuffleOrder: [1, 2, 0],
  foe: {
    discardIds: [],
    placement: {
      t16: { row: 0, col: 2 },
      t17: { row: 0, col: 1 },
      t18: { row: 1, col: 1 },
      t21: { row: 1, col: 3 },
      t25: { row: 1, col: 0 },
    },
    kingId: "t16",
    // 王が c2 まで踏み込んでくる。三角形の内側に入る
    moves: [{ pieceId: "t16", row: 3, col: 2 }],
  },
  steps: [
    {
      text: "最後にAが加わり、52枚すべてがそろいます。サイコロを振ります。",
      need: { type: "ROLL_DICE_SINGLE" },
      focus: { button: true },
    },
    {
      at: atMulligan,
      text: "今回は引き直しません。「引き直して確定」を押します。",
      need: { type: "CONFIRM_MULLIGAN" },
      focus: { button: true },
    },
    {
      at: atPlace,
      text: "A♠ を b2 へ。Aだけは移動できません。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t0", row: 3, col: 1 },
      focus: { cards: ["t0"], cells: [{ row: 3, col: 1 }] },
    },
    {
      text: "4♠ を c1 へ。Aと三角形をつくる位置です。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t11", row: 4, col: 2 },
      focus: { cards: ["t11"], cells: [{ row: 4, col: 2 }] },
    },
    {
      text: "5♠ を d2 へ。これで3点が三角形になります。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t10", row: 3, col: 3 },
      focus: { cards: ["t10"], cells: [{ row: 3, col: 3 }] },
    },
    {
      text: "3♠ を b1 へ。この駒を王にします。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t12", row: 4, col: 1 },
      focus: { cards: ["t12"], cells: [{ row: 4, col: 1 }] },
    },
    {
      text: "6♠ を e1 へ。これで5枚そろいます。",
      need: { type: "SETUP_PLACE_CARD", cardId: "t9", row: 4, col: 4 },
      focus: { cards: ["t9"], cells: [{ row: 4, col: 4 }] },
    },
    {
      text: "「王を選ぶ」を押します。",
      need: { type: "SETUP_GOTO_KING_STEP" },
      focus: { button: true },
    },
    {
      at: atKing,
      text: "b1 の 3♠ を王にします。タップしてください。",
      need: { type: "SETUP_PICK_KING", cardId: "t12" },
      focus: { cells: [{ row: 4, col: 1 }] },
    },
    {
      text: "Aを王にすると1ターンに2回入れ替えられますが、動けない王になります。「布陣を確定」を押します。",
      need: { type: "SETUP_CONFIRM" },
      focus: { button: true },
    },
    {
      at: myTurn,
      text: "Aは動けないので、他の駒を動かします。e1 の 6♠ を e3 へ。",
      need: { type: "MOVE_PIECE", pieceId: "t9", row: 2, col: 4 },
      focus: { pieces: ["t9"], cells: [{ row: 2, col: 4 }] },
    },
    {
      at: myTurn,
      text: "相手が c2 まで踏み込みました。b2 の A♠ をタップし、c1 の 4♠ をタップ。",
      need: { type: "TOGGLE_SHUFFLE_PICK", id: "t11" },
      focus: { pieces: ["t0", "t11"] },
    },
    {
      at: myTurn,
      text: "もう1つ、d2 の 5♠ をタップ。これで3点が決まります。",
      need: { type: "TOGGLE_SHUFFLE_PICK", id: "t10" },
      focus: { pieces: ["t10"] },
    },
    {
      at: myTurn,
      text: "3つとも味方なので、囲んだ内側の相手を取れます。確定を押します。",
      need: { type: "CONFIRM_SHUFFLE" },
      focus: { button: true },
    },
    {
      at: atEnd,
      text: "囲んで王を討ちました。13ランクすべての動きと、王の力を見てきました。",
      end: true,
    },
  ],
};

export const TUTORIALS = [EP1, EP2, EP3, EP4];

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
  MOVE_PIECE: 4,
  PLACE_RESERVE_CARD: 4,
  TOGGLE_SHUFFLE_PICK: 4,
  CONFIRM_SHUFFLE: 4,
};

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
      if (s.lastSwap) return true;
      return !!s.shuffleMode && s.shuffleMode.picks.includes(need.id);
    case "CONFIRM_SHUFFLE":
      return !!s.lastSwap;
    case "PLACE_RESERVE_CARD": {
      // 「置く札が無い」だけだと、引く前と置いた後を区別できない。
      // 指定のマスに自分の駒が立ったかで見る
      if (need.row === undefined) return !s.kPlacement;
      const here = s.board[need.row] && s.board[need.row][need.col];
      return !!here && here.owner === 0;
    }
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
 * いま出すべき台本の位置。
 * from から始めて、盤面を見て「もう済んだ」ものを飛ばす。
 */
export function currentStepIndex(tut, s, from) {
  let i = Math.max(0, Math.min(from, tut.steps.length));
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
