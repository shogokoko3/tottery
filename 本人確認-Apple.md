# ランダムマッチの横取り対策 — Sign in with Apple

## なぜやるか

待ち合わせ（`lobby`）の客席は、いまは**署名さえ通れば誰でも取れる**。匿名の口座は
いくらでも作れるので、ボット1つで待ち合わせを片端から埋めれば、ランダムマッチが
誰にも成立しなくなる（監査で本番実測済み。可用性の DoS）。合言葉部屋は8文字の
合言葉が鍵なので、この攻撃を受けない。

対策：**ランダムマッチに入るときだけ**「本人確認済み（匿名でない）」を求める。
ボットは Apple ID を口座ごとに要するので、現実的に埋め尽くせなくなる。合言葉部屋と
オフラインは今まで通り、匿名のまま遊べる。

## 何が変わるか（利用者から見て）

- 初回起動の匿名サインインは今まで通り（名前もメールも聞かない）。
- 「オンラインでマッチする」を押したとき、匿名のままなら **Sign in with Apple** の
  画面が1回出る。通すと、**いまの匿名の口座に Apple が紐づく**。uid は変わらないので、
  これまでの持ち点・称号・記録はそのまま続く。
- 合言葉で友達と対戦する分には、Apple は要らない。

## 誰が何をやるか（3人で分担）

### A. ご本人 — Apple と Firebase の設定（これが無いと一切動かない）

**先に Apple Developer で値を作り、あとで Firebase に貼る**、という順番。

#### A-1. Apple Developer で「Sign in with Apple」を有効化（App ID）

1. developer.apple.com/account → 「Certificates, Identifiers & Profiles」。
2. 左メニュー **Identifiers** → 一覧から App ID **`com.shogokoko.tottery`** をクリック。
3. Capabilities の一覧で **Sign In with Apple** にチェック → 右上 **Save**。
   （「Enable as a primary App ID」を聞かれたらそのまま Continue で可。）

#### A-2. Services ID を作る（Web からの本人確認に使う）

トッタリーは iOS と Web の両方で配っている。Web でも本人確認できるように、
Services ID を1つ作る（iOS だけなら省けるが、Web の人がランダムマッチに入れなく
なるので作っておく）。

1. **Identifiers** → 右上の **＋** → **Services IDs** を選んで Continue。
2. Description（例：Tottery Sign In）と Identifier を入れる。Identifier は
   **App ID とは別**にする。例：**`com.shogokoko.tottery.signin`**。Register。
3. 作った Services ID をクリック → **Sign In with Apple** にチェック → **Configure**：
   - **Primary App ID**：`com.shogokoko.tottery`
   - **Domains and Subdomains**：`tottery-66e0f.firebaseapp.com`
   - **Return URLs**：`https://tottery-66e0f.firebaseapp.com/__/auth/handler`
   - Next → Done → **Save**。

#### A-3. 秘密鍵（.p8）を作る

1. 左メニュー **Keys** → 右上の **＋**。
2. Key Name（例：Tottery Apple Sign In）を入れ、**Sign in with Apple** にチェック
   → その行の **Configure** → Primary App ID を `com.shogokoko.tottery` → Save。
3. Continue → **Register**。
4. **Download** で `.p8` ファイルを落とす。**ダウンロードは一度きり**なので必ず保存。
5. この鍵の **Key ID**（10桁の英数字）を控える。

#### A-4. Team ID を控える

画面右上のアカウント名 → **Membership details** に **Team ID**（10桁）がある。

#### A-5. Firebase コンソールに貼る

1. console.firebase.google.com → プロジェクト **tottery-66e0f**。
2. 左メニュー **Authentication** → **Sign-in method** タブ → **Add new provider**
   （既にあれば一覧の）→ **Apple** → 右上のトグルで **有効**。
3. 欄を埋める：
   - **Services ID**：A-2 で作った `com.shogokoko.tottery.signin`。
   - 「OAuth code flow configuration」を開いて：
     - **Apple team ID**：A-4 の Team ID。
     - **Key ID**：A-3 の Key ID。
     - **Private key**：A-3 の `.p8` をテキストエディタで開き、
       `-----BEGIN PRIVATE KEY-----` から `-----END PRIVATE KEY-----` まで丸ごと貼る。
   - **Save**。
4. 念のため、**Project settings → Your apps** に iOS アプリ（Bundle ID
   `com.shogokoko.tottery`）が登録されているか確認。無ければ「アプリを追加 → iOS」で
   Bundle ID を登録する（Apple のトークンの宛先(aud)を Firebase が照合するため）。

これで Apple のトークンを Firebase が受け付けるようになる。

### B. iOS セッション — ネイティブ（本体ツリー `~/Desktop/トッタリー/tottery`）

1. プラグインを入れる：`npm i @capacitor-community/apple-sign-in`
2. Xcode で App ターゲット → **Signing & Capabilities** → **＋ Capability** →
   **Sign in with Apple** を足す。
