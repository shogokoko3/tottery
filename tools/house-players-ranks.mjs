/**
 * 運営のプレイヤー32人(src/server/house-players.js)の名前・アイコン・称号を、
 * Firebase の ranks/<uid> に置く(2026-11-20 本人の指示)。
 * アプリのランキングは、名前の上の称号とアイコンを ranks から読むため。
 * 持ち点の順位そのものは Worker の台帳がその場で計算する(こちらは表示用)。
 *
 * 運営(OPERATOR_UID)のメールとパスワードでサインインする。パスワードは画面に出さない。
 * 下見(何も書かない):  node tools/house-players-ranks.mjs --dry
 * 置く:                node tools/house-players-ranks.mjs
 * 全部消す:            node tools/house-players-ranks.mjs --remove
 */
import { createInterface } from "node:readline";
import { API_KEY, OPERATOR_UID } from "../src/net/auth.js";
import { DB_URL } from "../src/net/firebase.js";
import { HOUSE_PLAYERS, HOUSE_EPOCH, houseStanding } from "../src/server/house-players.js";

const dry = process.argv.includes("--dry");
const remove = process.argv.includes("--remove");

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden)
      rl._writeToOutput = (s) => {
        if (s.includes(question)) process.stdout.write(question);
      };
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

async function signIn(email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const d = await res.json();
  if (!res.ok) throw new Error(`サインインできませんでした: ${d.error?.message || res.status}`);
  if (d.localId !== OPERATOR_UID) throw new Error("このアカウントには運営権限がありません。");
  return d.idToken;
}

function recordOf(p, now) {
  const s = houseStanding(p, HOUSE_EPOCH, now);
  return {
    name: p.name,
    icon: p.icon,
    title: p.title,
    rating: s.rating,
    rated: Math.max(1, s.rated),
    // CPU 戦なども遊んでいることにする(オンラインの局数より少し多い)
    plays: Math.max(1, s.rated) + (p.uid.charCodeAt(3) % 9) + 3,
    wins: s.wins,
    at: now,
  };
}

async function main() {
  const now = Date.now();
  console.log(`${remove ? "消す" : "置く"}のは ${HOUSE_PLAYERS.length} 人:`);
  for (const p of HOUSE_PLAYERS) {
    const r = recordOf(p, now);
    console.log(`  ${p.name.padEnd(10, "　")} アイコン ${r.icon.padEnd(8)} 称号 ${r.title.padEnd(12)} 持ち点 ${r.rating}  対局 ${r.rated}`);
  }
  if (dry) return console.log("\n--dry なので何もしません。");

  const email = process.env.TOTTERY_ADMIN_EMAIL || (await ask("\n運営のメールアドレス: "));
  const password = process.env.TOTTERY_ADMIN_PASSWORD || (await ask("パスワード: ", { hidden: true }));
  const token = await signIn(email, password);
  console.log("サインインしました(運営)。");

  let done = 0;
  for (const p of HOUSE_PLAYERS) {
    const res = await fetch(`${DB_URL}/ranks/${p.uid}.json?auth=${token}`, {
      method: remove ? "DELETE" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: remove ? undefined : JSON.stringify(recordOf(p, now)),
    });
    if (res.ok) done++;
    else console.log(`  ${p.name}(ranks/${p.uid})に失敗: HTTP ${res.status} ${await res.text()}`);
  }
  console.log(`\nranks: ${done}/${HOUSE_PLAYERS.length} 人を${remove ? "消しました" : "置きました"}。`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
