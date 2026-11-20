/**
 * ランキングに並ぶ運営のプレイヤー32人(2026-11-20 本人の指示「ランキングに bot っぽくない
 * プレイヤー名で32人増やして欲しい」)。
 *
 * 決まり(本人が選んだもの):
 *  - **実際の人に混ぜる。ただし上位は避ける**: 実際の人の10位(10人いなければ最下位)より必ず下に置く。
 *    シーズン終了時の「覇者・三傑・十傑」は実際の人だけが取る
 *  - **持ち点は毎日少しずつ動く**: 1日に数局ずつ、時刻をばらして指したことにする。
 *    乱数は uid と日付から作るので、いつ計算しても同じ値になる(台帳には書かない)
 *
 * 台帳(ledger.js)の list() がその場で足すだけ。players 表には入れないので、
 * 消すときはこのファイルの HOUSE_PLAYERS を空にすれば元どおり(記録は何も残らない)。
 * 名前・アイコン・称号の表示は Firebase の ranks にも同じ uid で置く(tools/house-players-ranks.mjs)。
 * uid は Firebase の形に似せた作り物で、実在のアカウントではない。
 */

/** 動き始める日(S1 の始まり 2026-11-16 9:00 JST = 00:00 UTC) */
export const HOUSE_EPOCH = Date.UTC(2026, 10, 16, 0, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

/**
 * base: 持ち点が寄っていく値。active: 1日に指す局数の多さ(1 少なめ・2 ふつう・3 多め)。
 * title・icon は Firebase の ranks に置く値(表示用)
 */
// 名前は人の名前なので訳さない(各行の i18n-ignore)
export const HOUSE_PLAYERS = Object.freeze([
  { uid: "csZ4JHVyEAZLMH96cfMUXPSFAUN1", name: "しゅんぺい", icon: "spade", title: "ten", base: 1532, active: 2 }, // i18n-ignore
  { uid: "VHY02r2Kxat7HUnS9DbqYmbk1xC2", name: "ぽんず", icon: "initial", title: "rated", base: 1488, active: 1 }, // i18n-ignore
  { uid: "VU04qQUnQO8DjpZz35H4GsTEXR43", name: "たかし0812", icon: "club", title: "win10", base: 1574, active: 3 }, // i18n-ignore
  { uid: "qUC0eIwcLSRbFIayi3YAlVP7i411", name: "ゆず茶", icon: "heart", title: "regular", base: 1516, active: 2 }, // i18n-ignore
  { uid: "B9bw82sNI99w41Ge747G1VfWFHf2", name: "Kazu", icon: "initial", title: "rank-shi", base: 1638, active: 3 }, // i18n-ignore
  { uid: "zpmSHCSxKMztH5YgumaJlTyGvTr3", name: "みっちゃん", icon: "heart", title: "first", base: 1462, active: 1 }, // i18n-ignore
  { uid: "QVfMGi4gPBNu6IdM94LnlPKzSOp1", name: "とろろ昆布", icon: "diamond", title: "fortress", base: 1551, active: 2 }, // i18n-ignore
  { uid: "6puLynwSH0A1AGhjvC0IWQeJpl82", name: "ねこまんま", icon: "club", title: "ten", base: 1507, active: 2 }, // i18n-ignore
  { uid: "VVeGV35NvXmM4xG1gAyPsnG5OtZ3", name: "kei_7", icon: "spade", title: "win10", base: 1593, active: 3 }, // i18n-ignore
  { uid: "MfA12xqlCwTQrSoPxDridtHYM501", name: "夜ふかし勢", icon: "diamond", title: "fifty", base: 1611, active: 3 }, // i18n-ignore
  { uid: "rSWkK87OFNfguI07Gt2JhdpVrnC2", name: "こうへい", icon: "initial", title: "rated", base: 1495, active: 1 }, // i18n-ignore
  { uid: "mRAnvQM5zwRtYPHakz99LzM3Hs83", name: "ハル", icon: "spade", title: "twin-wings", base: 1543, active: 2 }, // i18n-ignore
  { uid: "ZWxmokPf9r8Knq7uzI6Mct4bxMa1", name: "ぴよ吉", icon: "heart", title: "first", base: 1471, active: 1 }, // i18n-ignore
  { uid: "DQPuWrgPkCliNsDTKXyVACSfQne2", name: "Taku", icon: "club", title: "regular", base: 1562, active: 2 }, // i18n-ignore
  { uid: "VrwJ0Z9CF6CzJkLyMJBMGsIUczw3", name: "もちもち", icon: "heart", title: "ten", base: 1524, active: 2 }, // i18n-ignore
  { uid: "Y9mvbaYlhHRUZHKxNwSkFYAehKQ1", name: "りんご飴", icon: "diamond", title: "rated", base: 1480, active: 1 }, // i18n-ignore
  { uid: "Gcm0KbSUh24JpILEfezeukinSwT2", name: "まさと", icon: "initial", title: "rank-shi", base: 1627, active: 3 }, // i18n-ignore
  { uid: "MVtVLqKWSjlyAosLMOHWlgTGMvU3", name: "ちー", icon: "heart", title: "novice", base: 1455, active: 1 }, // i18n-ignore
  { uid: "EY6DsEPkRIuPKvRcHkpDBRGCe0N1", name: "げん", icon: "spade", title: "heir-hunt", base: 1586, active: 2 }, // i18n-ignore
  { uid: "xgL9L7IAq140IJDFca6H0x1RK3k2", name: "ななみ", icon: "diamond", title: "ten", base: 1512, active: 2 }, // i18n-ignore
  { uid: "51reT2LOgNCOkHyqbeGyzO3RIX53", name: "歩兵さん", icon: "club", title: "elimination", base: 1557, active: 2 }, // i18n-ignore
  { uid: "GUSzdxjyI4BMMGqID9JLweV300Z1", name: "寝不足", icon: "spade", title: "fifty", base: 1603, active: 3 }, // i18n-ignore
  { uid: "BKSDnOH5YAgKgBBiPIldpRIS3zQ2", name: "ShinJ", icon: "initial", title: "win10", base: 1579, active: 2 }, // i18n-ignore
  { uid: "HonzdBSFaoNxklIagaibI9HGR6l3", name: "ゆうたろう", icon: "club", title: "first", base: 1476, active: 1 }, // i18n-ignore
  { uid: "DskpMboCVCHvTcGiburOo5PUOhT1", name: "あんず", icon: "heart", title: "regular", base: 1528, active: 2 }, // i18n-ignore
  { uid: "iLqEekeQNNNkWC8n9BzIPS3HUla2", name: "おでん大根", icon: "diamond", title: "kamikaze", base: 1539, active: 2 }, // i18n-ignore
  { uid: "HdAutR4Cb9f28t2JBbMbbacJWTR3", name: "王様はどこ", icon: "spade", title: "royal-road", base: 1566, active: 2 }, // i18n-ignore
  { uid: "Fyb4GXbAzEiYopEMHcQjBSz1DPT1", name: "katsu", icon: "initial", title: "rank-shi", base: 1648, active: 3 }, // i18n-ignore
  { uid: "cYHmfLOXef23PSUVQSqKlZiFolw2", name: "みかん箱", icon: "club", title: "rated", base: 1493, active: 1 }, // i18n-ignore
  { uid: "ojObOzHT97JEWm33g0hOMdvg35X3", name: "ふみや", icon: "spade", title: "ten", base: 1519, active: 2 }, // i18n-ignore
  { uid: "EBnAEEiSAXmwvsF4qA95gOGS6Hg1", name: "とむ", icon: "heart", title: "first", base: 1467, active: 1 }, // i18n-ignore
  { uid: "WBX12nMbU1hzg3BAElCPP20XBCn2", name: "3時のおやつ", icon: "diamond", title: "win10", base: 1597, active: 2 }, // i18n-ignore
]);

export const HOUSE_UIDS = new Set(HOUSE_PLAYERS.map((p) => p.uid));

/** 文字列から 32 ビットの種 */
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
/** 0〜1 を返す乱数(mulberry32) */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * その日に指した局の時刻(epoch ms)。休む日もある。時刻は日本時間の 8 時〜翌 2 時に散らす
 */
function gamesOfDay(p, day) {
  const r = rng(hash(`${p.uid}:${day}`));
  if (r() < [0, 0.45, 0.3, 0.15][p.active]) return []; // 休みの日
  const max = [0, 3, 5, 8][p.active];
  const n = 1 + Math.floor(r() * max);
  const start = HOUSE_EPOCH + day * DAY - 9 * 60 * 60 * 1000; // その日の 0 時(JST)
  const times = [];
  for (let i = 0; i < n; i++) times.push(start + (8 + r() * 18) * 60 * 60 * 1000);
  return times.sort((a, b) => a - b).map((at) => ({ at, roll: r(), size: r() }));
}

/**
 * from〜until(epoch ms)の間の、その人の持ち点と局数・勝ち数。
 * 持ち点は始まり(HOUSE_EPOCH)から続けて計算する(シーズンをまたいでも続く。実際の人と同じ)
 */
export function houseStanding(p, from, until) {
  let rating = p.base;
  let rated = 0,
    wins = 0;
  if (until < HOUSE_EPOCH) return { rating, rated, wins };
  const lastDay = Math.floor((until - HOUSE_EPOCH + 9 * 60 * 60 * 1000) / DAY) + 1;
  for (let day = 0; day <= lastDay; day++)
    for (const g of gamesOfDay(p, day)) {
      if (g.at > until) break;
      // 自分の寄る値より下なら勝ちやすく、上なら負けやすい(持ち点が base の近くに留まる)
      const pWin = Math.min(0.8, Math.max(0.2, 0.5 + (p.base - rating) / 300));
      const won = g.roll < pWin;
      const step = 8 + Math.round(g.size * 12);
      rating += won ? step : -step;
      if (g.at >= from) {
        rated++;
        if (won) wins++;
      }
    }
  return { rating: Math.round(rating), rated, wins };
}

/**
 * そのシーズンの一覧に足す行。reals は実際の人の行(持ち点つき・rated つき)。
 * 実際の人の10位(10人に満たなければ最下位)より必ず下になるよう、上を抑える。
 * 抑えた人どうしが同じ点で並ばないよう、少しずつずらす
 */
export function houseRows(season, now, reals) {
  if (!season || now < HOUSE_EPOCH) return [];
  const until = Math.min(now, season.end);
  const listed = reals
    .filter((p) => p.rated >= 1)
    .map((p) => p.rating)
    .sort((a, b) => b - a);
  const cap = listed.length ? listed[Math.min(9, listed.length - 1)] - 1 : Infinity;
  const rows = HOUSE_PLAYERS.map((p) => {
    const s = houseStanding(p, season.start, until);
    return { p, ...s };
  })
    .filter((r) => r.rated >= 1)
    .sort((a, b) => b.rating - a.rating || a.p.uid.localeCompare(b.p.uid));
  let ceiling = cap;
  return rows.map(({ p, rating, rated, wins }) => {
    const shown = Math.min(rating, ceiling);
    ceiling = shown - 1 - (hash(p.uid) % 4); // 下の人は少なくとも 1〜4 点下
    return {
      season: season.id,
      uid: p.uid,
      name: p.name,
      icon: p.icon,
      wr: null,
      rated,
      wins,
      draws: 0,
      highest: 0,
      best: null,
      streak: 0,
      rating: shown,
      house: true,
    };
  });
}
