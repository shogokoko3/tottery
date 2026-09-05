# データベースの決まり（firebase-rules.json）

## なぜ締めたか

以前は `players` `ranks` `letters` `lobby` がすべて「誰でも読める・誰でも書ける」
でした。データベースの URL は配布物に平文で入っているので、**アプリを持って
いない人でも**、公開中のURLに対して次ができる状態でした（実測で確認済み）。

- 全プレイヤーの名前・端末id・持ち点・戦績を読む
- 他人の行を消す
- 形式を合わせた PUT で他人を使用停止(BAN)にする
  （停止された端末は次の起動でアカウントごと消えるので、他人のデータを消せる）
- 運営を名乗って褒美つきのお知らせを全員に配る
- 個人宛てのお知らせを宛先に関係なく読む

## どう締めたか

**Firebase の匿名サインイン**を通し、端末ごとに Firebase が uid を発行します。
uid は端末が名乗るものではなく Firebase が署名して発行するので、なりすませません。
サーバー上の記録はこの uid を鍵にして持ち、ルールで **「自分の行だけ書ける」** を
強制します。

| 置き場 | 読める人 | 書ける人 |
| --- | --- | --- |
| `rooms/<合言葉>` | サインイン済みの人 | サインイン済みの人 |
| `lobby` | サインイン済みの人 | サインイン済みの人 |
| `ranks/<uid>` | **誰でも**（ランキングなので） | 本人と運営 |
| `players/<uid>` | **本人と運営だけ** | 本人と運営 |
| **`bans/<uid>`** | **本人と運営だけ** | **運営だけ** |
| `letters/all/<id>` | サインイン済みの人 | **運営だけ** |
| **`letters/to/<uid>/<id>`** | **本人と運営だけ** | **運営だけ** |

### 停止の印を `players` の外に出した理由

はじめは `players/<uid>/banned` に置き、そこだけ運営限定にするつもりだった。
**これは効かない。** Firebase のルールは浅いほうが勝ち、**深い側で権限を
取り消せない**。`players/<uid>` に本人の書き込みを許した時点で、その下の
`banned` を運営限定にしても意味がなく、停止された本人が

- `PATCH {"banned": false}` で解除できる
- 行ごと `DELETE` すれば、起動時に新品として載り直す

別の木 `bans/<uid>` に出せば、本人が自分の台帳に何をしても停止は残る。

### お知らせを宛先ごとに分けた理由

ひとつの木に混ぜていたときは、端末が**全部を受け取ってから**自分宛てを
選り分けていた。つまり他人宛ての件名・本文・添付・宛先が、通信としては
全員に渡っていた。置き場を分けたので、**届く前に絞られる**。

## 公開する前にやること

1. Firebase コンソール → **Authentication → Sign-in method → 匿名** を有効にする
2. **ウェブ API キー**（プロジェクトの設定 → 全般）を `src/net/auth.js` の
   `API_KEY` に入れる
3. アプリを一度開いて、自分の **uid** を控える
   （設定画面の下、または `localStorage` の `tottery.auth.v1`）
4. このファイルの `PUT-OPERATOR-UID-HERE` を、その uid に置き換える（3か所＋2か所）
5. Firebase コンソールのルール画面に貼って公開する

**順番が大事です。** 2 を入れて配信し、みんながサインインを通してから 5 を公開して
ください。先にルールを締めると、まだ古い版のアプリを開いている人が繋がらなくなります。

## 名前の付け替えについて

以前は端末が自分で作った `p…` という id を鍵にしていました。uid に付け替えるので、
古い鍵の行は誰も名乗らない行として残ります。アプリは起動時に古い行を消してから
置き直します（`dropOldRows`）。名前・持ち点・戦績は端末の中にあるので、鍵が
変わっても失われません。

---

# ここまでの進み具合（2026-09-05 時点）

## 済んだこと

- **管理画面を配信先から外した**（`9adc938`）。`/admin` はどの綴りでも 404。
  使うときは手元で `npm run build && npm run serve` → `http://localhost:4199/admin.html`
- **匿名サインインの土台を書いた**（`f3132ba`）。通信14か所すべてに合言葉を付ける口を用意
- **認証層の危ない2点を直した**（`c0d20b1`）。どちらも実測で再現・修正を確認
  - 期限内の合言葉を捨てていた（対局中の手が消えて盤がずれる）
  - 通信不良で uid が作り替わっていた（別人になる）
- **ウェブAPIキーを受け取り、実際に通ることを確認した**
  匿名サインイン・合言葉つきの読み書き・1時間後の取り直し、すべて実測で成功

## いまの状態

**配信中のアプリは無傷です。** 認証は素通り（`API_KEY` が空）、ルールも旧のまま、
管理画面だけが閉じています。誰の対戦も止まっていません。

キーは `src/net/auth.js` のコメントに控えてあり、**入れるのは1行**です。
ただし**まだ入れないでください。** 入れた瞬間に uid への付け替えが始まり、
下の「移行と運用」の問題がそのまま起きます。

## 残っている作業

独立した点検（4観点 → 1件ずつ反証）で出た、**実在が確認された問題**です。
誤報と判定した13件は除いてあります。


### ルールの設計（18件）

**【重大】banned の入れ子ルールは効かない。停止された本人が1リクエストで解除できる**

- 何が起きるか: Firebase の .write は浅い方が勝ち、深い方で取り消せない。players/$uid に「本人も書ける」を与えた時点で、その下の banned / bannedAt の運営限定ルールは評価すらされない。停止された人が匿名トークンを取り(公開中の index.html に API キーが入る)、`PATCH https://…/players/<自分のuid>.json?auth=TOKEN` に {"banned":false} を投げるだけで解除される。既存の name が残るので .validate も通る。もっと雑に `DELETE /players/<自分のuid>.json?auth=TOKEN` でも行ごと消えて、syncPlayer は banned を見つけられない。つまり使用停止は運営の唯一の手段なのに、押した相手が自分で外せる。
- 根拠: `firebase-rules.json:33-40 / src/net/players.js:80-87`
- 直し方: $uid に .write を置かず、書ける子を1つずつ列挙する。例: "$uid": { "name": {".write": "auth.uid === $uid"}, "rating": {…}, …, "banned": {".write": "auth.uid === 運営"} } とし、$uid 直下の .write は運営だけにする。または banned を players ではなく別の木(bans/$uid、本人は読むだけ)へ移す。

