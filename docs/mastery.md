# スキンごとの熟練度 — 引き継ぎ

2026-09-22 着手。**次に触る人がこれだけ読めば続きを始められる**ことを目指して書く。
決まりごとには理由を添える。理由が分かっていないと、良かれと思って壊してしまうため。

関連コミット: `488b57d`(数える＋称号) → `cb0c82e`(終局メーター) → `48285a6`(王限定・表記変更) →
ホームの「カード」(2026-09-22) → **スキンごとへ全面改修(2026-09-24 本人の指示)**

> **2026-09-24 の大改修**: それまで「札の種類(A〜K の13種)」ごとに貯めていたが、本人の指示で
> **持っているスキンごと**に貯める形へ変えた。通常札(スキン未所持)では一切増えない。
> 保存の鍵が「札」→「スキン id」に変わったので、**旧データの点はこの改修で捨てて新規に貯め直す**
> (`normalizeMastery` が古い鍵を落とす)。

---

## 1. 何をするものか

**自分が持っているスキンを盤に出すと、そのスキンごとに点がたまる**。
たまると**称号・アイコン・アイコンフレーム**が解放される。

対象は `MASTERY_SKINS`(17種)。**通常札(スキン未所持)では増えない。**
J・Q・K は天使／悪魔の2系統、10 は竜騎士／天馬騎士の2系統があり、それぞれ別に貯まる。

点の決まり(2026-09-24 本人の指示):

| 出来事 | 点 | 上限 |
|---|---|---|
| そのスキンを**王に選んだ** | +5 | 1局に1回(対局が始まったとき) |
| そのスキンの駒を**盤に出した** | +1/枚 | 出した枚数ぶん(複数なら複数) |
| 王として**動かした** | +1/手 | 1局 3 手まで(`MASTERY_POINTS.moveMax`) |
| 王で相手の**駒を取った** | +1/体 | 1局 10 体まで(`MASTERY_POINTS.captureMax`)。A の囲い取りは A が倒した判定 |
| 王で相手の**王を討った** | +10 | — |

`src/game/constants.js` の `MASTERY_POINTS`、`src/game/profile.js` の `masteryPoints`。
段の境目(10・30・80・200・500)は据え置き。**オンライン(ランダムマッチ)でも数える**。

- 貯める鍵は**基底スキン id**(`baseSkinId` でフォイルの `:foil` を外した形)。
  フォイル装備でも通常装備でも同じスキンなら同じ枠に貯まる。
- 装備は `getCollection().equipped[rank]` を見る。その rank の装備が `MASTERY_SKINS` に無ければ数えない
  (= 通常札は増えない)。
- 王かどうかは `players[seat].kingId` で見る(`isKing` の旗は伏せ札の都合で当てにしない)。

細工よけ: 取った数は端末が送った手の中身ではなく、reducer が確定した撃破(`lastDefeat`・`captureReveal`)から数え、
同じ撃破は `lastDefeat.seq` で一度だけ数える。点そのものは端末の記録(profile)なので、盤には効かせない(§3-4)。

**盤の有利不利には一切効かせない。** ここが一番大事な決めごと(理由は §3)。

---

## 2. できていること

