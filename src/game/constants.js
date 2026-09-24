export const VERSION = "v49";
/** その版で何が入ったか。設定に添えて出す */
export const VERSION_NOTE = "アカウント・布陣ボーナス・記録の再生・BGM";

export const RANKS = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];
export const SUITS = ["spade", "heart", "diamond", "club"];

/**
 * 札ごとの熟練度の段。**その札を王に選んでためた点**の境目(本人の決め 2026-09-22。2026-09-24 に回数から点へ)。
 *
 * 500点で頭打ちにするのは意図的。青天井にすると1000局遊んだ人と100局遊んだ人の
 * 差が永久に開き続け、あとから始めた人が追いつけない。
 * 王を動かした点は1局に MASTERY_PER_GAME 回まで(長引かせる遊びを得にしない)。
 *
 * ここに置くのは、称号(titles.js)と記録(profile.js)の両方が見るため。
 * titles.js から profile.js を読むと輪になる。
 */
export const MASTERY_STEPS = [10, 30, 80, 200, 500];
export const MASTERY_PER_GAME = 3;
/**
 * 熟練度は**所持スキンごと**に貯まる(2026-09-24 本人の指示で、札ごと→スキンごとに変更)。
 * 通常札(スキン無し)では貯まらない。装備しているスキンの駒を盤に出す・王にすると、そのスキンに点が入る。
 * J/Q/K・10 は複数のスキンがあり、それぞれ別の枠。
 *
 * 熟練度の点(2026-09-24 本人の指示):
 *   king        そのスキンを王に選んだ: +5(1局に1回)
 *   piece       そのスキンの駒を盤に出した: 1体 +1(何体でも。複数で複数加算)
 *   move        王として動かした: 1手 +1、1局に moveMax(3)点まで(長引かせる遊びを得にしない)
 *   capture     王で相手の駒を取った: 1体 +1、captureMax(10)点まで(A の囲い取りは A が倒した判定 = reducer が A に付ける)
 *   kingCapture 王で相手の王を討った: さらに +10
 * capture は reducer の結果(撃破の記録)から数え、端末の手の中身は見ない。
 */
export const MASTERY_POINTS = Object.freeze({ king: 5, piece: 1, move: 1, moveMax: MASTERY_PER_GAME, capture: 1, captureMax: 10, kingCapture: 10 });
/**
 * 熟練度の対象スキン(17種)。カード画面の並び順と、通しの称号の条件に使う。
 * base の id(:foil を除いた側)で持つ。所持していないスキンは鎖(ロック)。
 */
export const MASTERY_SKINS = Object.freeze([
  "genie-magician", // A
  "zombie-male", // 2
  "zombie-female", // 3
  "pirate-male", // 4
  "pirate-female", // 5
  "elf-male", // 6
  "elf-female", // 7
  "viking-male", // 8
  "viking-female", // 9
  "dragon-knight", // 10
  "pegasus-knight", // 10
  "angel-j", // J 天使
  "demon-j", // J 悪魔
  "angel-q", // Q 天使
  "demon-q", // Q 悪魔
  "angel-k", // K 天使
  "demon-k", // K 悪魔
]);
/** スキン id → 表示する札(カード画面のカード絵と並び) */
export const MASTERY_SKIN_RANK = Object.freeze({
  "genie-magician": "A",
  "zombie-male": "2",
  "zombie-female": "3",
  "pirate-male": "4",
  "pirate-female": "5",
  "elf-male": "6",
  "elf-female": "7",
  "viking-male": "8",
  "viking-female": "9",
  "dragon-knight": "10",
  "pegasus-knight": "10",
  "angel-j": "J",
  "demon-j": "J",
  "angel-q": "Q",
  "demon-q": "Q",
  "angel-k": "K",
  "demon-k": "K",
});
/** 称号が出る段と、アイコンが出る段 */
export const MASTERY_TITLE_STEP = 3;
export const MASTERY_ICON_STEP = 5;

/** チュートリアルで段階的に開けていくカードプール */
export const CARD_POOLS = {
  basic: ["2", "3", "4", "5"],
  mid: ["2", "3", "4", "5", "6", "7", "8", "9"],
  numbers: ["2", "3", "4", "5", "6", "7", "8", "9", "10"],
  high: ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q"],
  court: ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"],
  full: RANKS,
};
export const SUIT_SYMBOL = { spade: "♠", heart: "♥", diamond: "♦", club: "♣" };

/** 縦横4方向 */
export const ORTH = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
/** 斜め4方向 */
export const DIAG = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
/** 桂馬の8方向 */
export const KNIGHT_OFFSETS = [
  [1, 2],
  [2, 1],
  [-1, 2],
  [-2, 1],
  [1, -2],
  [2, -1],
  [-1, -2],
  [-2, -1],
];

export const PLAYER_META = [
  { name: "赤", color: "#c1543a", soft: "#e2896f" },
  { name: "青", color: "#3e8e90", soft: "#7ec4c6" },
];

