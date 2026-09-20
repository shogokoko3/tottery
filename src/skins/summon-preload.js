import { SUMMON_ARCHITECTURE } from "./summon-architecture.js";

// Keep the small compressed artwork across draws. Only the most recent two
// worlds stay decoded (~24 MiB), rather than retaining fourteen full bitmaps.
const files = new Map(), decoded = new Map();
export function summonAssetUrls(world) {
  return [
    `skins/summon/art-v3/${SUMMON_ARCHITECTURE[world].asset || `${world}.webp`}`,
    `skins/summon/interior-v4/${world}.webp`,
  ];
}
function loadFile(url, priority) {
  if (files.has(url)) return files.get(url);
  const promise = fetch(url, { priority }).then(response => {
    if (!response.ok) throw new Error(`Summon artwork: ${response.status}`);
    return response.blob();
  }).catch(error => {
    files.delete(url); // A failed prefetch must not poison the next real draw.
    throw error;
  });
  files.set(url, promise);
  return promise;
}
export function loadSummonImage(url) {
  if (decoded.has(url)) {
    const promise = decoded.get(url);
    decoded.delete(url);
    decoded.set(url, promise);
    return promise;
  }
  const promise = loadFile(url, "high").then(async blob => {
    const objectUrl = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.src = objectUrl;
      await image.decode();
      return image;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }).catch(error => {
    if (decoded.get(url) === promise) decoded.delete(url);
    throw error;
  });
  decoded.set(url, promise);
  while (decoded.size > 4) decoded.delete(decoded.keys().next().value);
  return promise;
}

/** Start while browsing gacha, without playing audio or drawing any cards. */
export function warmSummonIntro() {
  let cancelled = false, releaseRenderer = () => {};
  const start = () => {
    if (cancelled) return;
    import("./summon-scene.js").then(({ warmSummonRenderer }) => {
      if (!cancelled) releaseRenderer = warmSummonRenderer();
    }).catch(() => {});
    import("./summon-sound.js").then(({ prepareSummonSound }) => {
      if (!cancelled) prepareSummonSound();
    }).catch(() => {});
    const queue = Object.keys(SUMMON_ARCHITECTURE).flatMap(summonAssetUrls);
    // Background traffic is bounded; a requested world's load is deduplicated.
    const worker = async () => {
      while (!cancelled && queue.length) {
        try { await loadFile(queue.shift(), "low"); } catch { /* Retry on use. */ }
      }
    };
    void worker();
    void worker();
  };
  const idle = typeof window.requestIdleCallback === "function";
  const handle = idle ? window.requestIdleCallback(start, { timeout: 750 }) : setTimeout(start, 200);
  return () => {
    cancelled = true;
    releaseRenderer();
    if (idle) window.cancelIdleCallback(handle);
    else clearTimeout(handle);
  };
}
