/**
 * BGM を鳴らす。
 *
 * 音量の上げ下げを Web Audio の GainNode でやっている。iOS では
 * <audio> の volume に代入しても無視されるので、GainNode を挟まないと
 * 音量調整もクロスフェードもできない。音そのものは <audio> のまま流すので、
 * 曲の全体を読み終える前に鳴り始める。
 *
 *   曲ごとの gain ──┐
 *   曲ごとの gain ──┼─ master(BGMの音量) ─ duck(演出中だけ下げる) ─┐
 *   曲ごとの gain ──┘                                             ├─ 出力
 *   効果音 ──────────── seBus(効果音の音量) ─────────────────┘
 *
 * 効果音は duck を通さない。撃破の効果音を鳴らすために BGM を下げるのに、
 * その効果音まで一緒に下がってしまっては意味がない。
 *
 * 最初の1回は利用者が画面に触れるまで鳴らせない決まりがあるので、
 * unlockAudio() を最初のタップから呼ぶ。それまでの再生指示は覚えておいて、
 * 解錠できた時点で流す。
 */

import { SOUNDS } from "./sounds.js";
import { TRACKS, audioUrl } from "./tracks.js";
import { isTestPlay } from "../game/profile.js";
import { loadAudioSettings, saveAudioSettings } from "./settings.js";

/** 曲を入れ替えるのにかける時間。ぶつ切りにすると安っぽくなる */
const FADE_MS = 700;
/** 演出のあいだ BGM を下げる深さ */
const DUCK_LEVEL = 0.35;

let ctx = null;
let master = null;
let duck = null;
/** 効果音の通り道。BGM とは別に出すので duck を通さない */
let seBus = null;
/** 効果音id -> AudioBuffer。解錠のときにまとめて読む */
const buffers = new Map();
const filmNodes = new WeakMap();
/** テストプレイ中だけ、鳴らした効果音を控えておく。ふだんは null */
let played = null;
let soundsLoading = false;
/** 曲id -> { el, gain, track, stopTimer } */
const nodes = new Map();
/** いま鳴らしている曲 */
let current = null;
/** 鳴らしたい曲。解錠前はここに溜まる */
let wanted = null;
let unlocked = false;
let duckTimer = null;

let settings = { bgm: 0.6, se: 0.75, muted: false };
let settingsLoaded = false;
/** 場面ごとの倍率。チュートリアル中だけ一段下げるのに使う */
let scale = 1;

function conf() {
  if (!settingsLoaded) {
    settings = loadAudioSettings();
    settingsLoaded = true;
  }
  return settings;
}

/** 設定を踏まえた BGM の音量 */
function masterLevel() {
  const s = conf();
  return s.muted ? 0 : s.bgm * scale;
}

/** 設定を踏まえた効果音の音量 */
function seLevel() {
  const s = conf();
  return s.muted ? 0 : s.se;
}

/**
 * 音の通り道を用意する。作れない環境では null を返し、
 * そのときは <audio> の volume でごまかす(iOS 以外なら効く)。
 */
function ensureGraph() {
  if (ctx) return ctx;
  const Ctor =
    typeof window !== "undefined" &&
    (window.AudioContext || window.webkitAudioContext);
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  master = ctx.createGain();
  master.gain.value = masterLevel();
  duck = ctx.createGain();
  duck.gain.value = 1;
  master.connect(duck);
  duck.connect(ctx.destination);
  seBus = ctx.createGain();
  seBus.gain.value = seLevel();
  seBus.connect(ctx.destination);
  return ctx;
}

function nodeFor(id) {
  const existing = nodes.get(id);
  if (existing) return existing;
  const track = TRACKS[id];
  if (!track) return null;

  const el = new Audio(audioUrl(track.file));
  el.loop = !!track.loop;
  el.preload = "auto";
  // 全画面の動画扱いにさせない。iOS でこれが無いと再生が乗っ取られる
  el.setAttribute("playsinline", "");

  let gain = null;
  if (ensureGraph()) {
    gain = ctx.createGain();
    gain.gain.value = 0;
    try {
      ctx.createMediaElementSource(el).connect(gain).connect(master);
    } catch {
      // 通り道に繋げなかったら、素の <audio> として鳴らす
      gain = null;
    }
  }
  if (!gain) el.volume = 0;

  const node = { el, gain, track, stopTimer: null };
  nodes.set(id, node);
  return node;
}

/** 曲の音量を to まで ms かけて動かす */
function fade(node, to, ms) {
  if (!node.gain || !ctx) {
    // GainNode が無いときは、段階を踏まずに切り替える
    node.el.volume = Math.min(1, Math.max(0, to));
    return;
  }
  const g = node.gain.gain;
  const now = ctx.currentTime;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(to, now + ms / 1000);
}

