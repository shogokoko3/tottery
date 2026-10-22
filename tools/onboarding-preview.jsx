import { useEffect, useState } from "react";
import { FirstSummonLobby, FirstSummon, FirstSummonResults, previewEquipment } from "./onboarding-summon.jsx";
import { createRoot } from "react-dom/client";
import { WelcomeComic } from "../src/ui/welcome-comic.jsx";
import { StoryReader } from "../src/ui/story-chronicle.jsx";
import { PhaseGuide } from "../src/ui/phase-guide.jsx";
import { Piece, CardFace } from "../src/ui/cards.jsx";
import { SeatsProvider } from "../src/ui/names.jsx";
import { MoveDiagram } from "../src/ui/guides.jsx";
import { FIRST_GAME } from "../src/game/tutorial.js";
import { SUIT_SYMBOL } from "../src/game/constants.js";
import { byId } from "../src/skins/catalog.js";
import { titleBgImg } from "../src/assets.js";
import { createTrial, trialAction, trialContinue, trialCoach, trialStep, trialMoves, previewProfile } from "./onboarding-preview-model.js";
import globalCss from "../src/styles.css";
import skinCss from "../src/skins/styles.css";
import css from "./onboarding-preview.css";

const NAV = [{ id: "comic", name: "漫画" }, { id: "game", name: "一局遊ぶ" }, { id: "win", name: "初勝利" }, { id: "name", name: "名前" }, { id: "reward", name: "無料10連" }, { id: "home", name: "ホーム" }];
const DESCRIPTIONS = {
  title: ["最初の一歩は、ゲームの楽しさから", "漫画で目的を知り、自分で一局遊んでから、報酬とホームへ進みます。"],
  comic: ["まず、どんな遊びかを知る", "準備・カードごとの動き・勝利を1ページずつ。すぐに遊ぶこともできます。"],
  game: ["漫画で見たことを、自分の手で", "実際の「はじめの一局」のルールと台本で遊べます。王を選び、札を選んで光るマスへ。"],
  win: ["勝利から、報酬へ自然につなぐ", "「門へ進む」を、何が起きるか分かる「初勝利の報酬を受け取る」に変更した案です。"],
  name: ["初めての勝利の後に、名前を決める", "対局前に入力を求めず、勝てたあとに自分の名前を登録する流れです。入力はこの画面内だけで扱います。"],
  reward: ["勝ったご褒美として、門が開く", "門の世界観と無料10連の案内を一画面にまとめます。召喚結果はプレビュー用の固定見本です。"],
  summon: ["報酬を受け取る時間", "レジェンド・ゲートと共通の演出です。門への接近、タップでの開門、札の飛来、めくりとレアリティ昇格を体験できます。抽選は固定見本です。"],
  results: ["手に入れた英雄と、次の一局を結び付ける", "次に使う数字の英雄を選び、装備後は一度ホームへ着地します。10の英雄は次の対局では使わないことも明示します。"],
  home: ["初回ホームで、現在地と次の目的が分かる", "主ボタンは「第1話を読む」。フェーズ1と進捗、対戦が開く条件を同じ場所で示します。"],
  next: ["ホームから、次の相手へ", "ここから通常のストーリー対局へつながる想定です。このプレビューでは、次の相手と動きの説明まで確認できます。"],
};
const asset = skin => `/assets/${skin.card}`;
const lines = value => (Array.isArray(value) ? value : [value]).filter(Boolean).map((line, i) => <span key={i}>{Array.isArray(line) ? line.join("") : line}</span>);
const symbol = card => `${card.rank}${SUIT_SYMBOL[card.suit]}`;

