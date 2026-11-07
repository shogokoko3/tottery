import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { transform } from "esbuild";
import { initialState, reducer, setupLimitMs, KING_LIMIT_MS } from "../src/game/reducer.js";
import { territoryRows } from "../src/game/board.js";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

// 実際の画面の時計と effect を仮想時刻で動かし、画面を往復する。
const game = read("src/ui/game.jsx");
const clockSource = game.slice(game.indexOf("  let handoff ="), game.indexOf("  // 同時配置では両者"));
assert.ok(clockSource.includes("setupRemaining"));
const clockScript = new vm.Script(`(() => { ${clockSource}; return setupRemaining; })()`);
function clock(size, { network = {}, cpu = false, seat = 0 } = {}) {
  let now = 1000, hook = 0;
  const deps = [], pending = [], actions = [];
  const context = vm.createContext({
    a: { ...initialState(), phase: "setup", boardSize: size },
    network, cpu, p: seat, noLimit: false, nowMs: now,
    setupStartRef: { current: null },
    setupElapsedRef: { current: [{ place: 0, king: 0 }, { place: 0, king: 0 }] },
    Date: { now: () => now }, setupLimitMs, KING_LIMIT_MS,
    setNowMs: (value) => { context.nowMs = value; },
    useEffect: (effect, next) => {
      const index = hook++;
      if (!deps[index] || next.some((value, i) => !Object.is(value, deps[index][i]))) {
        deps[index] = next;
        pending.push(effect);
      }
    },
    y: (action) => actions.push(action),
    autoArrangeAction: () => ({ type: "SETUP_AUTO_ARRANGE" }),
    autoPickKing: () => "fallback-king",
  });
  return {
    context, actions,
    render(ms = 0, step = context.a.setupSteps[seat]) {
      now += ms;
      context.nowMs = now;
      context.a.setupSteps[seat] = step;
      // effect が時計を切り替えたあとの描画まで進める。
      for (let pass = 0; pass < 2; pass++) {
        hook = 0;
        const remaining = clockScript.runInContext(context);
        const effects = pending.splice(0);
        for (const effect of effects) effect();
        if (pass === 1) return remaining;
      }
    },
  };
}
for (const size of [5, 9]) {
  for (const seat of [0, 1]) {
    const c = clock(size, { seat });
    const limit = setupLimitMs(size);
    assert.equal(c.render(), limit);
    assert.equal(c.render(20000), limit - 20000);
    assert.equal(c.render(0, "king"), KING_LIMIT_MS);
    assert.equal(c.render(4000), KING_LIMIT_MS - 4000);
    assert.equal(c.render(0, "place"), limit - 20000, "配置に戻っても時間が増えない");
    assert.equal(c.render(3000), limit - 23000);
    assert.equal(c.render(0, "king"), KING_LIMIT_MS - 4000, "王選びの時間も増えない");
    assert.equal(c.render(2000), KING_LIMIT_MS - 6000);
    assert.equal(c.render(0, "place"), limit - 23000);
    c.render(limit - 23000);
    assert.ok(c.actions.some((a) => a.type === "SETUP_GOTO_KING_STEP"), "配置の残り時間が切れると自動で進む");
    assert.equal(c.render(0, "king"), KING_LIMIT_MS - 6000);
    c.render(KING_LIMIT_MS - 6000);
    assert.equal(c.actions.at(-1).kingId, "fallback-king", "未選択でも時間切れなら王を自動で決める");
    c.context.a.phase = "play";
    assert.equal(c.render(), null);
    c.context.a.phase = "setup";
    assert.equal(c.render(0, "place"), limit, "次の対局では時間を初期化する");
  }
}
for (const options of [{ network: null, cpu: true }, { network: null }]) {
  const c = clock(5, options);
  c.render();
  c.render(12000);
  c.render(0, "king");
  assert.equal(c.render(1000, "place"), 48000, "CPU戦・同じ端末でも残りを保持する");
  if (!options.cpu) {
    c.context.a.interstitial = true;
    c.render();
    c.render(10000);
    c.context.a.interstitial = false;
    assert.equal(c.render(), 48000, "受け渡し中は時計を止める");
  }
  c.context.noLimit = true;
  assert.equal(c.render(100000), null, "時間無制限では自動確定しない");
}

