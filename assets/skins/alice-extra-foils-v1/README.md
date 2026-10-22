# トランプ兵・ティーカップのフォイル素材

animated.html を開くと、通常版との比較、36・48・72pxの縮小表示、動く反射の停止・再開を確認できます。描画処理とマスクをHTMLに同梱しているため、PNGと通常版のフォルダがあればオフラインでも動きます。

画像は内蔵 imagegen で生成。prompts.json に最終プロンプトを保存しています。

反射には既存ゲームの src/skins/foil-material.js の attachFoilMaterial を使用しています。素材の虹色が流れ、背景の光片が明滅します。画面外、非表示タブ、動きを減らす設定では停止します。

masks.json のキー:
- alice-extra-card-soldier
- alice-extra-teacup-blue-gold
- alice-extra-teacup-green-copper

ゲームに接続する場合、FoilArtwork または attachFoilMaterial の maskEntry に対応するエントリを渡してください。PNGは3:4で表示してください。輪郭の近似範囲と箔色の検出で、素材反射と背景の光片を分けています。イラスト自体は変更しません。

再生成:
- python3 tools/build-alice-extra-foil-masks.py
- node tools/check-alice-extra-foil-material.mjs
- node tools/build-alice-extra-foil-preview.mjs

今回の成果はフォイル画像・反射マスク・動くプレビューです。ゲーム本体のカード登録や入手条件は変更していません。