function Match({ model, setModel, onWin, onExit }) {
  const [hintOpen, setHintOpen] = useState(false);
  const s = model.state;
  const step = trialStep(model);
  const selected = s.pieces?.[s.selectedId];
  const moves = s.phase === "play" && selected ? trialMoves(model, selected) : [];
  const pickedKing = s.setupPickKings?.[0];
  useEffect(() => { if (s.phase === "gameover" && s.winner === 0) onWin(); }, [s.phase, s.winner, onWin]);
  const act = action => setModel(m => trialAction(m, action));
  const setupPieces = s.phase === "setup" ? [0, 1].flatMap(owner => Object.entries(owner === 0 ? FIRST_GAME.opening.placement : FIRST_GAME.foe.placement).map(([id, at]) => ({ ...FIRST_GAME.deck.find(c => c.id === id), ...at, owner, alive: true, isKing: owner === 0 && pickedKing === id }))) : [];
  useEffect(() => setHintOpen(false), [step]);
  const coach = !model.nudge.length && hintOpen && step?.need?.choose
    ? [...step.need.choose.hint, "4♦は縦横に2マスまで動けます。"] : trialCoach(model);
  const threatFrom = step?.threat && s.pieces?.[step.threat.pieceId];
  const threatTargets = (step?.threat?.targets || []).map(id => s.pieces?.[id]).filter(p => p?.alive);
  const clueMove = step?.need?.choose ? model.clueMove : null;
  return <section className="jp-match jp-page">
    <div className="jp-topline"><button className="jp-text" onClick={onExit}>漫画へ戻る</button><span>フェーズ1 · 王の力なし</span></div>
    <div className="jp-match-heading"><small>案内付き・時間制限なし</small><h1>はじめの一局</h1></div>
    <div className={`jp-coach ${model.nudge.length ? "is-nudge" : ""}`} role="status">{lines(coach)}</div>
    <div className="jp-side"><i className="jp-dot enemy" />相手 · 二と三の王 <span>相手の王は2か3です</span></div>
    <div className="jp-board-space"><div className="jp-board" role="group" aria-label="5×5の盤面">
      {Array.from({ length: 25 }, (_, index) => {
        const row = Math.floor(index / 5), col = index % 5;
        const p = s.phase === "setup" ? setupPieces.find(p => p.row === row && p.col === col) : s.board[row][col];
        const move = moves.find(m => m.row === row && m.col === col);
        const focus = step?.focus;
        const guided = focus?.pieces?.includes(p?.id) || focus?.cells?.some(at => at.row === row && at.col === col);
        const chosen = s.phase === "setup" ? p?.id === pickedKing : p?.id === s.selectedId;
        const threatened = threatTargets.some(target => target.id === p?.id);
        function click() {
          if (s.phase === "setup") { if (p?.owner === 0) act({ type: "SETUP_PICK_KING", player: 0, cardId: p.id }); return; }
          if (p?.owner === 0) { act({ type: "SELECT_PIECE", id: p.id }); return; }
          if (selected) act({ type: "MOVE_PIECE", pieceId: selected.id, row, col, captures: move?.captures });
        }
        return <button type="button" key={index} className={`jp-square ${move ? "can-move" : ""} ${chosen ? "is-chosen" : ""} ${guided ? "is-guided" : ""} ${threatened ? "is-threatened" : ""}`} onClick={click}
          aria-label={`${String.fromCharCode(97 + col)}${5 - row}${p ? p.owner === 0 ? ` 自分の${symbol(p)}${p.isKing ? " 王" : ""}` : " 相手の伏せ札" : " 空きマス"}${move ? " 移動できます" : ""}`}>
          {p && <Piece piece={p} viewer={0} size="sm" isSelected={chosen} />}
          {guided && p && <span className="jp-guide-marker" aria-hidden="true">▼</span>}
          {!p && move && <i className="jp-move-dot" />}
        </button>;
      })}
      {clueMove && <svg className="jp-threat-lines jp-last-move" viewBox="0 0 5 5" aria-hidden="true"><line x1={clueMove.from.col + .5} y1={clueMove.from.row + .5} x2={clueMove.to.col + .5} y2={clueMove.to.row + .5} /><circle cx={clueMove.from.col + .5} cy={clueMove.from.row + .5} r=".14" /><circle cx={clueMove.to.col + .5} cy={clueMove.to.row + .5} r=".28" /></svg>}
      {threatFrom && <svg className="jp-threat-lines" viewBox="0 0 5 5" aria-hidden="true">{threatTargets.map(target => {
        const dx = target.col - threatFrom.col, dy = target.row - threatFrom.row;
        const length = Math.hypot(dx, dy) || 1, ux = dx / length, uy = dy / length;
        const ex = target.col + .5 - ux * .3, ey = target.row + .5 - uy * .3;
        return <g key={target.id}><line x1={threatFrom.col + .5 + ux * .3} y1={threatFrom.row + .5 + uy * .3} x2={ex - ux * .15} y2={ey - uy * .15} /><polygon points={`${ex},${ey} ${ex - ux * .2 - uy * .12},${ey - uy * .2 + ux * .12} ${ex - ux * .2 + uy * .12},${ey - uy * .2 - ux * .12}`} /></g>;
      })}</svg>}
    </div></div>
    <div className="jp-side"><i className="jp-dot" />あなた <span>{s.phase === "setup" ? "王にする札を選びます" : step?.holdFoe ? "相手の番です" : s.lastMove?.owner === 1 ? "青い線は相手が動いた跡です" : selected ? "金色のマスへ動かせます" : "動かす札を選んでください"}</span></div>
    <div className="jp-match-action">
    {s.phase === "setup" && <button className="btn btn-primary jp-primary" disabled={!pickedKing} onClick={() => act({ type: "SETUP_CONFIRM", player: 0 })}>この札を王にして始める</button>}
    {step && !step.need && !step.end && <button className="btn btn-primary jp-primary" onClick={() => setModel(trialContinue)}>{step.nextLabel || "相手の動きを見る"}</button>}
    {step?.need?.choose && <button className="btn btn-ghost jp-primary" aria-expanded={hintOpen} onClick={() => setHintOpen(open => !open)}>{hintOpen ? "操作の案内に戻る" : "ヒントを見る"}</button>}
    </div>
    <p className="jp-muted jp-help">{s.phase === "setup" ? "王にする札を選び、下のボタンで始めます。" : step?.holdFoe ? "下のボタンで相手の動きを確認します。" : "札を選び、移動先をタップします。"}</p>
  </section>;
}

