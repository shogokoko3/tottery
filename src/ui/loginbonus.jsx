/**
 * ログインボーナスの札。
 *
 * ホームに着いたとき、その日のぶんがまだなら出す。
 * 出したら受け取るまで閉じない。うっかり外を押して流してしまうと、
 * その日はもう受け取れなくなるため。
 */
import { useEffect, useState } from "react";
import { Check, Ticket } from "../icons.jsx";
import { dayKey, loadProfile, markBonusTaken } from "../game/profile.js";
import {
  cycleOf,
  cycleRows,
  dayOf,
  isPending,
  rewardOf,
  ticketsOf,
} from "../game/login-bonus.js";
import { giveGift } from "../game/gifts.js";

export function LoginBonus() {
  // 出すかどうかは、開いたその時に決める。日をまたいでも出し直さない
  const [profile, setProfile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const p = loadProfile();
    if (isPending(p, dayKey())) setProfile(p);
  }, []);

  if (!profile) return null;

  const day = dayOf(profile.bonusTaken);
  const amount = ticketsOf(day);
  const rows = cycleRows(profile.bonusTaken);

  async function take() {
    if (busy) return;
    setBusy(true);
    // 先に配ってから控える。途中で失敗しても、配ったぶんは手元に残る
    await giveGift(rewardOf(day));
    markBonusTaken();
    setDone(true);
    setBusy(false);
  }

  return (
    <div className="modal-overlay bonus-overlay">
      <div className="modal-panel bonus-panel">
        <h3 className="bonus-title">ログインボーナス</h3>
        <p className="bonus-sub">
          {cycleOf(profile.bonusTaken)}周目の{day}日目
          {profile.streak > 1 && ` ・ 続けて${profile.streak}日`}
        </p>

        <div className="bonus-row">
          {rows.map((r) => (
            <div
              key={r.day}
              className={`bonus-cell ${r.today ? "is-today" : ""} ${
                r.taken || (r.today && done) ? "is-taken" : ""
              }`}
            >
              {/* 受け取り済みのマスは、日付の代わりに済みの印を出す。
                  狭いマスに印を重ねると数字と被って読めなくなる */}
              {r.taken || (r.today && done) ? (
                <Check size={13} className="bonus-check" />
              ) : (
                <small>{r.day}日目</small>
              )}
              <b>
                <Ticket size={14} />
                {r.amount}
              </b>
            </div>
          ))}
        </div>

        <p className="bonus-gain">
          {done ? (
            <>
              ガチャチケットを <b>{amount}枚</b> 受け取りました
            </>
          ) : (
            <>
              今日のぶんは ガチャチケット <b>{amount}枚</b>
            </>
          )}
        </p>

        {done ? (
          <button
            className="btn btn-ghost btn-wide"
            onClick={() => setProfile(null)}
          >
            ホームへ
          </button>
        ) : (
          <button
            className="btn btn-primary btn-wide"
            disabled={busy}
            onClick={take}
          >
            <Ticket size={16} /> 受け取る
          </button>
        )}
      </div>
    </div>
  );
}
