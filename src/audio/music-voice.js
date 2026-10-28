import { decodeAudio } from "./decode-queue.js";

/** Bounded decode cache; only current and next music are retained. */
const decoded = new Map();
let decodeQueue=Promise.resolve();
async function musicBuffer(ctx, url) {
  if (decoded.has(url)) {
    const value = decoded.get(url); decoded.delete(url); decoded.set(url,value);
    return value;
  }
  const pending = decodeQueue.then(()=>fetch(url)).then(r => {
    if (r.ok === false) throw new Error('Music unavailable');
    return r.arrayBuffer();
  }).then(raw => decodeAudio(ctx, raw, 2));
  decodeQueue=pending.then(()=>{},()=>{});
  decoded.set(url,pending);
  while (decoded.size > 2) decoded.delete(decoded.keys().next().value);
  try { return await pending; }
  catch (error) { if (decoded.get(url) === pending) decoded.delete(url); throw error; }
}

export function loopPosition(track, position) {
  if (position < track.loopEnd) return Math.max(0,position);
  return track.loopStart + (position-track.loopStart) % (track.loopEnd-track.loopStart);
}
export function harmonyAt(track, position) {
  const time = track.loopEnd ? loopPosition(track,position) : position;
  let found = track.harmony?.[0] || null;
  for (const entry of track.harmony || []) { if (entry.at > time) break; found=entry; }
  return found;
}
/** A nearby authored beat, preferring a compatible harmony, bounded to 2.8 s. */
export function endgameBoundary(track, position) {
  const time=loopPosition(track,position),length=track.loopEnd-track.loopStart;
  const options=(track.endgameExits || []).filter(cue => cue.at>=track.loopStart || (time<track.loopStart && cue.at>=time+.1)).map(cue => {
    let delay=cue.at-time;
    if (delay<.1) delay += length;
    return {...cue,delay};
  }).filter(cue=>cue.delay>=.1 && cue.delay<=2.8);
  options.sort((a,b)=>(b.fit-.13*b.delay)-(a.fit-.13*a.delay));
  return options[0]?.delay ?? Math.max(.12, Math.min(track.beatSeconds || .7, 1));
}

/** AudioBuffer loops exclude the intro; start/transition use the audio clock. */
export class MusicVoice {
  constructor(ctx, track, url, gain, fallback) {
    Object.assign(this,{ctx,track,url,gain,fallback});
    this.offset=0;this.source=null;this.startedAt=0;this.serial=0;
    this.buffer=null;this.legacy=false;this.paused=true;
    this.canSchedule=!!ctx?.decodeAudioData;
    fallback.loop=false;
    fallback.addEventListener?.('ended',()=>{
      if(this.legacy && !this._paused) {
        fallback.currentTime=track.loopStart;
        fallback.play()?.catch?.(()=>{});
      }
    });
    // Fallback is only for engines without usable buffer decoding.
    fallback.addEventListener?.('timeupdate',()=>{
      if(this.legacy && !this.paused && fallback.currentTime>=track.loopEnd-.03)
        fallback.currentTime=track.loopStart;
    });
  }
  async prepare() {
    if (!this.canSchedule) {this.legacy=true;return false;}
    try {
      const buffer=await musicBuffer(this.ctx,this.url);
      if(buffer.duration<this.track.loopEnd-.06) throw new Error('Incomplete music decode');
      this.buffer=buffer;this.legacy=false;return true;
    } catch { this.legacy=true;return false; }
  }
  get paused() {return this.legacy ? this.fallback.paused : this._paused;}
  set paused(value) {this._paused=value;}
  releasePrepared() {this.buffer=null;}
  get currentTime() {
    if(this.legacy)return this.fallback.currentTime || 0;
    const elapsed=this.source ? Math.max(0,this.ctx.currentTime-this.startedAt) : 0;
    return loopPosition(this.track,this.offset+elapsed);
  }
  set currentTime(value) {
    if(this.source)this.pause();
    this.offset=Math.max(0,Number(value)||0);
    this.fallback.currentTime=this.offset;
  }
  play() {return this.playAt(this.ctx?.currentTime || 0);}
  playAt(when) {
    const serial=++this.serial;
    const start=()=>{
      if(serial!==this.serial){this.buffer=null;throw new Error('Music request cancelled');}
      if(this.legacy) {
        this.fallback.currentTime=this.offset;
        const p=this.fallback.play();this.paused=false;return p;
      }
      if(this.source)return;
      const source=this.ctx.createBufferSource();source.buffer=this.buffer;
      source.loop=true;source.loopStart=this.track.loopStart;source.loopEnd=this.track.loopEnd;
      source.connect(this.gain);
      this.startedAt=Math.max(this.ctx.currentTime,when);
      source.start(this.startedAt,this.offset);
      this.source=source;this.paused=false;
    };
    if(!this.canSchedule){this.legacy=true;return start();}
    if(this.buffer)return Promise.resolve(start());
    return this.prepare().then(start);
  }
  pause() {
    this.offset=this.currentTime;this.serial++;
    if(this.source){try{this.source.stop();}catch{}this.source.disconnect();this.source=null;}
    this.fallback.pause();this.paused=true;this.buffer=null;
  }
  get volume(){return this.fallback.volume;}
  set volume(value){this.fallback.volume=value;}
}
