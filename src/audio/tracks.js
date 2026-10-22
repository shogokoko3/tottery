import { MUSIC_LAYOUTS } from "./music-layouts.js";
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
 * 勝敗後も結果画面の曲をループし、短い決着音はSEのバスで重ねる。
 */
export const TRACKS = {
  title: { ...MUSIC_LAYOUTS.title, file: "title.m4a", loop: true, gain: 0.75 },
  waiting: { ...MUSIC_LAYOUTS.waiting, file: "waiting.m4a", loop: true, gain: 0.6 },
  setup: { ...MUSIC_LAYOUTS.setup, file: "setup.m4a", loop: true, gain: 0.65 },
  battle: { ...MUSIC_LAYOUTS.battle, file: "battle.m4a", loop: true, gain: 0.6 },
  endgame: { ...MUSIC_LAYOUTS.endgame, file: "endgame.m4a", loop: true, gain: 0.65 },
  tutorial: { ...MUSIC_LAYOUTS.tutorial, file: "tutorial.m4a", loop: true, gain: 0.55 },
  puzzle: { ...MUSIC_LAYOUTS.puzzle, file: "puzzle.m4a", loop: true, gain: 0.6 },
  story: { ...MUSIC_LAYOUTS.story, file: "story.m4a", loop: true, gain: 0.7 },
  collection: { ...MUSIC_LAYOUTS.collection, file: "collection.m4a", loop: true, gain: 0.6 },
  shop: { ...MUSIC_LAYOUTS.shop, file: "shop.m4a", loop: true, gain: 0.6 },
  summon: { ...MUSIC_LAYOUTS.summon, file: "summon.m4a", loop: true, gain: 0.65 },
  rewards: { ...MUSIC_LAYOUTS.rewards, file: "rewards.m4a", loop: true, gain: 0.6 },
  ranking: { ...MUSIC_LAYOUTS.ranking, file: "ranking.m4a", loop: true, gain: 0.65 },
  win: { ...MUSIC_LAYOUTS.resultWin, file: "resultWin.m4a", loop: true, restart: true, gain: 0.65 },
  lose: { ...MUSIC_LAYOUTS.resultLose, file: "resultLose.m4a", loop: true, restart: true, gain: 0.6 },
  draw: { ...MUSIC_LAYOUTS.resultDraw, file: "resultDraw.m4a", loop: true, restart: true, gain: 0.6 },
};

/** 採用音源の制作記録は docs/selected-audio.json。アプリ同梱の音を使う。 */
export const MUSIC_CREDIT = "トッタリー オリジナルBGM";

/**
 * 効果音の出どころ。効果音ラボは表記が要らないが、揃えて出しておく。
 */
export const SE_CREDIT = "トッタリー オリジナルSE";

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
  const cs = state?.clocksHidden ? [] : clocks || (state && state.clocks) || [];
  for (const ms of cs)
    if (typeof ms === "number" && ms <= ENDGAME_CLOCK_MS) return true;

  const pieces = state && state.pieces ? Object.values(state.pieces) : [];
  if (pieces.length === 0) return false;
  const alive = pieces.filter((p) => p.alive).length;
  return alive / pieces.length < ENDGAME_ALIVE_RATIO;
}

/**
 * 画面ごとの曲。
 *
 * **画面を足したら、ここにも足すこと。** 書き忘れても遊べなくなりはしないが、
 * その画面だけ表題の曲のままになる。`npm run check` が
 * src/ui/screens.jsx の並びと突き合わせて、書き忘れを知らせる。
 *
 * "game" は対局そのもので、曲は下の PHASE_TRACK が決めるので null。
 */
export const SCREEN_TRACK = {
  home: "title",
  matching: "title",
  ranking: "ranking",
  tutorial: "tutorial",
  // ストーリー(一覧とステージ前の説明)。チュートリアルの場所に置いたので同じ曲
  story: "story",
  phaseGuide: "tutorial",
  welcomeComic: "tutorial",
  rules: "title",
  // 対局の外の画面(メニュー・スキン・ミッション・バトルパス・手紙)は
  // タイトルと同じ曲のまま続ける。画面を行き来しても曲が切れない
  menu: "title",
  skins: "summon",
  missions: "rewards",
  battlepass: "rewards",
  // 札ごとの熟練度を見る「カード」。ホームの一部なので同じ曲
  cards: "collection",
  letters: "title",
  shop: "shop",
  // フレンドとプロフィール(2026-09-23)。ホームの続きなので同じ曲
  friends: "title",
  profile: "title",
  // 観戦(2026-09-24)。対局を見るので対局と同じ曲
  spectate: "battle",
  // 詰めトッタリーは考える場面なので、布陣と同じ落ち着いた曲
  tsume: "puzzle",
  // 相手を待っているあいだは、数分続いても飽きない薄い曲にする
  online: "waiting",
  room: "waiting",
  // 近くの端末を探しているあいだ(フレンド対戦の待ちと同じ曲)
  nearby: "waiting",
  game: null,
};

/**
 * 対局の進み具合ごとの曲。
 *
 * **場面(phase)を足したら、ここにも足すこと。** `npm run check` が
 * src/game/reducer.js の phase と突き合わせて、書き忘れを知らせる。
 *
 * play と gameover はここに書いた曲から更に振り分ける。
 * 終盤なら endgame、負けなら lose。振り分け先は EXTRA_TRACKS に挙げてある。
 */
export const PHASE_TRACK = {
  intro: "setup",
  dice: "setup",
  mulligan: "setup",
  setup: "setup",
  play: "battle",
  gameover: "win",
};

/**
 * 上の2つの表には出てこないが、場面によって差し替わる曲。
 * ここに挙げていない曲が TRACKS にあると、鳴らす道がないので検査が知らせる。
 */
export const EXTRA_TRACKS = ["endgame", "lose", "draw", "tutorial"];

/**
 * いまの場面で鳴らす曲。鳴らさないときは null。
 *
 * scene は次の形:
 *   screen  画面(SCREEN_TRACK の見出し)
 *   phase   対局中の進み具合(PHASE_TRACK の見出し)
 *   endgame 終盤かどうか
 *   result  決着したときだけ "win" / "lose" / "draw"
 *
 * 表に無いものが来ても、音が止まるより鳴っているほうがましなので
 * 既定の曲を返す。**書き忘れを知らせるのは実行時ではなく `npm run check`。**
 */
export function trackForScene(scene) {
  if (!scene) return null;
  const { screen, phase } = scene;

  if (screen !== "game")
    return screen in SCREEN_TRACK ? SCREEN_TRACK[screen] : "title";

  if (phase === "gameover") {
    if (scene.result === "draw") return "draw";
    return scene.result === "lose" ? "lose" : "win";
  }
  if (scene.tutorial) return "tutorial";
  if (phase === "play") return scene.endgame ? "endgame" : "battle";
  return phase in PHASE_TRACK ? PHASE_TRACK[phase] : "setup";
}