function stopNode(id) {
  const node = nodes.get(id);
  if (!node) return;
  fade(node, 0, FADE_MS);
  clearTimeout(node.stopTimer);
  node.stopTimer = setTimeout(() => {
    node.el.pause();
    // ループしない曲(勝敗)は、次に呼ばれたとき頭から鳴らす
    if (!node.track.loop) node.el.currentTime = 0;
  }, FADE_MS + 80);
}

/**
 * wanted の曲に合わせる。解錠前は何もしない。
 *
 * 消音中は音量を絞るのではなく、そもそも鳴らさない。
 * 音量0で流し続けると、聞こえない曲を落とし続けることになる。
 */
function apply() {
  if (!unlocked) return;
  const target = conf().muted ? null : wanted;
  if (current === target) return;
  const from = current;
  current = target;
  if (from) stopNode(from);
  if (!current) return;

  const node = nodeFor(current);
  if (!node) return;
  clearTimeout(node.stopTimer);
  // ジングルは毎回頭から。ループする曲は前に鳴っていた続きから戻す
  if (!node.track.loop) {
    try {
      node.el.currentTime = 0;
    } catch {
      // まだ読めていないと弾かれることがある。次の再生で頭から鳴る
    }
  }
  const started = node.el.play();
  if (started && started.catch) started.catch(() => {});
  fade(node, node.track.gain, FADE_MS);
}

/**
 * 効果音をまとめて読む。
 *
 * 全部で数十KBしかないので、解錠のときに読んでしまう。
 * 押した瞬間に鳴らせないと効果音の意味がないので、
 * BGM のように鳴らすときに取りに行く作りにはしていない。
 */
function ensureSounds() {
  if (soundsLoading || conf().muted || !ensureGraph()) return;
  soundsLoading = true;
  for (const [id, sound] of Object.entries(SOUNDS)) {
    if (buffers.has(id)) continue;
    fetch(audioUrl(sound.file))
      .then((res) => res.arrayBuffer())
      .then((raw) => ctx.decodeAudioData(raw))
      .then((buf) => buffers.set(id, buf))
      .catch(() => {
        // 読めなくても、音が出ないだけで遊べる
      });
  }
}

/**
 * 効果音を鳴らす。
 *
 * まだ読み終わっていなければ何もしない。待って鳴らすと、
 * 操作から遅れて鳴ることになって、かえって気持ちが悪い。
 */
export function playSound(id, { rate = 1 } = {}) {
  const sound = SOUNDS[id];
  const buf = buffers.get(id);
  if (!sound || !buf || !ctx || !seBus || conf().muted) return;
  if (ctx.state === "suspended") return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = Math.max(0.5, Math.min(2, rate));
  const gain = ctx.createGain();
  gain.gain.value = sound.gain;
  src.connect(gain).connect(seBus);
  src.start(0);
  if (played) played.push(id);
  return () => {
    try {
      src.stop();
    } catch {}
  };
}

// Route movie audio through the same SE bus, including on iOS where setting a
// media element's volume alone is ineffective. Reuse the node in StrictMode.
export function connectFilmSound(el) {
  if (ensureGraph()) {
    try {
      let node = filmNodes.get(el);
      if (!node) {
        const source = ctx.createMediaElementSource(el),
          gain = ctx.createGain();
        gain.gain.value = 0.7;
        source.connect(gain);
        node = { source, gain };
        filmNodes.set(el, node);
      }
      node.gain.connect(seBus);
      el.volume = 1;
      return () => node.gain.disconnect();
    } catch {
      /* Media without Web Audio still plays at the saved volume. */
    }
  }
  el.volume = conf().se * 0.7;
  return () => {};
}

/**
 * 最初のタップから呼ぶ。ここを通るまで音は鳴らせない。
 * 呼ばれた時点で、待たせていた曲があれば流し始める。
 */
export function unlockAudio() {
  if (unlocked) return;
  const c = ensureGraph();
  if (c) {
    if (c.state === "suspended") {
      const resumed = c.resume();
      if (resumed && resumed.catch) resumed.catch(() => {});
    }
    // iOS はここで実際に何かを鳴らしておかないと解錠されない
    try {
      const src = c.createBufferSource();
      src.buffer = c.createBuffer(1, 1, 22050);
      src.connect(c.destination);
      src.start(0);
    } catch {
      // 鳴らせなくても、次の再生で解錠されることがある
    }
  }
  unlocked = true;
  ensureSounds();
  apply();
}

/** この曲に切り替える。null なら止める */
export function playTrack(id) {
  wanted = id && TRACKS[id] ? id : null;
  apply();
}

/** 全部止める。画面を離れるときに使う */
export function stopMusic() {
  playTrack(null);
}

/** いま鳴っている曲。確かめ用 */
export function currentTrack() {
  return current;
}