**【重大】管理画面が丸ごと開かなくなる。lobby / letters を素の URL で叩いている**

- 何が起きるか: admin.jsx は players / letters の送信だけ net/ 側の関数を使い、一覧の読みと削除は自前の getJson / remove を使っている。この2つは authed() を通っていないので、トークンが一切付かない。新ルールでは lobby の .read も letters の .read も auth != null なので 401。しかも getJson("lobby") は Promise.all の中で reject 用の受け皿を持たない(players と letters だけ .then の第二引数を持っている)ので、Promise.all ごと落ちて外側の catch に入り、ranks も players も letters も一件も描画されない。remove(`ranks/…`)、remove(`lobby/…`) も同じ理由で必ず失敗する
- 根拠: `src/admin/admin.jsx:42-56,182-194,230,325`
- 直し方: admin.jsx の getJson / remove も await authed(...) を通す(net/firebase.js の getJson を使い回すのが早い)。ついでに getJson("ranks") / getJson("lobby") にも players と同じ形の受け皿を付け、1つ読めなくても他が出るようにする。

**【重大】他人の対局に手を差し込める。acts に誰が送ったかの検査が無い**

- 何が起きるか: rooms/$code も「サインイン済みなら誰でも読み書き」。code は上の lobby から取れるうえ、フレンド戦は4桁(32^4=約100万通り)なので総当たりも現実的。受け手は game.jsx:950-955 で __id が既知でない act をそのまま reducer へ流し、送り主を一切見ない。よって POST /rooms/<code>/acts.json?auth=T に {"type":"MOVE_PIECE","pieceId":…,"__id":"x1"} を投げるだけで、他人の対局で勝手に駒を動かせる。PUT /rooms/<code>.json に {} を投げれば対局そのものを壊せる。付け加えると acts には SETUP_CONFIRM の kingId がそのまま載るので、code を知る第三者は GET /rooms/<code>/acts.jso
- 根拠: `firebase-rules.json:6-11 / src/ui/game.jsx:944-956 / src/net/sync.js:40-51`
- 直し方: rooms/$code に hostUid / guestUid を持たせ、.write をその2人に限る。acts/$id には ".validate": "newData.child('by').val() === auth.uid" を付け、受け手側でも act.by が相手の uid と一致するものだけ reducer に流す(自分の by は既に __id で弾いている)。

**【重大】players/$uid/banned を運営だけに絞ったつもりが効いていない。本人が自分でBANを解除できる**

- 何が起きるか: Realtime Database の .write は浅い階層で許可すると下位で取り消せない。firebase-rules.json:33 が `players/$uid` 全体に `auth.uid === $uid` で書き込みを与えているので、その下の firebase-rules.json:35-40（banned / bannedAt は運営だけ）は評価されるまでもなく無意味になる。再現: BANされた利用者が自分の idToken を付けて `PATCH https://…/players/<自分のuid>.json` に `{"banned": false}` を送ると 200 が返り、players.js:82 の判定を通らなくなって復活する（.validate は既存の name が残るので通る）。firebase-rules.md:28 の表と commit mess
- 根拠: `firebase-rules.json:33 と firebase-rules.json:35-40、firebase-rules.md:28、src/net/players.js:82`
- 直し方: BAN の置き場を players の外に出す。例えば `banned/<uid>` を作り、`".read": "auth != null && auth.uid === $uid"`, `".write": "auth.uid === 'OPERATOR'"` にして、players/$uid 側からは触れないようにする。players.js:31 の url と syncPlayer の読み先、admin.jsx:256 の setBanned もそこへ向ける。

**【重大】移行の窓（キー配信済み・ルール未公開）に banned:true を仕込まれると、その人は二度と名前を持てない**

- 何が起きるか: 手順どおりなら 2 と 5 のあいだ、データベースは旧ルール（誰でも読み書き）のまま新しい uid 鍵の行が並ぶ。この窓で `players` を GET すれば全員の uid が採れるので、`curl -X PATCH .../players/<uid>.json -d '{"banned":true}'` を18人ぶん撃てる。以前はこれをやられても players.js:9-10 のとおり「新しい名前を決めれば別人として登録し直せる」逃げ道があった（鍵が端末生成の p… だったため）。今は逃げ道が無い: resetAccount は profile.js:163-171 で tottery.account.v1 しか消さず、tottery.auth.v1（auth.js:35）を残すので uid は変わらない。→ 次の起動で screens.jsx:933-941 が同じ uid を持
- 根拠: `src/game/profile.js:163-171, src/net/auth.js:35, src/ui/screens.jsx:941-947, src/net/players.js:82`
- 直し方: 順番を変えて窓を無くす。ルールの players だけ先に `".read": false, ".write": false` に近い形へ締めてから（旧版は players に書けなくなるが遊べる）、キーを配る。合わせて、BAN されたときに tottery.auth.v1 も消すか、逆に「BANは端末ではなくuidに効かせる」と決めるなら、少なくとも resetAccount で全部消すのをやめて、名前だけ決め直させる（記録を毎回焼くのは事故のとき取り返しがつかない）。

**【重大】ランキングから全員が一時的に消える。dropOldRows が ranks の行を消すのに、置き直すのは次のレート対局のときだけ**

