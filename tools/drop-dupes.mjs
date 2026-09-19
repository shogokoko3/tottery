/**
 * 同期でできた控えを落とす。
 *
 * この Mac では、同期の取り合いで末尾に「半角空白＋数字」が付いた控えが勝手にできる
 * (`skins 3/`、`config 2.xml`、`nearby 2.js`)。放っておくと:
 *   - dist/ ごとアプリに写り、気づかないまま配られる
 *     (2026-09-19 に判明。iOS のアプリに `skins 3` が丸ごと 128MB 入っていた)
 *   - Android の res/ に入るとビルドが止まる(名前に空白を使えない)
 *
 * 組み立ての前後に必ず通す。
 *
 *   node tools/drop-dupes.mjs <フォルダ> [...]
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** 控えの名前か(「… 2」「… 2.png」) */
export const 控えの名前 = (name) => / \d+(\.[^.]+)?$/.test(name);

/** dir の下の控えを消して、消したものの一覧を返す */
export function dropDupes(dir, found = []) {
  if (!fs.existsSync(dir)) return found;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const at = path.join(dir, e.name);
    if (控えの名前(e.name)) {
      fs.rmSync(at, { recursive: true, force: true });
      found.push(at);
      continue;
    }
    if (e.isDirectory()) dropDupes(at, found);
  }
  return found;
}

// 直に呼ばれたときだけ動く。パスに日本語が入るので pathToFileURL で揃える
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dirs = process.argv.slice(2);
  if (!dirs.length) {
    console.error("× 見るフォルダを渡してください");
    process.exit(1);
  }
  const all = [];
  for (const d of dirs) dropDupes(d, all);
  console.log(
    all.length
      ? `同期でできた控えを落とした(${all.length}件): ${all.slice(0, 6).join(", ")}${all.length > 6 ? " ほか" : ""}`
      : "同期でできた控えは無かった",
  );
}
