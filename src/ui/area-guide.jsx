/**
 * 盤面エリアの説明(プレイヤー向け)。ルール画面(guides.jsx)の3つ目のタブと、
 * 対局中のエリアの札の「?」から開く。
 *
 * 決まりの正本は src/game/areas.js と 盤面エリア.md。ここは読み物なので、
 * 数字(2体・3手番・50%)は AREA_TUNING から引き、文は人が読む形に直してある。
 * 効果を差し替えたら、この表も直すこと(tools/check-area-guide.mjs が見張る)。
 */
import { AREA_INFO } from "../game/areas.js";
import { AREA_GUIDE_ROWS } from "./area-guide-rows.js";
import { AreaPreview } from "./area-preview.jsx";

export function AreaGuide() {
  return (
    <div className="area-guide">
      <p className="hint area-guide-lead">
        <b>9×9 の対局だけ</b>のしくみです。ガチャで引ける
        <b>フォイル加工のスキン</b>を
        王に選んだ札のランクに装備していると、そのランク帯の「エリア」が自陣に立ちます
        （通常のスキンでは立ちません）。エリアは自分にも相手にも見え、
        <b>毎回の自分の手番に1回</b>効果が出ます。5×5
        とチュートリアルにはありません。
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
            <div className="area-guide-effect">{row.effect}</div>
            <div className="area-guide-seen">{row.seen}</div>
          </div>
        ))}
      </div>
      <p className="hint rule-foot">
        昇格・変身は盤面上だけの効果です。撃破されると元の数字の捨て札になります。
        予備札がなくなると、両者の引き直し・撃破による捨て札をシャッフルして補充します。
      </p>
      <p className="hint rule-foot">
        <b>印の読み方：</b>「見抜」は自分だけが正体を知っている相手の駒。❄
        は凍っている駒。
        「空」「宮」は変身・昇格で正体が変わった駒で、こちらは相手にも見えています。
      </p>
      <p className="hint rule-foot">
        <b>手に入れ方：</b>ガチャで、その帯のどちらかのランクのフォイルを引く
        （たとえば土なら 2 か 3
        のフォイル）。引いたフォイルをそのランクに装備し、
        その札を王にすると発動します。効果の中身は、スキン画面でそのフォイルを
        開くと確かめられます。
      </p>
      <p className="hint rule-foot">
        <b>オンラインでは</b>
        、二人とも新しい版のアプリのときだけエリアが立ちます。
        どちらかが古いままの部屋は、エリア無しの従来ルールで進みます。
      </p>
    </div>
  );
}