- 何が起きるか: screens.jsx:938 の dropOldRows(oldId) は players.js:96 で `ranks/<古いp-id>` を DELETE する。ところが新しい `ranks/<uid>` を書くのは ranking.js の publishRank だけで、その唯一の呼び出しは game.jsx:1141 の `if (after.delta !== null) publishRank(after)`、つまりオンラインのレート対局を1局終えたときに限られる。起動時の syncPlayer（screens.jsx:941）が書くのは players だけ。→ 手順2を配って全員が一度アプリを開いた時点で、ranks はほぼ空になる。18人がそれぞれ次にオンライン対戦を1局終えるまで、ランキング画面は空か数人しか出ない。
- 根拠: `src/net/players.js:96, src/ui/game.jsx:1141, src/ui/screens.jsx:938-941`
- 直し方: screens.jsx の起動の筋で、dropOldRows のあとに publishRank(now) も呼ぶ（profile.name と rating は端末に残っているので、そのまま載せ直せる）。順番は「新しい鍵で置き直してから古い鍵を消す」にすると、途中で落ちても消えっぱなしにならない。

**【中】players/<uid> の書き込み権が子まで降りるので、使用停止にされた本人が banned を自分で消せる。BAN が実質効かない**

- 何が起きるか: Realtime Database の .read/.write は浅い側が深い側を上書きする（深い階層で権限を取り消すことはできない）。firebase-rules.json:33 が players/$uid 全体の書き込みを本人に許しているので、firebase-rules.json:35-40 の banned/bannedAt の「運営だけ」は一切効かない。実際の手順: 使用停止にされた人が自分の idToken で `PATCH https://<db>/players/<自分のuid>.json?auth=<idToken>` に `{"banned":false,"bannedAt":null}` を投げるだけ。ルールは通る（.validate は name があるので通過）。次の起動で players.js:82 の banned チェックが false になり、そのまま
- 根拠: `firebase-rules.json:33 と firebase-rules.json:35-40, src/net/players.js:82`
- 直し方: 停止フラグを本人が書ける木の外へ出す。ルートに `"banned": { "$uid": { ".read": "auth != null && auth.uid === $uid", ".write": "auth != null && auth.uid === '<運営uid>'" } }` を作り、players.js:80-87 の syncPlayer はそちらを読む。players/$uid 側の banned/bannedAt の子ルールは消す（意味が無いので残すと誤解のもとになる）。

**【中】uid 移行で既存の BAN が全部消える。しかも端末が自分で証拠を消しに行く**

- 何が起きるか: 起動時に ensureAuth → adoptUid で profile.id が p… から uid へ変わり、dropOldRows(旧id) が players/<旧id> を DELETE する。公開手順どおり「アプリを先に配って、ルールは後で公開」する以上、この DELETE が走る期間はルールがまだ全開なので必ず成功する。そのあと syncPlayer が見るのは players/<新uid> で、banned はどこにも無い。結果、いま停止中の人は新版を開いた瞬間に、何もしなくても全員復活する。しかも消したのは本人の端末なので運営側に痕跡が残らない。
- 根拠: `src/ui/screens.jsx:933-941 / src/net/players.js:94-106`
- 直し方: 移行のとき、旧行の banned を読んでから引き継ぐ(readPlayer(旧id) して banned が true なら新 uid の行にも立てる)。少なくとも dropOldRows から players/<旧id> の削除を外し、旧行の掃除は運営側でまとめてやる。

**【中】ranks の .validate が穴だらけ。余計な子を止めず、子パスへ直接書けば上限も抜けられる**

- 何が起きるか: 2つある。(a) hasChildren と name/rating しか見ておらず、知らない子を禁じていない。PUT /ranks/<自分のuid>.json?auth=T に {"name":"a","rating":4000,"junk":"…数MB…"} を書くと検査を通る。rating が 4000 なので limitToLast=50 に必ず入り、全プレイヤーが起動のたびにその数MBを落としてくる(readRanks はランキング全体を1回で読む)。(b) 親の .validate は「その親ノードに書いたとき」しか評価されないので、PUT /ranks/<自分のuid>/rating.json?auth=T に 999999 や "abc" を投げると .write だけ通って型と 0〜4000 の上限をすり抜ける。ランキング画面は rating が number であること
- 根拠: `firebase-rules.json:25 / src/net/ranking.js:60,75`
- 直し方: $uid の中を子ごとに書く。"name": {".validate": "newData.isString() && newData.val().length <= 10"}、"rating": {".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 4000"}、plays/wins/rated/at も同様に、icon/title は長さの上限を付け、最後に "$other": {".validate": false} を足して知らない子を全部落とす。$uid 自身には hasChildren(['name','rating']) を残す。

**【中】ルール公開後に初めて新版を開いた人は、ranks の古い行が永久に残って同じ名前が二重に並ぶ**

- 何が起きるか: dropOldRows は `ranks/<古いp-id>` を DELETE するが、firebase-rules.json:24 の `.write` は `auth.uid === $uid` で、$uid は p… の文字列。この鍵で名乗れる人間は存在しないので、ルールを公開したあとの DELETE は必ず 401 で失敗する（players.js:102 が黙って握り潰す）。同じことは、手順2の配信からルール公開までのあいだに一度もオンラインでアプリを開かなかった人にも起きる。さらに screens.jsx:938 の dropOldRows は await されておらず、players.js:96 のループは players → ranks の順に逐次なので、起動直後にアプリを閉じると ranks 側だけ消し残る。残った行は凍った持ち点のまま ranks の上位50件（rank
- 根拠: `firebase-rules.json:24, src/net/players.js:94-106, src/ui/screens.jsx:938, src/net/ranking.js:60`
- 直し方: (1) 移行のあいだだけ ranks の削除を運営にも許す: `".write": "auth != null && (auth.uid === $uid || auth.uid === 'OPERATOR')"`。(2) 管理画面に「p… 始まりの古い ranks 行を掃除する」ボタンを足す。(3) dropOldRows を await して、消し終わってから syncPlayer に進む。

**【中】個人宛てのお知らせが uid 付け替えで届かなくなり、宛先を直す手がかりも同時に消える**

