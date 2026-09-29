/**
 * 近くの端末とのフレンド対戦(Bluetooth / 近距離 Wi‑Fi。インターネット不要)。
 *
 * iOS の MultipeerConnectivity を Capacitor のプラグイン(plugins/tottery-nearby)で包み、
 * その上に Firebase の部屋(src/net/firebase.js)と同じ形の「部屋」を載せる。
 * 対局の画面(GameCore)は部屋の合言葉が NEAR- で始まると、firebase.js がここへ振り分けるので、
 * 対局のコードは通信の種類を知らずに済む。
 *
 * 作り:
 * - 両端末とも「近くの端末」の画面で名乗り(advertise)と探索(browse)を同時に行い、
 *   どちらかが相手をタップすると招待→接続。タップした側がゲスト(席1)、された側がホスト(席0)
 * - 接続後にゲストが hello を送り、ホストが hello を返す。両方そろったら部屋ができ、対局へ
 * - 部屋の中身(席・再戦の意思・局番号)と手番の列は、両端末が同じ写しを持つ。書き込みは
 *   相手へ送って両方で反映する(書く場所は席ごとに分かれているので衝突しない)
 * - 手番の順は、送るたびに増えるカウンタ(相手から届いたぶんも取り込む)と席番号で決まり、
 *   両端末で同じ並びになる
 * - 持ち点・シーズン・オンラインの回数には数えない(通信の外なので照合できない)
 *
 * Capacitor のプラグインは Proxy なので、async から return / await しない(iap.js と同じ包み)。
 */
import { Capacitor, registerPlugin } from "@capacitor/core";
import { myUid } from "./auth.js";
import { onlinePhase } from "./match-settings.js";

export const NEARBY_PREFIX = "NEAR-";
export const isNearbyCode = (code) =>
  typeof code === "string" && code.startsWith(NEARBY_PREFIX);

const METHODS = ["start", "stop", "invite", "send", "peers"];
function wrap(proxy) {
  const o = {};
  for (const m of METHODS) o[m] = (options) => proxy[m](options);
  o.addListener = (event, fn) => proxy.addListener(event, fn);
  return o;
}

let nativePlugin = null;
function native() {
  if (!nativePlugin) nativePlugin = wrap(registerPlugin("Nearby"));
  return nativePlugin;
}

/** 近くの端末との対戦が使えるか(iOS アプリだけ。Web には無い) */
export function nearbyAvailable() {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Nearby");
  } catch {
    return false;
  }
}

const ID_KEY = "tottery.nearby.id";
/** 自分の名乗り。Firebase の uid があればそれ、無ければ端末に控えた印(通信できなくても対戦できるように) */
export function nearbyId() {
  const uid = myUid();
  if (uid) return uid;
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      id = "near-" + Math.random().toString(36).slice(2, 12);
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  } catch {
    return "near-" + Math.random().toString(36).slice(2, 12);
  }
}

const DISCONNECTED = "相手との接続が切れました。近くに居るか、Bluetooth と Wi‑Fi が有効か確かめてください。";

/**
 * 近くの端末との接続と、部屋の写しを持つ。
 * plugin は { start, stop, invite, send, addListener } (本物は native()、検査では偽物)
 */
