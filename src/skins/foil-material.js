// Light is drawn only into the supplied material mask. Artwork pixels are never
// sampled or moved, and no request is needed for an ordinary/static card.
let masksPromise;
const decoded = new Map();
const players = new Set();
const running = new Set();
let raf = 0;
let previousTick = 0;
let motion;

export function loadFoilMasks() {
  if (!masksPromise) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    // Like all skin URLs, resolve next to index.html, including subdirectory hosting.
    masksPromise = fetch(
      new URL("skins/foils/masks.json?v=background-glints-1", document.baseURI),
      {
        signal: controller.signal,
      },
    )
      .then((response) => {
        if (!response.ok) throw new Error("Foil masks unavailable");
        return response.json();
      })
      .catch(() => {
        // The static foil remains usable offline. A later mount may retry.
        masksPromise = null;
        return {};
      })
      .finally(() => clearTimeout(timeout));
  }
  return masksPromise;
}

export function decodeFoilMask(entry, targetWidth = entry.width) {
  const raw = atob(entry.alpha);
  if (raw.length !== entry.width * entry.height)
    throw new Error("Invalid foil mask dimensions");
  const width = Math.min(entry.width, Math.max(1, Math.round(targetWidth)));
  const height = Math.max(1, Math.round((width * entry.height) / entry.width));
  const alpha = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor((x * entry.width) / width);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * entry.width) / width));
      const y0 = Math.floor((y * entry.height) / height);
      const y1 = Math.max(
        y0 + 1,
        Math.floor(((y + 1) * entry.height) / height),
      );
      let total = 0;
      for (let sy = y0; sy < y1; sy++)
        for (let sx = x0; sx < x1; sx++)
          total += raw.charCodeAt(sy * entry.width + sx);
      alpha[y * width + x] = Math.round(total / ((x1 - x0) * (y1 - y0)));
    }
  }
  // Reapply face/skin guards after reduction so an edge cell cannot spill into a face.
  for (const [left, top, right, bottom] of entry.protected || []) {
    for (let y = Math.floor(top * height); y < Math.ceil(bottom * height); y++)
      for (let x = Math.floor(left * width); x < Math.ceil(right * width); x++)
        if (x >= 0 && x < width && y >= 0 && y < height)
          alpha[y * width + x] = 0;
  }
  const active = [];
  for (let i = 0; i < alpha.length; i++)
    if (alpha[i])
      active.push({
        i,
        x: i % width,
        y: Math.floor(i / width),
        weight: alpha[i] / 255,
      });
  return {
    width,
    height,
    active,
    background: entry.background
      ? decodeFoilMask(
          { ...entry, alpha: entry.background, background: undefined },
          targetWidth,
        ).active
      : [],
    wx: new Float32Array(width),
    wy: new Float32Array(height),
    pixels: new Uint8ClampedArray(width * height * 4),
    lastFrame: -Infinity,
    frame: null,
  };
}

export function renderFoilFrame(mask, seconds, pixels = mask.pixels) {
  pixels.fill(0);
  // Continuous curved bands: every foil region changes throughout the cycle,
  // including tiny board cards. There is no off-screen sweep/wait interval.
  const time = seconds * ((Math.PI * 2) / 2.8);
  for (let x = 0; x < mask.width; x++)
    mask.wx[x] = 0.1 * Math.sin((x / mask.width) * 9 + time);
  for (let y = 0; y < mask.height; y++)
    mask.wy[y] = 0.2 * Math.sin((y / mask.height) * 10 - time * 0.8);
  for (const point of mask.active) {
    const x = point.x / mask.width,
      y = point.y / mask.height;
    const phase =
      (0.55 * x + y + mask.wx[point.x] + mask.wy[point.y]) * Math.PI * 4 - time;
    const wave = 0.5 + 0.5 * Math.cos(phase);
    const crest = Math.pow(wave, 7);
    const weight = Math.sqrt(point.weight);
    const alpha = Math.round((0.12 + 0.83 * wave) * weight * 255);
    const k = point.i * 4;
    // Gold, cyan and violet travel with the bend; white crests read as metal.
    const red = 155 + 100 * (0.5 + 0.5 * Math.sin(phase + 0.8));
    const green = 100 + 135 * (0.5 + 0.5 * Math.sin(phase + 2.9));
    const blue = 120 + 135 * (0.5 + 0.5 * Math.sin(phase + 4.6));
    pixels[k] = red + (255 - red) * crest;
    pixels[k + 1] = green + (255 - green) * crest;
    pixels[k + 2] = blue + (255 - blue) * crest;
    pixels[k + 3] = alpha;
  }
  // Twinkle only on sampled foil flecks already present in the background.
  // Positions never move, and no new star shapes or background artwork are drawn.
  for (const point of mask.background || []) {
    const grain = ((point.i * 16807) % 101) / 101;
    const pulse = Math.pow(
      0.5 + 0.5 * Math.sin(seconds * 3.4 + grain * Math.PI * 2),
      9,
    );
    const glow =
      0.5 +
      0.5 *
        Math.sin(
          (point.x / mask.width) * 7 +
            (point.y / mask.height) * 5 -
            seconds * 1.6,
        );
    const strength = (0.1 * glow + 0.86 * pulse) * Math.sqrt(point.weight);
    const k = point.i * 4;
    if (pixels[k + 3]) continue;
    pixels[k] = 246;
    pixels[k + 1] = 243 + Math.round(12 * glow);
    pixels[k + 2] = 220 + Math.round(35 * glow);
    pixels[k + 3] = Math.round(strength * 255);
  }
  return pixels;
}

