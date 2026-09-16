import { audioSettings, connectFilmSound, duckMusic } from "../audio/index.js";

let sourceUrl;
// Original sound design: soft ascending wind, low gate resonance, departing cards.
// A single continuous file avoids stopping/restarting the game music.
function soundUrl() {
  if (sourceUrl) return sourceUrl;
  const rate = 22050,
    n = rate * 9,
    data = new ArrayBuffer(44 + n * 2),
    view = new DataView(data);
  const word = (at, s) =>
    [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  word(0, "RIFF");
  view.setUint32(4, 36 + n * 2, true);
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
  view.setUint32(40, n * 2, true);
  let noise = 0,
    seed = 74193;
  const bell = (t, at, hz, level) =>
    t < at
      ? 0
      : Math.exp(-(t - at) * 3.5) *
        Math.sin((t - at) * hz * Math.PI * 2) *
        level;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    const white = (seed >>> 0) / 2147483648 - 1;
    noise = noise * 0.965 + white * 0.035;
    const ascent = t < 2 ? Math.sin((t / 2) * Math.PI) : 0;
    const opening = t > 4 && t < 7 ? Math.sin(((t - 4) / 3) * Math.PI) : 0;
    const gate =
      opening *
      (Math.sin(t * 49 * Math.PI * 2) * 0.06 +
        Math.sin(t * 73.42 * Math.PI * 2) * 0.035 +
        noise * 0.6);
    let value =
      ascent * noise * 1.5 +
      gate +
      bell(t, 2, 392, 0.065) +
      bell(t, 4, 98, 0.12) +
      bell(t, 6.65, 587.33, 0.045);
    for (let k = 0; k < 5; k++) {
      const q = t - (7 + k * 0.12);
      if (q >= 0 && q < 0.4)
        value += Math.sin((q / 0.4) * Math.PI) * (noise * 0.8 + white * 0.015);
    }
    value += bell(t, 8.65, 783.99, 0.04);
    const edge = Math.min(1, t / 0.04, (9 - t) / 0.12);
    view.setInt16(
      44 + i * 2,
      Math.round(Math.max(-0.75, Math.min(0.75, value * edge)) * 32767),
      true,
    );
  }
  sourceUrl = URL.createObjectURL(new Blob([data], { type: "audio/wav" }));
  return sourceUrl;
}

export function startSummonSound() {
  const settings = audioSettings();
  if (settings.muted || !settings.se) return () => {};
  const audio = new Audio(soundUrl());
  const disconnect = connectFilmSound(audio);
  let release = () => {},
    stopped = false;
  audio
    .play()
    .then(() => {
      if (stopped) audio.pause();
      else release = duckMusic(9000) || (() => {});
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
