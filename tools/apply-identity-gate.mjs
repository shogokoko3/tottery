/**
 * ランダムマッチの待ち合わせ(lobby)の募集・参加を「本人確認済みだけ」に絞る。
 *
 * ★公開はいちばん最後★
 * 本人確認(Sign in with Apple)入りのクライアントを配信し、みんなが一度開いた
 * あとで、このパッチを firebase-rules.json に当てて公開する。先に締めると、
 * まだ古いクライアント(匿名のまま)の人はランダムマッチに入れなくなる。
 * 合言葉部屋は lobby を使わないので影響を受けない。
 *
 * 使い方:
 *   node tools/apply-identity-gate.mjs            … firebase-rules.json に当てる
 *   node tools/apply-identity-gate.mjs --dry <出力>… 別ファイルに書いて中身を確かめる
 *
 * 論理はコピーに当てて確かめてある(scratchpad/prove-gate.mjs、6/6)。
 * 本番での最終確認は、実際の Apple トークンでしかできない(公開後に probe する)。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const GATE = "auth.token.firebase.sign_in_provider != 'anonymous'";

export function applyGate(rules) {
  const L = rules.rules.lobby.$code;
  const w = L[".write"];
  if (w.includes(GATE)) throw new Error("lobby .write に既に当たっている");
  if (!w.includes("((!data.exists() && !root.child('bans')"))
    throw new Error("lobby .write: 当てる場所が見つからない");
  L[".write"] = w.replace("((!data.exists() && ", `((!data.exists() && ${GATE} && `, 1);
  const g = L.guest[".write"];
  if (g.includes(GATE)) throw new Error("guest .write に既に当たっている");
  if (!g.includes("((!data.exists() && newData.val() === auth.uid"))
    throw new Error("guest .write: 当てる場所が見つからない");
  L.guest[".write"] = g.replace("((!data.exists() && ", `((!data.exists() && ${GATE} && `, 1);
  return rules;
}

if (process.argv[1] && process.argv[1].endsWith("apply-identity-gate.mjs")) {
  const src = join(here, "..", "firebase-rules.json");
  const rules = applyGate(JSON.parse(readFileSync(src, "utf8")));
  const txt = JSON.stringify(rules, null, 2) + "\n";
  if (txt.includes("numChildren")) throw new Error("numChildren が混ざった");
  const dry = process.argv.indexOf("--dry");
  const out = dry >= 0 ? process.argv[dry + 1] : src;
  writeFileSync(out, txt);
  console.log(`本人確認ゲートを書き出した: ${out}`);
}
