// 札を開く前に、盤面の移動が終わるまで待てるよう同じ時間を使う。
export function movePresentationMs(move) {
  if (!move?.from || !move?.to) return 0;
  const dr = Math.abs(move.from.row - move.to.row);
  const dc = Math.abs(move.from.col - move.to.col);
  const knight = (dr === 1 && dc === 2) || (dr === 2 && dc === 1);
  const steps = knight ? 1 : Math.max(dr, dc);
  return steps ? (steps + 1) * 190 : 0;
}

/**
 * 取る手のルールは即座に確定するが、正体は撃破札を確認するまで公開しない。
 * 移動先・生死は新しい盤面を使い、公開情報だけを取る前の状態から描く。
 */
export function captureDisplayState(state, before) {
  if (!state.captureReveal) return state;
  const prior = before?.captureReveal === state.captureReveal ? null : before;
  const newlyShown =
    state.lastReveal?.reason === "王を討った" ? state.lastReveal.id : null;
  const pieces = Object.fromEntries(
    Object.entries(state.pieces).map(([id, piece]) => {
      const old = prior?.pieces?.[id];
      return [
        id,
        {
          ...piece,
          revealed: old
            ? !!old.revealed
            : id === newlyShown
              ? false
              : piece.revealed,
          isKing: old ? !!old.isKing : piece.isKing,
          history: old?.history || [],
        },
      ];
    }),
  );
  return {
    ...state,
    phase: "play",
    winner: null,
    pendingKingChoice: null,
    lastReveal: null,
    pieces,
    board: state.board.map((row) =>
      row.map((piece) => (piece ? pieces[piece.id] : null)),
    ),
    players: state.players.map((player, i) => ({
      ...player,
      capturedOwn: prior?.players?.[i]?.capturedOwn || [],
      kingId: prior?.players?.[i]?.kingId ?? null,
    })),
    currentTurn:
      prior?.currentTurn ?? state.captureReveal.capturedBy ?? state.currentTurn,
    log: prior?.log || [],
  };
}