- 何が起きるか: letters.js:74 の isFor は `letter.to === myId` の完全一致で、myId は letters.jsx:43 / letters.jsx:218 が loadProfile().id から採る。adoptUid（profile.js:381）はこの id を uid で上書きし、古い p-id をどこにも残さない。→ 既に出してある `to: "p1a2b3…"` のお知らせは、付け替えた瞬間に本人からも見えなくなり、未読バッジにも出ない。しかも dropOldRows が `players/<古いp-id>` も消す（players.js:96）ので、運営側にも「この p-id は誰だったか」が残らない。管理画面の一覧は admin.jsx:618 で players から名前を引くため、宛先が生の `p1a2b3…` として表示されるだけになり、誰
- 根拠: `src/net/letters.js:74, src/ui/letters.jsx:43, src/ui/letters.jsx:218, src/game/profile.js:378-384, src/net/players.js:96`
- 直し方: adoptUid で古い id を捨てずに `prevIds: [...(profile.prevIds||[]), profile.id]` として残し、isFor を `letter.to === myId || (prevIds||[]).includes(letter.to)` に変える（profile.js:378-384 と letters.js:70-75、呼び出し側の letters.jsx:43/218 に prevIds を渡す）。合わせて publishPlayer が `prevIds` をサーバーにも載せれば、管理画面から古い宛先を新しい uid に読み替えられる。移行前に未受け取りの個人宛てを洗い出しておくのも要る。

**【中】players/$uid の banned 子ルールは効かない。停止された本人が自分で解除できる**

- 何が起きるか: Firebase Realtime Database の .read/.write は上位で許可すると下位で狭められない（カスケードして、深い階層のルールは追加許可にしかならない）。firebase-rules.json:33 で players/$uid 全体に「本人なら書ける」を与えているため、35-40 行の banned / bannedAt の「運営だけ」は一切効かない。手順: 運営が管理画面から利用者Aを使用停止にする → Aは自分の端末の localStorage の tottery.auth.v1 から idToken を取り、curl -X PATCH 'https://tottery-66e0f-default-rtdb.asia-southeast1.firebasedatabase.app/players/<自分のuid>.json?auth=<自分のidToken
- 根拠: `/private/tmp/claude-501/-Users-shogo-Desktop------/80cc8fa5-6c87-425f-a279-6eb6ba1a155c/scratchpad/wt-lv/firebase-rules.json:33（$uid の .write）と :35-40`
- 直し方: 子の .write では止められないので .validate で縛る。players/$uid の .validate に「運営でなければ banned と bannedAt を変えられない」を足す: ".validate": "newData.child('name').isString() && newData.child('name').val().length <= 10 && (auth.uid === 'OPERATOR-UID' || (newData.child('banned').val() === data.child('banned').val() && newData.child('bannedAt').val() === data.child('bannedAt').val()))" とし、banned / bannedAt の子ブロックは削除する（誤解を招くだけ

**【中】ranks に運営条項が無いので、authed に直しても管理画面からランキング行を消せない**

- 何が起きるか: 上の指摘を直して admin の remove を authed() 経由にしても、ranks/$uid の .write は "auth.uid === $uid" だけなので、運営 uid で DELETE しても 401 のまま。管理画面のランキングタブの「消す」ボタン（admin.jsx:230）は恒久的に動かない。不適切な名前がランキングに載ったときに運営が消す手段が無くなる（players 側を消しても ranks 行は残り、ranks の .read は true なので誰でも見え続ける）。同じ理由で、players.js:94-106 の dropOldRows が消し残した古い ranks 行も、運営が後から掃除できない。
- 根拠: `/private/tmp/claude-501/-Users-shogo-Desktop------/80cc8fa5-6c87-425f-a279-6eb6ba1a155c/scratchpad/wt-lv/firebase-rules.json:24、/src/admin/admin.jsx:2`
- 直し方: ranks/$uid の .write を "auth != null && (auth.uid === $uid || auth.uid === 'OPERATOR-UID')" にする。削除では .validate は評価されないので、運営の DELETE はこれだけで通る。

**【中】使用停止にされた端末が、起動のたびにプロフィールを丸ごと失う無限ループに入る（本コミットによる退行）**

- 何が起きるか: API_KEY を入れて新ルールを公開したあと、運営が利用者Aを使用停止にする。Aの端末で: 起動 → ensureAuth → me.id は既に uid なので adoptUid は素通り → syncPlayer が banned:true を見る → resetAccount() が tottery.account.v1 を丸ごと消す（名前・レベル・経験値・チケット・所持スキン・受け取り済みの手紙が全部消える）→ 名前決め直し画面。Aが名前を入れると saveName が profile.id || makeId() で新しいローカル id を作る（profile.js:187）。次の起動で adoptUid が同じ uid に戻すので、また banned に当たり、また全消し。以後、起動するたびに名前を入れ直しては全部消える状態から抜けられない。このコミット以前は resetAc
- 根拠: `/private/tmp/claude-501/-Users-shogo-Desktop------/80cc8fa5-6c87-425f-a279-6eb6ba1a155c/scratchpad/wt-lv/src/ui/screens.jsx:933-948、/src/game/profile.`
- 直し方: 使用停止のときは resetAccount() で全消ししない。banned を見たら「使用停止中です」の画面で止める（オンラインだけ止め、ローカルの記録は残す）か、少なくとも名前だけ落として xp/tickets/skins は残す。名前決め直しに戻す運用を続けるなら、停止は uid ではなく都度発行する別の鍵に紐付けて、決め直したら解けるようにする。

**【中】letters はサインイン済みなら誰でも全部読める。「個人宛てのお知らせを宛先に関係なく読む」は直っていない**

- 何が起きるか: 匿名サインインは誰でも何個でも作れるので、"auth != null" は実質「誰でも」。curl で accounts:signUp を1回叩いて idToken を取り、GET '.../letters.json?auth=<その idToken>' を投げると、to が特定の uid 宛てのものも含めて全通が返る。宛先の絞り込み（letters.js:70-75 の isFor）はクライアント側のフィルタでしかなく、サーバーは何も守っていない。commit message と firebase-rules.md:14 が問題として挙げている「個人宛てのお知らせを宛先に関係なく読む」は、新ルールでも成立したまま。
- 根拠: `/private/tmp/claude-501/-Users-shogo-Desktop------/80cc8fa5-6c87-425f-a279-6eb6ba1a155c/scratchpad/wt-lv/firebase-rules.json:45（letters の .read）、/src/`
- 直し方: 全員宛てと個人宛てを置き場ごと分ける。letters/all/$id は "auth != null" のまま、letters/to/$uid/$id は ".read": "auth != null && auth.uid === $uid" にして、readLetters は2か所を読んで合わせる。あわせて firebase-rules.md:29 の表の「読める人＝サインイン済みの人」も、直すまでは「（個人宛ても含めて）サインイン済みの全員」と正直に書き直す。

