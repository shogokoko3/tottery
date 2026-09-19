import { audioSettings, connectFilmSound, duckMusic } from "../audio/index.js";
const urls = new Map();
function soundUrl(kind) {
  if (urls.has(kind)) return urls.get(kind);
  const rate = 22050,
    duration = kind === "collapse" ? 0.65 : 2.5;
  const count = Math.floor(rate * duration),
    buffer = new ArrayBuffer(44 + count * 2),
    view = new DataView(buffer);
  const word = (at, s) =>
    [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  word(0, "RIFF");
  view.setUint32(4, 36 + count * 2, true);
  word(8, "WAVE");
  word(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  word(36, "data");
  view.setUint32(40, count * 2, true);
  for (let i = 0; i < count; i++) {
    const t = i / rate,
      edge = Math.min(1, t / 0.008, (duration - t) / 0.03);
    const v =
      kind === "collapse"
        ? 0.17 *
            Math.sin(2 * Math.PI * (290 * t - 205 * t * t)) *
            Math.exp(-t * 8) +
          0.05 * Math.sin(2 * Math.PI * 65 * t) * Math.exp(-t * 13)
        : [196, 293.66, 392, 587.33, 783.99].reduce(
            (v, hz, k) =>
              v +
              0.04 *
                Math.sin(2 * Math.PI * hz * t) *
                Math.exp(-t * (1.4 + k * 0.25)),
            0,
          ) * Math.min(1, t / 0.035);
    view.setInt16(44 + i * 2, Math.round(v * edge * 32767), true);
  }
  const url = URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
  urls.set(kind, url);
  return url;
}
export function startFreezeSound(kind) {
  const settings = audioSettings();
  if (settings.muted || !settings.se) return () => {};
  const audio = new Audio(soundUrl(kind)),
    disconnect = connectFilmSound(audio);
  let stopped = false,
    release = () => {};
  audio
    .play()
    .then(() => {
      if (stopped) audio.pause();
      else release = duckMusic(kind === "collapse" ? 1300 : 2500) || (() => {});
    })
    .catch(() => {});
  return () => {
    stopped = true;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    disconnect();
    release();
  };
}
