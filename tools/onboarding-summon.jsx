export { FirstSummonLobby } from "../src/ui/first-summon.jsx";
import { useEffect, useRef } from "react";
import { byId } from "../src/skins/catalog.js";
import { SummonRevealPresentation } from "../src/ui/skins.jsx";
import { useReducedMotion } from "../src/ui/skin-modal.jsx";
import { PREVIEW_DRAW } from "./onboarding-preview-model.js";
import { SummonResultCard } from "../src/ui/summon-results.jsx";
import { CardFace } from "../src/ui/cards.jsx";
import { autoEquip } from "../src/skins/auto-equip.js";
import { summonAssetUrls } from "../src/skins/summon-preload.js";
import css from "./onboarding-summon.css";

const RESULTS = PREVIEW_DRAW.map((id, index) => ({ id, isNew: PREVIEW_DRAW.indexOf(id) === index }));
const OWNED = RESULTS.reduce((owned, {id}) => ({ ...owned, [id]: (owned[id] || 0) + 1 }), {});
export const previewEquipment = () => autoEquip({ owned: OWNED, equipped: {} }, { prefer: PREVIEW_DRAW }).equipped;
const GATE_WORLD = "first-victory";


function PreviewSummonFrame({ label, onClose, className, children }) {
  const dialog = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.focus({ preventScroll: true });
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  return <div className={`skin-overlay os-legend-frame ${className}`}><section ref={dialog} className="skin-dialog" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} onKeyDown={event => {
    if (event.key === "Escape") { event.preventDefault(); onClose(); }
    if (event.key !== "Tab") return;
    const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled),[tabindex="0"]')].filter(el => !el.closest('[inert]'));
    const first = controls[0], last = controls.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus(); }
  }}>{children}</section></div>;
}

export function FirstSummon({ onComplete }) {
  const reduce = useReducedMotion();
  return <div className="os-legend-summon"><style>{css}</style><div className="os-summon-preparing" role="status"><img src={summonAssetUrls(GATE_WORLD)[0]} alt="" /><p>門を準備しています。<br />演出を飛ばして、札をめくることもできます。</p></div><SummonRevealPresentation results={RESULTS} ownedNow={OWNED} Modal={PreviewSummonFrame} plain gateWorld={GATE_WORLD} reduce={reduce} onFinish={onComplete} /></div>;
}

export function FirstSummonResults({ chosen, setChosen, equipped, setEquipped, onDone }) {
  const companion = byId(chosen || "pirate-female");
  const isEquipped = equipped[companion.rank] === companion.id;
  const available = ["2", "3", "4", "5"].includes(companion.rank);
  const collection = { owned: OWNED, equipped };
  return <div className="os-legend-results skins-results-overlay"><style>{css}</style>
    <div className="skin-modal-head"><div><span className="skins-eyebrow">SUMMON COMPLETE</span><h2>新たな出会い</h2><p className="skins-first-pull-note">出会った英雄を、あなたの盤へ。</p></div></div>
    <p className="skins-first-pull-note">数字ごとに自動で装備しました。札の見た目が変わり、動きや強さは変わりません。</p>
    <p className="skins-note">次の対局では2〜5の札を使います。ほかの数字の英雄は、後の対局で使えます。</p>
    <div className="skins-first-companion"><CardFace rank={companion.rank} suit="spade" size="lg" skinId={companion.id} animated={false} /><div><small>盤上では、この姿に</small><strong>{companion.name}</strong><p role="status">{isEquipped ? available ? `${companion.rank}の札に装備中です。次の対局でも使えます。` : `${companion.rank}の札に装備中です。この数字が登場する対局で使えます。` : `${companion.rank}の札に装備すると、見た目がこの姿に変わります。`}</p></div></div>
    <div className="skins-results-grid">{RESULTS.map((result, index) => <SummonResultCard key={index} skin={byId(result.id)} result={result} index={index} collection={collection} firstResults shine onEquip={skin => { setEquipped(previous => ({ ...previous, [skin.rank]: skin.id })); setChosen(skin.id); }} />)}</div>
    <div className="skins-result-actions"><button className="skin-btn skin-btn-gold skins-result-done" onClick={onDone}>ホームへ進む</button></div>
  </div>;
}
