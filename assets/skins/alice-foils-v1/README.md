# アリスシリーズのフォイル反射

animated.html をブラウザで開くと、通常版との比較・盤面サイズ・反射の停止と再開を確認できます。HTMLに描画処理とマスクを同梱しているため、同じフォルダのPNGと一緒にオフラインでも使えます。

既存の src/skins/foil-material.js を使用。素材の虹色反射は約2.8秒周期で、背景の光片も明滅します。表示範囲外・非表示タブ・動きを減らす設定では停止します。

再生成:
- python3 tools/build-alice-foil-masks.py
- node tools/check-alice-foil-material.mjs
- node tools/build-alice-foil-preview.mjs

masks.json のキーは alice-A-alice 〜 alice-K-king。FoilArtwork または attachFoilMaterial の maskEntry に対応するエントリを渡して接続できます。元画像と同じ3:4比率で表示してください。

顔と手を矩形で保護し、残りの箔色を検出して反射範囲を作成しています。素材画像は変更していません。画像差し替え時は保護範囲も見直してください。

素材と反射の準備まで。キャラ台帳、ガチャ、バトルパス、効果盤面は未変更。Aフォイルの入手条件は未設定です。