**【中】lobby の一覧が誰でも読めて rooms は誰でも上書きできるので、匿名アカウント1個でランダムマッチを全面妨害できる**

- 何が起きるか: lobby の .read（firebase-rules.json:14）は lobby 配下すべてにカスケードするので、匿名 idToken 1つで GET '.../lobby.json?auth=…' を投げれば待機中の部屋コードが全部取れる。rooms/$code は .read/.write とも "auth != null"（:8-9）なので、そのコードに対して DELETE '.../rooms/<code>.json?auth=…' または PUT でゴミを書けば、待っている人のマッチが必ず壊れる。3分（LOBBY_TTL）ごとに一覧を舐めて消し続けるだけで、ランダムマッチが誰にも成立しなくなる。同じ経路で進行中の rooms/<code> を読めば、対局中の相手の情報も取れる。
- 根拠: `/private/tmp/claude-501/-Users-shogo-Desktop------/80cc8fa5-6c87-425f-a279-6eb6ba1a155c/scratchpad/wt-lv/firebase-rules.json:6-18、/src/ui/screens.jsx:`
- 直し方: lobby の一覧読みをやめられないなら、せめて lobby/$code に host の uid を持たせ、".write": "auth != null && (!data.exists() || data.child('host').val() === auth.uid || newData.child('guest').exists())" のように、掲載した本人か参加者しか触れないようにする。rooms/$code も同様に、部屋に入った2人の uid を書いて ".write" をその2人に絞る。ここまでやらないなら「サインインしただけで全部の部屋を壊せる」ことを firebase-rules.md に明記しておく。

**【軽微】letters は署名さえ通れば誰でも全部読める。個人宛ての手紙も宛先に関係なく読める（commit が「直した」と書いている項目のひとつが直っていない）**

- 何が起きるか: firebase-rules.json:45 は letters 全体に .read: "auth != null" を置いている。匿名サインインは誰でも通せる（この一覧の別項目のとおり、API キーだけで idToken が作れる）ので、`GET https://<db>/letters.json?auth=<自分で作った idToken>` で全通の手紙が読める。to: "<uid>" の個人宛ても含まれる。宛先の絞り込みは letters.js:70-75 の isFor が端末側でやっているだけで、サーバーは何も絞っていない。firebase-rules.md の「なぜ締めたか」には「個人宛てのお知らせを宛先に関係なく読む」が締めた対象として並んでいるが、実際には締まっていない（同じファイルの表のほうは「サインイン済みの人」と正直に書いてあり、文書内で食い違っている）。
- 根拠: `firebase-rules.json:44-46, src/net/letters.js:70-75, firebase-rules.md（なぜ締めたか）`
- 直し方: 全員宛てと個人宛てを別の場所に分ける。letters/all/<id> を .read: "auth != null"、letters/to/<uid>/<id> を .read: "auth != null && auth.uid === $uid" にして、readLetters は2か所を読む。当面直さないなら firebase-rules.md の「なぜ締めたか」からその1行を消して、表と揃える。

**【軽微】ranks の .validate が余分な子を縛っていないので、1人で全員のランキング取得を太らせられる**

- 何が起きるか: ranks/$uid の .validate は name（10文字以内）と rating（0〜4000）しか見ておらず、icon / title / その他の子は無制限。匿名でサインインした利用者が自分の uid に対して PUT '.../ranks/<自分のuid>.json?auth=…' で {"name":"あ","rating":4000,"title":"<数MBの文字列>"} を書くと、rating が上限なので limitToLast=50 に必ず入り、ランキング画面を開いた全員がその数MBを毎回落とすことになる。
- 根拠: `/private/tmp/claude-501/-Users-shogo-Desktop------/80cc8fa5-6c87-425f-a279-6eb6ba1a155c/scratchpad/wt-lv/firebase-rules.json:25、/src/net/ranking.js:60`
- 直し方: ranks/$uid に子ごとの .validate を書く。$other: { ".validate": false } で未知の子を弾き、icon/title は "newData.isString() && newData.val().length <= 40"、rated/wins/plays は isNumber() を要求する。


### 移行と運用（4件）

**【重大】新しく始めた人は、その初回セッションが丸ごとサーバーに載らなくなる**

