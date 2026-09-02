# reference/

復元の出どころと、挙動照合の「正解」を置いている。消さないこと。

| ファイル | 中身 |
| --- | --- |
| `v47-build.html` | 復元元。ソースが失われていた頃の最後のビルド(2026-09-01 22:24) |
| `v33-build.html` | GitHub に入っていた古いビルド。参考 |
| `original-logic.mjs` | v47 から機械抽出したゲームロジック。`tools/parity.mjs` の正解として使う |
| `app.pretty.js` | v47 のアプリ部分を整形しただけのもの。復元パイプラインの入口 |
| `app.named.jsx` | 名前を戻し JSX に変換した、分割前の1枚岩。差分確認用 |

再生成:

```
python3 tools/extract-bundle.py                                  # 画像・CSS・app.min.js
node tools/rename.mjs reference/app.pretty.js reference/app.renamed.js tools/name-map.json
node tools/dejsx.mjs  reference/app.renamed.js reference/app.named.jsx
node tools/split.mjs                                             # src/ へ分割
```
