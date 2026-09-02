/**
 * reducer 挙動照合ハーネス
 *
 * 元バンドルから機械抽出したロジック(reference/original-logic.mjs)を正とし、
 * 復元した reducer が「同じ入力に対して同じ出力を返すか」をステップ単位で突き合わせる。
 *
 * 各ステップは (直前の状態, アクション, 乱数シード) → 状態 の独立した検証になっている。
 * こうしておくと、一手でも挙動が違えばそこで確実に落ちる。局面の進み方が
 * ずれて以降のアクションが空振りする、という見かけだけの一致は起きない。
 */
import * as ORIG from "../reference/original-logic.mjs";

const GAMES = Number(process.env.GAMES || 150);
const MAX_STEPS = 4000;

/** reducer が持つ全アクション（網羅率の分母） */
const ALL_ACTIONS = [
  "START_SETUP", "ROLL_DICE_SINGLE", "NEXT_DICE_STEP", "REROLL_DICE", "GOTO_MULLIGAN",
  "TOGGLE_MULLIGAN_CARD", "CONFIRM_MULLIGAN", "SETUP_PLACE_CARD", "SETUP_UNPLACE_CARD",
  "SETUP_AUTO_ARRANGE", "SETUP_GOTO_KING_STEP", "SETUP_BACK_TO_PLACE", "SETUP_PICK_KING",
  "SETUP_CONFIRM", "DISMISS_INTERSTITIAL", "SELECT_PIECE", "CANCEL_SELECTION",
  "TOGGLE_SHUFFLE_PICK", "CONFIRM_SHUFFLE", "MOVE_PIECE", "DISMISS_CAPTURE",
  "ACK_KING_CHOICE", "CHOOSE_HEIR", "PLACE_RESERVE_CARD", "SKIP_RESERVE_PLACEMENT",
  "SKIP_EXTRA_ACTION", "VIEW_LOG", "CLOSE_LOG", "RESIGN", "NEW_GAME",
];

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const realRandom = Math.random;
const seedRandom = (s) => { Math.random = mulberry32(s); };
const restoreRandom = () => { Math.random = realRandom; };

function stable(v) {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === "object") {
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = stable(v[k]);
    return o;
  }
  return v;
}
const snap = (s) => JSON.stringify(stable(s));

/** reducer を固定シードで1回だけ呼ぶ。例外も結果として扱う */
function step(logic, state, action, seed) {
  seedRandom(seed);
  try { return { ok: true, out: snap(logic.ki(state, action)) }; }
  catch (err) { return { ok: false, out: "THREW:" + (err && err.message) }; }
  finally { restoreRandom(); }
}

/** CPU が出さない、UI 由来のアクションを混ぜる（guard 節も照合対象にする） */
function fuzzAction(st) {
  const r = Math.random;
  const pick = (arr) => (arr && arr.length ? arr[Math.floor(r() * arr.length)] : null);
  const sz = st.boardSize;

  if (st.phase === "mulligan") {
    const card = pick(st.players[st.mulliganIdx]?.hand);
    if (card) return { type: "TOGGLE_MULLIGAN_CARD", cardId: card.id };
  }
  if (st.phase === "setup" && st.setupStep === "place") {
    const hand = st.players[st.setupIdx]?.hand || [];
    const placed = Object.keys(st.setupPlacement || {});
    if (r() < 0.4 && placed.length) return { type: "SETUP_UNPLACE_CARD", cardId: pick(placed) };
    const card = pick(hand);
    if (card) {
      const [lo, hi] = ORIG.hl(sz, st.setupIdx);
      return { type: "SETUP_PLACE_CARD", cardId: card.id,
               row: lo + Math.floor(r() * (hi - lo + 1)), col: Math.floor(r() * sz) };
    }
  }
  if (st.phase === "setup" && st.setupStep === "king") return { type: "SETUP_BACK_TO_PLACE" };
  if (st.phase === "play") {
    const alive = Object.values(st.pieces || {}).filter((x) => x.alive);
    const opts = [
      { type: "CANCEL_SELECTION" }, { type: "SKIP_EXTRA_ACTION" },
      { type: "SKIP_RESERVE_PLACEMENT" }, { type: "CLOSE_LOG" },
    ];
    const pc = pick(alive);
    if (pc) { opts.push({ type: "VIEW_LOG", id: pc.id }); opts.push({ type: "SELECT_PIECE", id: pc.id }); }
    if (r() < 0.02) opts.push({ type: "RESIGN", player: Math.floor(r() * 2) });
    return pick(opts);
  }
  return null;
}

/**
 * CPU 同士で1局まわし、(直前の状態, アクション, シード, 元の出力) を記録する。
 * 進行は必ず「元」の出力で行うので、記録した局面は常に本物。
 */
