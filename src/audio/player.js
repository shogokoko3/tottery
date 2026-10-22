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

import { MusicVoice, harmonyAt, endgameBoundary } from "./music-voice.js";
import { tonalSound } from "./tonal-cues.js";
import { captureSoundOnBus } from "./capture-sounds.js";
import { SOUNDS, IMPORTANT_CUES, importantCueGain } from "./sounds.js";
import { areaSoundSamples } from "./area-sounds.js";
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
const filmElements = new Set();
/** テストプレイ中だけ、鳴らした効果音を控えておく。ふだんは null */
let played = null;
let soundsLoading = false;
/** 曲id -> { el, gain, track, stopTimer } */
const nodes = new Map();
/** いま鳴らしている曲 */
let current = null;
/** 次の曲の再生開始待ち。この間も現在の曲を鳴らし続ける。 */
let pendingTrack = null;
/** 鳴らしたい曲。解錠前はここに溜まる */
let wanted = null;
let unlocked = false;
let lifecycleArmed = false;
let nativeInactive = false;
let systemInterrupted = false;
let resumeNeedsGesture = false;
let recovering = false;
let recoveryRequest = 0;
let contextInterrupted = false;
let duckTimer = null;
let duckUntil = 0;
let duckTarget = 1;
const activeSounds = new Set();
const cueGains = new Map();
let resultTimer = null;
let importantUntil = 0;
const lastSoundAt = new Map();
const loadingSounds = new Map();
let paletteTimer = null;
let lastCueDuration = 0;
const soundReads=[];let soundReadCount=0;
function readSound(file) {
  return new Promise((resolve,reject)=>{soundReads.push({file,resolve,reject});pumpSoundReads();});
}
function pumpSoundReads() {
  while(soundReadCount<4 && soundReads.length) {
    const job=soundReads.shift();soundReadCount++;
    fetch(audioUrl(job.file)).then(r=>{if(r.ok===false)throw new Error("Audio unavailable");return r.arrayBuffer();})
      .then(raw=>ctx.decodeAudioData(raw)).then(job.resolve,job.reject)
      .finally(()=>{soundReadCount--;pumpSoundReads();});
  }
}
const inBackground = () => nativeInactive || systemInterrupted || (typeof document !== "undefined" && document.hidden);

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
  ctx.addEventListener?.("statechange", () => {
    if (ctx.state === "interrupted") {
      contextInterrupted = true;
      pauseApplicationAudio();
    } else if (ctx.state === "running" && contextInterrupted) {
      contextInterrupted = false;
      recoverAudio();
    }
  });
  master = ctx.createGain();
  master.gain.value = masterLevel();
  duck = ctx.createGain();
  duck.gain.value = 1;
  master.connect(duck);
  duck.connect(ctx.destination);
  seBus = ctx.createGain();
  seBus.gain.value = seLevel();
  // Only SE (including movie/area audio) pass this soft, non-resonant filter.
  // Music retains its original timbre and bandwidth.
  if (ctx.createBiquadFilter) {
    const warmth = ctx.createBiquadFilter();
    warmth.type = "highshelf";
    warmth.frequency.value = 1400;
    warmth.gain.value = -6;
    const softEdge = ctx.createBiquadFilter();
    softEdge.type = "lowpass";
    softEdge.frequency.value = 3200;
    softEdge.Q.value = 0.5;
    seBus.connect(warmth).connect(softEdge).connect(ctx.destination);
  } else seBus.connect(ctx.destination);
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

  const voice = track.loopEnd ? new MusicVoice(ctx,track,audioUrl(track.file),gain,el) : el;
  if(voice !== el && voice.canSchedule) el.preload="none";
  const node = { el: voice, gain, track, stopTimer: null };
  nodes.set(id, node);
  return node;
}

