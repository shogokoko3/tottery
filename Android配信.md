# Android(Google Play)へ出す手順

iOS の手順は「iOS配信.md」。ここは Android だけの話。

## いまどこまでできているか

- `android/` を作った(Capacitor 8)。パッケージ名は iOS と同じ `com.shogokoko.tottery`
- 版の番号(versionCode)・アプリ名・運営画面の除外は設定済み
- **課金・広告・近くの端末との対戦・強制アップデートは、Android では出ない**状態にしてある
  (理由は下の「まだできていないこと」)

つまりいまの Android 版は「Web 版と同じ遊べる範囲＋アプリとして配れる形」。

## 組み立てに必要なもの(この Mac にはまだ入っていない)

- **JDK 17 以上**(いま入っているのは 11。Capacitor 8 の Gradle は 17 以上が要る)
- **Android SDK**(`ANDROID_HOME` か `ANDROID_SDK_ROOT` を通す)

Homebrew なら:

```
brew install --cask temurin@17
brew install --cask android-commandlinetools
```

入れたあと、`~/.zshrc` に

```
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export ANDROID_HOME=/usr/local/share/android-commandlinetools
export PATH="$ANDROID_HOME/platform-tools:$PATH"
```

を足し、`sdkmanager "platforms;android-36" "build-tools;36.0.0" "platform-tools"` を一度走らせる。
(Android Studio を入れる場合は SDK も一緒に入るので、`ANDROID_HOME=~/Library/Android/sdk`)

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

## 署名

Play App Signing に任せる(Google が配布用の鍵を持つ)。こちらが持つのは
**アップロード鍵**だけ。最初の AAB を上げるときに Play Console の案内に従って作り、
`android/keystore.properties` などに置く場合は **必ず .gitignore に入れる**。
鍵を失うと更新が出せなくなるので、控えを別の場所にも取っておくこと。

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
