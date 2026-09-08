/**
 * シークレットミッション。
 *
 * 通常のミッションは「◯回あそぶ」のような数え上げで、条件が最初から見えている。
 * こちらは、めったに起きない出来事に**出くわしたら**達成になる。条件は達成
 * するまで伏せてあり、達成した時点でどれくらい珍しいことだったかを見せる。
 *
 * chance は実測または計算で出した確率。文言に使うので、当てずっぽうを
 * 書かないこと(tools/check-secrets.mjs が桁を見張っている)。
 */
export const SECRETS = [
  {
    id: "court-heavy",
    // 麻雀の国士無双(およそ2,500局に1回)とほぼ同じ珍しさ。
    // 四字熟語としても「国に並ぶ者なき士」で、絵札だらけの手札に重なる
    name: "国士無双",
    // 何をしたら達成か。達成するまでは出さない
    how: "9×9で、手札が絵札(J・Q・K)に偏りすぎて盤に並べきれず、数字の札で配り直された",
    // 0.038% ≒ 2600局に1回(実際の配り方で20万回試した実測)
    chance: 0.00038,
    // 同じくらいの珍しさの、よく知られた出来事
    like: "麻雀で国士無双が出るのと、ほぼ同じ珍しさです",
    reward: { type: "title", id: "court-heavy" },
  },
];

export function findSecret(id) {
  return SECRETS.find((s) => s.id === id) || null;
}

/** 「約◯局に1回」の言い方。端数は丸めて読みやすくする */
export function chanceLabel(chance) {
  const one = Math.round(1 / chance);
  const rounded =
    one >= 1000 ? Math.round(one / 100) * 100 : Math.round(one / 10) * 10;
  return `約 ${rounded.toLocaleString()} 局に1回 (${(chance * 100).toFixed(3)}%)`;
}

/** 達成したものだけを、達成した順に返す */
export function listSecrets(profile) {
  const got = profile.secrets || [];
  return {
    found: SECRETS.filter((s) => got.includes(s.id)),
    hidden: SECRETS.length - SECRETS.filter((s) => got.includes(s.id)).length,
  };
}