- 何が起きるか: 起動時の effect は `if (!me.id || !me.name) return;` で、名前がまだ無い初回起動では ensureAuth も adoptUid も走らない。そのあと NameSetupScreen で saveName すると id は makeId() の p… になり、そのまま publishPlayer(players/p…)、対局後に publishRank(ranks/p…) を叩く。新ルールでは auth.uid ≠ "p…" なので全部 401。呼び出し側はどれも黙って捨てるので、画面には何も出ない。再現: localStorage を空にしてアプリを開く → 名前を決める → オンラインで1局終える → 管理画面にもランキングにも出てこない。アプリを閉じて開き直すまで直らない。effect の deps は [] なので setNamed(tru
- 根拠: `src/ui/screens.jsx:925-926,948-950 / src/ui/account.jsx:59-61 / src/game/profile.js:187`
- 直し方: 名前が決まった時点で ensureAuth → adoptUid を通す。NameSetupScreen の onDone(次のプロフィール)で await ensureAuth() し、uid を採ってから publishPlayer する。あるいは effect の deps に named を入れ、id が無い状態でも ensureAuth だけは先に走らせる。

**【重大】新規プレイヤーの初回セッションは、台帳にもランキングにも一切載らない**

- 何が起きるか: screens.jsx:925 の `if (!me.id || !me.name) return;` で、名前を決めていない起動では ensureAuth も adoptUid も走らない。しかも useEffect の依存配列は空（:952）なので、名前を決めても再実行されない。手順: 新規インストール → 名前「ふう」を入れる → account.jsx:61 の publishPlayer が、profile.js:187 で作ったローカルの id（p… 形式）宛てに PATCH players/<ローカルid> を投げる。このとき authed() は遅延で匿名サインインを済ませて ?auth= を付けるが、パスの $uid が uid と一致しないのでルールに弾かれ 401。players.js:74 の catch と :73 の {ok:res.ok} で黙って捨てられる。
- 根拠: `/private/tmp/claude-501/-Users-shogo-Desktop------/80cc8fa5-6c87-425f-a279-6eb6ba1a155c/scratchpad/wt-lv/src/ui/screens.jsx:925, :933-940, :952、/src/u`
- 直し方: id の付け替えを名前決定より前に済ませる。起動の useEffect から `!me.name` の早期 return を外して（名前が無くても ensureAuth → adoptUid だけは通し、syncPlayer は名前があるときだけ呼ぶ）、依存配列に named を足す。あるいは account.jsx:58 の submit を async にして `const a = await ensureAuth(); const next = adoptUid(a?.uid) ?? saveName(...)` の順にする。

**【軽微】dropOldRows はルールを公開したあとは必ず弾かれる。移行の窓を逃した人はランキングに二重に出る（firebase-rules.md の説明と食い違う）**

- 何が起きるか: players.js:94-105 は players/<古いid> と ranks/<古いid> を DELETE する。新ルールでは players/$uid も ranks/$uid も auth.uid === $uid が要る（firebase-rules.json:24,33）。古い id は p… から始まる端末の目印で uid ではないので、この DELETE は必ず拒否される。players.js:102 が握りつぶすので誰も気づかない。手順は「キーを配信 → みんながサインインを通す → ルールを公開」だが、その窓のあいだにアプリを開かなかった人（数日〜数週間ぶりの人）は、公開後に初めて起動して adoptUid で uid に切り替わり、古い p… の行が消せないまま残る。ranks は誰でも読めて名前も持ち点も入っているので、その人は順位表に古い持ち点と新しい持ち点
- 根拠: `src/net/players.js:94-105, firebase-rules.json:24, firebase-rules.json:33, firebase-rules.md（名前の付け替えについて）`
- 直し方: ranks/$uid と players/$uid に運営の書き込み枝を足したうえで、移行が済んだあと運営が p… で始まる鍵の行をまとめて消す（admin に一括削除を足す）。あわせて firebase-rules.md の当該段落を「窓のあいだに開いた人だけ自動で消える。残りは運営が消す」に直す。

**【軽微】uid に付け替えると登録日(since)が全員その日にリセットされる**

- 何が起きるか: syncPlayer は players.js:84 で「読めて、かつ行が無いとき」だけ since を書く。uid に付け替えた直後は必ず行が無いので、18人全員の since が移行した日に書き換わる。管理画面の admin.jsx:737-738 は since を「登録日」として出しているので、全員が同じ日に登録したように見える。持ち点・戦績は端末側（tottery.account.v1）に残るので失われないが、since だけはサーバーにしか無かったので消える。
- 根拠: `src/net/players.js:84, src/ui/screens.jsx:938, src/admin/admin.jsx:737-738`
- 直し方: dropOldRows の前に readPlayer(oldId) で古い行の since を読み、あれば新しい行にそのまま引き継ぐ。読めなければ今日で構わない。


### 管理画面（2件）

**【重大】管理画面の通信2本が authed() を通っていない。ルールを公開した瞬間に管理画面の半分が死ぬ**

- 何が起きるか: admin.jsx は自前の getJson / remove を持っていて、そこだけ authed() を通していない（他の players/letters 系は net/ 側の関数を使うので通っている）。ビルド済みの admin.html:4431 にも素の fetch(`${me}/${t}.json`) がそのまま残っている。新ルールを公開したあと管理画面を開くと: (1) getJson("lobby") → lobby の .read が "auth != null" なので 401、画面に「lobby は読めません(Firebase のルールで閉じています)」が出て待ち合わせ一覧が空、(2) getJson("letters") → letters の .read が "auth != null" なので 401、お知らせ一覧が出ない（送信はできるのに、送ったものを確認・取り
- 根拠: `/private/tmp/claude-501/-Users-shogo-Desktop------/80cc8fa5-6c87-425f-a279-6eb6ba1a155c/scratchpad/wt-lv/src/admin/admin.jsx:43, :52（authed を通さない fetc`
- 直し方: admin.jsx:43/52 を net/firebase.js と同じ形にする（import { authed } from "../net/auth.js" して fetch(await authed(`${DB_URL}/${path}.json`)) にする）。あわせて npm run check に「src/admin/ に authed を通さない fetch が無いこと」を見る検査を1本足すと、次に増えたときに気づける。

**【中】運営の uid でサインインする道筋がコードに無い。手順どおりにやると管理画面が自分のルールで弾かれる**

- 何が起きるか: auth.js が持っている口は accounts:signUp の匿名だけで、特定のアカウントに入る手段が無い。firebase-rules.md の手順3は「アプリを一度開いて自分の uid を控える」だが、アプリは配信先オリジン、admin.html は localhost:4199 で localStorage が別なので、管理画面は開いた瞬間に別の匿名アカウントを作る。その uid はルールに書いた運営 uid と違うため、players の一覧も letters の送信も 401。さらに手順3が言う「設定画面の下」に uid を出す実装は無い(myUid() は auth.js:148 に定義されているだけで、どこからも import されていない)。仮に localhost の uid を控えて凌いでも、ブラウザのサイトデータを消す・別のマシンで開く・匿名アカウントが整理され
- 根拠: `src/net/auth.js:73-93,148-150 / firebase-rules.md:36-38 / src/admin/admin.jsx:1-27`
- 直し方: 管理画面だけ別の入り方にする。accounts:signInWithPassword でメール/パスワードのアカウントに入るログイン欄を admin.jsx に置き、その uid をルールに書く(匿名と違って端末を替えても同じ)。将来を考えるなら Admin SDK で admin カスタムクレームを付け、ルール側は auth.token.admin === true にする。どちらにせよ手順3の「設定画面の下に uid が出る」は嘘なので、myUid() を実際に表示するか記述を直す。


### 認証層（6件）

**【致命】取り直しが1回こけると、まだ4分使える合言葉を捨てて30秒「素のURL」で通信する。ルール公開後は対局中に401が続き、指した手が相手に届かないまま盤がずれる**

- 何が起きるか: 1) 起動して55分以上たった状態で対戦に入る（held.expiresAt-EARLY_MS < now = 早め取り直しの窓）。2) その瞬間 securetoken.googleapis.com が10秒だけ詰まる（地下鉄・電波の切り替わり・Google 側の一時的な503のいずれでも同じ）。3) auth.js:118 が throw → 151の signUp も失敗 → auth.js:160-161 で held=null、quietUntil=+30秒。4) 以後30秒、ensureAuth は auth.js:138 で即 null を返し、authed() は auth.js:181 で合言葉なしの素のURLを返す。5) 新ルールでは rooms も lobby も auth != null が要るので、この30秒の通信はすべて401。6) 自分が指した手は game.
- 根拠: `src/net/auth.js:160 (held=null), src/net/auth.js:161 (quietUntil), src/net/auth.js:138, src/net/auth.js:181, src/ui/game.jsx:846-853`
- 直し方: 失敗しても期限内の合言葉は捨てない。auth.js:160 の held=null をやめ、ensureAuth の諦める枝の直前に「まだ本当の期限は過ぎていないならそれを使う」を1行足す: `if (held && held.expiresAt > Date.now()) return held;` を auth.js:138 の quietUntil 判定の前後に置く。合わせて game.jsx:846-853 の投げ直しを、401のときは quietUntil が明けるまで待って投げ直す形にする（1回きりで諦めない）。

