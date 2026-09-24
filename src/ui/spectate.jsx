/**
 * 観戦(2026-09-24 本人の指示「フレンドが対戦中に観戦できる」)。
 *
 * 対戦している二人には一切触れない**読むだけ**の画面。手番の列(rooms/<code>/acts)を
 * 読み、初期状態から reducer で畳んで盤を作り直す。手は書き込まない(pushAct を呼ばない)。
 *
 * 見える範囲は部屋の spectateReveal で決まる:
 *  - フレンド戦(reveal=true): 審判視点。両者の伏せ札まで表向き(Piece の revealAll)
 *  - ランダムマッチ(reveal=false): 観戦した席(friendSeat)の視点。相手の伏せ札は隠れる
 *
 * 入るときに spectators へ自分を登録し(joinSpectate)、出るときに下ろす(leaveSpectate)。
 * ルール側で spectate 済みの部屋だけ観戦者が読めるようにしてある(firebase-rules.json)。
 */
import { useEffect, useRef, useState } from "react";
import { reducer, initialState } from "../game/reducer.js";
import { spectateAct, setupFromRoom } from "../net/sync.js";
import { readActs, readRoom, joinSpectate, leaveSpectate } from "../net/firebase.js";
import { sanitizeLoadout } from "../skins/catalog.js";
import { PLAYER_META } from "../game/constants.js";
import { Piece } from "./cards.jsx";
import { CapturedRow } from "./game.jsx";
import { territoryOwnerOf } from "./setup.jsx";
import { PlayerIcon } from "./playericon.jsx";
import { TitleFrame } from "./title-frame.jsx";
import { ArrowLeft, Users } from "../icons.jsx";

const clip = (s, n) => (typeof s === "string" ? s.slice(0, n) : "");

/** 観戦の盤。game.jsx の盤を読むだけに削ったもの(選択・演出は無い) */
function SpectateBoard({ state, viewer, reveal }) {
  const R = state.boardSize;
  const flip = viewer === 1;
  const lm = state.lastMove;
  return (
    <div className="board-frame" style={{ "--n": R }}>
      <div className="rank-labels">
        {Array.from({ length: R }).map((_, U) => {
          const be = flip ? R - 1 - U : U;
          return <span key={U}>{R - be}</span>;
        })}
      </div>
      <div className="board-grid area-board" style={{ gridTemplateColumns: `repeat(${R},1fr)` }}>
        {Array.from({ length: R }).map((_, U) =>
          Array.from({ length: R }).map((__, at) => {
            const row = flip ? R - 1 - U : U;
            const col = flip ? R - 1 - at : at;
            const piece = state.board[row][col];
            const zone = territoryOwnerOf(row, col, R);
            const areaType = zone !== null && state.areas && state.areas[zone] ? state.areas[zone].type : null;
            const isFrom = lm && lm.from && lm.from.row === row && lm.from.col === col;
            const isTo = lm && lm.to && lm.to.row === row && lm.to.col === col;
            return (
              <div
                key={`${row}-${col}`}
                className={`cell ${zone !== null ? `zone-${zone}` : ""} ${areaType ? `area-${areaType}` : ""} ${isFrom ? "cell-from" : isTo ? "cell-to" : ""}`}
                style={lm && (isFrom || isTo) ? { "--lm": PLAYER_META[lm.owner].color } : undefined}
              >
                {piece && (
                  <div className="piece-slot">
                    <Piece piece={piece} viewer={viewer} revealAll={reveal} size={R >= 9 ? "xs" : "md"} />
                  </div>
                )}
              </div>
            );
          }),
        )}
      </div>
      <div className="file-labels">
        {Array.from({ length: R }).map((_, U) => {
          const be = flip ? R - 1 - U : U;
          return <span key={U}>{String.fromCharCode(97 + be)}</span>;
        })}
      </div>
    </div>
  );
}

function SeatTag({ name, icon, title, active }) {
  return (
    <div className={`spectate-seat ${active ? "spectate-seat-active" : ""}`}>
      <PlayerIcon icon={icon} name={name} size="sm" />
      <div className="spectate-seat-body">
        <b>{name || "プレイヤー"}</b>
        {title ? <TitleFrame id={title} size="compact" /> : null}
      </div>
    </div>
  );
}