// KingStep の実際のクリック処理と確定ボタンを、描画ツリーから操作する。
const setup = read("src/ui/setup.jsx");
const kingSource = setup.slice(setup.indexOf("export function KingStep("), setup.indexOf("/**\n * Kの予備札"));
const { code } = await transform(kingSource.replace("export function", "function"), { loader: "jsx", jsxFactory: "element" });
const ui = vm.createContext({
  element: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
  useNames: () => null, useState: (initial) => [initial, () => {}],
  findHandCard: (player, id) => player.hand.find((card) => card.id === id),
  territoryRows, kingPowerBoard: () => null, kingPowersOn: () => false,
  PLAYER_META: [{ color: "blue" }, { color: "red" }], nameOf: () => "Player",
  ...Object.fromEntries(["SetupOrderNote", "SetupTimer", "Phrases", "CardFace", "CardBack", "KingPowerCard", "ArrowLeft", "Crown"].map((name) => [name, name])),
});
const KingStep = vm.runInContext(`${code}; KingStep`, ui);
const nodes = (node) => node && typeof node === "object" ? [node, ...node.children.flatMap(nodes)] : [];
for (const rank of ["K", "8"]) {
  let state = { ...initialState(), phase: "setup", setupMode: "simultaneous" };
  state.players[0].hand = [rank, "2", "3", "4", "5"].map((rank, i) => ({ id: `card-${i}`, rank, suit: "spade" }));
  state.setupPlacements[0] = Object.fromEntries(state.players[0].hand.map((card, i) => [card.id, { row: 4, col: i }]));
  state.setupSteps[0] = "king";
  const render = () => nodes(KingStep({ state, player: state.players[0], pIdx: 0, size: 5, dispatch: (a) => { state = reducer(state, a); } }));
  const click = (rank) => render().find((node) => node.props.className?.startsWith("mini-cell ") && nodes(node).some((n) => n.type === "CardFace" && n.props.rank === rank)).props.onClick();
  click(rank);
  assert.equal(state.setupPickKings[0], "card-0");
  click(rank);
  assert.equal(state.setupPickKings[0], null, `${rank}を再タップで解除`);
  assert.equal(render().find((node) => node.type === "button" && node.props.className === "btn btn-primary").props.disabled, true);
  assert.equal(reducer(state, { type: "SETUP_CONFIRM", player: 0 }), state, "王が未選択なら確定できない");
  click(rank);
  assert.equal(state.setupPickKings[0], "card-0", "解除後に選び直せる");
  click("2");
  assert.equal(state.setupPickKings[0], rank === "K" ? "card-0" : "card-1", "Kを置いた場合の王の制約と通常の選び直し");
  state.setupDone[0] = true;
  assert.equal(reducer(state, { type: "SETUP_PICK_KING", player: 0, cardId: null }), state, "確定後の王は解除しない");
}
// 「公開する駒を自分で選ぶ」で公開を選んでいる間も、王の駒をタップすれば王を外し、王を選ぶ段へ戻る
{
  const slots = [];
  let slot = 0;
  ui.useState = (initial) => {
    const i = slot++;
    if (!(i in slots)) slots[i] = initial;
    return [slots[i], (v) => { slots[i] = typeof v === "function" ? v(slots[i]) : v; }];
  };
  let state = { ...initialState(), phase: "setup", setupMode: "simultaneous", custom: { ranks: ["8", "2", "3", "4", "5"], areas: "both", reveal: { count: 2, king: false, choose: true } } };
  state.players[0].hand = ["8", "2", "3", "4", "5"].map((rank, i) => ({ id: `card-${i}`, rank, suit: "spade" }));
  state.setupPlacements[0] = Object.fromEntries(state.players[0].hand.map((card, i) => [card.id, { row: 4, col: i }]));
  state.setupSteps[0] = "king";
  const render = () => { slot = 0; return nodes(KingStep({ state, player: state.players[0], pIdx: 0, size: 5, dispatch: (a) => { state = reducer(state, a); } })); };
  const click = (rank) => render().find((node) => node.props.className?.startsWith("mini-cell ") && nodes(node).some((n) => n.type === "CardFace" && n.props.rank === rank)).props.onClick();
  const button = (text) => render().find((node) => node.type === "button" && node.children.some((n) => typeof n === "string" && n.includes(text)));
  click("8");
  button("公開する駒を選ぶ").props.onClick();
  assert.ok(button("王を選び直す"), "公開を選ぶ段に入る");
  const kingCell = render().find((node) => node.props.className?.startsWith("mini-piece ") && nodes(node).some((n) => n.type === "CardFace" && n.props.rank === "8"));
  assert.ok(!kingCell.props.className.includes("mini-piece-disabled"), "公開を選ぶ間も王の駒は押せる見た目");
  click("2");
  click("8");
  assert.equal(state.setupPickKings[0], null, "公開を選ぶ間に王をタップで解除");
  assert.ok(button("公開する駒を選ぶ"), "王を選ぶ段へ戻る");
  click("3");
  assert.equal(state.setupPickKings[0], "card-2", "解除後に別の駒を王に選べる");
}
console.log("布陣の往復: 5×5・9×9／両席／CPU／受け渡し／時間切れ／再対局、王の再タップ解除(公開を選ぶ間も) OK");
