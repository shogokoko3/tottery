/**
 * プレイヤーの「自動配置」(2026-10-25 本人の指示「今までの AI に覚えさせてきた戦略をベースに自動配置する」)。
 *
 * 前の自動配置は、札もマスも乱数で並べていた(reducer.js autoArrange)。AI テストプレイで王が前列の中央に出て、
 * 初手で王を取られた局があった(5人中4人)。ここでは CPU が自分の布陣に使っている手順をそのまま使う:
 *   1. 採用する札と王を選ぶ(cpu-strategy.js chooseArmyPlan。札の値打ちと採用上限)
 *   2. 王を後列の中央に置き、取り返しの関係がいちばん厚くなるよう並べ替える(arrangeArmy。formationMetrics の局所探索)
 *   3. 5×5 は、相手の自陣のどのマスにどの数字が居ても初手で王に届かない形へ寄せる(cpu-joseki.js shieldKing)
 *   4. シーズン2(アリス)の採用の決まりに合わせる(cpu-alice.js aliceSetupFix)
 * 相手の伏せ札は読まない(CPU と同じ。自分の手札と盤の大きさだけを見る)。
 *
 * 画面がこの結果を SETUP_AUTO_ARRANGE に載せ、reducer は placementOk で確かめてから使う
 * (reducer から CPU のモジュールを読むと、cpu.js を経て reducer.js へ戻る輪ができるため)。
 * 自動配置は通信に載らない手(sync.js LOCAL_ONLY_ACTIONS)なので、オンラインの相手とずれることはない。
 */
import { armySlots } from "./board.js";
import { chooseArmyPlan, arrangeArmy } from "./cpu-strategy.js";
import { shieldKing } from "./cpu-joseki.js";
import { aliceSetupFix } from "./cpu-alice.js";
import { hasAliceRules } from "./alice-rules.js";

/** その席のおすすめの陣 { placement, kingId }。作れなければ null(呼ぶ側は従来の自動配置に戻す) */
export function strategicSetup(state, player) {
  if (!state || state.phase !== "setup" || !state.players?.[player]?.hand?.length) return null;
  const slots = armySlots(state);
  const tryPlan = (rank) => {
    const plan = chooseArmyPlan(state, player, rank);
    if (!plan) return null;
    let placement = arrangeArmy(state, player, plan);
    if (state.boardSize === 5) placement = shieldKing(state, player, plan, placement);
    placement = aliceSetupFix(state, player, plan.kingId, placement);
    return Object.keys(placement).length === slots ? { placement, kingId: plan.kingId } : null;
  };
  let chosen = tryPlan(null);
  if (!chosen && hasAliceRules(state)) {
    const ranks = [...new Set(state.players[player].hand.map((c) => c.rank))].filter((r) => r !== "A");
    for (const rank of ranks) if ((chosen = tryPlan(rank))) break;
  }
  return chosen;
}

/**
 * 自動配置の手。おすすめの陣が作れたら placement と kingId を載せる。作れなければ従来どおり(乱数で埋める)。
 * keep(時間切れで残りを埋める)は、すでに置いた札が無いときだけおすすめの陣にする(置いた札は動かさない)
 */
export function autoArrangeAction(state, player, { keep = false } = {}) {
  const placed = Object.keys(state?.setupPlacements?.[player] || {}).length;
  const plan = !keep || placed === 0 ? strategicSetup(state, player) : null;
  return plan
    ? { type: "SETUP_AUTO_ARRANGE", player, placement: plan.placement, kingId: plan.kingId }
    : { type: "SETUP_AUTO_ARRANGE", player, ...(keep ? { keep: true } : null) };
}
