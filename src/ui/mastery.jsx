import { MASTERY_STEPS } from "../game/constants.js";
import { FRAME_GRADES } from "./title-design.js";
import { TitleFrame } from "./title-frame.jsx";

/**
 * 終局画面に出す、札ごとの熟練度のメーター(2026-09-22 本人の指示)。
 *
 * プレイヤーレベルのゲージとは別に置く。あちらは1本で「その人の歩み」を出すが、
 * こちらは**その局で王にした札**を出して「どれだけ上がったか」を見せる。
 * 王に選んだ札しか育たないので、ふつうは1行だけになる(2026-09-22 本人の決め)。
 *
 * 段に届いた行だけ印を強くする。全部を光らせると、どこが変わったのか分からない。
 */
export function MasteryGains({ gains, titles }) {
  // 王を一度も動かさなかった局は、欄ごと出さない
  if (!gains || !gains.length) return null;
  // 王は1局に1種類なので、ふつうは1行。念のため並べ替えは残す
  const rows = [...gains].sort(
    (a, b) => b.added - a.added || b.after - a.after,
  );
  return (
    <section className="mastery-gains" aria-label="札の熟練度">
      <h4 className="mastery-gains-head">
        <span>札の熟練度</span>
        <small>王に選んだ札にたまる点</small>
      </h4>
      {rows.map((g) => {
        const p = g.progress;
        const stepUp = p.step > g.stepBefore;
        return (
          <div
            key={g.rank}
            className={`mastery-row${stepUp ? " mastery-row-up" : ""}`}
          >
            <b className="mastery-rank">{g.rank}</b>
            <div className="mastery-meter">
              <div
                className="mastery-track"
                role="progressbar"
                aria-label={`${g.rank} の熟練度`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(p.ratio * 100)}
                aria-valuetext={
                  p.done
                    ? `極み（${p.count}点）`
                    : `${p.count}点。次の段まであと${p.left}点`
                }
              >
                <span style={{ width: `${p.ratio * 100}%` }} />
              </div>
              <div className="mastery-detail">
                <span>
                  {p.done
                    ? `極み · 累計${p.count}点`
                    : `${p.count} / ${p.next}点`}
                </span>
                {stepUp ? (
                  <b className="mastery-up">
                    {p.done
                      ? "極みに到達"
                      : FRAME_GRADES[p.step - 1]
                        ? `${FRAME_GRADES[p.step - 1].name}に到達`
                        : `段${p.step}に到達`}
                  </b>
                ) : p.done ? (
                  <span>これ以上は上がりません</span>
                ) : (
                  <span>次の段まであと {p.left}</span>
                )}
              </div>
            </div>
            <span className="mastery-added">+{g.added}</span>
            {/* 点の内訳(2026-09-24)。何で稼いだかが分からないと、次に何をすればいいか分からない */}
            {g.points && (
              <small className="mastery-breakdown">
                {[
                  g.points.king ? `王に選んだ +${g.points.king}` : null,
                  g.points.moves ? `王を動かした +${g.points.moves}` : null,
                  g.points.captures ? `王で取った +${g.points.captures}` : null,
                  g.points.kingCapture ? `王を討った +${g.points.kingCapture}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
            )}
          </div>
        );
      })}
      {/* この局で届いた称号は、額縁ごと見せる。数字だけでは手に入れた実感が薄い */}
      {titles && titles.length > 0 && (
        <div className="mastery-earned">
          <small>称号を手に入れました</small>
          {titles.map((t) => (
            <TitleFrame key={t.id} id={t.id} size="compact" />
          ))}
        </div>
      )}
      {/* 段の境目を添える。あと何点でどうなるのかが読めないと、伸ばす気にならない */}
      <p className="mastery-steps-note">
        段の境目: {MASTERY_STEPS.join(" · ")}点
      </p>
    </section>
  );
}
