import { RankGuide } from "./rank-guide.jsx";
import { useEffect, useRef, useState } from "react";
import {
  seasonRequest,
  queueSeasonMatch,
  finishSeasonMatch,
  retrySeasonMatches,
} from "../net/season.js";
import { myUid } from "../net/auth.js";
import { useCollection } from "../skins/store.js";
import {
  seasonName,
  seasonRewards,
  rewardReady,
  SEASON_TIERS,
  tierOf,
  SEASON_BACK,
  SEASON_FRAME,
} from "../game/season.js";
import { loadProfile } from "../game/profile.js";
import { readRanks } from "../net/ranking.js";
import { PlayerIcon } from "./playericon.jsx";
import { PlayerActionModal } from "./report.jsx";
import { withoutBlocked } from "../game/blocked.js";
import { CardBack } from "./cards.jsx";
import { SeatsProvider, useSeats } from "./names.jsx";

const dateLabel = (n) =>
  new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).format(n);
export function SeasonScreen({ historyOnly = false, rankingOnly = false }) {
  // 通報・見えなくする画面を出している相手(ガイドライン 1.2)
  const [acting, setActing] = useState(null);
  // 見えなくした直後に一覧から消すための数え札
  const [hidden, setHidden] = useState(0);
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("load"),
    [notice, setNotice] = useState("");
  const [identities, setIdentities] = useState({});
  const mounted = useRef(true);
  async function refresh() {
    setBusy("load");
    setError("");
    try {
      await retrySeasonMatches();
    } catch {
      if (mounted.current)
        setNotice(
          "未送信の対局があります。通信が戻ったら「更新」で再送できます。",
        );
    }
    try {
      const [next, names] = await Promise.all([
        seasonRequest("summary"),
        readRanks(Number.MAX_SAFE_INTEGER),
      ]);
      if (mounted.current && names.ok)
        setIdentities(Object.fromEntries(names.list.map((r) => [r.id, r])));
      if (mounted.current) setData(next);
    } catch (e) {
      if (mounted.current) setError(e.message);
    } finally {
      if (mounted.current) setBusy("");
    }
  }
  useEffect(() => {
    mounted.current = true;
    refresh();
    return () => {
      mounted.current = false;
    };
  }, []);
  // 開いたまま月が替わった場合もサーバーの期間を読み直す。
  useEffect(() => {
    if (!data) return;
    const timer = setTimeout(
      refresh,
      Math.min(2147483647, Math.max(1000, data.season.end - data.now + 100)),
    );
    return () => clearTimeout(timer);
  }, [data?.season.id, data?.now]);
  async function claim(reward) {
    setBusy(reward.id);
    setError("");
    setNotice("");
    try {
      setData(await seasonRequest("claim", { id: reward.id }));
      setNotice(`${reward.name}を受け取りました。`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  // 到達報酬は上の段(王)から並べる。最終順位の称号は 1位から
  const rewardsOf = (id, closed) => {
    const list = seasonRewards(id).filter((r) => !!r.place === closed);
    return closed ? list : list.reverse();
  };
  const rewards = (id, player, closed) => (
    <div className="season-rewards">
      {rewardsOf(id, closed)
        .map((reward) => {
          const claimed = data.claims.some((c) => c.id === reward.id),
            ready = rewardReady(reward, player, closed);
          return (
            <div
              className={`season-reward ${ready ? "season-reward-ready" : ""}`}
              key={reward.id}
            >
              <span className="season-reward-mark">{reward.mark}</span>
              <span>
                <small>{reward.label}</small>
                <b>{reward.name}</b>
              </span>
              <button
                className={`btn ${ready && !claimed ? "btn-primary" : "btn-ghost"}`}
                disabled={!!busy || claimed || !ready}
                onClick={() => claim(reward)}
              >
                {claimed
                  ? "受取済"
                  : busy === reward.id
                    ? "受取中…"
                    : ready
                      ? "受け取る"
                      : reward.place
                        ? "対象外"
                        : "未達成"}
              </button>
            </div>
          );
        })}
    </div>
  );
  const p = data?.player || {
      wr: 0.5,
      rating: 1500,
      rated: 0,
      highest: tierOf({ rating: 1500 }),
    },
    next = SEASON_TIERS[tierOf(p) + 1];
  return (
    <section className="season-content">
      {acting && (
        <PlayerActionModal
          target={acting}
          onClose={() => setActing(null)}
          onChanged={() => setHidden((n) => n + 1)}
        />
      )}
      <div className="season-toolbar">
        <span>9×9 オンライン対戦</span>
        <button className="btn btn-ghost" disabled={!!busy} onClick={refresh}>
          更新
        </button>
      </div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="season-notice" role="status">
          {notice}
        </p>
      )}
      {!data && (
        <p className="hint">
          {busy ? "シーズンを読み込んでいます…" : "「更新」で読み直せます。"}
        </p>
      )}
      {data && !historyOnly && !rankingOnly && (
        <>
          <div className="season-hero">
            <span className="season-eyebrow">月 間 シ ー ズ ン</span>
            <h3>{seasonName(data.season.id)}の戦い</h3>
            <p>
              {dateLabel(data.season.start)} 〜 {dateLabel(data.season.end)}{" "}
              <small>日本時間</small>
            </p>
            <div className="season-score">
              <span className="season-emblem">
                {SEASON_TIERS[tierOf(p)].name}
              </span>
              <strong>
                {p.rating}
                <small>持ち点</small>
              </strong>
              <span className="season-place">
                {p.place ? `${p.place}位` : "未掲載"}
                <small>{p.rated}戦</small>
              </span>
            </div>
            <div className="season-record">
              <span>
                最高順位 <b>{p.best ? `${p.best}位` : "—"}</b>
              </span>
              <span>
                最高到達 <b>{SEASON_TIERS[p.highest].name}</b>
              </span>
            </div>
          </div>
          <div className="season-goal">
            <b>{next ? `次は「${next.name}」へ` : "最高段階「王」に到達"}</b>
            {next && (
              <>
                <div className="season-meter">
                  <span
                    style={{
                      width: `${Math.min(100, Math.max(0, (p.rating / next.rating) * 100))}%`,
                    }}
                  />
                </div>
                <p>レート あと{Math.max(0, next.rating - p.rating)}点</p>
              </>
            )}
            {p.rated < 10 && (
              <small>あと{10 - p.rated}戦でランキングに掲載されます。</small>
            )}
          </div>
          <h4>到達報酬</h4>
          {rewards(data.season.id, p, false)}
          <p className="hint">
            一度到達した報酬は、段階が下がっても受け取れます。裏面と枠は設定で着脱できます。
          </p>
          <RankGuide />
          <h4>月末の記念称号</h4>
          <p className="hint">
            最終1位は「覇者」、3位以内は「三傑」、10位以内は「十傑」。翌月1日5時に確定します。同じ持ち点は同順位です。
          </p>
        </>
      )}
      {data && rankingOnly && (
        <>
          <h3>{seasonName(data.season.id)}のランキング</h3>
          {data.list.length ? (
            <ol className="rank-list">
              {withoutBlocked(
                data.list.map((row) => ({ ...row, id: row.uid })),
                hidden,
              ).map((row) => (
                <li
                  className={`rank-row ${row.uid === data.uid ? "rank-row-me" : ""}`}
                  key={row.uid}
                >
                  <span className="rank-place">{row.place}</span>
                  <PlayerIcon
                    name={identities[row.uid]?.name || row.name}
                    icon={identities[row.uid]?.icon ?? row.icon}
                    frame={row.frame}
                    size="sm"
                  />
                  <span className="rank-name">
                    {identities[row.uid]?.name || row.name}
                  </span>
                  <b className="rank-score">{row.rating}</b>
                  {row.uid !== data.uid && (
                    <button
                      className="rank-more"
                      onClick={() =>
                        setActing({
                          id: row.uid,
                          name: identities[row.uid]?.name || row.name,
                        })
                      }
                      aria-label={`${identities[row.uid]?.name || row.name} を通報する、または見えなくする`}
                    >
                      ⋯
                    </button>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="hint">10戦を達成したプレイヤーから掲載されます。</p>
          )}
        </>
      )}
      {data && historyOnly && (
        <>
          <h3>歴代の戦績</h3>
          {!data.history.length && (
            <p className="hint">参加したシーズンの終了後に、戦績が残ります。</p>
          )}
          {data.history.map((s) => (
            <article className="season-history" key={s.id}>
              <h4>{seasonName(s.id)}</h4>
              <div className="season-record">
                <span>
                  最終{" "}
                  <b>{s.player.place ? `${s.player.place}位` : "未掲載"}</b>
                </span>
                <span>
                  最高 <b>{s.player.best ? `${s.player.best}位` : "—"}</b>
                </span>
                <span>
                  最高到達 <b>{SEASON_TIERS[s.player.highest].name}</b>
                </span>
              </div>
              <p className="hint">
                {s.player.rating}点 · {s.player.rated}戦 {s.player.wins}勝{" "}
                {s.player.draws}分
              </p>
              {rewards(s.id, s.player, false)}
              {rewards(s.id, s.player, true)}
            </article>
          ))}
        </>
      )}
    </section>
  );
}

export function AppearanceSettings() {
  const collection = useCollection(),
    cache = collection.season;
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function sync() {
    setBusy(true);
    setError("");
    try {
      await seasonRequest("summary");
      setReady(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    sync();
  }, []);
  async function equip(change) {
    setBusy(true);
    setError("");
    try {
      await seasonRequest("equip", {
        back: cache.back,
        frame: cache.frame,
        ...change,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const me = loadProfile();
  return (
    <div className="appearance-settings">
      <p className="settings-head">シーズンの装飾</p>
      <div className="appearance-preview">
        <CardBack size="sm" colorHex="#c6a466" backId={cache.back} />
        <PlayerIcon
          name={me.name}
          icon={me.icon}
          frame={cache.frame}
          size="lg"
        />
        <span>裏面は自分の伏せた駒すべてに付きます。</span>
      </div>
      <label>
        カード裏面
        <select
          value={cache.back || ""}
          disabled={!ready || busy}
          onChange={(e) => equip({ back: e.target.value || null })}
        >
          <option value="">いつもの裏面</option>
          {cache.backs.includes(SEASON_BACK) && (
            <option value={SEASON_BACK}>月夜の紋章</option>
          )}
        </select>
      </label>
      <label>
        プロフィール枠
        <select
          value={cache.frame || ""}
          disabled={!ready || busy}
          onChange={(e) => equip({ frame: e.target.value || null })}
        >
          <option value="">枠なし</option>
          {cache.frames.includes(SEASON_FRAME) && (
            <option value={SEASON_FRAME}>金の月桂冠</option>
          )}
        </select>
      </label>
      {!cache.backs.length && !cache.frames.length && (
        <p className="hint">月間シーズンの到達報酬で獲得できます。</p>
      )}
      {error && (
        <>
          <p className="error-text" role="alert">
            {error}
          </p>
          <button className="btn btn-ghost" disabled={busy} onClick={sync}>
            読み直す
          </button>
        </>
      )}
    </div>
  );
}

// 装飾だけをサーバーから読む。推理メモや伏せ札の情報はここへ渡さない。
export function AppearanceSeats({ network, cpu, tutorial, children }) {
  const seats = useSeats(),
    cache = useCollection().season,
    [foe, setFoe] = useState(null);
  useEffect(() => {
    setFoe(null);
    let gone = false;
    if (network?.foeUid)
      seasonRequest("appearance", { uids: [network.foeUid] })
        .then((r) => {
          if (!gone) setFoe(r[network.foeUid]);
        })
        .catch(() => {});
    return () => {
      gone = true;
    };
  }, [network?.foeUid]);
  const mine = { back: cache.back, frame: cache.frame },
    mySeat = network?.myPlayerIndex ?? 0;
  const appearances = tutorial
    ? [null, null]
    : network
      ? [0, 1].map((i) => (i === mySeat ? mine : foe))
      : cpu
        ? [mine, null]
        : [null, null];
  return (
    <SeatsProvider
      value={{
        ...seats,
        backs: appearances.map((a) => a?.back),
        frames: appearances.map((a) => a?.frame),
      }}
    >
      {children}
    </SeatsProvider>
  );
}

export function useSeasonMatch(state, network, round, disabled) {
  const eligible = !!network && state.boardSize === 9 && !disabled;
  const [status, setStatus] = useState(""),
    [error, setError] = useState("");
  const flight = useRef(null),
    done = useRef(false),
    mounted = useRef(true);
  const match =
    eligible && state.phase === "gameover" && state.setupDone?.every(Boolean)
      ? {
          code: network.code,
          createdAt: network.createdAt,
          round,
          winner: state.winner,
          uid: myUid(),
        }
      : null;
  function submit() {
    if (!match || done.current) return Promise.resolve(true);
    if (flight.current) return flight.current;
    setStatus("saving");
    setError("");
    flight.current = (async () => {
      try {
        queueSeasonMatch(match);
        let last;
        for (let i = 0; i < 3; i++) {
          try {
            await finishSeasonMatch(match);
            done.current = true;
            if (mounted.current) setStatus("done");
            return true;
          } catch (e) {
            last = e;
            if (i < 2) await new Promise((r) => setTimeout(r, 900));
          }
        }
        throw last;
      } catch (e) {
        if (mounted.current) {
          setStatus("error");
          setError(e.message);
        }
        return false;
      } finally {
        flight.current = null;
      }
    })();
    return flight.current;
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (match) submit();
  }, [state.phase]);
  return { active: !!match, status, error, submit, done };
}
export function SeasonMatchNotice({ result }) {
  if (!result?.active) return null;
  return (
    <div className="season-match-notice" role="status">
      {result.status === "done" ? (
        "月間シーズンに成績を記録しました。"
      ) : result.status === "error" ? (
        <>
          {result.error}
          <br />
          再戦の前に成績を送信してください。
          <button className="btn btn-ghost" onClick={result.submit}>
            再送する
          </button>
        </>
      ) : (
        "月間シーズンの成績を記録しています…"
      )}
    </div>
  );
}
