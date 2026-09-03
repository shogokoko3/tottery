/**
 * どの場面でどの曲を鳴らすか。
 *
 * ここには音を鳴らす仕掛けを置かない。「いまはどの曲か」を決めるだけの
 * 純粋な対応表にしてあるので、画面を開かずに node で確かめられる。
 *
 * 曲そのものは assets/audio/ に置き、ビルドが dist/audio/ へ写す。
 * カード画像と違って data URI では埋め込まない。7曲ぶんを埋めると
 * index.html が数MB 太り、1曲も鳴らないうちに全部が落ちてくることになる。
 */

/** 曲の置き場所。index.html から見た相対 URL */
export const AUDIO_DIR = "audio/";

/**
 * 使う曲。
 *
 * gain は曲ごとの音量差をならす倍率。差し替えた曲が大きすぎ・小さすぎたら、
 * 音源を作り直さずにここだけ直せばよい。
 * loop が false の曲は鳴り終わったら無音になる(勝敗のジングル)。
 */
export const TRACKS = {
  /** タイトル・相手の選択・ルール設定 */
  title: { file: "title.m4a", loop: true, gain: 0.85 },
  /** 相手を待っているあいだ(ランダムマッチ・合言葉ルーム) */
  waiting: { file: "waiting.m4a", loop: true, gain: 0.6 },
  /** 開始からサイコロ・引き直し・布陣まで */
  setup: { file: "setup.m4a", loop: true, gain: 0.8 },
  /** 対局本編。いちばん長く鳴る */
  battle: { file: "battle.m4a", loop: true, gain: 0.75 },
  /** 終盤。battle と同じ調で、濃い版 */
  endgame: { file: "endgame.m4a", loop: true, gain: 0.85 },
  /** 決着(勝ち)。ループしない */
  win: { file: "win.m4a", loop: false, gain: 1 },
  /** 決着(負け)。ループしない */
  lose: { file: "lose.m4a", loop: false, gain: 1 },
};

/** チュートリアル中の音量の倍率。考える邪魔をしないよう一段下げる */
export const TUTORIAL_VOLUME = 0.55;

/** 終盤に切り替わる持ち時間(ミリ秒)。どちらかがこれを切ったら曲が変わる */
export const ENDGAME_CLOCK_MS = 60 * 1000;

/** 終盤に切り替わる駒の残り具合。盤の駒がこの割合を下回ったら曲が変わる */
export const ENDGAME_ALIVE_RATIO = 0.4;

/**
 * 終盤かどうか。
 *
 * **公開されている情報だけで決める。** 王が誰かを音で悟らせてはいけない。
 * 「王が危ない」で曲を変えると、伏せてある王の正体を相手に教えてしまう。
 * 見るのは持ち時間と、盤に残っている駒の数だけにしてある。
 * どちらも両者が画面で見えているものなので、音にしても何も漏れない。
 */
export function isEndgame(state, clocks) {
  const cs = clocks || (state && state.clocks) || [];
  for (const ms of cs) if (typeof ms === "number" && ms <= ENDGAME_CLOCK_MS) return true;

  const pieces = state && state.pieces ? Object.values(state.pieces) : [];
  if (pieces.length === 0) return false;
  const alive = pieces.filter((p) => p.alive).length;
  return alive / pieces.length < ENDGAME_ALIVE_RATIO;
}

/**
 * いまの場面で鳴らす曲。鳴らさないときは null。
 *
 * scene は次の形:
 *   screen  画面(home / matching / tutorial / rules / online / room / game)
 *   phase   対局中の進み具合(intro / dice / mulligan / setup / play / gameover)
 *   endgame 終盤かどうか
 *   result  決着したときだけ "win" か "lose"
 */
export function trackForScene(scene) {
  if (!scene) return null;
  const { screen, phase } = scene;

  if (screen !== "game") {
    // 相手を待っているあいだは、数分続いても飽きない薄い曲にする
    if (screen === "online" || screen === "room") return "waiting";
    return "title";
  }

  if (phase === "gameover") return scene.result === "lose" ? "lose" : "win";
  if (phase === "play") return scene.endgame ? "endgame" : "battle";
  // intro / dice / mulligan / setup。対局が始まるまでは1曲で通す
  return "setup";
}
