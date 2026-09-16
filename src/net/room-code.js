/**
 * フレンド対戦の合言葉(部屋コード)。
 *
 * 6文字(紛らわしい 0/O・1/I を除いた 32 種)= 約 10 億通り。以前は 8 文字だったが、
 * 口で伝えるには長く、フレンド対戦が気楽にできなかった(2026-09-17 本人の指示)。
 * 鍵はこの合言葉そのものなので短くしすぎると総当たりで待機中の部屋に入り込まれるが、
 * 部屋は待っているあいだ(数分)しか存在せず、10 億通りをその間に当てるのは現実的でない。
 * 伝えるときは「ABC-DEF」と 3 文字ずつに区切り、リンク(?room=ABCDEF)で共有すれば入力もいらない。
 * Firebase のルール(firebase-rules.json)は 4〜8 文字を通す。
 */
export const ROOM_CODE_LENGTH = 6;
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateFriendCode(random = Math.random) {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++)
    code += CHARS[Math.floor(random() * CHARS.length)];
  return code;
}

/** 表示用: ABC-DEF */
export function formatRoomCode(code) {
  const c = String(code || "").toUpperCase();
  return c.length > 3 ? `${c.slice(0, 3)}-${c.slice(3)}` : c;
}

/** 入力の途中の文字列を、合言葉に使える文字だけにする(小文字・区切り・空白は捨てる) */
export function cleanRoomCode(text) {
  return String(text || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, ROOM_CODE_LENGTH);
}

/**
 * 貼り付けた文字列から合言葉を取り出す。リンク(?room=ABCDEF)でも、
 * 「ABC-DEF」「abc def」でもよい。見つからなければ ""
 */
export function parseRoomCode(text) {
  const s = String(text || "");
  const m = /[?&]room=([A-Za-z0-9-]{6,9})/.exec(s);
  const raw = m ? m[1] : s;
  const cleaned = cleanRoomCode(raw);
  return cleaned.length === ROOM_CODE_LENGTH ? cleaned : "";
}

/** 相手に送るリンク。開くとそのまま参加の画面になる */
export function roomLink(code, origin) {
  return `${origin}/?room=${String(code || "").toUpperCase()}`;
}

/** 起動時の URL から合言葉を読む(?room=)。読んだら URL から消す */
export function roomFromLocation(loc = globalThis.location, history = globalThis.history) {
  try {
    if (!loc || !loc.search) return "";
    const code = parseRoomCode(loc.search);
    if (code && history && typeof history.replaceState === "function") {
      const url = new URL(loc.href);
      url.searchParams.delete("room");
      history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
    return code;
  } catch {
    return "";
  }
}