| 中身 | 場所 |
|---|---|
| スキンの一覧・rank 対応 | `src/game/constants.js` `MASTERY_SKINS`(17) / `MASTERY_SKIN_RANK`(id→rank) |
| 数える入口(装備の解決・王/駒) | `src/ui/game.jsx`(`equippedSkinKey` / `masteryTrack`、対局開始の useEffect と `y()`) |
| 1局ぶんを貯める箱 | `game.jsx` `masteryRef`(`{skin: {king,pieces,moves,captures,kingCapture}}`) |
| 終局時の書き込み | `game.jsx` `recordMastery(masteryRef.current)` |
| 貯める・段を出す | `src/game/profile.js` `recordMastery` / `masteryProgress` / `masteryStep` / `masteryAll` / `normalizeMastery` |
| 保存の形 | `profile.mastery = { "angel-j": 120, ... }`(鍵はスキン id) |
| 称号17種＋通し2種 | `src/game/titles.js` `MASTERY_NAMES` / `MASTERY_TITLES`(全体の表に合流) |
| 額縁の意匠 | `src/ui/title-design.js`(`mastery-<skinId>` を17種＋通し) |
| 終局画面のメーター | `src/ui/mastery.jsx`(スキン名・段・内訳を出す)、置き場所は `game.jsx` の終局 |
| ホームの「カード」(スキン一覧) | `src/ui/card-mastery.jsx`。画面 id `cards`。所持スキンだけ解放、未所持は鎖でロック |
| ホームの「カード」タイルの鎖 | `src/ui/screens.jsx` `HomeTile locked`。スキンを1つも持たないとロック(`hasAnySkin`) |
| メーターの見た目 | `src/styles.css` の `.mastery-*` |
| 検査 | `tools/check-mastery.mjs`。カード画面は `check-home-layout.mjs`、称号の意匠は `check-title-notices.mjs` |

### 称号の名前(スキンの絵柄に合わせる)

2026-09-24 本人の指示で、**スキンのイラストの人物**から付けた。id は `mastery-<skinId>`。

`MASTERY_NAMES`(`src/game/titles.js`)を正とする。17種＋通し:
- 通し: **十七英雄の主**(17種すべて80点=段3) / **盤上無双**(すべて500点=段5)

> J・Q・K・10 は2系統あるので、**天使側と悪魔側(竜騎士と天馬騎士)で別の称号**になる。
> 称号を増減したら `MASTERY_NAMES`・`title-design.js`・`MASTERY_SKINS` の三つが揃っているか確かめる
> (`check-title-notices.mjs` が意匠漏れを見張る)。

---

## 3. 決まりごとと、その理由

**理由を消さないこと。** 数字だけ見ると「もっと気前よくしていいのでは」と思えるが、どれも一度考えた末にこうしている。

### 3-1. スキンを持っている札だけが貯まる(本人の決め、2026-09-24)

通常札で貯まると「誰でも全部カンストできる」ので、**スキンを手に入れた札だけ**が育つ形にした。
スキンを1つも持たない人は、ホームの「カード」タイル自体を鎖でロックする(育てる対象がまだ無いから)。

- スキンを買う/ミッションで得る → その札の枠が解放され、以後その札を盤に出すと貯まり始める。
- 竜騎士と天馬(10)、天使と悪魔(J・Q・K)は別枠。両方持てば両方育てられる。

### 3-2. 王+5・駒+1・動き上限3・取り上限10・王討ち+10(本人の決め、2026-09-24)

「王に選ぶ」を一番重く(+5)、「盤に並べた枚数」も評価し(+1/枚)、
派手な働き(王討ち+10)に報いる。動きと取りに上限を置くのは、**わざと長引かせて稼ぐ**遊び方を防ぐため。

### 3-3. 段は5つ、500点で頭打ち(`MASTERY_STEPS`)

青天井にすると、たくさん遊んだ人と少し遊んだ人の差が**永久に開き続け**、あとから始めた人が追いつけない。
「やり込んだ人が報われる」と「新しい人が追いつける」は、上限を置くことでしか両立しない。

### 3-4. 恩恵は見た目だけ。盤には効かせない ← **最重要**

当初「熟練度の高い札が必ず1枚配られる『印』」の案があったが、**本人が取り下げた**。

再び盤に効かせたくなったときは、**先に塞ぐべき穴が2つある**。

1. **配り札は片方の端末が決めて、相手はそれを信じている**
   `src/game/actions.js` の `enrichAction` が `START_SETUP` のときに1回だけシャッフルし、
   その**結果の配列そのもの**を相手に送る。受け取る側は形しか見ない(`reducer.js` の `deckOk`)。
