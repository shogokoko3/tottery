export const SKINS = [
  [
    "genie-magician",
    "A",
    "ランプのマジシャン",
    "愉快なランプの魔人",
    "genie",
    "SPECIAL",
    "#d3a7eb",
    "マジカルシルクハット",
    "3つの帽子で駒を入れ替え、包囲した相手を大きな帽子へ吸い込む。",
  ],
  [
    "zombie-male",
    "2",
    "墓守のレヴナント",
    "男のゾンビ",
    "zombie",
    "R",
    "#8db694",
    "土葬より、再び",
    "王位を継承したとき、盤面を覆う土から蘇る。",
  ],
  [
    "zombie-female",
    "3",
    "黄昏のレヴナント",
    "女のゾンビ",
    "zombie",
    "R",
    "#a5c5ad",
    "土葬より、再び",
    "王位を継承したとき、盤面を覆う土から蘇る。",
  ],
  [
    "pirate-male",
    "4",
    "黒潮の船長",
    "男の海賊",
    "pirate",
    "R",
    "#e7aa68",
    "最期の大航海",
    "道連れが成立したとき、ドクロ爆弾が画面を埋め尽くす。",
  ],
  [
    "pirate-female",
    "5",
    "紅帆の船長",
    "女の海賊",
    "pirate",
    "R",
    "#ed907b",
    "最期の大航海",
    "道連れが成立したとき、ドクロ爆弾が画面を埋め尽くす。",
  ],
  [
    "elf-male",
    "6",
    "翠樹の射手",
    "男のエルフ",
    "elf",
    "SR",
    "#91d5b4",
    "静寂を射抜く",
    "相手の駒を取るたび、光をまとった矢を放つ。",
  ],
  [
    "elf-female",
    "7",
    "月影の射手",
    "女のエルフ",
    "elf",
    "SR",
    "#addbcc",
    "静寂を射抜く",
    "相手の駒を取るたび、光をまとった矢を放つ。",
  ],
  [
    "viking-male",
    "8",
    "北海の戦斧",
    "男のバイキング",
    "viking",
    "SR",
    "#9bc4dc",
    "北海の断撃",
    "相手の駒を取るたび、大斧を振るう。",
  ],
  [
    "viking-female",
    "9",
    "霜狼の戦斧",
    "女のバイキング",
    "viking",
    "SR",
    "#b1c9e9",
    "北海の断撃",
    "相手の駒を取るたび、大斧を振るう。",
  ],
  [
    "dragon-knight",
    "10",
    "焔翼の竜騎士",
    "ドラゴンナイト",
    "dragon",
    "SSR",
    "#efa66d",
    "天翔ける竜焔",
    "空を舞うドラゴンが炎で相手の駒を焼き尽くす。",
  ],
  [
    "pegasus-knight",
    "10",
    "白翼の天馬騎士",
    "ペガサスナイト",
    "pegasus",
    "LIMITED",
    "#c8dcf3",
    "白翼の流星",
    "空を舞うペガサスが急降下し、騎士の槍が相手を貫く。",
  ],
  [
    "angel-j",
    "J",
    "告天使 ガブリエル",
    "三大天使 · J",
    "angel",
    "SSR",
    "#b9d9f4",
    "天の裂け目",
    "空の裂け目から降臨し、相手を浮かせ、光へ還す。",
  ],
  [
    "angel-q",
    "Q",
    "癒天使 ラファエル",
    "三大天使 · Q",
    "angel",
    "SSR",
    "#b4e0b9",
    "天の裂け目",
    "空の裂け目から降臨し、相手を浮かせ、光へ還す。",
  ],
  [
    "angel-k",
    "K",
    "熾天使 ミカエル",
    "三大天使 · K",
    "angel",
    "SSR",
    "#f4da97",
    "天の裂け目",
    "空の裂け目から降臨し、相手を浮かせ、光へ還す。",
  ],
  [
    "demon-j",
    "J",
    "魔公 アスタロト",
    "三大悪魔 · J",
    "demon",
    "SSR",
    "#c8a2e8",
    "奈落の掌握",
    "地の裂け目から現れ、相手を力で掴み、魔炎で消し去る。",
  ],
  [
    "demon-q",
    "Q",
    "夜后 リリス",
    "三大悪魔 · Q",
    "demon",
    "SSR",
    "#ef9cae",
    "奈落の掌握",
    "地の裂け目から現れ、相手を力で掴み、魔炎で消し去る。",
  ],
  [
    "demon-k",
    "K",
    "堕天王 ルシファー",
    "三大悪魔 · K",
    "demon",
    "SSR",
    "#d8a0d0",
    "奈落の掌握",
    "地の裂け目から現れ、相手を力で掴み、魔炎で消し去る。",
  ],
].map(([id, rank, name, role, family, rarity, color, move, description]) => ({
  id,
  rank,
  name,
  role,
  family,
  rarity,
  color,
  move,
  description,
  acquisition: id === "genie-magician" ? "battlepass" : null,
  image: `skins/portraits/${id}.webp`,
  card: `skins/cards/${id}.webp`,
  // 小さな盤面では顔と帽子が見やすい専用絵を使う。
  boardCard:
    id === "genie-magician" ? "skins/board/genie-magician-v1.png" : null,
  // 既存16種の動画は維持。Aは入れ替え/包囲撃破を使い分ける。
  video: id === "genie-magician" ? null : `skins/videos/${id}.mp4`,
  videos:
    id === "genie-magician"
      ? {
          swap: "skins/videos/ace-genie-swap.mp4",
          capture: "skins/videos/ace-genie-capture.mp4",
        }
      : null,
}));

export const byId = (id) => SKINS.find((s) => s.id === id);
export const POOL = SKINS.filter((s) => ["R", "SR", "SSR"].includes(s.rarity));
export const ODDS = Object.freeze({ R: 65, SR: 32, SSR: 3 });
export const rate = (s) =>
  (ODDS[s.rarity] || 0) /
  (POOL.filter((p) => p.rarity === s.rarity).length || 1);
export function draw(random = Math.random) {
  const n = random();
  if (!Number.isFinite(n) || n < 0 || n >= 1)
    throw new Error("乱数の範囲が不正です");
  let threshold = n * 100;
  for (const skin of POOL) {
    threshold -= rate(skin);
    if (threshold < 0) return skin;
  }
  return POOL[POOL.length - 1];
}
// 通信相手の装備からも、既知の同じ数字のスキンだけを通す。
export function sanitizeLoadout(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(
    SKINS.filter((s) => raw[s.rank] === s.id).map((s) => [s.rank, s.id]),
  );
}