/** 曲の音量を to まで ms かけて動かす */
function fade(node, to, ms) {
  if (!node.gain || !ctx) {
    // GainNode が無いときは、段階を踏まずに切り替える
    node.el.volume = Math.min(1, Math.max(0, to * masterLevel()));
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
  if (!unlocked || inBackground()) return;
  const target = conf().muted ? null : wanted;
  if (pendingTrack?.id === target) return;
  // 素早い画面切替・消音では、古い再生要求を取り消す。
  if (pendingTrack) {
    const obsolete = pendingTrack;
    pendingTrack = null;
    clearTimeout(obsolete.commitTimer);
    if(obsolete.from) {
      const outgoing=nodes.get(obsolete.from);
      clearTimeout(outgoing?.stopTimer);
      if(outgoing)fade(outgoing,outgoing.track.gain,120);
    }
    obsolete.node.el.pause();
  }
  if (current === target) return;
  if (!target) {
    if (current) stopNode(current);
    current = null;
    return;
  }

  const node = nodeFor(target);
  if (!node) return;
  clearTimeout(node.stopTimer);
  // ジングルは毎回頭から。ループする曲は前に鳴っていた続きから戻す
  if (!node.track.loop || (node.track.restart && !node.resumePosition)) {
    try {
      node.el.currentTime = 0;
    } catch {
      // まだ読めていないと弾かれることがある。次の再生で頭から鳴る
    }
  }
  node.resumePosition=false;
  const request = { id: target, node };
  pendingTrack = request;
  const ready = () => {
    if (pendingTrack !== request) return;
    pendingTrack = null;
    const from = current;
    current = target;
    fade(node, node.track.gain, FADE_MS);
    if (from) stopNode(from);
    startPaletteUpdates();
    for(const [id,n] of nodes)if(id!==target)n.el.releasePrepared?.();
    if(target === "battle") {
      const next=nodeFor("endgame");next?.el.prepare?.().then(()=>{
        if(current!=="battle" && pendingTrack?.id!=="endgame")next.el.releasePrepared?.();
      });
    }
  };
  const failed = () => {
    if (pendingTrack !== request) return;
    pendingTrack = null;
    node.el.pause();
    // 前の曲を維持し、次の再生要求で再試行できるようにする。
  };
  if(current === "battle" && target === "endgame" && node.el.canSchedule) {
    const from=current,outgoing=nodes.get(from);
    request.from=from;
    node.el.prepare().then(prepared=>{
      if(pendingTrack!==request || inBackground() || conf().muted){node.el.releasePrepared?.();return;}
      if(!prepared || !outgoing?.el.canSchedule) {
        const p=node.el.play();p?.then ? p.then(ready,failed) : ready();return;
      }
      const when=ctx.currentTime+endgameBoundary(outgoing.track,outgoing.el.currentTime);
      const ms=Math.min(1200,Math.max(650,outgoing.track.beatSeconds*1000));
      request.when=when;
      // Both the source and gain envelopes are scheduled on the audio clock.
      node.el.currentTime=0;
      node.el.playAt(when).then(()=>{
        if(pendingTrack!==request)return;
        for(const [n,to] of [[node,node.track.gain],[outgoing,0]]) {
          const g=n.gain.gain;g.cancelScheduledValues(ctx.currentTime);
          g.setValueAtTime(g.value,ctx.currentTime);g.setValueAtTime(g.value,when);
          g.linearRampToValueAtTime(to,when+ms/1000);
        }
        request.commitTimer=setTimeout(()=>{
          if(pendingTrack!==request)return;
          pendingTrack=null;current=target;startPaletteUpdates();
        },Math.max(0,(when-ctx.currentTime)*1000));
        outgoing.stopTimer=setTimeout(()=>outgoing.el.pause(),Math.max(0,(when-ctx.currentTime)*1000)+ms+80);
      },failed);
    });
    return;
  }
  try {
    // play() の解決は「要求を出した時」ではなく実際の再生開始時。
    // 先に前の曲を止めると、低速回線では読み込み中に無音になる。
    const started = node.el.play();
    if (started?.then) started.then(ready, failed);
    else ready();
  } catch {
    failed();
  }
}

/**
 * 効果音をまとめて読む。
 *
 * 全部で数十KBしかないので、解錠のときに読んでしまう。
 * 押した瞬間に鳴らせないと効果音の意味がないので、
 * BGM のように鳴らすときに取りに行く作りにはしていない。
 */
function loadSound(id, file = SOUNDS[id]?.file) {
  if (buffers.has(id)) return Promise.resolve(buffers.get(id));
  if (loadingSounds.has(id)) return loadingSounds.get(id);
  if (!file || !ctx) return Promise.resolve(null);
  const task = readSound(file)
    .then(buf => { buffers.set(id, buf); if (IMPORTANT_CUES[id] || id.startsWith("bloom-")) cueGains.set(id, importantCueGain(buf));
      const tonalKeys=[...buffers.keys()].filter(key=>key.startsWith("bloom-"));
      while(tonalKeys.length>24){const old=tonalKeys.shift();buffers.delete(old);cueGains.delete(old);}
      return buf; })
    .catch(() => null)
    .finally(() => loadingSounds.delete(id));
  loadingSounds.set(id, task);
  return task;
}
function ensureSounds() {
  if (soundsLoading || conf().muted || !ensureGraph()) return;
  soundsLoading = true;
  const queue = [...new Set(["tap", "place", "capture", "confirm", "back", "tick", ...Object.keys(SOUNDS)])];
  // Limit local file reads/decodes so the first tap does not start 70 requests.
  const worker = async () => { while (queue.length) await loadSound(queue.shift()); };
  Promise.all(Array.from({ length: 4 }, worker)).finally(() => { soundsLoading = false; });
}

/**
 * 効果音を鳴らす。
 *
 * まだ読み終わっていなければ何もしない。待って鳴らすと、
 * 操作から遅れて鳴ることになって、かえって気持ちが悪い。
 */
export function playSound(id, { rate = 1, harmony: preferredHarmony } = {}) {
  const sound = SOUNDS[id];
  const variant = tonalSound(id, preferredHarmony === undefined ? currentHarmony() : preferredHarmony);
  const bufferKey=variant?.key || id;
  const buf = buffers.get(bufferKey);
  if (!sound || !ctx || !seBus || conf().muted || inBackground()) return;
  if (!buf) {
    const requested = Date.now();
    loadSound(bufferKey,variant?.file || sound.file).then(value => {
      if (value && Date.now() - requested < 180) playSound(id, { rate, harmony: preferredHarmony });
    });
    return;
  }
  const now = Date.now();
  const cue = IMPORTANT_CUES[id];
  const priority = cue?.priority || 0;
  if (now - (lastSoundAt.get(id) || 0) < 100) return;
  if (priority === 0 && now < importantUntil) return;
  if (ctx.state !== "running") return;
  // A warning/result can replace a less important voice, never the reverse.
  if (activeSounds.size >= 8) {
    const victim = [...activeSounds].find(source => (source.cuePriority || 0) < priority);
    if (!victim) return;
    victim.stop();
    activeSounds.delete(victim);
  }
  if (priority === 4) {
    for (const source of [...activeSounds]) if ((source.cuePriority || 0) < priority) {
      source.stop(); activeSounds.delete(source);
    }
  }
  if (priority > 0) {
    importantUntil = now + 160;
    // Remove the generic click that led to this dedicated presentation cue.
    for (const source of [...activeSounds]) if (source.uiCue) {
      source.stop(); activeSounds.delete(source);
    }
  }
  lastSoundAt.set(id, now);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = variant ? 1 : Math.max(0.5, Math.min(2, rate));
  const gain = ctx.createGain();
  gain.gain.value = sound.gain * (cueGains.get(bufferKey) || 1);
  src.cuePriority = priority;
  src.uiCue = ["tap", "back", "page"].includes(id);
  src.connect(gain).connect(seBus);
  activeSounds.add(src);
  src.onended = () => { activeSounds.delete(src); src.disconnect(); gain.disconnect(); };
  src.start(0);
  lastCueDuration=buf.duration / src.playbackRate.value;
  if (cue) duckMusic(cue.duckMs, priority === 1 ? 0.6 : DUCK_LEVEL);
  if (played) played.push(id);
  return () => {
    try {
      src.stop();
    } catch {}
  };
}

export function createCaptureSound() {
  if (!unlocked || !ensureGraph() || !seBus || ctx.state !== "running")
    return { play() {}, stop() {} };
  return captureSoundOnBus(ctx, seBus, () => playSound("capture"));
}

export function playAreaSound(type, { hit = true } = {}) {
  const selected = { earth: "earth", sea: "sea", forest: "forest", ice: "ice", sky: "sky", palace: "palace", heaven: "heaven", hell: "hell" }[type];
  if (selected) return playSound(selected);

  if (
    !unlocked ||
    inBackground() ||
    conf().muted ||
    !ensureGraph() ||
    !seBus ||
    ctx.state !== "running"
  )
    return;
  const id = `area:${type}:${hit}`;
  if (!buffers.has(id)) {
    const samples = areaSoundSamples(type, ctx.sampleRate, hit);
    const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    buffer.copyToChannel(samples, 0);
    buffers.set(id, buffer);
  }
  const source = ctx.createBufferSource();
  source.buffer = buffers.get(id);
  source.connect(seBus);
  source.start();
  source.onended = () => source.disconnect();
  if (played) played.push(id);
  return () => {
    try {
      source.stop();
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
      filmElements.add(el);
      el.volume = 1;
      return () => { filmElements.delete(el); node.gain.disconnect(); };
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
  if (unlocked) { recoverAudio(true); return; }
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
export function playTrack(id, { restart = false } = {}) {
  if(restart && nodes.has(id)) {
    const node=nodes.get(id);node.el.pause();node.el.currentTime=0;
    if(current===id)current=null;
  }
  clearTimeout(resultTimer);
  resultTimer = null;
  wanted = id && TRACKS[id] ? id : null;
  apply();
}

/** Let the soft result cue finish before starting result music from its opening. */
export function playResultTrack(id) {
  if (!["win", "lose", "draw"].includes(id)) return;
  const outgoingHarmony=currentHarmony();
  playTrack(null);
  lastCueDuration=0;
  const stopCue = playSound(id,{harmony:outgoingHarmony});
  const duration = lastCueDuration || buffers.get(id)?.duration || 1.7;
  const timer = setTimeout(() => {
    if (resultTimer !== timer) return;
    resultTimer = null;
    wanted = id;
    apply();
  }, Math.max(800, duration * 1000 + 180));
  resultTimer = timer;
  return () => {
    if (resultTimer === timer) { clearTimeout(timer); resultTimer = null; }
    stopCue?.();
  };
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
  if (muted) for (const source of activeSounds) { try { source.stop(); } catch {} }
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
export function duckMusic(ms, level = DUCK_LEVEL) {
  if (!ctx || !duck) return;
  if (Date.now() >= duckUntil) duckTarget = 1;
  duckTarget = Math.min(duckTarget, Math.max(0, Math.min(1, level)));
  duckUntil = Math.max(duckUntil, Date.now() + Math.max(0, Number(ms) || 700));
  const hold = Math.max(0, duckUntil - Date.now());
  const now = ctx.currentTime;
  duck.gain.cancelScheduledValues(now);
  duck.gain.setValueAtTime(duck.gain.value, now);
  duck.gain.linearRampToValueAtTime(duckTarget, now + 0.08);
  clearTimeout(duckTimer);
  const release = () => {
    if (!ctx || !duck) return;
    duckUntil = 0;
    duckTarget = 1;
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
  if (typeof document === "undefined" || lifecycleArmed) return;
  lifecycleArmed = true;
  const kinds = ["pointerdown", "touchend", "mousedown", "keydown", "click"];
  const once = () => {
    unlockAudio();
    // Keep gesture recovery armed: iOS may require a tap after a call.
  };
  for (const k of kinds) document.addEventListener(k, once, { passive: true });

  // テストプレイ中だけ、いま何が鳴っているかを外から見られるようにする。
  // 配信ビルドでは窓に何も生やさない
  if (isTestPlay()) {
    played = [];
    window.__bgm = {
      current: currentTrack,
      harmony: currentHarmony,
      transition: () => pendingTrack ? {id:pendingTrack.id,when:pendingTrack.when ?? null} : null,
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

  document.addEventListener("visibilitychange", () => {
    if (inBackground()) {
      pauseApplicationAudio();
      if (ctx?.suspend) { const r = ctx.suspend(); r?.catch?.(() => {}); }
    } else recoverAudio();
  });
  window.addEventListener?.("focus", () => recoverAudio());
  window.addEventListener?.("pageshow", () => recoverAudio());
  window.addEventListener?.("tottery-audio-state", event => {
    const status = event.status || event.detail?.status;
    if (status === "inactive") nativeInactive = true;
    if (status === "interrupted") systemInterrupted = true;
    if (status === "active") nativeInactive = false;
    if (status === "ended" || status === "manual") {
      systemInterrupted = false;
      resumeNeedsGesture = status === "manual";
    }
    if (inBackground() || resumeNeedsGesture) pauseApplicationAudio();
    else recoverAudio();
  });
}

function pauseApplicationAudio() {
  clearTimeout(paletteTimer);
  recoveryRequest++;
  recovering = false;
  // One-shot presentation audio must not continue invisibly through a call.
  for (const el of filmElements) el.pause();
  for (const source of [...activeSounds]) {
    try { source.stop(); } catch {}
    activeSounds.delete(source);
  }
  if (pendingTrack) { clearTimeout(pendingTrack.commitTimer); pendingTrack.node.el.pause(); pendingTrack = null; }
  for (const [id,node] of nodes) {
    clearTimeout(node.stopTimer);
    node.resumePosition=id===current && !node.el.paused;
    node.el.pause();
    fade(node, 0, 0);
  }
  current = null;
}

/** Resume the existing graph/position; never replay stale SE from the call. */
function recoverAudio(fromGesture = false) {
  if (!unlocked || inBackground() || conf().muted) return;
  if (fromGesture) resumeNeedsGesture = false;
  if (resumeNeedsGesture || (recovering && !fromGesture)) return;
  const request = ++recoveryRequest;
  const finish = () => {
    if (request !== recoveryRequest) return;
    recovering = false;
    if (inBackground() || conf().muted || resumeNeedsGesture) return;
    if (ctx && ctx.state !== "running") return;
    contextInterrupted = false;
    // A media element may be paused by the OS even if the context is running.
    if (current && nodes.get(current)?.el.paused) current = null;
    apply();
  };
  if (ctx && (ctx.state === "suspended" || ctx.state === "interrupted")) {
    recovering = true;
    try {
      const resumed = ctx.resume();
      if (resumed?.then) resumed.then(finish, () => { if (request === recoveryRequest) recovering = false; });
      else finish();
    } catch { recovering = false; }
  } else finish();
}

function currentHarmony() {
  if(conf().bgm === 0 || conf().muted || inBackground())return null;
  const sounding=pendingTrack?.when!=null && ctx?.currentTime>=pendingTrack.when ? pendingTrack.id : current;
  const node=nodes.get(sounding);
  return node ? harmonyAt(node.track,node.el.currentTime) : null;
}
function startPaletteUpdates() {
  clearTimeout(paletteTimer);
  if(!current || inBackground() || conf().muted)return;
  const node=nodes.get(current),harmony=currentHarmony();
  if(harmony) {
    // Decode just the current/upcoming palette, keeping at most 24 variants.
    const upcoming=harmonyAt(node.track,node.el.currentTime+2);
    const variants=[harmony,upcoming].flatMap(h=>["reveal_r","reveal_sr","reveal_ssr"].map(id=>tonalSound(id,h)));
    const queue=[...new Map(variants.map(v=>[v.key,v])).values()];
    const work=async()=>{while(queue.length){const v=queue.shift();await loadSound(v.key,v.file);}};
    Promise.all([work(),work()]);
  }
  paletteTimer=setTimeout(startPaletteUpdates,1500);
}
