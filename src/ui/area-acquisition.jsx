import { useEffect, useRef, useState } from "react";
import { AREA_INFO } from "../game/areas.js";
import { areaRewardName } from "../skins/area-rewards.js";
import { fieldUrl } from "./fields/backdrop.jsx";
import { FoilArtwork } from "./foil-artwork.jsx";
import { SkinModal } from "./skin-modal.jsx";
import styles from "./area-acquisition.css";

function AcquiredField({ reward, reduce }) {
  const [ready, setReady] = useState(reduce);
  const heading = useRef(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    // 画像が届かなくても説明と次へ進む操作は使える。
    const timer = setTimeout(() => setReady(true), 1800);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div
      className={`area-acquisition-scene field-${reward.theme}${ready ? " is-ready" : ""}${reduce ? " is-reduced" : ""}`}
      data-area-reward={reward.theme}
    >
      <header className="area-acquisition-heading">
        <span className="area-acquisition-eyebrow">FIELD ACQUIRED</span>
        <h2 ref={heading} tabIndex={-1}>
          効果盤面も獲得
        </h2>
        <p>箔の輝きが、新たな盤面を呼び覚ます。</p>
      </header>
      <div className="area-acquisition-stage">
        <div className="area-acquisition-orbit" aria-hidden="true" />
        <div className="area-acquisition-motes" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <i key={i} style={{ "--i": i }} />
          ))}
        </div>
        <div className="area-acquisition-frame">
          <img
            src={fieldUrl(reward.theme)}
            alt={`${areaRewardName(reward)}の効果盤面`}
            onLoad={() => setReady(true)}
            onError={() => setReady(true)}
          />
          <div className="area-acquisition-grid" aria-hidden="true" />
          <div className="area-acquisition-light" aria-hidden="true" />
          <div className="area-acquisition-name">{areaRewardName(reward)}</div>
        </div>
        <div className="area-acquisition-source">
          <FoilArtwork
            skin={reward.skins[0]}
            animated={!reduce}
            alt={reward.skins[0].name}
          />
          <span>
            <b>FOIL</b>
            <small>この輝きに宿る盤面</small>
          </span>
        </div>
      </div>
      <div className="area-acquisition-info">
        <p>{AREA_INFO[reward.type].text}</p>
        <div className="area-acquisition-ranks">
          {reward.skins.map((skin) => (
            <span key={skin.id}>
              {skin.rank} <small>{skin.name.replace("（フォイル）", "")}</small>
            </span>
          ))}
        </div>
        <p className="area-acquisition-condition">
          <b>このフォイルを装備した札を王にすると、9×9で発動。</b>
        </p>
      </div>
    </div>
  );
}

export function AreaAcquisition({ rewards, reduce = false, onFinish }) {
  const [index, setIndex] = useState(0);
  const scroll = useRef(null);
  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = 0;
  }, [index]);
  const last = index === rewards.length - 1;
  return (
    <SkinModal
      label="効果盤面の獲得"
      onClose={onFinish}
      className="area-acquisition-overlay"
    >
      <style>{styles}</style>
      <div className="area-acquisition-scroll" ref={scroll}>
        <AcquiredField
          key={rewards[index].theme}
          reward={rewards[index]}
          reduce={reduce}
        />
      </div>
      <footer className="area-acquisition-footer">
        {rewards.length > 1 && (
          <span>
            {index + 1} / {rewards.length} 盤面
          </span>
        )}
        <button
          className="skin-btn skin-btn-gold"
          onClick={last ? onFinish : () => setIndex((i) => i + 1)}
        >
          {last ? "獲得結果へ →" : "次の効果盤面へ →"}
        </button>
      </footer>
    </SkinModal>
  );
}