export function audioSettings() {
  return { ...conf() };
}

function pushMaster() {
  if (!ctx || !master) {
    // GainNode が無いときは、鳴っている曲の volume を直に動かす
    for (const [id, node] of nodes)
      if (!node.gain)
        node.el.volume = id === current ? masterLevel() * node.track.gain : 0;
    return;
  }
  const now = ctx.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(master.gain.value, now);
  master.gain.linearRampToValueAtTime(masterLevel(), now + 0.08);
}

function pushSe() {
  if (!ctx || !seBus) return;
  const now = ctx.currentTime;
  seBus.gain.cancelScheduledValues(now);
  seBus.gain.setValueAtTime(seBus.gain.value, now);
  seBus.gain.linearRampToValueAtTime(seLevel(), now + 0.05);
}

export function setSeVolume(v) {
  settings = saveAudioSettings({ ...conf(), se: v });
  settingsLoaded = true;
  pushSe();
  return { ...settings };
}

export function setBgmVolume(v) {
  settings = saveAudioSettings({ ...conf(), bgm: v });
  settingsLoaded = true;
  pushMaster();
  return { ...settings };
}

/**
 * 場面ごとの倍率。設定の音量とは別に、その場面だけ静かにしたいときに使う。
 * チュートリアルは考えながら読ませたいので下げている。
 */
export function setVolumeScale(next) {
  const v = Number(next);
  const safe = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
  if (safe === scale) return;
  scale = safe;
  pushMaster();
}

export function setMuted(muted) {
  settings = saveAudioSettings({ ...conf(), muted });
  settingsLoaded = true;
  pushMaster();
  pushSe();
  // 消音を解いたら、いまの場面の曲をあらためて流す
  ensureSounds();
  apply();
  return { ...settings };
}

/**
 * 演出のあいだ BGM を一段下げる。撃破の効果音を入れたときに、
 * 音がぶつかって潰れないようにするための口。
 */
export function duckMusic(ms) {
  if (!ctx || !duck) return;
  const hold = Math.max(0, Number(ms) || 700);
  const now = ctx.currentTime;
  duck.gain.cancelScheduledValues(now);
  duck.gain.setValueAtTime(duck.gain.value, now);
  duck.gain.linearRampToValueAtTime(DUCK_LEVEL, now + 0.08);
  clearTimeout(duckTimer);
  const release = () => {
    if (!ctx || !duck) return;
    const t = ctx.currentTime;
    duck.gain.cancelScheduledValues(t);
    duck.gain.setValueAtTime(duck.gain.value, t);
    duck.gain.linearRampToValueAtTime(1, t + 0.35);
  };
  const timer = setTimeout(release, hold);
  duckTimer = timer;
  return () => {
    if (duckTimer !== timer) return;
    clearTimeout(timer);
    release();
  };
}

/**
 * 最初のタップを待ち受ける。main.jsx から1度だけ呼ぶ。
 * どの触り方でも解錠できるよう、押した瞬間に反応する種類を並べてある。
 */
export function armAudioUnlock() {
  if (typeof document === "undefined" || unlocked) return;
  const kinds = ["pointerdown", "touchend", "mousedown", "keydown", "click"];
  const once = () => {
    unlockAudio();
    for (const k of kinds) document.removeEventListener(k, once);
  };
  for (const k of kinds) document.addEventListener(k, once, { passive: true });

  // テストプレイ中だけ、いま何が鳴っているかを外から見られるようにする。
  // 配信ビルドでは窓に何も生やさない
  if (isTestPlay()) {
    played = [];
    window.__bgm = {
      current: currentTrack,
      settings: audioSettings,
      // 鳴っている曲が1本だけかを見るための覗き窓。
      // 切り替えたあとに前の曲が止まっていないと、ここに2本並ぶ
      sounding: () =>
        [...nodes]
          .filter(([, n]) => !n.el.paused)
          .map(([id, n]) => ({
            id,
            gain: n.gain
              ? +n.gain.gain.value.toFixed(3)
              : +n.el.volume.toFixed(3),
          })),
      // 鳴らした効果音の並びと、読み終わっているもの
      sounds: () => ({ 鳴らした: [...played], 読めた: [...buffers.keys()] }),
      // 演出中に BGM が下がっているか。1 なら下がっていない
      duck: () => (duck ? +duck.gain.value.toFixed(3) : null),
      // 撃破を待たずに、下がって戻るのを確かめる
      duckNow: (ms) => duckMusic(ms),
      clearSounds: () => {
        played = [];
      },
    };
  }

  // 裏に回ったら止める。戻ってきたら続きから鳴らす
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) {
      if (ctx.suspend) ctx.suspend();
    } else if (unlocked && ctx.resume) {
      const r = ctx.resume();
      if (r && r.catch) r.catch(() => {});
    }
  });
}
