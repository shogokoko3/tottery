import { baseSkinId, byId } from "./catalog.js";
import { FOIL_IMAGE_TIMEOUT_MS } from "./foil-acquisition.js";

// Owned by a single draw. Prepare the next two foils during the gate/flips,
// retaining their decoded images until the draw ends (never a global cache).
export function createFoilUnveilingAssets({
  createImage = () => new Image(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  const entries = new Map();
  let disposed = false;
  function prepare(skin) {
    if (entries.has(skin.id)) return entries.get(skin.id);
    const entry = { value: null, images: [], promise: null, cancel: null };
    entries.set(skin.id, entry);
    entry.promise = new Promise(resolve => {
      let finished = false;
      const finish = value => {
        if (finished) return;
        finished = true;
        clearTimer(timer);
        for (const image of entry.images) image.onload = image.onerror = null;
        entry.value = value;
        resolve(value);
      };
      const timer = setTimer(() => finish({ fallback: false, missing: true }), FOIL_IMAGE_TIMEOUT_MS);
      entry.cancel = () => finish({ fallback: false, missing: true });
      const load = (src, fallback = false) => {
        if (finished || disposed) return;
        const image = createImage();
        entry.images.push(image);
        const fail = () => {
          if (finished || disposed) return;
          image.onload = image.onerror = null;
          if (fallback) finish({ fallback: true, missing: true });
          else load(byId(baseSkinId(skin.id)).card, true);
        };
        image.decoding = "async";
        image.onload = () => Promise.resolve().then(() => image.decode?.())
          .then(() => image.naturalWidth > 0
            ? finish({ fallback, missing: false }) : fail(), fail);
        image.onerror = fail;
        image.src = src;
      };
      if (disposed) entry.cancel();
      else load(skin.card);
    });
    return entry;
  }
  return {
    prepare,
    dispose() {
      disposed = true;
      for (const entry of entries.values()) {
        entry.cancel();
        entry.images.length = 0;
      }
      entries.clear();
    },
  };
}
