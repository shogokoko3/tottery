import { SUMMON_WORLDS } from "../skins/summon-plan.js";
import { summonAssetUrls } from "../skins/summon-preload.js";
import { unlockAudio } from "../audio/index.js";
import styles from "./first-summon.css";
import { L } from "../i18n/index.js";

const GATE_WORLD = "first-victory";

export function FirstSummonLobby({ name, onStart }) {
  return <section className="os-lobby os-legend-lobby">
    <style>{styles}</style>
    <img className="os-legend-exterior" src={summonAssetUrls(GATE_WORLD)[0]} alt={SUMMON_WORLDS[GATE_WORLD].name} />
    <div className="os-legend-vignette" />
    <header><div className="os-overline">{L("初勝利の贈り物 · レジェンド・ゲート")}</div><h1>{L("その勝利が、")}<br />{L("新たな縁を呼ぶ。")}</h1><p>{L("{name}の旅に、10人の英雄を。", { name })}</p></header>
    <div className="os-legend-place"><span>{L("運命の一枚を、この手に。")}</span><b>{SUMMON_WORLDS[GATE_WORLD].name}</b></div>
    <div className="os-lobby-bottom"><div className="os-guarantee"><span>✦</span><b>{L("SSR以上 1体確定")}</b><span>✦</span></div>
      <button className="os-gold-button" onClick={() => { unlockAudio(); onStart(); }}><small>{L("初回限定 · チケット消費なし")}</small><strong>{L("無料10連を引く")} <span>→</span></strong></button>
      <p>{L("英雄は札に装備して、対局に連れていけます。")}</p>
    </div>
  </section>;
}
