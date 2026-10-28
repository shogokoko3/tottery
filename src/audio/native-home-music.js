import { Capacitor, registerPlugin } from "@capacitor/core";
import { loopPosition } from "./music-voice.js";

export function nativeHomeMusicAvailable() {
  try {
    return Capacitor.getPlatform() === "ios" && Capacitor.isPluginAvailable("NativeHomeMusic");
  } catch { return false; }
}

let registered;
export function nativeAudioBridge() {
  if (!registered) registered = registerPlugin("NativeHomeMusic");
  return registered;
}

/** iOS owns decoding, the sample clock and the retained pause position. */
export class NativeHomeMusicVoice {
  constructor(track, url, { bridge = nativeAudioBridge(), now = () => performance.now() / 1000 } = {}) {
    Object.assign(this, { track, url, bridge, now });
    this.native = true;
    this.id = track.file.replace(/\.m4a$/, "");
    this.canSchedule = false;
    this.paused = true;
    this.offset = 0;
    this.startedAt = 0;
    this.serial = 0;
    this.trackLevel = 0;
    this.commands = Promise.resolve();
  }

  command(method, options = {}) {
    const task = this.commands.then(() => this.bridge[method]({ id: this.id, ...options }));
    this.commands = task.catch(() => {});
    return task;
  }

  async prepare() {
    if (!this.preparing) {
      const file = this.url.split("/").at(-1).split("?")[0];
      this.preparing = this.command("prepare", { file, loopStart: this.track.loopStart, loopEnd: this.track.loopEnd });
      this.preparing.catch(() => { this.preparing = null; });
    }
    await this.preparing;
    return true;
  }

  async play() {
    const serial = ++this.serial;
    await this.prepare();
    if (serial !== this.serial) throw new Error("Music request cancelled");
    const seek = this.seek;
    this.seek = undefined;
    const state = await this.command("play", seek === undefined ? {} : { position: seek });
    if (serial !== this.serial) throw new Error("Music request cancelled");
    this.offset = state.position;
    this.startedAt = this.now();
    this.paused = false;
  }

  pause({ lifecycle = false } = {}) {
    const serial = ++this.serial;
    this.offset = this.currentTime;
    this.paused = true;
    this.command("pause", lifecycle ? { keepIntent: true } : {}).then(state => {
      if (serial === this.serial) {
        this.offset = state.position;
        this.startedAt = this.now();
        this.paused = state.paused;
      }
    }).catch(() => {});
  }

  get currentTime() {
    return loopPosition(this.track, this.offset + (this.paused ? 0 : Math.max(0, this.now() - this.startedAt)));
  }
  set currentTime(value) {
    if (!this.paused) this.pause();
    this.seek = Math.max(0, Number(value) || 0);
    this.offset = this.seek;
  }
  async refreshState() {
    const serial = this.serial;
    const state = await this.command("state");
    if (serial === this.serial) {
      this.offset = state.position;
      this.startedAt = this.now();
      this.paused = state.paused;
    }
    return state;
  }
  mix(options) { this.command("setMix", options).catch(() => {}); }
  fadeTrack(value, durationMs) { this.trackLevel = value; this.mix({ track: value, durationMs }); }
  get volume() { return this.trackLevel; }
  set volume(value) { this.fadeTrack(value, 0); }
  releasePrepared() {
    this.preparing = null;
    this.command("release").catch(() => {});
  }
  async transitionFrom(outgoing) {
    const serial = ++this.serial;
    await this.prepare();
    if (serial !== this.serial) throw new Error("Music request cancelled");
    const state = await this.command("transition", {
      from: outgoing.id, to: this.id, exits: outgoing.track.endgameExits || [],
      beatSeconds: outgoing.track.beatSeconds, gain: this.track.gain,
    });
    if (serial !== this.serial) throw new Error("Music request cancelled");
    this.seek = undefined;
    this.offset = 0;
    this.startedAt = this.now() + state.delay;
    this.paused = false;
    return state;
  }
}