2. **装備の所持を誰も検証していない**
   `src/game/areas.js` の `sanitizeLoadouts` は型と文字列長しか見ない。`src/server/verify-match.js` にも検証はない。

この2つがある状態で盤に効く恩恵を足すと、**改造した端末が「熟練度カンスト」を名乗って毎局好きな札を引ける**。
持ち点は一度汚れると巻き戻せない。

`check-mastery.mjs` の最後の節が、`board.js`・`reducer.js`・`actions.js`・`areas.js` に
`mastery` の語が出てこないことを見張っている。**うっかり盤に効かせたら検査が落ちる。**

### 3-5. 称号は `unlocked(p)` 方式＋焼き付け

`profile.mastery` から毎回判定する(一覧に自動で並ぶ)。届いた瞬間に `profile.titles` へも焼き付けるので、
以後は熟練度の数字が無くても名乗れる。持ち点の称号と同じ作り。

### 3-6. 終局画面の並び(本人の決め、2026-09-24)

1. 勝敗結果 → 2. 熟練度メーターの上昇(`MasteryGains`) → 3. 4つのボタン(対戦ログ・マッチング・ホーム・もう一度)。
`game.jsx` の終局(`gameover-body`)で、`MasteryGains` は `gameover-grid`(ボタン)の直前に置く。

---

## 4. 残っている作業

### A. アイコン(段5＝500点で解放)

`src/game/icons.js` の `ICONS` に足す。所持判定は同ファイルの `hasIcon(profile, id)`。
`icon.mastery = { skin: "angel-j", need: 500 }` のような条件を1つ足すのが素直。

### B. アイコンフレーム — **仕組みから作る必要がある**

いまフレームは1種類しかなく、文字列直書きで出している(`src/game/season.js` の `SEASON_FRAME`、
`src/ui/playericon.jsx` が直接比較)。フレームの台帳も解放条件の表も無い。足すなら台帳を新設し、
`playericon.jsx` を id で引く形に直し(既存の所持者を失わせない)、検査を足す。

### C. 「印」(盤の効果)— 保留

本人が取り下げた。再開するなら §3-4 の穴を塞ぐのが先。釣り合いは議論ではなく**実測**で決める。

---

## 5. 落とし穴(実際にはまったもの)

- **CSS が2つある。** `src/styles.css` と `src/ui/title-frame.css`。`screens.jsx` の `<style>` で
  `TITLE_STYLES` が後に連結されるので、同じ強さなら title-frame.css が勝つ。
- **CPU の手も `y()` を `__foe` 無しで通る。** 駒の持ち主 `mover.owner === mySeat` を必ず見ること。
- **`title-design.js` に意匠が無い称号は黙って「素朴」に落ちる。** 称号を足したら意匠も足す(`check-title-notices.mjs`)。
- **スキン id の三点セット。** `MASTERY_SKINS`(constants)・`MASTERY_NAMES`(titles)・`title-design.js` の
  DESIGNS が揃っていないと、称号かメーターのどこかが欠ける。増減は必ず三つ同時に。
- **基底 id を忘れない。** フォイル(`:foil`)を付けたまま鍵にすると別枠に貯まる。必ず `baseSkinId` を通す。
- **共有の作業ツリー。** `git add -A` は使わず、自分が触ったパスだけを指定する。`admin.html` は stage しない。
- **`npm run check` への登録を忘れない。** push 前に `grep check-mastery package.json`。

---

## 6. 確かめ方

```bash
node tools/check-mastery.mjs          # 熟練度だけ
npm run check                          # 全体
```

ブラウザ確認: `preview_start name:"tottery"`(port 4199)。ホーム右上「カード」でスキン一覧
(所持スキンだけ解放・未所持は鎖)、CPU 戦を1局終えると終局にメーターが出る。
**スキンを持っていないと熟練度は増えない**ので、確認時は装備に `MASTERY_SKINS` のどれかを入れておくこと。