function recordGame(seed) {
  seedRandom(seed);
  const trace = [];
  let st = ORIG.Eo();
  let n = 0;

  const push = (rawAction) => {
    const action = ORIG.Wg(rawAction, st);
    const raw = rawAction;
    const before = st;
    const stepSeed = (seed * 7919 + n * 104729) | 0;
    n++;
    // 記録は「元」の結果。乱数はステップ固定シードで再現可能にしておく
    restoreRandom();
    const res = step(ORIG, before, action, stepSeed);
    trace.push({ before, raw, action, stepSeed, expect: res });
    seedRandom(seed + n * 7);   // CPU 側の乱数は進めておく
    if (res.ok) st = JSON.parse(res.out);
    return res.ok;
  };

  push({ type: "START_SETUP", size: Math.random() < 0.5 ? 5 : 7 });
  for (let i = 0; i < MAX_STEPS && st.phase !== "gameover"; i++) {
    if (st.interstitial) { push({ type: "DISMISS_INTERSTITIAL" }); continue; }
    if (st.captureReveal) { push({ type: "DISMISS_CAPTURE" }); continue; }
    if (Math.random() < 0.25) { const f = fuzzAction(st); if (f) { push(f); continue; } }
    if (st.phase === "dice" && st.diceIdx === 2) { push({ type: "GOTO_MULLIGAN" }); continue; }
    if (st.phase === "dice" && st.diceIdx === 3) { push({ type: "REROLL_DICE" }); continue; }
    let acted = false;
    for (const p of [0, 1]) {
      const a = ORIG.Fg(st, p);
      if (!a) continue;
      if (a.type === "__CPU_SHUFFLE") {
        push({ type: "SELECT_PIECE", id: a.aceId });
        push({ type: "TOGGLE_SHUFFLE_PICK", id: a.pickIds[0] });
        push({ type: "TOGGLE_SHUFFLE_PICK", id: a.pickIds[1] });
        push({ type: "CONFIRM_SHUFFLE" });
      } else push(a);
      acted = true;
      break;
    }
    if (!acted) break;
  }
  if (st.phase === "gameover") push({ type: "NEW_GAME" });
  restoreRandom();
  return { trace, finalPhase: st.phase };
}

/** ランダム生成では踏めない分岐を、状態を直接組んで照合する */
function scenarios() {
  const out = [];
  const { trace } = recordGame(4242);
  const playStep = trace.find(
    (t) => t.expect.ok && (() => { const s = JSON.parse(t.expect.out);
      return s.phase === "play" && Object.values(s.pieces || {}).filter((x) => x.alive && x.owner === 0).length >= 3; })(),
  );

  if (playStep) {
    const st = JSON.parse(playStep.expect.out);
    const mine = Object.values(st.pieces).filter((x) => x.alive && x.owner === 0).slice(0, 3);
    const pieces = { ...st.pieces };
    const board = st.board.map((r) => [...r]);
    for (const pc of mine) { const np = { ...pc, rank: "2" }; pieces[pc.id] = np; board[pc.row][pc.col] = np; }
    const heirs = mine.slice(1).map((x) => x.id);
    const base = {
      ...st, pieces, board,
      players: st.players.map((pl, i) => (i === 0 ? { ...pl, kingId: null } : pl)),
      pendingKingChoice: { owner: 0, rank: "2", candidateIds: heirs, acknowledged: false },
    };
    out.push({ name: "王位継承: 承認して継承者を選ぶ", state: base,
               actions: [{ type: "ACK_KING_CHOICE" }, { type: "CHOOSE_HEIR", id: heirs[0] }] });
    out.push({ name: "王位継承: 候補外のIDを弾く", state: base,
               actions: [{ type: "ACK_KING_CHOICE" }, { type: "CHOOSE_HEIR", id: "存在しないID" },
                         { type: "CHOOSE_HEIR", id: heirs[1] }] });
    out.push({ name: "王位継承: 承認前に継承しようとする", state: base,
               actions: [{ type: "CHOOSE_HEIR", id: heirs[0] }, { type: "ACK_KING_CHOICE" }] });
    out.push({ name: "投了(両プレイヤー)", state: st,
               actions: [{ type: "RESIGN", player: 0 }] });
    out.push({ name: "投了後に動かそうとする", state: st,
               actions: [{ type: "RESIGN", player: 1 }, { type: "SKIP_EXTRA_ACTION" }, { type: "NEW_GAME" }] });
  }
  out.push({ name: "継承待ちなしでの ACK/CHOOSE", state: ORIG.Eo(),
             actions: [{ type: "ACK_KING_CHOICE" }, { type: "CHOOSE_HEIR", id: "x" }] });
  out.push({ name: "未知のアクション", state: ORIG.Eo(),
             actions: [{ type: "存在しないアクション" }, { type: "NEW_GAME" }] });
  return out;
}

