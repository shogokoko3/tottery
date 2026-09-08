# Firebase のルールの控え

**Realtime Database のルールには版管理が無い。** Firestore と違い、Firebase 側に
「前の版に戻す」機能は無い。戻せるのは手元に控えがあるときだけ。

## 置いてあるもの

| ファイル | 中身 |
| --- | --- |
| `firebase-rules.json` | **これから公開する版。** reports を足し、ranks の name に長さ1以上を課した |
| `firebase-rules.backup-83885e6.json` | コミット `83885e6` 時点の版。**公開中のものである可能性が高い**が、確証は無い |

## 「可能性が高い」であって確証が無い理由

稼働中のルールは、認証なしでは読み出せない。

```
curl -s "https://tottery-66e0f-default-rtdb.asia-southeast1.firebasedatabase.app/.settings/rules.json"
→ {"error":"Permission denied."}
```

コンソールで直接ルールを編集していた場合、git の版とは食い違う。

## 公開する前に必ずやること

1. Firebase コンソール → tottery-66e0f → Realtime Database → **ルール**タブ
2. 編集欄の中身を**全選択してコピー**
3. `firebase-rules.live-YYYY-MM-DD.json` として、このフォルダに保存する
4. そのあとで `firebase-rules.json` の中身に差し替えて公開する

## 公開できたかの確かめ方

**読み取りでは新旧を区別できない。** 新旧の差は書き込み側にしか効かないので、
`/reports` が 401 でも「まだ公開していない」証拠にはならない。

判定はこの POST だけ。

```bash
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"targetId":"test","targetName":"テスト","reason":"other","at":1757000000000,"handled":false}' \
  'https://tottery-66e0f-default-rtdb.asia-southeast1.firebasedatabase.app/reports.json'
```

`{"name":"-N…"}` が返れば公開できている。`{"error":"Permission denied"}` ならまだ。

**この試験で書いた通報は残る。** ルールがクライアントからの削除を拒むので、
コンソールのデータタブから手で消すこと。

## 公開後に「まだ公開されていません」と出たら

公開漏れとは限らない。RTDB は `.validate` 落ちも同じ 401 を返し、
`src/net/reports.js` が 401 をすべて「未公開」と読み替えている。
ルールの構文ではなく、送っている中身が検査に落ちている可能性を見ること。
