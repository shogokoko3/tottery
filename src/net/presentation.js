const PRESENTATION_ACTIONS = new Set(["CONFIRM_SHUFFLE", "MOVE_PIECE"]);

/**
 * 未受信の手を、盤面演出を始められる最初の手まで取り込む。
 * 王Aの2回などをまとめて畳み込むと、中間の盤面が描かれず演出が消える。
 * 選択や布陣などはまとめ、移動・入れ替えの直後だけ描画の区切りを作る。
 *
 * seen は呼び出し側が consumedIds だけ更新する。remaining は次回まで未受信
 * のまま残す。初回接続で履歴を復元する場合は split:false で一括適用できる。
 * この関数は入力の配列・アクション・受信済みIDを変更しない。
 */
export function takePresentationBatch(unseenActions, { split = true } = {}) {
  const barrier = split
    ? unseenActions.findIndex((action) => PRESENTATION_ACTIONS.has(action.type))
    : -1;
  const end = barrier < 0 ? unseenActions.length : barrier + 1;
  const actions = unseenActions.slice(0, end);
  return {
    actions,
    consumedIds: actions.map((action) => action.__id),
    remaining: unseenActions.slice(end),
  };
}
