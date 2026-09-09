/**
 * 盤面エリアの説明(プレイヤー向け)。ルール画面(guides.jsx)の3つ目のタブと、
 * 対局中のエリアの札の「?」から開く。
 *
 * 決まりの正本は src/game/areas.js と 盤面エリア.md。ここは読み物なので、
 * 体数・手番数・看破率は AREA_TUNING から引き、文は人が読む形に直してある。
 * 効果を差し替えたら、この表も直すこと(tools/check-area-guide.mjs が見張る)。
 */
import { AREA_INFO } from "../game/areas.js";
import { AREA_GUIDE_ROWS } from "./area-guide-rows.js";
import { AreaPreview } from "./area-preview.jsx";

export function AreaGuide() {
  return (
    <div className="area-guide">
      <p className="hint area-guide-lead">
        <b>フォイルを装備した札を王にすると、9×9で使えます。</b>
        通常のスキンでは立ちません。
      </p>
      <p className="hint area-guide-lead">
        <b>自分の手番の初めに1回。発動後も移動できます。</b>
        「任意発動」は、使いたい手番だけ「発動」を押します。
      </p>
      <div className="area-guide-list">
        {AREA_GUIDE_ROWS.map((row) => (
          <div
            className={`area-guide-row area-guide-${row.type}`}
            key={row.type}
          >
            <div className="area-guide-head">
              <span className={`area-chip area-chip-${row.type}`}>
                {AREA_INFO[row.type].name}
              </span>
              <span className="area-guide-ranks">王が {row.ranks}</span>
            </div>
            <AreaPreview type={row.type} className="area-guide-preview" />
            <div className="area-guide-when">{row.when}</div>
            <div className="area-guide-effect">{row.summary}</div>
            <details className="area-guide-details">
              <summary>詳しいルール</summary>
              <div className="area-guide-effect">{row.effect}</div>
              <div className="area-guide-seen">{row.seen}</div>
            </details>
          </div>
        ))}
      </div>
      <details className="area-guide-details area-guide-common">
        <summary>入手方法・共通ルール</summary>
        <p className="hint rule-foot">
          昇格・変身は盤面上だけの効果です。撃破されると元の数字の捨て札になります。
          予備札がなくなると、両者の引き直し・撃破による捨て札をシャッフルして補充します。
          凍結中の駒を昇格・変身させても、凍結の残り期間は引き継ぎます。
        </p>
        <p className="hint rule-foot">
          エリアの種類は対局開始時の王と装備で決まり、その試合中は変わりません。
          両者がエリアを持つ場合、背景は手番側のエリアに切り替わります。
        </p>
        <p className="hint rule-foot">
          <b>印の読み方：</b>「見抜」は自分だけが正体を知っている相手の駒。❄
          は凍っている駒。
          「空」「宮」は変身・昇格で正体が変わった駒で、こちらは相手にも見えています。
        </p>
        <p className="hint rule-foot">
          <b>手に入れ方：</b>
          ガチャ・錬成でのフォイル獲得、または同じキャラの通算100回入手による
          フォイル加工で手に入ります。入手方法による効果の違いはありません。
          手に入れたフォイルを対応するランクに装備し、その札を王にすると使えます
          （たとえば土なら2か3のフォイル）。効果はスキン画面の詳細でも確認できます。
        </p>
        <p className="hint rule-foot">
          <b>オンラインでは</b>
          、二人のルール版が一致し、どちらも盤面エリアに対応しているときに使えます。
          ルール版が違う場合は、エリアなしで対戦します。開始済みの対局は開始時のルールで続きます。
        </p>
        <p className="hint rule-foot">
          盤面エリアはチュートリアル第13話でも体験できます。
        </p>
      </details>
    </div>
  );
}