**【重大】一時的な通信不良で uid が作り替わる。起動のたびに別人になり、ランキングに同じ人が増える**

- 何が起きるか: auth.js:129 の refresh() は auth.js:36 の 8 秒タイムアウトや 5xx でも throw する。ところが auth.js:131-139 の catch は理由を見ずに signUp() を呼び、signUp は auth.js:87 の save() で控えの refreshToken を新しいものに上書きしてしまう。つまり「電波の悪いところで起動した」だけで、同じ端末が別の uid になる。すると screens.jsx:935-938 が adoptUid（新uid）＋ dropOldRows（前のuid）を走らせるが、ルール公開後は前の uid の行を消せるのは前の uid だけ（firebase-rules.json:24,33）なので DELETE は 401。前の行は残り、新しい行が増える。回線が不安定な人は起動のたびにこれを繰り返し、ラン
- 根拠: `src/net/auth.js:129, src/net/auth.js:131-139, src/net/auth.js:87, src/ui/screens.jsx:935-938`
- 直し方: catch で作り直すのは「控えが本当に無効なとき」だけにする。refresh の res が 400 で、本文の error.message が INVALID_REFRESH_TOKEN / TOKEN_EXPIRED / USER_DISABLED のときだけ signUp に落とし、タイムアウト・5xx・オフラインは null を返して次の起動に任せる（auth.js:96-114 で res.ok でないときに status と本文を持った例外を投げ、auth.js:131 で見分ける）。

**【重大】authed() の往復が呼び出し側の8秒タイムアウトの外にある。最大24秒待たされ、対戦の同期が詰まる**

- 何が起きるか: `withTimeout(fetch(await authed(url)), TIMEOUT_MS)` は引数の評価が先なので、authed() の待ち時間はタイムアウトの計測に入らない。API_KEY を入れたあと通信が不安定になると、ensureAuth は refresh(最大8秒) → 失敗 → signUp(最大8秒) を辿り、失敗後は held=null のまま次の呼び出しでも同じことを繰り返す。結果、1回の readActs が 8+8+8 = 最大24秒かかる。オンライン対戦の手番取得は 1.5 秒間隔（screens.jsx:401 のロビー監視も同様）なので、詰まっている間にタイマーが重なり、相手の手が20秒以上来ない。しかも失敗したときの文言は firebase.js:35 の「通信が8秒以内に応答しませんでした」で、実際には24秒経っている。firebase.js:
- 根拠: `/private/tmp/claude-501/-Users-shogo-Desktop------/80cc8fa5-6c87-425f-a279-6eb6ba1a155c/scratchpad/wt-lv/src/net/firebase.js:55, :66, :83, :104 と :4, `
- 直し方: authed をタイムアウトの内側に入れる: `withTimeout((async () => fetch(await authed(url)))(), TIMEOUT_MS)`。加えて auth.js に失敗の記憶を持たせ（例: 直近の失敗から30秒はサインインを試みず即 null を返す）、毎回の呼び出しが16秒を払わないようにする。withTimeout は clearTimeout も入れる。

**【中】refresh が一時的に失敗しただけで新しい匿名口座を作り、uid が入れ替わる。その対局の結果とランキングが黙って捨てられ、再起動するまで治らない**

