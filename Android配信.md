# Android(Google Play)へ出す手順

iOS の手順は「iOS配信.md」。ここは Android だけの話。

## いまどこまでできているか

- `android/` を作った(Capacitor 8)。パッケージ名は iOS と同じ `com.shogokoko.tottery`
- 版の番号(versionCode)・アプリ名・運営画面の除外は設定済み
- **課金・広告・近くの端末との対戦・強制アップデートは、Android では出ない**状態にしてある
  (理由は下の「まだできていないこと」)

つまりいまの Android 版は「Web 版と同じ遊べる範囲＋アプリとして配れる形」。

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

## 大きさの問題(Play に出す前に必ず決める)

2026-09-19 に初めて組んだ AAB は **192MB**。中身の内訳(非圧縮):

| 何 | 大きさ |
|---|---|
| skins(動画 20本 69MB＋webp 101枚 55MB) | 129MB |
| honors(png 21枚) | 27MB |
| fields(png 7枚) | 20MB |
| アプリ本体(dex・res・index.html) | 25MB |

**Play は「基本＋設定 APK のダウンロード合計 200MB」が上限**。すでに際どく、
スキンを足すたびに超える。絵も動画も端末の density では分かれないので、
そのままでは分割されない。どれかを選ぶ必要がある:

1. **絵を Cloudflare から取りに行く**(いちばん効く)。アプリは 30MB 弱になり、
   iOS のダウンロードも軽くなる。初回に読み込む作りが要る
2. **Play Asset Delivery**(アセットパック)。1GB まで置けるが、WebView から
   読む配線を書く必要がある
3. **絵を圧縮し直す**。honors と fields は **png のまま(合わせて 46MB)**なので、
   webp にすれば 30〜40MB は減る。すぐできるが、根本的には足りない

いまは 1 か 2 を選ぶまで、Play には出せない。

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