async function main() {
  const target = process.argv[2];
  const NEW = target ? await import(target) : ORIG;
  console.log(`照合対象: ${target || "(元バンドル同士のセルフチェック)"}`);
  console.log(`局数: ${GAMES}\n`);

  const seen = {}, phases = {};
  let steps = 0, agreed = 0, noop = 0;
  const failed = [];

  for (let g = 0; g < GAMES; g++) {
    const { trace, finalPhase } = recordGame(1000 + g);
    phases[finalPhase] = (phases[finalPhase] || 0) + 1;
    for (const t of trace) {
      seen[t.action.type] = (seen[t.action.type] || 0) + 1;
      steps++;
      if (t.expect.ok && t.expect.out === snap(t.before)) noop++;
      const got = step(NEW, t.before, t.action, t.stepSeed);
      if (got.ok === t.expect.ok && got.out === t.expect.out) agreed++;
      else if (failed.length < 5)
        failed.push({ game: g, action: t.action, expect: t.expect, got, before: t.before });
    }
  }

  console.log(`到達フェーズ: ${JSON.stringify(phases)}`);
  console.log(`検証ステップ数: ${steps}（うち状態が変化しない guard: ${noop} / ${((noop / steps) * 100).toFixed(1)}%）`);

  // --- CPU(Fg) と アクション補完(Wg) の照合 ---
  let cpuSteps = 0, cpuOk = 0, encSteps = 0, encOk = 0;
  const cpuFail = [];
  
  if (NEW.Fg && NEW.Wg) {
    for (let g = 0; g < Math.min(GAMES, 200); g++) {
      const { trace } = recordGame(5000 + g);
      for (const t of trace) {
        for (const p of [0, 1]) {
          const sd = t.stepSeed ^ (p + 1);
          seedRandom(sd); const a = JSON.stringify(ORIG.Fg(t.before, p) ?? null);
          seedRandom(sd); const b = JSON.stringify(NEW.Fg(t.before, p) ?? null);
          restoreRandom();
          cpuSteps++;
          if (a === b) cpuOk++;
          else if (cpuFail.length < 3) cpuFail.push({ kind: "CPU", player: p, a, b });
        }
        seedRandom(t.stepSeed); const wa = JSON.stringify(ORIG.Wg(t.raw, t.before));
        seedRandom(t.stepSeed); const wb = JSON.stringify(NEW.Wg(t.raw, t.before));
        restoreRandom();
        encSteps++;
        if (wa === wb) encOk++;
        else if (cpuFail.length < 3) cpuFail.push({ kind: "補完", action: t.raw.type, a: wa, b: wb });
      }
    }
    console.log(`CPU思考の一致: ${cpuOk}/${cpuSteps}`);
    console.log(`アクション補完の一致: ${encOk}/${encSteps}`);
    for (const f of cpuFail) {
      console.log(`\n― ${f.kind} 不一致 ${f.action || "player" + f.player}`);
      console.log(`  元  : ${String(f.a).slice(0, 300)}`);
      console.log(`  復元: ${String(f.b).slice(0, 300)}`);
    }
  }

  const scen = scenarios();
  let sOk = 0; const sFail = [];
  for (const sc of scen) {
    let a = sc.state, b = sc.state, ok = true;
    sc.actions.forEach((ac, i) => {
      seen[ac.type] = (seen[ac.type] || 0) + 1;
      const ra = step(ORIG, a, ac, 31337 + i), rb = step(NEW, b, ac, 31337 + i);
      if (ra.out !== rb.out) ok = false;
      if (ra.ok) a = JSON.parse(ra.out);
      if (rb.ok) b = JSON.parse(rb.out);
    });
    ok ? sOk++ : sFail.push(sc.name);
  }

  const covered = ALL_ACTIONS.filter((a) => seen[a]);
  const missing = ALL_ACTIONS.filter((a) => !seen[a]);
  console.log(`アクション網羅: ${covered.length}/${ALL_ACTIONS.length}`);
  if (missing.length) console.log("  未実行: " + missing.join(", "));
  console.log(`\nステップ一致: ${agreed}/${steps}`);
  console.log(`シナリオ一致: ${sOk}/${scen.length}` + (sFail.length ? "  失敗: " + sFail.join(", ") : ""));

  if (failed.length || sFail.length || cpuFail.length) {
    for (const f of failed) {
      console.log(`\n― 不一致 局${f.game}  アクション: ${JSON.stringify(f.action).slice(0, 200)}`);
      if (!f.expect.ok || !f.got.ok) {
        console.log(`  元  : ${f.expect.out.slice(0, 200)}`);
        console.log(`  復元: ${f.got.out.slice(0, 200)}`);
      } else {
        const A = JSON.parse(f.expect.out), B = JSON.parse(f.got.out);
        for (const k of Object.keys(A)) {
          const x = JSON.stringify(A[k]), y = JSON.stringify(B[k]);
          if (x !== y) {
            console.log(`  差分 [${k}]`);
            console.log(`    元  : ${String(x).slice(0, 260)}`);
            console.log(`    復元: ${String(y).slice(0, 260)}`);
          }
        }
      }
    }
    process.exit(1);
  }
  console.log("\n完全一致。");
}
main();