/**
 * その席の呼び名。名前が分かっていればそれを、無ければ色名を返す。
 * names は [先手の名前, 後手の名前]。1台で交互に指すときは誰の名前も無い。
 */
export function nameOf(idx, names) {
  const given = names && names[idx];
  return given || PLAYER_META[idx].name;
}

/**
 * 視点つきのプレイヤー名。
 * 名前が分かっていれば名前だけを返す。自分の名前は自分で分かるので、
 * わざわざ「(あなた)」と添えない。
 */
export function playerLabel(idx, viewer, names) {
  const who = nameOf(idx, names);
  if (viewer == null || (names && names[idx])) return who;
  return idx === viewer ? `あなた(${who})` : `相手(${who})`;
}

export function shortPlayerLabel(idx, viewer, names) {
  if (names && names[idx]) return names[idx];
  if (viewer == null) return PLAYER_META[idx].name;
  return idx === viewer ? "あなた" : "相手";
}

/** ランクごとの移動ルール */
export const MOVE_TEXT = {
  A: "ターンを使い、自分と好きな駒2つ(敵味方どちらでも)の位置をランダムに入れ替える。選んだ2つが両方とも味方なら、入れ替え後の3つが作る三角形の内側(辺の上も含む)にいる相手の駒を取る。",
  2: "縦横1マス。",
  3: "斜め1マス。",
  4: "縦横に2マスまで。",
  5: "斜めに2マスまで。",
  6: "縦横に偶数マス。進路に駒があると止まり、それが相手なら取れる。",
  7: "斜めに偶数マス。進路に駒があると止まり、それが相手なら取れる。",
  8: "縦横に奇数マス。進路に駒があると止まり、それが相手なら取れる。",
  9: "斜めに奇数マス。進路に駒があると止まり、それが相手なら取れる。",
  10: "縦に2・横に1(またはその逆)へ跳ぶ。間に駒があっても飛び越える。",
  J: "縦横に何マスでも。2枚まで採用可(王がKなら1枚)。",
  Q: "斜めに何マスでも。2枚まで採用可(王がKなら1枚)。",
  K: "縦横斜めに何マスでも。10と同じ跳び方もできる。王にする時のみ1枚採用できる。",
};

/**
 * 動きの説明のうち、採用(布陣)のときだけ意味がある但し書き。
 * 予備札から盤に出すときは「2枚まで採用可」「王にする時のみ採用」が、その札を置けないかの
 * ように読めてしまう(本人の指摘 2026-09-15)。置く場面では moveOnlyText で外す
 */
export const ADOPTION_NOTES = [
  "2枚まで採用可(王がKなら1枚)。",
  "王にする時のみ1枚採用できる。",
];

/** 採用の但し書きを外した、動きだけの説明 */
export function moveOnlyText(rank) {
  let t = MOVE_TEXT[rank] || "";
  for (const n of ADOPTION_NOTES) t = t.replace(n, "");
  return t.trim();
}

/** そのランクを王にしたときの追加能力 */
export const KING_TEXT = {
  A: "この駒だけ1ターンに2回入れ替えを使える(1回で終えてもよい)。移動はできない。",
  2: "自分の移動距離が「採用した2の枚数×2マス」伸びる(1枚なら3マス、4枚なら9マス)。王の2が倒れると、盤上の別の2が王位を継ぐ(複数いれば選ぶ)。",
  3: "自分の移動距離が「採用した3の枚数×2マス」伸びる(1枚なら3マス、4枚なら9マス)。王の3が倒れると、盤上の別の3が王位を継ぐ(複数いれば選ぶ)。",
  4: "王以外の4の移動距離が「採用した4の枚数×2マス」伸びる(1枚なら4マス、3枚なら8マス)。王自身は2マスのまま。王以外の4が倒されると、倒した相手を道連れにする。",
  5: "王以外の5の移動距離が「採用した5の枚数×2マス」伸びる(1枚なら4マス、3枚なら8マス)。王自身は2マスのまま。王以外の5が倒されると、倒した相手を道連れにする。",
  6: "同じ線上に並ぶ相手の駒を、手前から順にまとめて取れる。味方の駒があればそこで止まる。",
  7: "同じ線上に並ぶ相手の駒を、手前から順にまとめて取れる。味方の駒があればそこで止まる。",
  8: "同じ線上に並ぶ相手の駒を、手前から順にまとめて取れる。味方の駒があればそこで止まる。",
  9: "同じ線上に並ぶ相手の駒を、手前から順にまとめて取れる。味方の駒があればそこで止まる。",
  10: "この駒だけ1ターンに2回動ける(1回で終えてもよい)。",
  J: "斜め1マスも動ける。",
  Q: "縦横1マスも動ける。",
  K: "自分のJかQが倒されると(道連れで倒れたときを除く)、予備札から1枚を表向きで盤に出せる。予備札が尽きると捨て札を混ぜて補充する(昇格・変身した札は元の数字に戻る)。",
};
