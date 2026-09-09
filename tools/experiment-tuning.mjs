// 検証ツール専用。areas.js より先に読み込み、AREA_TUNING の数字を環境変数で差し替える。
//   EARTH_ODDS=0.75  土の当たる確率
//   SEA_PULLS_OWN=0  海で自分の駒を流さない
// 画面のコードはこのファイルを読まないので、配信物には影響しない。
const tuning = {};
if (process.env.EARTH_ODDS) tuning.earthOdds = Number(process.env.EARTH_ODDS);
if (process.env.SEA_PULLS_OWN)
  tuning.seaPullsOwn = process.env.SEA_PULLS_OWN === "1";
if (Object.keys(tuning).length) globalThis.TOTTERY_AREA_TUNING = tuning;