export function createNearby({ plugin, myId, now = () => Date.now() } = {}) {
  const listeners = { peers: new Set(), state: new Set() };
  let peers = [];
  let me = null; // { uid, name, icon, title, skins, ruleVersion, boardSize }
  let seat = null; // 0=ホスト(招待された側) 1=ゲスト(タップした側)
  let foe = null; // 相手の hello
  let code = null;
  let doc = null; // 部屋の写し(null = 消えた)
  const acts = new Map();
  let counter = 0;
  let connected = false;
  let readyCb = null;
  let handles = [];
  // ネイティブから届いた最後のエラー。画面が後から開いても読めるように持っておく
  let lastError = null;

  const emit = (kind, v) => {
    for (const fn of listeners[kind]) fn(v);
  };
  const send = (msg) => plugin.send({ data: JSON.stringify(msg) });

  function pathSet(target, path, value) {
    if (!path.length) return value;
    const out = { ...(target && typeof target === "object" ? target : {}) };
    if (path.length === 1) {
      if (value === null || value === undefined) delete out[path[0]];
      else out[path[0]] = value;
      return out;
    }
    out[path[0]] = pathSet(out[path[0]], path.slice(1), value);
    return out;
  }
  function set(path, value, broadcast = true) {
    if (!path.length) doc = value;
    else if (doc) doc = pathSet(doc, path, value);
    if (broadcast) send({ t: "set", path, value });
  }
  function nextKey() {
    counter += 1;
    return `${String(counter).padStart(8, "0")}-${seat}`;
  }

  function buildRoomFor(hostHello, guestHello) {
    return {
      createdAt: hostHello.createdAt,
      seats: { host: hostHello.uid, guest: guestHello.uid },
      guestPresent: true,
      hostName: hostHello.name,
      hostIcon: hostHello.icon,
      hostTitle: hostHello.title,
      hostSkins: hostHello.skins,
      hostRuleVersion: hostHello.ruleVersion,
      guestName: guestHello.name,
      guestIcon: guestHello.icon,
      guestTitle: guestHello.title,
      guestSkins: guestHello.skins,
      guestRuleVersion: guestHello.ruleVersion,
      boardSize: hostHello.boardSize,
      // フェーズ(ストーリーとフェーズ.md)。名乗りに無ければ(古い版)・読めなければ 3
      phase: onlinePhase(hostHello.phase),
      ...(Number.isInteger(guestHello.phase) ? { guestPhase: onlinePhase(guestHello.phase) } : {}),
      round: 0,
    };
  }
  function finish(hostHello, guestHello) {
    doc = buildRoomFor(hostHello, guestHello);
    acts.clear();
    counter = 0;
    const network = {
      code,
      nearby: true,
      createdAt: doc.createdAt,
      myPlayerIndex: seat,
      foeUid: foe.uid,
      // 席順(ホスト, ゲスト)。ゲストの端末では自分が 1 番目
      names: [hostHello.name, guestHello.name],
      icons: [hostHello.icon, guestHello.icon],
      titles: [hostHello.title, guestHello.title],
      ratings: [null, null],
      skins: [hostHello.skins, guestHello.skins],
      boardSize: hostHello.boardSize,
      hostRuleVersion: hostHello.ruleVersion,
      guestRuleVersion: guestHello.ruleVersion,
      phase: onlinePhase(hostHello.phase),
      ...(Number.isInteger(guestHello.phase) ? { guestPhase: onlinePhase(guestHello.phase) } : {}),
    };
    emit("state", { state: "ready" });
    if (readyCb) readyCb(network);
  }

  function onMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg || typeof msg !== "object") return;
    switch (msg.t) {
      case "hello": {
        if (!me) return;
        foe = msg.me;
        if (seat === 0) {
          // ホスト: 部屋を名乗って返す
          code = NEARBY_PREFIX + Math.random().toString(36).slice(2, 8).toUpperCase();
          const mine = { ...me, createdAt: now() };
          send({ t: "hello", me: mine, code });
          me = mine;
          finish(me, foe);
        } else {
          code = msg.code;
          finish(foe, me);
        }
        return;
      }
      case "set":
        if (Array.isArray(msg.path)) set(msg.path, msg.value, false);
        return;
      case "act":
        if (typeof msg.key === "string" && msg.act && typeof msg.act === "object") {
          const n = Number(msg.key.split("-")[0]);
          if (Number.isFinite(n)) counter = Math.max(counter, n);
          acts.set(msg.key, msg.act);
        }
        return;
      case "clearActs":
        acts.clear();
        return;
      default:
    }
  }

  async function attach() {
    if (handles.length) return;
    handles = await Promise.all([
      plugin.addListener("peers", (e) => {
        peers = Array.isArray(e?.peers) ? e.peers : [];
        emit("peers", peers);
      }),
      plugin.addListener("connected", (e) => {
        connected = true;
        seat = e && e.initiator ? 1 : 0;
        emit("state", { state: "connected", peer: e });
        if (seat === 1) send({ t: "hello", me });
      }),
      plugin.addListener("message", (e) => onMessage(e && e.data)),
      // ネイティブ側は名乗り・探索を始められないと "error" を出す(位置情報や
      // ローカルネットワークの許可が下りていない、Bluetooth が切れている等)。
      // 2026-09-28 まで**誰も拾っていなかった**ので、画面は「まだ見つかりません」の
      // ままで、何が起きているか分からなかった(本人の報告「Bluetooth の対戦ができなかった」)
      plugin.addListener("error", (e) => {
        const message = (e && e.message) || "近くの端末との通信を始められませんでした";
        lastError = message;
        emit("state", { state: "error", message });
      }),
      plugin.addListener("disconnected", () => {
        connected = false;
        // 相手が居なくなった。部屋も無いものとして、対局後の画面が「相手が出た」と分かるように
        if (doc) doc = null;
        emit("state", { state: "disconnected" });
      }),
    ]);
  }

  const api = {
    /** 名乗りと探索を始める。profile は自分の名乗り(名前・アイコン・称号・装備・ルール版・盤の大きさ) */
    async start(profile, onReady) {
      me = { ...profile, uid: myId };
      readyCb = onReady;
      seat = null;
      foe = null;
      code = null;
      doc = null;
      acts.clear();
      counter = 0;
      connected = false;
      lastError = null;
      await attach();
      await plugin.start({ name: profile.name || "名無し" });
    },
    /** 相手をタップ: 招待する(自分がゲストになる) */
    async invite(peerId) {
      await plugin.invite({ peerId });
    },
    /** 探索も接続もやめる */
    async stop() {
      readyCb = null;
      connected = false;
      try {
        await plugin.stop();
      } catch {
        /* 片付けなので失敗しても進める */
      }
      for (const h of handles) {
        try {
          await h.remove();
        } catch {
          /* 同上 */
        }
      }
      handles = [];
    },
    onPeers(fn) {
      listeners.peers.add(fn);
      return () => listeners.peers.delete(fn);
    },
    onState(fn) {
      listeners.state.add(fn);
      return () => listeners.state.delete(fn);
    },
    get peers() {
      return peers;
    },
    /** ネイティブから届いた最後のエラー(無ければ null) */
    get lastError() {
      return lastError;
    },
    get connected() {
      return connected;
    },
    get code() {
      return code;
    },
    get seat() {
      return seat;
    },
    /* ---- Firebase の部屋と同じ形の口 ---- */
    readRoom: async () => ({ ok: true, data: doc, error: null }),
    updateRoom: async (patch) => {
      for (const [k, v] of Object.entries(patch || {})) set([k], v);
      return { ok: true, error: null };
    },
    joinRoom: async () => {
      set(["seats", "guest"], myId);
      return { ok: true, error: null };
    },
    leaveRoom: async () => {
      set(["seats", "guest"], null);
    },
    deleteRoom: async () => {
      set([], null);
      return { ok: true, error: null };
    },
    clearActs: async () => {
      acts.clear();
      send({ t: "clearActs" });
      return { ok: true, error: null };
    },
    wantRematch: async (round) => {
      set(["rematch", `r${round}`, myId], true);
      return { ok: true, error: null };
    },
    readRematch: async (round) => ({
      ok: true,
      data: (doc && doc.rematch && doc.rematch[`r${round}`]) || null,
      error: null,
    }),
    bumpRound: async (round) => {
      set(["round"], round);
      return { ok: true, error: null };
    },
    readRound: async () => ({ ok: true, data: doc ? doc.round : null, error: null }),
    pushAct: async (act) => {
      if (!connected) return { ok: false, error: DISCONNECTED };
      const key = nextKey();
      const stamped = { ...act, by: myId };
      acts.set(key, stamped);
      send({ t: "act", key, act: stamped });
      return { ok: true, error: null };
    },
    readActs: async () => {
      if (!connected) return { ok: false, list: [], error: DISCONNECTED };
      return {
        ok: true,
        list: [...acts.keys()].sort().map((k) => acts.get(k)),
        error: null,
      };
    },
  };
  return api;
}

let singleton = null;
/** アプリで使う本物(iOS のプラグイン)。検査は createNearby に偽物を渡す */
export function nearby() {
  if (!singleton) singleton = createNearby({ plugin: native(), myId: nearbyId() });
  return singleton;
}
