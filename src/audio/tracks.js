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
 * 配信用のファイル名。
 *
 * ビルド(build.mjs)が曲の中身からハッシュを取り、`title.a1b2c3d4.m4a` の
 * ように名前に埋めて dist/audio/ へ写す。名前が中身で決まるので、
 * 配信側は1年キャッシュしてよく、曲を差し替えたときだけ新しい名前で落ちてくる。
 *
 * この対応表はビルドが `__AUDIO_FILES__` として埋め込む。node から
 * 直接読むとき(tools/check-bgm.mjs)は無いので、その場合は素の名前を返す。
 */
const HASHED_FILES =
  typeof __AUDIO_FILES__ !== "undefined" ? __AUDIO_FILES__ : {};

/** TRACKS / SOUNDS の file を、実際に取りに行く URL にする */
export function audioUrl(file) {
  return AUDIO_DIR + (HASHED_FILES[file] || file);
}

/**
 * 使う曲。
 *
 * 音源は tools/prepare-bgm.mjs が同じ音量(-20dBFS)に揃えてあるので、
 * gain は「その場面をどれだけ静かにしたいか」だけを表す。
 * 出どころの違う曲を足して大きさが合わないときは、音源を作り直すより
 * まずここを直すほうが早い。
 * loop が false の曲は鳴り終わったら無音になる(勝敗のジングル)。
 */
export const TRACKS = {
  /** タイトル・相手の選択・ルール設定 —— 古の碑石 / 甘茶の音楽工房 */
  title: { file: "title.m4a", loop: true, gain: 0.9 },
  /** 相手を待つあいだ —— ジェーン・グレイの肖像 / 甘茶の音楽工房 */
  waiting: { file: "waiting.m4a", loop: true, gain: 0.6 },
  /** 開始からサイコロ・引き直し・布陣まで —— 深い闇の奥で / 甘茶の音楽工房 */
  setup: { file: "setup.m4a", loop: true, gain: 0.8 },
  /** 対局本編。いちばん長く鳴るので控えめに —— 斜塔 / 甘茶の音楽工房 */
  battle: { file: "battle.m4a", loop: true, gain: 0.7 },
  /** 終盤。ここだけ一段上げる —— 騎兵戦 / 甘茶の音楽工房 */
  endgame: { file: "endgame.m4a", loop: true, gain: 0.9 },
  /** 決着(勝ち)。ループしない —— ジングル01 / 魔王魂 */
  win: { file: "win.m4a", loop: false, gain: 1 },
  /** 決着(負け)。ループしない —— ジングル07 / 魔王魂 */
  lose: { file: "lose.m4a", loop: false, gain: 1 },
};

/**
 * 曲の出どころ。設定画面に出す。
 *
 * **魔王魂は「音楽：魔王魂」の表記が規約で必須。** 消さないこと。
 * 甘茶の音楽工房(https://amachamusic.chagasi.com/)は任意だが、揃えて出す。
 * リンクにはしていない。アプリに包んだとき、外部を開く導線が
 * WebView の設定しだいで死ぬので、文字で出しておくほうが確実。
 */
export const MUSIC_CREDIT = "甘茶の音楽工房 / 魔王魂";

/**
 * 効果音の出どころ。効果音ラボは表記が要らないが、揃えて出しておく。
 */
export const SE_CREDIT = "効果音ラボ";

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
  for (const ms of cs)
    if (typeof ms === "number" && ms <= ENDGAME_CLOCK_MS) return true;

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
