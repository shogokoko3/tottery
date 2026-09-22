/**
 * 9月8日にまとめて登録した100名のテストプレイヤーを、ランキングから消す(2026-09-23 本人の指示)。
 *
 * 消す先は3つ。実際の人(それ以外の行)には触らない。
 *   1. Firebase の ranks/<uid>(通算ランキング)
 *   2. Firebase の players/<uid>(登録した人の台帳。あれば)
 *   3. Worker のシーズン台帳(今月のランキング) … /api/admin/season-forget(運営だけ)
 * 順番は 3 → 1 → 2。Worker の口がまだ配られていなければ 3 で止まり、Firebase には触らない(やり直せる)。
 * 消す前に対象の一覧を reports/test-players-2026-09-08.json に控える
 *
 * 見分け方: ranks の at が 2026-09-08 17:51〜17:59(日本時間)の行。実際の人は9/5・9/9・9/12・9/21 以降で、
 * この8分間には誰も登録していない(2026-09-23 に実データで確認: 該当100件、それ以外10件)。
 *
 * 運営(OPERATOR_UID)のメールとパスワードでサインインする。パスワードは画面に出さない。
 * 何もしない下見:  node tools/remove-test-players.mjs --dry
 * 実行:            node tools/remove-test-players.mjs
 */
import { createInterface } from "node:readline";
import { API_KEY, OPERATOR_UID } from "../src/net/auth.js";
import { DB_URL } from "../src/net/firebase.js";
import { SEASON_API_ORIGIN } from "../src/net/season.js";

// 2026-09-08 17:50:00 〜 18:00:00 JST(UTC+9) を epoch ms で
const FROM = Date.UTC(2026, 8, 8, 8, 50, 0);
const TO = Date.UTC(2026, 8, 8, 9, 0, 0);
const dry = process.argv.includes("--dry");

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // 入力を画面に出さない(パスワード)
      rl._writeToOutput = (s) => {
        if (s.includes(question)) process.stdout.write(question);
      };
    }
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

const fmt = (ms) =>
  new Date(ms).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", hour12: false });

async function main() {
  const email = process.env.TOTTERY_ADMIN_EMAIL || (await ask("運営のメールアドレス: "));
  const password = process.env.TOTTERY_ADMIN_PASSWORD || (await ask("パスワード: ", { hidden: true }));
  const token = await signIn(email, password);
  console.log("サインインしました(運営)。");

  const res = await fetch(`${DB_URL}/ranks.json?auth=${token}`);
  if (!res.ok) throw new Error(`ranks を読めませんでした: HTTP ${res.status}`);
  const data = (await res.json()) || {};
  const rows = Object.entries(data).map(([id, r]) => ({ id, ...r }));
  const targets = rows.filter((r) => Number(r.at) >= FROM && Number(r.at) < TO);
  const keep = rows.filter((r) => !targets.includes(r));
  console.log(`\nranks は ${rows.length} 行。消す候補 ${targets.length} 行、残す ${keep.length} 行。`);
  console.log("\n【残す(実際の人)】");
  for (const r of keep) console.log(`  ${String(r.name).padEnd(12)} 持ち点 ${r.rating}  対局 ${r.rated}  ${fmt(r.at)}`);
  console.log("\n【消す(テストプレイヤー)】");
  for (const r of targets) console.log(`  ${String(r.name).padEnd(12)} 持ち点 ${r.rating}  対局 ${r.rated}  ${fmt(r.at)}  ${r.id}`);
  if (!targets.length) return console.log("\n消すものはありません。");
  if (targets.length > 120) throw new Error("候補が多すぎます。見分け方を確かめてください。");
  if (dry) return console.log("\n--dry なので何もしません。");

  const yes = await ask(`\n上の ${targets.length} 行を ranks・players・今月のシーズン台帳から消します。よろしいですか? (yes/no): `);
  if (yes !== "yes") return console.log("やめました。");

  // 消す前に、対象の一覧を控えに書く(あとで照らせるように)
  const { writeFileSync, mkdirSync } = await import("node:fs");
  mkdirSync("reports", { recursive: true });
  writeFileSync(
    "reports/test-players-2026-09-08.json",
    JSON.stringify(targets.map((r) => ({ id: r.id, name: r.name, rating: r.rating, rated: r.rated, at: r.at })), null, 1),
  );

  // 3 を先に。Worker の口がまだ配られていなければここで止まり、Firebase は何も消えない(やり直せる)
  const s = await fetch(`${SEASON_API_ORIGIN}/api/admin/season-forget`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ uids: targets.map((r) => r.id) }),
  });
  const sd = await s.json().catch(() => ({}));
  if (!s.ok)
    throw new Error(
      `シーズン台帳から消せませんでした: ${sd.error || s.status}。` +
        "Worker の配信(git push の数分後)が済んでから、もう一度この道具を走らせてください。Firebase はまだ何も消していません。",
    );
  console.log(`\nシーズン台帳: ${sd.forgotten} 人ぶんを消しました。`);

  // 1・2. Firebase
  let ranksDone = 0, playersDone = 0;
  for (const r of targets) {
    const a = await fetch(`${DB_URL}/ranks/${r.id}.json?auth=${token}`, { method: "DELETE" });
    if (a.ok) ranksDone++; else console.log(`  ranks/${r.id} を消せませんでした: HTTP ${a.status}`);
    const p = await fetch(`${DB_URL}/players/${r.id}.json?auth=${token}`);
    if (p.ok && (await p.json()) !== null) {
      const b = await fetch(`${DB_URL}/players/${r.id}.json?auth=${token}`, { method: "DELETE" });
      if (b.ok) playersDone++; else console.log(`  players/${r.id} を消せませんでした: HTTP ${b.status}`);
    }
  }
  console.log(`ranks: ${ranksDone}/${targets.length} 行を消しました。players: ${playersDone} 行を消しました。`);
  console.log("\n完了。アプリのランキングは次に開いたときから反映されます。");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
