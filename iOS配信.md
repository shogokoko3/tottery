# iOS 配信(TestFlight / App Store)

2026-09-11 作成。Web(https://tottery.shogokoko3.workers.dev/)は `main` へ push すれば配られるが、
iOS アプリは別に組み立てて Apple へ送る必要がある。手順と、本人にしかできない準備をまとめる。

## 本人にしかできない準備(最初の1回)

1. **Apple Developer Program** に加入する(年額。個人でよい)。https://developer.apple.com/programs/
2. **Xcode にサインイン**: Xcode → Settings → Accounts → Apple ID を追加。チームが出たら、
   その **Team ID(10桁)** を控える(Membership のページにも出る)。
3. **App Store Connect にアプリを作る**: https://appstoreconnect.apple.com → My Apps → 「+」→
   名前「トッタリー」、Bundle ID **com.shogokoko.tottery**(先に Certificates, Identifiers & Profiles で
   Identifier を登録する。Xcode の自動署名で作られることもある)、SKU は任意。
4. (任意)**App Store Connect の API キー**: Users and Access → Integrations → App Store Connect API →
   「+」。Key ID・Issuer ID を控え、.p8 を `~/.appstoreconnect/private_keys/` に置く。
   無くても Xcode のサインインだけで送れる(その場合は初回にパスワードを聞かれることがある)。
5. **TestFlight の受け取り側**: App Store Connect → TestFlight → 内部テスター(App Store Connect のユーザー)か、
   外部テスター(メールで招待。外部は最初の1回だけ Apple の簡易審査がある)。iPhone に TestFlight アプリを入れる。

## 送る(毎回)

```
export APPLE_TEAM_ID=XXXXXXXXXX          # 2. の Team ID
# API キーを使うなら(任意)
export ASC_KEY_ID=XXXXXXXXXX ASC_ISSUER_ID=xxxxxxxx-... ASC_KEY_PATH=~/.appstoreconnect/private_keys/AuthKey_XXXXXXXXXX.p8
sh tools/ios-release.sh all
```

- `archive` … `npm run ios:sync`(build → cap copy → admin.html を落とす)→ 署名付きアーカイブ(`ios/build/App.xcarchive`)。
  ビルド番号は時刻(例 202609111530)で自動的に増える。見た目の版(1.0 など)は Xcode の MARKETING_VERSION。
- `upload` … `ios/ExportOptions.plist`(App Store Connect へ upload)で書き出して送る。
- 10〜30分で App Store Connect の TestFlight に現れる。輸出コンプライアンスは Info.plist の
  `ITSAppUsesNonExemptEncryption` で答えてあるので聞かれない。

## 送る前の点検

- `node tools/check-submit.mjs` … 提出の関門。未了は `src/game/support.js` の **SUPPORT_EMAIL**
  (このアプリ専用のアドレス。個人の常用アドレスは入れない。TestFlight だけなら未設定でも送れるが、審査には必須)。
- `npm run check` が通っていること。
- シーズン API はアプリから絶対 URL(`src/net/season.js` の `seasonApiBase`)で Worker に届き、Worker は
  `capacitor://localhost` にだけ CORS を返す(`tools/check-ios-api.mjs`)。Firebase は元から CORS 済み。

## つまずいたら

- 「Your team has no devices」… 開発用の署名にはチームに iPhone が1台要る。iPhone を USB でつないでおけば
  `-allowProvisioningDeviceRegistration`(スクリプトに入れてある)が自動で登録する。2026-09-12 に初回のアーカイブでこれに当たった
- 「No signing certificate」… Xcode の Accounts でチームが選べているか。`-allowProvisioningUpdates` が
  証明書とプロファイルを自動で作る。
- 「No profiles for 'com.shogokoko.tottery'」… App Store Connect / Identifiers に Bundle ID が無い。
- シミュレータ用の手順(署名なし)は README と `tottery-ios-build` のメモのまま。
