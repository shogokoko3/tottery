# トッタリー

トランプ52枚を駒にした、2人用のカード×陣取りバトル。
1台の端末で交互に指すか、合言葉でルームを作ってオンラインで対戦する。CPU戦もある。

現在の版: **v47 (CPU対戦を追加)**

## ビルド

```
npm install
npm run build     # index.html を生成
```

`index.html` は React もカード画像96枚も data URI で内包した単一ファイルで、
これ1つを置けば動く。サーバー側の設定には依存しない。

## 構成

```
src/
  main.jsx           エントリ
  styles.css         全画面ぶんのスタイル
  icons.jsx          SVGアイコン(外部ライブラリなし)
  assets.js          カード絵柄92枚 + UI画像4枚の取り込み
  hooks.js
  game/
    constants.js     ランク・スート・ルール文言
    board.js         盤面と移動生成
    reducer.js       ゲーム進行のすべて(30アクション)
    cpu.js           CPU思考
    actions.js       手番の乱数をアクションに焼き込む
  net/
    firebase.js      Realtime Database を REST で読み書き
    sync.js          送る手番と送らない操作の切り分け
  ui/                画面とコンポーネント
assets/              カード画像(webp)
reference/           元のビルド v47 と、そこから機械抽出した比較用ロジック
tools/               復元と検証に使ったスクリプト
```

## このソースの出どころ

v47 まではビルド済み HTML だけが残り、ソースが失われていた。
`reference/v47-build.html` から機械的に復元したのがこの `src/` で、
挙動が変わっていないことは照合ハーネスで担保している。

```
node tools/parity.mjs ./restored-logic.mjs
GAMES=1200 node tools/parity.mjs ./restored-logic.mjs   # 局数を増やす
```

元バンドルから抜き出した `reference/original-logic.mjs` を正として、
同じ状態・同じアクション・同じ乱数シードを与え、reducer / CPU / アクション補完の
出力が完全に一致するかをステップ単位で突き合わせる。30アクションすべてを通る。

復元に使った道具:

| スクリプト | 役割 |
| --- | --- |
| `tools/dejsx.mjs` | `(0,c.jsx)(...)` を JSX 記法へ戻す |
| `tools/rename.mjs` | 圧縮された識別子を意味のある名前へ戻す |
| `tools/split.mjs` | 1枚岩を `src/` へ分割し、import を自動生成する |
| `tools/parity.mjs` | 復元版と元バンドルの挙動を突き合わせる |
| `tools/extract-logic.py` | 元バンドルから比較用のロジックだけ切り出す |

## 引き継ぎメモ

- **王が6・7・8・9のとき、取れる手しか生成されない**（`board.js` の `jumpMoves` で
  `multiCapture` が真のとき、静かな移動を積んでいない）。元の実装のままにしてある。
  意図した仕様でなければ、ここを直せば王も普通に動けるようになる。
- オンライン対戦は Realtime Database を**クライアントから直接**叩いている。
  データベース側のセキュリティルールが公開読み書きのままだと、
  誰でも全ルームを消せる。公開前に確認すること。
