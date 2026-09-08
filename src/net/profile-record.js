/** players と ranks で共有するプロフィール。所持品・認証情報は含めない。 */
export function profileRecord(profile, at = Date.now()) {
  if (!profile?.id || !profile.name || /[.#$\[\]/]/.test(profile.id))
    return null;
  const count = (n) => Math.max(0, Math.min(1e9, Math.round(Number(n) || 0)));
  return {
    name: String(profile.name).slice(0, 10),
    icon: profile.icon || "",
    title: profile.title || "",
    plays: count(profile.plays),
    wins: count(profile.wins),
    rating: Math.max(0, Math.min(4000, Number(profile.rating) || 0)),
    rated: count(profile.rated),
    at,
  };
}

export const isRankedRecord = (r) =>
  !!r?.name && Number.isFinite(r.rating) && r.rated > 0;
export const worldGamesOf = (rows) =>
  rows.reduce((n, r) => n + (isRankedRecord(r) ? r.rated : 0), 0);

/** 一つの PATCH で両方の値をそろえる。登録日は更新のたびに書き換えない。 */
export function profilePatch(id, record, previous, rank, since) {
  const dates = [previous?.since, since].filter(
    (v) => Number.isFinite(v) && v > 0,
  );
  const patch = {
    [`players/${id}`]: {
      ...record,
      since: dates.length ? Math.min(...dates) : record.at,
    },
  };
  // 未参加者を新しくランキングへ公開しない。過去の0戦の行は値だけそろえ、表示時に除く。
  if (record.rated > 0 || rank) patch[`ranks/${id}`] = record;
  return patch;
}

/** 既存の二つの記録は更新日時が新しい方を採用。勝敗を推測して作り足さない。 */
export function reconciliationPlan(players, ranks) {
  const changes = [];
  for (const [id, p] of Object.entries(players || {})) {
    const r = ranks?.[id];
    if (!p?.name) continue;
    const source = r?.at > p.at ? r : p;
    const record = profileRecord({ id, ...source }, source.at);
    if (!record || !Number.isFinite(record.at)) continue;
    const patch = profilePatch(id, record, p, r, p.since);
    // 認証導入前の短い端末IDや検査IDを、新規の参加者として復活させない。
    if (!r && /^p(?:[a-z0-9]{14}|test[0-9]*)$/.test(id))
      delete patch[`ranks/${id}`];
    for (const [path, after] of Object.entries(patch)) {
      const before = path.startsWith("players/") ? p : r;
      // 古い空欄や更新日時だけの差は、戦績の不一致として数えない。
      const normalized = before && profileRecord({ id, ...before }, record.at);
      if (
        !normalized ||
        Object.keys(record).some((k) => record[k] !== normalized[k])
      )
        changes.push({ path, before: before || null, after });
    }
  }
  return changes;
}