export function SpectateScreen({ match, friend, onExit }) {
  const code = match && match.code;
  const [state, setState] = useState(initialState);
  const [meta, setMeta] = useState(null); // { seats, names, icons, titles, reveal, friendSeat }
  const [status, setStatus] = useState("loading"); // loading | watching | ended | fail
  const [err, setErr] = useState("");
  const stateRef = useRef(state);
  const seen = useRef(new Set());

  // 画面を閉じるときに観戦を下ろす(投げっぱなしでよい)
  useEffect(() => {
    return () => {
      if (code) leaveSpectate(code, true);
    };
  }, [code]);

  useEffect(() => {
    if (!code) return;
    let alive = true;
    let reading = false;
    let metaLocal = null;

    async function boot() {
      // 先に観戦者として名乗る(これを置かないと部屋を読めない)
      const j = await joinSpectate(code);
      if (!alive) return;
      if (!j.ok) {
        setErr(j.error || "観戦を始められませんでした。");
        setStatus("fail");
        return;
      }
      const r = await readRoom(code);
      if (!alive) return;
      if (!r.ok || !r.data || !r.data.seats) {
        setStatus("ended");
        return;
      }
      const d = r.data;
      const seats = d.seats || {};
      const friendSeat = friend && seats.guest === friend.uid ? 1 : 0;
      metaLocal = {
        seats,
        skins: [sanitizeLoadout(d.hostSkins), sanitizeLoadout(d.guestSkins)],
        ruleVersion: d.hostRuleVersion,
        boardSize: d.matchSize || 5,
        names: [clip(d.hostName, 10), clip(d.guestName, 10)],
        icons: [clip(d.hostIcon, 40), clip(d.guestIcon, 40)],
        titles: [clip(d.hostTitle, 40), clip(d.guestTitle, 40)],
        reveal: d.spectateReveal === true,
        friendSeat,
      };
      if (!alive) return;
      setMeta(metaLocal);
      setStatus("watching");
      tick();
    }

    function apply(list) {
      if (!metaLocal) return;
      const host = metaLocal.seats.host;
      const guest = metaLocal.seats.guest;
      let s = stateRef.current;
      let changed = false;
      for (const raw of list) {
        let act = spectateAct(raw, host, guest);
        if (!act || seen.current.has(act.__id)) continue;
        act = setupFromRoom(act, metaLocal.skins, {
          ranked: !!match.online,
          ruleVersion: metaLocal.ruleVersion,
          boardSize: metaLocal.boardSize,
        });
        seen.current.add(act.__id);
        try {
          s = reducer(s, act);
          changed = true;
        } catch (e) {
          console.warn("観戦: 手を適用できませんでした", act, e);
        }
      }
      if (changed) {
        stateRef.current = s;
        setState(s);
      }
    }

    async function tick() {
      if (reading || !alive) return;
      reading = true;
      let be;
      try {
        be = await readActs(code);
      } finally {
        reading = false;
      }
      if (!alive) return;
      if (!be.ok) {
        // 部屋が消えた(対局が終わって片付いた)なら、読みが拒まれる
        setStatus((s) => (s === "watching" ? "ended" : s));
        return;
      }
      apply(be.list);
    }

    boot();
    const timer = setInterval(tick, 1000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [code]);

  const turnLabel = (() => {
    if (!meta) return "";
    if (state.phase === "gameover") {
      if (state.winner === 0 || state.winner === 1) return `${meta.names[state.winner] || "プレイヤー"} の勝ち`;
      return "引き分け";
    }
    if (state.phase !== "play") return "布陣中";
    const t = state.currentTurn;
    return t === 0 || t === 1 ? `${meta.names[t] || "プレイヤー"} の番` : "";
  })();

  return (
    <div className="spectate-screen">
      <div className="spectate-bar">
        <button className="icon-btn" aria-label="観戦をやめる" onClick={onExit}>
          <ArrowLeft size={18} />
        </button>
        <span className="spectate-title">
          <Users size={16} /> 観戦{match.online ? "(ランダムマッチ)" : "(フレンド対戦)"}
        </span>
        <span className="spectate-turn">{turnLabel}</span>
      </div>

      {status === "loading" && <p className="hint spectate-note">対局を読み込んでいます…</p>}
      {status === "fail" && <p className="hint spectate-note">{err}</p>}
      {status === "ended" && (
        <p className="hint spectate-note">この対局は終了したか、見つかりませんでした。</p>
      )}

      {meta && status !== "fail" && (
        <>
          <div className="spectate-seats">
            <SeatTag
              name={meta.names[0]}
              icon={meta.icons[0]}
              title={meta.titles[0]}
              active={state.phase === "play" && state.currentTurn === 0}
            />
            <span className="spectate-vs">VS</span>
            <SeatTag
              name={meta.names[1]}
              icon={meta.icons[1]}
              title={meta.titles[1]}
              active={state.phase === "play" && state.currentTurn === 1}
            />
          </div>

          {!meta.reveal && (
            <p className="hint spectate-note">
              {(meta.names[meta.friendSeat] || "フレンド")} の視点で観戦しています(相手の伏せ札は見えません)。
            </p>
          )}

          {state.board && state.board.length > 0 && (
            <>
              <SpectateBoard state={state} viewer={meta.friendSeat} reveal={meta.reveal} />
              <CapturedRow players={state.players} dispatch={() => {}} viewer={meta.friendSeat} />
            </>
          )}
        </>
      )}
    </div>
  );
}
