/**
 * 記念配布(運営からのプレゼントの台帳)。
 *
 * 運営の手紙の添付チケットは、端末の申告としてサーバーの財布に入るので
 * 1回10枚・1日30枚の上限がある(src/server/wallet.js の earn)。リリース記念の
 * 50枚のような大きな配布は、ここに書いた「記念配布」として配る。
 *
 *  - アプリは、この台帳から「運営からのお知らせ」の手紙を作って一覧に混ぜる
 *    (src/net/letters.js の readLetters)。新しく入れた人にも、期間内なら必ず出る
 *  - 受け取りは端末ではなくサーバーの財布が行う(/api/wallet/campaign)。
 *    uid ごとに一度きり(出来事 id = campaign:<id>:<uid>)。枚数もサーバーがこの台帳から
 *    読むので、端末は id を送るだけ(枚数を偽れない)
 *  - サーバーとアプリの両方がこのファイルを読む(src/iap/catalog.js と同じ置き方)
 *
 * 期間: from 以降、until まで(0 なら期限なし)。終わらせるときは until を過去にするか、
 * 行を消す(消すと受け取り済みの控えだけが端末に残る。害はない)。
 */

export const CAMPAIGNS = Object.freeze([
  Object.freeze({
    id: "release-2026-09",
    subject: "リリース記念のプレゼント",
    body: "トッタリーへようこそ。\n\nリリースを記念して、運営からガチャチケット50枚をお贈りします。ガチャで新しい札を手に入れて、盤で試してみてください。\n\nこれからも、よろしくお願いします。",
    tickets: 50,
    // 2026-09-14 05:00 JST
    from: Date.UTC(2026, 8, 13, 20, 0, 0),
    until: 0,
  }),
  // リリース前限定(TestFlight の期間)。本人の指示 2026-09-14。
  // **正式リリースの日に until を切る**(それまでの仮の期限は 2026-10-31 24:00 JST)。
  // 期限を過ぎると手紙は出ず、サーバーも受け取りを断る
  Object.freeze({
    id: "prerelease-2026-09",
    subject: "リリース前のテスト参加ありがとう",
    body: "正式リリース前のテストに参加してくださって、ありがとうございます。\n\n感謝の印として、運営からガチャチケット300枚をお贈りします。リリース前の期間だけの特別なプレゼントです。たくさん引いて、フォイルや効果盤面も試してみてください。\n\n気づいたことは、どんな小さなことでも教えてください。",
    tickets: 300,
    // 2026-09-14 00:00 JST
    from: Date.UTC(2026, 8, 13, 15, 0, 0),
    // 2026-10-31 24:00 JST(仮)。リリース日に差し替える
    until: Date.UTC(2026, 9, 31, 15, 0, 0),
    prerelease: true,
  }),
]);

export const campaignOf = (id) => CAMPAIGNS.find((c) => c.id === id) || null;

/** 期間内か。until が 0 なら期限なし */
export function campaignOpen(c, now = Date.now()) {
  return !!c && now >= c.from && (!c.until || now < c.until);
}

/** 手紙の id(端末の受け取り控えと、一覧の見分けに使う) */
export const campaignLetterId = (id) => `campaign:${id}`;

/**
 * 期間内の記念配布を、運営の手紙と同じ形で返す。
 * `campaign` に台帳の id を持つのが目印で、受け取りはサーバーの財布に頼む。
 */
export function campaignLetters(now = Date.now()) {
  return CAMPAIGNS.filter((c) => campaignOpen(c, now)).map((c) => ({
    id: campaignLetterId(c.id),
    to: "all",
    subject: c.subject,
    body: c.body,
    gifts: [{ type: "ticket", amount: c.tickets }],
    at: c.from,
    until: c.until,
    campaign: c.id,
  }));
}

export const isCampaignLetter = (letter) =>
  !!letter &&
  typeof letter.campaign === "string" &&
  !!campaignOf(letter.campaign);