- 何が起きるか: 1) securetoken が 503 を返す（あるいは匿名口座が Firebase の自動掃除で30日後に消えて 400 USER_NOT_FOUND になる）。2) auth.js:118 が throw。__timeout が付いていないので auth.js:151 の枝に入り、signUp が成功して uid が別物になる。auth.js:100 の save() が控えを上書きするので、元の口座には二度と戻れない。手元で実測（503 を返させると uid-OLD → uid-NEW、控えも上書き）。3) 一方 profile.id は screens.jsx:933-939 の起動時1回きり（依存配列が空）でしか付け替えないので、古い uid のまま。4) 対局が終わると game.jsx:1141-1142 が ranks/<古いuid> と players/<古いuid>
- 根拠: `src/net/auth.js:118, src/net/auth.js:151-155, src/net/auth.js:100, src/ui/screens.jsx:933-939, src/ui/game.jsx:1141-1142, src/net/ranking.js:36,53`
- 直し方: 作り直しに落ちる条件を「refreshToken が本当に無効なとき」だけに絞る。refresh() で res.status を持って投げ、400 かつ本文の error.message が TOKEN_EXPIRED / USER_NOT_FOUND / USER_DISABLED / INVALID_REFRESH_TOKEN のときだけ signUp に落とす。5xx・429・通信断は落とさず null を返して次に任せる。加えて、uid が入れ替わったら screens.jsx の起動処理をもう一度通せるよう、auth.js から uid 変更を知らせる仕組み（コールバックか、ensureAuth の戻りの uid を publishRank 側でも見る）を足す。

**【中】合言葉の取り直しが一度コケると別人になり、成績が黙って更新されなくなる**

- 何が起きるか: refresh() は res.ok でない(503 でも)ときも、8秒タイムアウトでも例外を投げ、catch がそれを区別せず signUp() に落として新しい uid を作る。localStorage も上書きされるので元に戻せない。一方 profile.id は起動時に一度 adoptUid しただけなので古い uid のまま。この状態で対局を終えると publishRank が ranks/<旧uid> へ PUT → auth.uid は新 uid なので 401 → ranking.js:53 で握りつぶし。以後そのセッション中ずっと持ち点が反映されない。次の起動では adoptUid(新uid) が走り dropOldRows(旧uid) が旧行を消そうとするが、これも 401 で消せず、同じ人がランキングに2行並ぶ。再現: 対局中に securetoken.googlea
- 根拠: `src/net/auth.js:105,131-139 / src/net/ranking.js:36,53-55`
- 直し方: refresh の失敗を選り分ける。400 かつ TOKEN_EXPIRED / INVALID_REFRESH_TOKEN / USER_DISABLED のときだけ signUp に落とし、タイムアウト・5xx・オフラインは null を返して次回に再試行する。あわせて uid が変わったら adoptUid をやり直し、profile.id と auth.uid がずれないようにする。

**【中】サインインの失敗を覚えないので、対局中に相手の手が最大16〜24秒遅れる。匿名サインイン未有効だと全端末が0.7秒ごとに叩き続ける**

- 何が起きるか: ensureAuth は失敗すると auth.js:137 で held を null にするだけで、失敗そのものを覚えない。次に呼ばれるとまた refresh（最大8秒, auth.js:36）→ signUp（最大8秒）を試す。しかも呼び出し側の 8 秒タイムアウトは `withTimeout(fetch(await authed(url)), TIMEOUT_MS)` という書き方で、await authed(...) は withTimeout の外にある（firebase.js:55/66/83, players.js:52, ranking.js:62, letters.js:80-87 すべて同じ形）。つまり authed の最大16秒はタイムアウトに数えられず、1回の通信が最悪24秒かかる。対局中は game.jsx:943 が 700ms ごとに readActs を回し
- 根拠: `src/net/auth.js:120-145（特に 137）, src/net/firebase.js:55, src/ui/game.jsx:943, src/net/ranking.js:62`
- 直し方: ensureAuth に失敗の記憶と待ち時間を入れる（例: 失敗したら次の再挑戦時刻を持ち、それまでは即 null を返す。指数的に伸ばして上限5分）。合わせて authed 自体に短い上限（2秒程度）を掛け、間に合わなければ素の URL を返して通信を始める。呼び出し側は `const u = await authed(url); await withTimeout(fetch(u), TIMEOUT_MS)` と分けても、authed の遅さは消えないので、上限は authed 側に置く。


### その他（1件）

**【重大】匿名アカウント1つでランダムマッチを全部潰せる。待ち合わせに持ち主の概念が無い**

- 何が起きるか: lobby は「サインイン済みなら誰でも読めて、どの $code にも書ける」。匿名サインインは API キー1つで通るので、これは実質「誰でも」と同じ。攻撃手順: (1) accounts:signUp でトークンを取る (2) GET /lobby.json?auth=T で待っている部屋の code を全部取る (3) 各 code に PUT /lobby/<code>/guest.json?auth=T で "x" を書く。ホスト側は screens.jsx:380-383 の巡回で guest を見つけて対局画面へ進み、相手が来ないまま固まる(guestName は null になるだけで弾かれない)。あるいは (3) を DELETE /lobby/<code>.json に替えれば、誰も相手を見つけられなくなる。1秒おきに回すだけでランダムマッチが機能停止する。
- 根拠: `firebase-rules.json:13-18 / src/ui/screens.jsx:380-390,413-431,440-445`
- 直し方: lobby/$code に hostUid を持たせ、.write を「新規作成でホストが自分の uid を書く」「ホスト本人」「空いている guest 欄に自分の uid を入れる人」の3つに限る。例: ".write": "auth != null && (!data.exists() ? newData.child('hostUid').val() === auth.uid : (data.child('hostUid').val() === auth.uid || (!data.child('guestUid').exists() && newData.child('guestUid').val() === auth.uid)))"。guest には文字列ではなく uid を入れる。


## 進める順番

1. **ルールを設計し直す** — Firebase の `.write` は浅いほうが勝ち、**深い側で
   取り消せない**。`players/<自分>` に書く権限を与えた時点で、その下の `banned`
   を運営限定にしても効かない。停止フラグは `players` の外（別の木）へ出す
2. **移行の段取りを作る** — ランキングを載せ直す、登録日と使用停止を引き継ぐ、
   新規の方の初回を取りこぼさない
3. **運営の身元を決める（要判断）** — 匿名アカウントはブラウザのデータを消すと
   失われ、運営権限ごと消える。**メールアドレス＋パスワード**にするのが確実
   （管理画面は手元でしか開かないので、入力するのは自分の端末だけ）
4. キーを入れて配信 → 皆が uid を持つのを待つ → **最後にルールを公開**

順番が大事。先にルールを締めると、古い版を開いている人が繋がらなくなる。