function App() {
  const [stage, setStage] = useState("title");
  const [model, setModel] = useState(createTrial);
  const [name, setName] = useState("");
  const [chosen, setChosen] = useState("pirate-female");
  const [equipped, setEquipped] = useState({});
  const [guide, setGuide] = useState(false);
  const [replay, setReplay] = useState(false);
  const [firstStoryReading, setFirstStoryReading] = useState(false);
  const [movesOpen, setMovesOpen] = useState(false);
  const profile = previewProfile(name);
  const equippedHero = Object.values(equipped).includes(chosen) ? byId(chosen) : byId(Object.values(equipped)[0]);
  const description = DESCRIPTIONS[stage];
  function go(next) { setStage(next); setGuide(false); setReplay(false); setFirstStoryReading(false); document.querySelector(".jp-device-body")?.scrollTo(0, 0); }
  function reset() { setModel(createTrial()); setName(""); setChosen("pirate-female"); setEquipped({}); setMovesOpen(false); go("title"); }
  function start() { setModel(createTrial()); go("game"); }
  const activeNav = ["summon", "results"].includes(stage) ? "reward" : stage === "next" ? "home" : stage;
  return <>
    <style>{globalCss + skinCss + css}</style>
    <div className="jp-shell">
      <aside className="jp-review">
        <div className="jp-review-kicker">トッタリー · 導線の確認</div><h1>初めての勝利から、<br />次の一局まで。</h1>
        <p className="jp-review-lead">提案した初回体験を、実際に押して確かめられるプレビューです。</p>
        <nav className="jp-timeline" aria-label="確認する場面">{NAV.map((item, index) => <button key={item.id} aria-current={activeNav === item.id ? "step" : undefined} onClick={() => item.id === "game" ? start() : go(item.id)}><span>{String(index + 1).padStart(2, "0")}</span>{item.name}<i /></button>)}</nav>
        <div className="jp-review-note" aria-live="polite"><small>この場面のねらい</small><h2>{description[0]}</h2><p>{description[1]}</p></div>
        <button className="jp-reset" onClick={reset}>最初から体験する ↻</button>
        <p className="jp-review-disclaimer">名前・進捗・召喚はこのプレビュー内だけの見本です。実際の所持品やアカウントには保存しません。</p>
      </aside>
      <div className="jp-device" data-preview-stage={stage}>
        <header className="jp-app-bar"><span>◆ トッタリー ◆</span><span className="jp-app-icon">◇</span></header>
        <div className="jp-device-body">
          {stage === "title" && <section className="jp-title"><img src={titleBgImg} alt="トッタリー — 相手の王を討て" /><div className="jp-title-foot"><p>その一枚が、王かもしれない。</p><button className="btn btn-primary jp-primary" onClick={() => go("comic")}>ゲームスタート</button><small>まずは、漫画で遊び方を知ろう。</small></div></section>}
          {stage === "comic" && <WelcomeComic firstRun onDone={start} />}
          {stage === "game" && <Match model={model} setModel={setModel} onWin={() => go("win")} onExit={() => go("comic")} />}
          {stage === "win" && <section className="jp-page jp-win"><small>はじめての一局</small><div className="jp-crown">♛</div><h1>王を、見つけた。</h1><p>相手が逃がした一枚は、王だった。<br />あなたの読みが、勝利につながった。</p><div className="jp-won-card"><CardFace rank="3" suit="diamond" size="lg" isKing skinId={false} /></div><div className="jp-milestone"><span>二と三の王</span><b>初回クリア</b></div><div className="jp-win-reward"><span>勝利の褒美</span><b>英雄を呼び出す、無料10連</b></div><button className="btn btn-primary jp-primary" onClick={() => go("name")}>初勝利の報酬を受け取る</button></section>}
          {stage === "name" && <section className="jp-page jp-name"><small>はじめての勝利に、あなたの名前を。</small><h1>プレイヤー名を決めてください。</h1><p>対局やプロフィールで使う名前です。<br />あとから変更できます。</p><form onSubmit={event => { event.preventDefault(); if (name.trim()) { setName(name.trim()); go("reward"); } }}><label htmlFor="journey-name">プレイヤー名</label><input id="journey-name" autoComplete="off" maxLength={12} placeholder="あなたの名前" value={name} onChange={e => setName(e.target.value)} /><small>1〜12文字</small><button className="btn btn-primary jp-primary" disabled={!name.trim()}>この名前で報酬へ</button></form></section>}
          {stage === "reward" && <FirstSummonLobby name={profile.name} onStart={() => go("summon")} />}
          {stage === "summon" && <FirstSummon onComplete={() => { setEquipped(previewEquipment()); setChosen("pirate-female"); go("results"); }} />}
          {stage === "results" && <FirstSummonResults chosen={chosen} setChosen={setChosen} equipped={equipped} setEquipped={setEquipped} onDone={() => go("home")} />}
          {stage === "home" && <section className="jp-page jp-home"><div className="jp-home-profile"><div>♙</div><span><b>{profile.name}</b><small>Lv 1 · 見習い</small></span><span className="jp-home-balance">初勝利おめでとう</span></div><header><small>あなたの旅は、ここから。</small><h1>次の一局へ。</h1></header><section className="jp-current"><div><small>あなたの現在地</small><button className="jp-text" onClick={() => setGuide(true)}>フェーズガイド ›</button></div><h2>フェーズ1<br /><span>札の動きを覚える</span></h2><div className="jp-progress"><i /></div><p><b>ストーリー 0 / 7 クリア</b><span>全7ステージ</span></p><small>全7ステージをクリアすると、ランダム対戦が開きます。</small></section><button className="jp-next-main" onClick={() => go("next")}><small>最初は、二と三の王。</small><b>第1話を読む</b><span>物語を読んで、最初の相手と対局します。　→</span></button>{equippedHero && <div className="jp-equipped"><img src={asset(equippedHero)} alt="" /><p><small>装備した英雄</small><b>{equippedHero.name}</b><span>{equippedHero.rank}の札に装備中</span><span>{["2", "3", "4", "5"].includes(equippedHero.rank) ? "次の対局でも使えます。" : `${equippedHero.rank}の札が登場する対局で使えます。`}</span></p></div>}<div className="jp-home-links"><button onClick={() => setReplay(true)}>漫画で遊び方</button><button onClick={() => setGuide(true)}>フェーズを確認</button></div><div className="jp-locked-match"><span>ランダム対戦</span><small>ストーリー全7ステージで解放</small></div></section>}
          {stage === "next" && <section className="jp-page jp-next"><button className="jp-text" onClick={() => go("home")}>‹ ホームへ</button><small>フェーズ1 · 次の相手</small><h1>二と三の王</h1><p>第1話は、物語を読んでから対局します。<br />この対局に勝つと、最初のステージがクリアになります。</p><button className="btn btn-primary jp-primary" onClick={() => setFirstStoryReading(true)}>第1話の物語を読む</button><div className="jp-next-cards"><CardFace rank="2" suit="spade" size="lg" skinId={false} /><CardFace rank="3" suit="heart" size="lg" skinId={equipped["3"] || false} artworkSkin={equipped["3"] ? { ...byId(equipped["3"]), image: asset(byId(equipped["3"])), card: asset(byId(equipped["3"])) } : null} /></div><button className="btn btn-primary jp-primary" onClick={() => setMovesOpen(!movesOpen)}>{movesOpen ? "説明を閉じる" : "2と3の動き方を確認する"}</button>{movesOpen && <div className="jp-next-diagrams"><figure><MoveDiagram rank="2" gridSize={5} /><figcaption>2：縦横1マス</figcaption></figure><figure><MoveDiagram rank="3" gridSize={5} /><figcaption>3：斜め1マス</figcaption></figure></div>}<button className="jp-text" onClick={() => go("home")}>ホームへ戻る</button></section>}
          {guide && <div className="jp-guide-overlay"><PhaseGuide profile={profile} onBack={() => setGuide(false)} /></div>}
          {replay && <WelcomeComic onDone={() => setReplay(false)} />}
          {firstStoryReading && <StoryReader axis="23" phase={1} battle requireRead onDone={() => setFirstStoryReading(false)} onClose={() => setFirstStoryReading(false)} />}
        </div>
      </div>
    </div>
  </>;
}

createRoot(document.getElementById("root")).render(<SeatsProvider value={{ names: ["あなた", "二と三の王"], skins: [{}, {}] }}><App /></SeatsProvider>);
