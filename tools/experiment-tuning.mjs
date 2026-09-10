// 検証ツール専用。areas.js より先に読み込み、AREA_TUNING の数字を環境変数で差し替える。
//   EARTH_ODDS=0.75  土の当たる確率
//   SEA_PULLS_OWN=0  海で自分の駒を流さない
//   ICE_KING=1       氷で相手の王も凍らせる
//   FREEZE_DEATH=4   凍ったまま4手番迎えた駒は倒れる(凍結死)
//   KING_FREEZE=2    王の凍結を2手番に
//   KING_EXTEND=0    凍結中の王は延長しない
// 画面のコードはこのファイルを読まないので、配信物には影響しない。
const tuning = {};
if (process.env.EARTH_ODDS) tuning.earthOdds = Number(process.env.EARTH_ODDS);
if (process.env.SEA_PULLS_OWN)
  tuning.seaPullsOwn = process.env.SEA_PULLS_OWN === "1";
if (process.env.ICE_KING) tuning.iceFreezesKing = process.env.ICE_KING === "1";
if (process.env.FREEZE_DEATH) tuning.freezeDeathTurns = Number(process.env.FREEZE_DEATH);
if (process.env.KING_FREEZE) tuning.kingFreezeTurns = Number(process.env.KING_FREEZE);
if (process.env.KING_EXTEND) tuning.kingFreezeExtends = process.env.KING_EXTEND === "1";
if (Object.keys(tuning).length) globalThis.TOTTERY_AREA_TUNING = tuning;
