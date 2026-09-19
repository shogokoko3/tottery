# Android(Google Play)へ出す手順

iOS の手順は「iOS配信.md」。ここは Android だけの話。

## いまどこまでできているか

- `android/` を作った(Capacitor 8)。パッケージ名は iOS と同じ `com.shogokoko.tottery`
- 版の番号(versionCode)・アプリ名・運営画面の除外は設定済み
- **課金・広告・近くの端末との対戦・強制アップデートは、Android では出ない**状態にしてある
  (理由は下の「まだできていないこと」)

つまりいまの Android 版は「Web 版と同じ遊べる範囲＋アプリとして配れる形」。
絵は webp にして 158MB まで下げた(Play の上限は 200MB)。iOS の画質は下げていない。

## 組み立てに必要なもの(2026-09-19 にこの Mac へ入れた)

- **JDK 21**(Capacitor 8 の Android は Java 21 を要求する。17 では止まる)
  `~/Library/Java/JavaVirtualMachines/jdk-21.0.12.1+1`
  (Adoptium の tar.gz を展開しただけ。管理者パスワードは要らない。
   Homebrew は Intel Mac 向けのビルド済みを配らなくなったので使えない)
- **Android SDK**(`brew install --cask android-commandlinetools`)
  `/usr/local/share/android-commandlinetools`
  入れた中身: platform-tools / platforms;android-36 / build-tools;36.0.0

組む前に、この2つを環境変数で指しておく:

```
export JAVA_HOME=~/Library/Java/JavaVirtualMachines/jdk-21.0.12.1+1/Contents/Home
export ANDROID_HOME=/usr/local/share/android-commandlinetools
export PATH="$JAVA_HOME/bin:$PATH"
```

毎回打たずに済ませるなら `~/.zshrc` に入れる。

## 組み立て方

```
npm run android:debug    # 手元で試す APK
npm run android:bundle   # Play に上げる AAB
```

できるもの:

- `android/app/build/outputs/apk/debug/app-debug.apk`
- `android/app/build/outputs/bundle/release/app-release.aab`

### 版の番号について

Play の `versionCode` は **21億未満の整数**でなければならない。iOS の
`BUILD_NUMBER`(`202609190705` のような12桁)はそのまま入らないので、Android は
**2020-01-01 からの経過分数**を使う(単調に増え、当分あふれない)。
`tools/android-release.sh` が自動で計算する。上書きしたいときは `ANDROID_VERSION_CODE`。

## 署名(Play に上げる前に一度だけ)

アップロード鍵を自分で作る(パスワードは自分で決めて、パスワード管理に控える):

```
keytool -genkeypair -v -keystore android/upload.jks -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

作ったら `android/keystore.properties` を書く:

```
storeFile=upload.jks
storePassword=(決めたパスワード)
keyAlias=upload
keyPassword=(決めたパスワード)
```

このファイルと `.jks` は `android/.gitignore` に入れてあるので git には入らない。
**鍵を失うと更新が出せなくなる**ので、控えを別の場所にも取っておくこと。
`keystore.properties` が無いときは署名なしで組む(手元で形を見るだけ。Play には上げられない)。

### Play App Signing

 に任せる(Google が配布用の鍵を持つ)。こちらが持つのは
**アップロード鍵**だけ。最初の AAB を上げるときに Play Console の案内に従って作り、
`android/keystore.properties` などに置く場合は **必ず .gitignore に入れる**。
鍵を失うと更新が出せなくなるので、控えを別の場所にも取っておくこと。

## 2つの版を同時に作る

iOS 版と Google Play 版は、**中身は同じで、絵の重さだけが違う**。

| | iOS / Web | Google Play |
|---|---|---|
| 絵(盤面エリア・称号) | png のまま(46MB) | webp q95(12MB) |
| 組み立て | `ASSETS=full` | `ASSETS=compact` |
| 出来上がり | 221MB | 158MB |

Play には「ダウンロード合計 200MB」の上限があり、png のままだと 192MB で
ほとんど余裕が無かった。iOS にはその上限が無いので、**iOS の画質は下げない**。
元の png は `assets/` にそのまま残るので、いつでも戻せる。

```
npm run release:both    # 両方作る。iOS は TestFlight まで送る
npm run release:build   # 両方作るだけ(送らない)
npm run check:both      # 両方が同じ中身か確かめる
```

`release:both` は ① iOS を組んで送る → ② Android の AAB を作る →
③ 両方が同じ中身か確かめる → ④ dist を画質そのままに戻す、の順に進む。

### 片方だけ古くなっていないか

`node build.mjs` は、組むたびに `build-info.json` をアプリの中へ入れる。

```json
{ "version": "49.0.0", "codeHash": "241f6c13…", "assets": "full", "build": 0 }
```

`codeHash` は `src/` と組み立ての道具から作る印で、**絵の重さや版の番号が違っても、
同じ中身なら同じ値**になる。`npm run check:both`(`npm run check` にも入っている)が
両方の `build-info.json` を読み比べ、ずれていればどちらが古いかを出して止める。

### webp の変換について

`cwebp`(`brew install webp`)を使う。品質は q95 + `-sharp_yuv` + `-alpha_q 100`。
等倍で見比べても元の png と見分けが付かない値(実測 PSNR 39〜41dB)。
変換した結果は `.webp-cache/` に貯めるので、2度目からは一瞬で終わる
(初回 3分35秒 → 2度目 2.5秒)。

## まだできていないこと(Play に出す前にどれかは決める)

| 何 | いまの状態 | どうするか |
|---|---|---|
| 課金 | Android では店を出さない | サーバーの検証([src/server/applejws.js](src/server/applejws.js))が Apple の署名専用。Google Play Developer API(`purchases.products.get`)で検証する道を作り、サービスアカウント鍵を用意する。商品も Play Console に作り直す |
| 広告 | Android では出さない | AdMob は Android 対応。Android 用のアプリID・ユニットIDを取って [src/net/ads.js](src/net/ads.js) の判定を開ける |
| 本人確認 | Android では出さない | Apple でのサインインの代わりに Google でのサインイン。[src/net/auth.js](src/net/auth.js) のバンドルID判定も直す |
| 近くの端末と対戦 | Android では入口が出ない | `plugins/tottery-nearby` は Swift だけ。Nearby Connections API で作るか、Android では出さないままにする |
| 強制アップデート | Android では効かない | 版の番号が iOS と別系統なので、`MIN_APP_BUILD` とは別の環境変数にするか、Play の In-App Update を使う |

## Play Console 側で要るもの

- デベロッパー登録($25)と本人確認
- **個人アカウントは、製品版の前に「12人以上が14日連続でクローズドテストに参加」**が要る。日数が固定でかかるので最初に始める
- フィーチャーグラフィック 1024×500、アイコン 512×512、Android 比率のスクリーンショット
- データセーフティの申告(App Store の栄養ラベルとは別様式)
- コンテンツレーティング(IARC)、広告の有無の申告
- **ガチャの確率開示**(Play は「有料のランダム化された仮想アイテム」に明示を義務づけている)
- **アカウント削除の導線**(アプリ内とウェブの両方)
- プライバシーポリシーの URL(既存のものを使える)