3. `npx cap sync ios`
4. ランダムマッチに入る操作のところで、次の流れで呼ぶ：

```js
import { SignInWithApple } from "@capacitor-community/apple-sign-in";
import { linkAppleIdentity } from "../net/auth.js";
import { sha256hex } from "…"; // rawNonce の SHA-256(16進)。無ければ Web Crypto で

const rawNonce = crypto.randomUUID() + crypto.randomUUID();
const res = await SignInWithApple.authorize({
  clientId: "com.shogokoko.tottery",     // Bundle ID
  scopes: "name email",
  nonce: await sha256hex(rawNonce),        // Apple には「ハッシュ」を渡す
});
const identityToken = res.response.identityToken;
await linkAppleIdentity({ identityToken, rawNonce }); // Firebase には「素の」nonce
```

**nonce の要点**：Apple には `SHA-256(rawNonce)` を渡し、Firebase には `rawNonce`
そのものを渡す（Firebase が突き合わせる）。私の `linkAppleIdentity` は
`nonce=rawNonce` を送るので、上の渡し方でつながる。**プラグインの版によっては
nonce を内部でハッシュするものもある**ので、実機で一度「本人確認が通るか」を
確かめてほしい（通らなければ、ハッシュを二重にかけていないかを見る）。

### C. 私（Claude）— コード

- **済み（push 済み。まだどこからも呼ばれないので既存の動きは無変更）**
  - `src/net/auth.js` に3つ足した：
    - `linkAppleIdentity({ identityToken, rawNonce })` … いまの匿名口座に Apple を
      紐づける（uid を保つ）。REST の `accounts:signInWithIdp`。もしその Apple id が
      別口座に既にあれば（再インストール等）、添え物なしで入り直して前の口座に戻す。
    - `providerOf(idToken)` / `isVerified()` … いまの合言葉が匿名でないかを、
      idToken の中の `firebase.sign_in_provider` から見分ける。
  - 検査 `tools/check-verify.mjs`（6件）を `npm run check` に追加。
- **これから（A・B が整ってから）**
  - `RandomMatchScreen`（`src/ui/screens.jsx:404`）の入口で `isVerified()` を見て、
    匿名なら B の Apple 連携を挟む。断られたら「合言葉で対戦」へ誘導し、待ち合わせは
    始めない。掲示に出す前・客席に名乗る前の2か所（`writeLobby('/${v}')` 付近と
    `writeLobby('/${z}/guest')` 付近）が対象。
- **これから（いちばん最後、クライアントが配られてから）**
  - `tools/apply-identity-gate.mjs` でルールに本人確認ゲートを当てて公開。

## 公開の順番（超重要・前回と同じ轍）

**クライアントが先、ルールが後。**

1. B（ネイティブ）と A の1・2（Apple／Firebase 設定）を済ませる。
2. C の「ランダムマッチ入口ゲート」入りクライアントを配信し、**みんなが一度開くのを待つ**。
3. `node tools/apply-identity-gate.mjs` でルールにゲートを当て、公開する。

先にルールを締める（3を2より前にやる）と、まだ古いクライアント（匿名のまま）の人は
ランダムマッチに入れなくなる。**2→3の順を必ず守る。** 合言葉部屋は全段階で影響なし。

## ルールに足すゲート（`tools/apply-identity-gate.mjs` が自動で当てる）

`lobby/$code` の募集と、`lobby/$code/guest` の参加、この2つの「作る」枝の先頭に
1つ足すだけ：

```
auth.token.firebase.sign_in_provider != 'anonymous'
```

`sign_in_provider` は Firebase が署名して入れる欄なので、端末では詐称できない。
「下ろす（delete）」枝には足さないので、**片付けは匿名でも妨げない**。合言葉部屋の席
（`rooms/$code/seats/guest`）はゲートの対象外。

論理はコピーに当てて評価器で確かめた（`scratchpad/prove-gate.mjs`、6/6：匿名は募集も
参加も弾かれ、Apple 確認済みは通り、下ろすのは匿名でもでき、合言葉部屋は匿名で座れる）。

## 公開後の最終確認（本番で）

Apple 連携済みの本物のトークンでしか本番の最終確認はできない（評価器は署名を見ない）。
公開したら次を実測する：

- 匿名の口座は、ランダムマッチの募集・参加ができない（弾かれる）。
- Apple 連携済みは、募集・参加ができる。
- 合言葉部屋は、匿名のまま今まで通り座れる。

## いまの立ち位置

- C の**認証コードとルールのパッチは用意して検証済み**（`isVerified`／`linkAppleIdentity`／
  `apply-identity-gate.mjs`。`npm run check` 通過、build 通過）。
- 止まっているのは **A（ご本人の Apple／Firebase 設定）と B（iOS ネイティブ）** 待ち。
  この2つが整えば、C の残り（入口ゲートの結線）を入れて配信 → ルール公開、で完了する。
