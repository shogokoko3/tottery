# フレンドとプロフィール(2026-09-23)

本人の指示: 「フレンド登録・毎日1回フレンドにガチャチケットを送る・フレンド対戦の招待・50人まで・フレンドのプロフィールを見る」
「プロフィールの背景・さまざまな記録のアピール・固定用の称号をカスタマイズできる」。

## 置き場所

| 何 | どこ |
| --- | --- |
| サーバーの決まり(ID・申請・50人・1日1回・招待の期限・写しの見張り) | src/server/friends.js(`Friends`) |
| Worker の経路 `/api/friends/<op>` と Durable Object の op | src/server/worker.js |
| 端末の通信 | src/net/friends.js |
| プロフィールの飾り(背景・アピール・固定の称号)と写しの組み立て | src/game/profile-card.js、profile.js の `card` / `saveProfileCard` |
| フレンド画面 | src/ui/friends.jsx(`FriendsScreen`、`useFriendAlerts`、`usePublishProfileCard`) |
| プロフィール画面と編集の幕 | src/ui/profile.jsx(`ProfileScreen`、`ProfileEditModal`、`ProfileCard`) |
| ホームの入口・ルーター・招待の配線 | src/ui/screens.jsx(`friends` / `profile` 画面、`inviteToRoom`、`joinInvite`、`RoomScreen` の `onRoomCreated`) |
| 検査 | tools/check-friends.mjs |
| 手元の見本サーバー | tools/serve.mjs(`fakeFriends`) |

## 決めごと

- **1日1回の贈り物は「送る側が1日に1回」**(日本時間の日付)。フレンド1人にチケット1枚。送る側は減らず、サーバーが作る。
  受け取りは上限なし(フレンドの数まで)。1人あたり1日1枚ずつ全員に配れる作りにすると、50人で毎日50枚(150ジェム換算で7,500円分)が湧くので採らなかった。
- 財布への加算は `claim` のときに `gift:<from>:<day>` の id で1枚ずつ。同じ id は二度足さない。`kind` は `friend-gift` で、`earn` の日次上限(30枚)には数えない。
- フレンド ID は8文字(`ABCDEFGHJKMNPQRSTUVWXYZ23456789`)。読み違えやすい 0/O・1/I/L は使わず、入力側は寄せて読む(`Friends.normalizeCode`)。
- 50人は申請する側・される側の両方で見る。承認のときも見る(申請後に増えていれば断る)。
- 招待は `friend_invites(from,to)` に1つだけ(同じ相手へ送り直すと上書き)。3分で消える。相手は「参加する」で `pendingRoom` に合言葉を入れ、リンクから開いたときと同じ道で部屋に入る。
- プロフィールの写しは端末の申告。端末は持っていない称号・解放していない背景を落として送り(`buildProfileCard`)、サーバーは桁と長さと id の集合だけ見張る(`sanitizeProfileCard`)。持ち点と順位はサーバーの台帳から足す。
- 写しは **フレンドだけ** が読める(`profile-get` は `isFriend` を見る)。自分のはいつでも。
- 端末側で「非表示」にした人(src/game/blocked.js)は、フレンド画面の一覧・申請・招待に出さない。
- `forget`(自分の記録を消す)で `Friends.forget(uid)` も走る。相手の一覧からも外れ、ID も作り直しになる。

## 画面

- ホームの上段は元どおり `[自分の札][お知らせ]`(2026-09-24 本人の指示)。「お知らせ」が運営の手紙とフレンドの両方の入口(`InboxScreen`、src/ui/inbox.jsx。タブ = 画面 id `letters` / `friends`)。釦の印は未読の手紙とフレンドの届き物(申請・贈り物・招待。`useFriendAlerts`)の合計。
- フレンド画面: 自分の ID とコピー、ID を入れて申請、届いた贈り物(まとめて受け取る)、届いた招待(参加する)、届いた申請(承認/断る)、フレンド一覧(贈る・招待・⋯で外す)、送った申請(取り消す)。開いている間は 10 秒ごとに読み直す。
- プロフィール画面: 背景・アイコンと額縁・名前・Lv・持ち点・今月の順位・対局で見せる称号・固定の称号(showcase の額縁)・アピール3つ・戦績。自分なら「プロフィールを編集」「名前・アイコン・称号を変える(設定)」「フレンド」。フレンドなら「チケットを贈る」「対戦に招待する」「フレンドから外す(二度押し)」。
- 編集の幕: 背景(未解放は錠と条件)、アピール(3つまで。いっぱいなら残りは押せない)、固定の称号(称号を選ぶ幕と同じ並び＋「固定しない」)。上に見本の札が出て、選ぶたびに変わる。
