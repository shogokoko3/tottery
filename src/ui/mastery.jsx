import { MASTERY_STEPS } from "../game/constants.js";
import { FRAME_GRADES } from "./title-design.js";
import { TitleFrame } from "./title-frame.jsx";

/**
 * 終局画面に出す、札ごとの熟練度のメーター(2026-09-22 本人の指示)。
 *
 * プレイヤーレベルのゲージとは別に置く。あちらは1本で「その人の歩み」を出すが、
 * こちらは**その局で使った札だけ**を並べて「何がどれだけ上がったか」を出す。
 * 使っていない札は出さない(13本並べると読む気が失せる)。
 *
 * 段に届いた行だけ印を強くする。全部を光らせると、どこが変わったのか分からない。
 */
export function MasteryGains({ gains, titles }) {
  if (!gains || !gains.length) return null;
  // 上がり幅が大きいものを先に。同じなら累計の多いものを先に
  const rows = [...gains].sort(
    (a, b) => b.added - a.added || b.after - a.after,
  );
  return (
    <section className="mastery-gains" aria-label="札の熟練度">
      <h4 className="mastery-gains-head">
        <span>札の熟練度</span>
        <small>盤に出して指した回数</small>
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
                    ? `極み（${p.count}回）`
                    : `${p.count}回。次の段まであと${p.left}回`
                }
              >
                <span style={{ width: `${p.ratio * 100}%` }} />
              </div>
              <div className="mastery-detail">
                <span>
                  {p.done
                    ? `極み · 累計${p.count}回`
                    : `${p.count} / ${p.next}回`}
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
      {/* 段の境目を添える。あと何回でどうなるのかが読めないと、伸ばす気にならない */}
      <p className="mastery-steps-note">
        段の境目: {MASTERY_STEPS.join(" · ")}回
      </p>
    </section>
  );
}
