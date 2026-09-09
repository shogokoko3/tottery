/**
 * 盤面エリアの説明(プレイヤー向け)。ルール画面(guides.jsx)の3つ目のタブと、
 * 対局中のエリアの札の「?」から開く。
 *
 * 決まりの正本は src/game/areas.js と 盤面エリア.md。ここは読み物なので、
 * 数字(2体・3手番・50%)は AREA_TUNING から引き、文は人が読む形に直してある。
 * 効果を差し替えたら、この表も直すこと(tools/check-area-guide.mjs が見張る)。
 */
import { AREA_INFO, AREA_TUNING } from "../game/areas.js";

/** 表に出す6行。順番は王のランクの順 */
export const AREA_GUIDE_ROWS = [
  {
    type: "earth",
    ranks: "2・3",
    when: "自分の手番の初めに自動",
    effect: `直前に動いた相手の駒の足跡を読み、${Math.round(AREA_TUNING.earthOdds * 100)}%で正体を見抜きます。見抜いた駒は自分にだけ表向きになります。`,
    seen: "相手には、当たったか外れたかだけが分かります",
  },
  {
    type: "sea",
    ranks: "4・5",
    when: "自分の手番の初めに自動",
    effect:
      "盤上の全ての駒を、中央に向かって最大1マスずつ引き寄せます。行き先が埋まっている駒はその場に残ります。取りは起きません。",
    seen: "相手にも駒の動きがそのまま見えます",
  },
  {
    type: "forest",
    ranks: "6・7",
    when: "自分の手番の初めに自動",
    effect: `相手の王以外で、まだ正体を知らない駒からランダムに${AREA_TUNING.forestReveals}体を見抜きます。見抜いた駒は自分にだけ表向きになります。`,
    seen: "相手には「見抜かれた」ことだけが分かり、どの駒かは分かりません",
  },
  {
    type: "ice",
    ranks: "8・9",
    when: "自分の手番の初めに自動",
    effect: `相手の王以外からランダムに${AREA_TUNING.iceTargets}体を凍らせます。凍った駒は相手の${AREA_TUNING.freezeTurns}手番のあいだ動けません。すでに凍っている駒が選ばれると、${AREA_TUNING.freezeTurns}手番ぶん延びます。凍った駒は取られます。Aの入れ替えに使うと氷は解けますが、凍ったA自身は入れ替えを使えません。`,
    seen: "凍った駒は青白くなり ❄ が付きます。凍って何も指せなければ、その側の負けです",
  },
  {
    type: "sky",
    ranks: "10",
    when: "自分の手番の初めに「発動」を押して駒を選ぶ",
    effect:
      "自分の駒1体(王と10以外)を本物の10に変身させます。変身した駒は表向きになり「空」の印が付きます。以後、自分の10は全て1手番に2回動けます。",
    seen: "相手にも変身した駒と正体が見えます",
  },
  {
    type: "palace",
    ranks: "J・Q・K",
    when: "自分の手番の初めに「発動」を押して駒を選ぶ",
    effect:
      "自分の駒1体(王・A以外)を1段階昇格させます(2→3 … 9→10→J→Q→K)。1試合に1回だけ、2段階昇格も選べます(9→J、10→Q、J→Kなど)。Kより上には進めません。昇格した駒は表向きになり「宮」の印が付きます。昇格したあと、その手番で普通に駒を動かせます。",
    seen: "相手にも昇格した駒と正体が見えます",
  },
];

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
