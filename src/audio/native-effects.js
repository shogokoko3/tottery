import { nativeAudioBridge } from "./native-home-music.js";

let serial = 0, listening = false;
const handles = new Map();
function listen() {
  if (listening) return;
  listening = true;
  nativeAudioBridge().addListener?.("effectEnded", ({ token }) => handles.get(token)?.finish())?.catch?.(() => {});
}
export async function prepareNativeEffect(key, file) {
  listen();
  const value = await nativeAudioBridge().prepareEffect({ key, file });
  return { native: true, key, duration: value.duration, cueGain: value.cueGain || 1 };
}
export function nativeEffect(buffer, options = {}) {
  listen();
  const token = `se-${Date.now()}-${++serial}`;
  let done = false, timer;
  const handle = {
    cuePriority: options.priority || 0, uiCue: !!options.ui,
    finish() {
      if (done) return;
      done = true; clearTimeout(timer); handles.delete(token); handle.onended?.();
    },
    stop() { nativeAudioBridge().stopEffect({ token }).catch(() => {}); handle.finish(); },
    disconnect() {},
  };
  handles.set(token, handle);
  nativeAudioBridge().playEffect({ key: buffer.key, token, deadline: Date.now() + 180, ...options })
    .then(result => { if (!result.played) handle.finish(); })
    .catch(() => handle.finish());
  // Cleanup only; native audio schedules/ends playback without JS timers.
  timer = setTimeout(() => handle.finish(), (buffer.duration / (options.rate || 1) + .5) * 1000);
  return handle;
}
export function stopNativeEffects() {
  for (const handle of [...handles.values()]) handle.finish();
  nativeAudioBridge().stopEffect({}).catch(() => {});
}
export function nativeEffectsVolume(volume) { nativeAudioBridge().setEffectsVolume({ volume }).catch(() => {}); }
export function resumeNativeAudio(gesture = false) {
  return nativeAudioBridge().resumeAudio({ gesture }).catch(() => ({ active: false, canPlay: false }));
}
export function observeNativeAudioState(listener) {
  nativeAudioBridge().addListener?.("nativeAudioState", listener)?.catch?.(() => {});
}

export function connectNativeFilm(el, { gain = .7, active = () => true } = {}) {
  const url = new URL(el.currentSrc || el.src, window.location.href);
  const file = decodeURIComponent(url.pathname).replace(/^\//, "");
  const key = `movie:${file}`;
  let closed = false, generation = 0, handle;
  el.muted = true; // Video pixels stay in WebKit; its audio is always silent.
  const prepared = prepareNativeEffect(key, file).catch(() => null);
  const stop = () => { generation++; handle?.stop(); handle = null; };
  const start = async () => {
    stop(); const revision = generation;
    const buffer = await prepared;
    if (closed || revision !== generation || !buffer || el.paused || el.ended || !active()) return;
    handle = nativeEffect(buffer, { gain, offset: el.currentTime || 0, rate: el.playbackRate || 1, movie: true, priority: 1 });
  };
  const events = { playing: start, pause: stop, ended: stop, seeking: stop, seeked: start, ratechange: start };
  for (const [name, fn] of Object.entries(events)) el.addEventListener(name, fn);
  if (!el.paused) start();
  return () => {
    closed = true; stop();
    for (const [name, fn] of Object.entries(events)) el.removeEventListener(name, fn);
  };
}
