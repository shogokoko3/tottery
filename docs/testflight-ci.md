# TestFlight 自動化(GitHub Actions)の設定

`main` に push すると、GitHub の Mac が自動でビルドして TestFlight へ送ります
(`.github/workflows/testflight.yml`)。手元で `npm run ios:deploy` を打つ必要が
なくなります。**最初の一度だけ、GitHub に3つの秘密(Secrets)を登録**してください。

## 登録する Secrets(GitHub の Settings → Secrets and variables → Actions → New repository secret)

| 名前 | 中身 |
| --- | --- |
| `ASC_KEY_P8` | App Store Connect API キー(.p8)を base64 にしたもの |
| `DIST_CERT_P12` | 配布用証明書＋秘密鍵を書き出した .p12 を base64 にしたもの |
| `DIST_CERT_PASSWORD` | その .p12 を書き出すときに決めたパスワード |

Key ID / Issuer ID / Team ID は秘密ではないのでワークフローに直書きしてあります
(`U94V7XX3LN` / `d709d4c7-…` / `K66H4J3S87`)。変わったらワークフローを直します。

## 値の作り方(あなたのターミナル / Keychain Access)

### 1) `ASC_KEY_P8`
```bash
base64 -i ~/.appstoreconnect/private_keys/AuthKey_U94V7XX3LN.p8 | pbcopy
```
クリップボードに入るので、そのまま `ASC_KEY_P8` に貼り付け。

### 2) `DIST_CERT_P12`(配布証明書の書き出し)
証明書は `baccaland-signing` キーチェーンにあります。**Keychain Access(GUI)が確実**です。

1. 「キーチェーンアクセス」を開く → 左で **baccaland-signing** を選ぶ
   (見えないときは メニュー 表示 → キーチェーンを表示)
2. 種類「証明書」で **Apple Distribution: Shogo Tsushima** を開き、▶ で下の**秘密鍵も一緒に**選ぶ
   (証明書と鍵の2つを Command キーで複数選択)
3. 右クリック → **2項目を書き出す** → 形式 **個人情報交換(.p12)** → 保存
4. **書き出し用のパスワードを決めて入力**(これを `DIST_CERT_PASSWORD` に使う)
5. base64 にしてコピー:
   ```bash
   base64 -i ~/Desktop/書き出したファイル.p12 | pbcopy
   ```
   これを `DIST_CERT_P12` に貼り付け。

### 3) `DIST_CERT_PASSWORD`
2) の手順4で決めたパスワードをそのまま登録。

## 動かし方
- 3つの Secrets を登録したら、以後は **`main` に push されるたびに自動**でビルド→送信。
- アプリに関係ないコミット(メモだけ等)では走りません(paths で除外)。個別に飛ばしたい
  ときはコミット文に `[skip tf]` を入れる。
- 手動で回したいときは GitHub の **Actions タブ → TestFlight → Run workflow**。
- 結果は Actions のログで確認。最後に `Upload succeeded` が出れば TestFlight で処理待ち。

## 注意
- private リポジトリの macOS 実行は無料枠が少なめ(1ビルド≈15分)。多いと課金になり得ます。
- runner の Xcode は「最新の安定版」を使います。プロジェクトが要る SDK が入っていない
  ときはワークフローの `xcode-version` を固定してください。
- 証明書を作り直したら `DIST_CERT_P12` を入れ直します。