function tick(now) {
  raf = 0;
  if (!running.size) return;
  // One scheduler for the entire board; small cards share 12 fps material frames.
  if (now - previousTick >= 1000 / 24) {
    previousTick = now;
    for (const player of running) player.paint(now);
  }
  raf = requestAnimationFrame(tick);
}
function schedule() {
  if (running.size && !raf) raf = requestAnimationFrame(tick);
  else if (!running.size && raf) {
    cancelAnimationFrame(raf);
    raf = 0;
  }
}
function syncAll() {
  for (const player of players) player.sync();
}
function connectEnvironment() {
  if (players.size) return;
  motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  motion.addEventListener("change", syncAll);
  document.addEventListener("visibilitychange", syncAll);
}
function disconnectEnvironment() {
  if (players.size) return;
  motion?.removeEventListener("change", syncAll);
  document.removeEventListener("visibilitychange", syncAll);
  motion = null;
}

export function attachFoilMaterial({ canvas, image, skinId }) {
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return { setEnabled() {}, destroy() {} };
  connectEnvironment();
  let disposed = false,
    requested = true,
    visible = !window.IntersectionObserver;
  let pending = false,
    entry = null,
    mask = null,
    drawnAt = -Infinity;
  let displayWidth = 0,
    displayHeight = 0;

  function clear() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    canvas.dataset.animated = "false";
    drawnAt = -Infinity;
  }
  function layout() {
    if (!image.complete || !image.naturalWidth) return;
    const width = image.clientWidth,
      height = image.clientHeight;
    if (!width || !height) {
      displayWidth = 0;
      displayHeight = 0;
      return;
    }
    const computed = getComputedStyle(image);
    const fit = computed.objectFit;
    let w = width,
      h = height;
    if (fit === "contain" || fit === "cover") {
      const scale = Math[fit === "cover" ? "max" : "min"](
        width / image.naturalWidth,
        height / image.naturalHeight,
      );
      w = image.naturalWidth * scale;
      h = image.naturalHeight * scale;
    }
    displayWidth = w;
    displayHeight = h;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    const positions = computed.objectPosition.split(/\s+/);
    const offset = (position, gap) => {
      if (position?.endsWith("%")) return (gap * parseFloat(position)) / 100;
      if (position?.endsWith("px")) return parseFloat(position);
      return gap / 2;
    };
    canvas.style.left =
      image.offsetLeft + offset(positions[0], width - w) + "px";
    canvas.style.top =
      image.offsetTop + offset(positions[1], height - h) + "px";
    if (!entry) return;
    const resolution = w <= 100 ? 64 : w <= 180 ? 128 : 256;
    const key = skinId + ":" + resolution;
    if (!decoded.has(key)) decoded.set(key, decodeFoilMask(entry, resolution));
    const next = decoded.get(key);
    if (next !== mask) {
      mask = next;
      canvas.width = mask.width;
      canvas.height = mask.height;
      canvas.dataset.maskPixels = String(mask.active.length);
      drawnAt = -Infinity;
    }
  }
  const player = {
    sync() {
      if (disposed) return;
      const allowed =
        requested &&
        visible &&
        !document.hidden &&
        !motion.matches &&
        image.complete &&
        !!image.naturalWidth &&
        !image.hidden;
      if (allowed && !entry && !pending) {
        pending = true;
        loadFoilMasks()
          .then((masks) => {
            if (disposed) return;
            entry = masks[skinId] || null;
            // Missing/failed masks leave static artwork; do not spin on a failed fetch.
            if (entry) {
              layout();
              player.sync();
            }
          })
          .catch(() => {
            if (!disposed) clear();
          });
      }
      if (allowed && mask && displayWidth > 0 && displayHeight > 0)
        running.add(player);
      else {
        running.delete(player);
        clear();
      }
      schedule();
    },
    paint(now) {
      const interval = mask.width <= 64 ? 1000 / 12 : 1000 / 24;
      if (now - mask.lastFrame >= interval) {
        renderFoilFrame(mask, now / 1000);
        if (!mask.frame)
          mask.frame = context.createImageData(mask.width, mask.height);
        mask.frame.data.set(mask.pixels);
        mask.lastFrame = now;
      }
      if (mask.frame && drawnAt !== mask.lastFrame) {
        context.putImageData(mask.frame, 0, 0);
        canvas.dataset.animated = "true";
        drawnAt = mask.lastFrame;
      }
    },
  };
  players.add(player);
  canvas.dataset.skinId = skinId;
  const loaded = () => {
    layout();
    player.sync();
  };
  const failed = () => {
    running.delete(player);
    clear();
    schedule();
  };
  image.addEventListener("load", loaded);
  image.addEventListener("error", failed);
  const intersection = window.IntersectionObserver
    ? new IntersectionObserver(([value]) => {
        visible = value.isIntersecting;
        layout();
        player.sync();
      })
    : null;
  intersection?.observe(image);
  const resize = window.ResizeObserver
    ? new ResizeObserver(() => {
        layout();
        player.sync();
      })
    : null;
  resize?.observe(image);
  loaded();
  return {
    setEnabled(enabled) {
      requested = !!enabled;
      player.sync();
    },
    destroy() {
      disposed = true;
      intersection?.disconnect();
      resize?.disconnect();
      image.removeEventListener("load", loaded);
      image.removeEventListener("error", failed);
      running.delete(player);
      players.delete(player);
      clear();
      schedule();
      disconnectEnvironment();
    },
  };
}
