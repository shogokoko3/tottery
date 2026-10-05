// Canvas layers from the approved capture preview (2026-09-29).
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (x) => {
  x = clamp(x);
  return x * x * (3 - 2 * x);
};
const out = (x) => 1 - Math.pow(1 - clamp(x), 3);
const rgba = (r, g, b, a) => `rgba(${r},${g},${b},${clamp(a)})`;
function rounded(c, x, y, w, h, r) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}
function txt(
  c,
  str,
  x,
  y,
  size = 16,
  col = "#eed8a6",
  align = "center",
  serif = false,
) {
  c.font = `${serif ? "500" : "500"} ${size}px ${serif ? '"Hiragino Mincho ProN", "Yu Mincho", serif' : '"Hiragino Sans", "Yu Gothic", sans-serif'}`;
  c.textAlign = align;
  c.textBaseline = "middle";
  c.fillStyle = col;
  c.fillText(str, x, y);
}
function glow(c, x, y, r, color, alpha) {
  if (alpha <= 0) return;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(...color, alpha));
  g.addColorStop(0.24, rgba(...color, alpha * 0.68));
  g.addColorStop(1, rgba(...color, 0));
  c.fillStyle = g;
  c.fillRect(x - r, y - r, 2 * r, 2 * r);
}
function star(c, x, y, r, a = 1) {
  c.save();
  c.translate(x, y);
  c.globalAlpha *= a;
  c.fillStyle = "#fff4ce";
  c.beginPath();
  c.moveTo(0, -r);
  c.quadraticCurveTo(r * 0.17, -r * 0.17, r, 0);
  c.quadraticCurveTo(r * 0.17, r * 0.17, 0, r);
  c.quadraticCurveTo(-r * 0.17, r * 0.17, -r, 0);
  c.quadraticCurveTo(-r * 0.17, -r * 0.17, 0, -r);
  c.fill();
  c.restore();
}
function ornament(c, x, y, s = 1) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.strokeStyle = "#b58b45";
  c.lineWidth = 1.3;
  c.beginPath();
  c.moveTo(0, 26);
  c.lineTo(0, 0);
  c.lineTo(26, 0);
  c.moveTo(5, 20);
  c.lineTo(5, 5);
  c.lineTo(20, 5);
  c.stroke();
  star(c, 0, 0, 4, 0.9);
  c.restore();
}
function card(c, img, x, y, o = {}) {
  let w = 75 * (o.scale || 1),
    h = 101 * (o.scale || 1);
  c.save();
  c.translate(x, y);
  c.scale(o.sx === undefined ? 1 : o.sx, 1);
  c.rotate(o.angle || 0);
  c.globalAlpha *= o.alpha === undefined ? 1 : o.alpha;
  if (o.shadow !== false) {
    c.shadowColor = "rgba(0,0,0,.72)";
    c.shadowBlur = 13;
    c.shadowOffsetY = 6;
    rounded(c, -w / 2, -h / 2, w, h, 5);
    c.fillStyle = "#080e17";
    c.fill();
    c.shadowBlur = 0;
    c.shadowOffsetY = 0;
  }
  rounded(c, -w / 2, -h / 2, w, h, 5);
  c.save();
  c.clip();
  c.drawImage(img, -w / 2, -h / 2, w, h);
  if (o.tint) {
    c.fillStyle = rgba(255, 222, 146, o.tint);
    c.fillRect(-w / 2, -h / 2, w, h);
  }
  c.restore();
  if (o.outline) {
    c.strokeStyle = o.outline;
    c.lineWidth = 1.7;
    rounded(c, -w / 2 - 2, -h / 2 - 2, w + 4, h + 4, 6);
    c.stroke();
  }
  c.restore();
}
function slash(c, x, y, length, width, alpha, angle) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.globalAlpha *= alpha;
  const g = c.createLinearGradient(-length / 2, 0, length / 2, 0);
  g.addColorStop(0, "#c98a3000");
  g.addColorStop(0.27, "#e3aa4d");
  g.addColorStop(0.52, "#fff5c9");
  g.addColorStop(0.8, "#ffe8a0");
  g.addColorStop(1, "#facb6400");
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(-length / 2, width * 0.6);
  c.quadraticCurveTo(0, -width * 0.55, length / 2, -width * 0.35);
  c.quadraticCurveTo(length * 0.12, width * 0.3, -length / 2, width * 0.6);
  c.fill();
  c.strokeStyle = "#fffbe7";
  c.lineWidth = 1.7;
  c.beginPath();
  c.moveTo(-length * 0.3, width * 0.24);
  c.quadraticCurveTo(0, -width * 0.16, length * 0.31, -width * 0.24);
  c.stroke();
  c.restore();
}
function shock(c, x, y, u) {
  if (u < 0 || u > 580) return;
  const p = clamp(u / 460),
    fade = 1 - ease((u - 55) / 330);
  c.save();
  c.globalCompositeOperation = "lighter";
  glow(c, x, y, 174, [251, 176, 59], 0.7 * Math.exp(-u / 105));
  glow(c, x, y, 69, [255, 241, 187], 0.95 * Math.exp(-u / 85));
  const ring = clamp((u - 24) / 370);
  c.strokeStyle = rgba(255, 220, 134, 0.8 * Math.pow(1 - ring, 1.6));
  c.lineWidth = lerp(8, 1, ring);
  c.beginPath();
  c.ellipse(
    x,
    y + 22,
    lerp(13, 171, out(ring)),
    lerp(5, 72, out(ring)),
    0,
    0,
    Math.PI * 2,
  );
  c.stroke();
  slash(c, x, y, lerp(145, 350, out(clamp(u / 180))), 39, fade, -0.32);
  slash(c, x, y, 185, 18, fade * 0.6, 0.78);
  for (let i = 0; i < 17; i++) {
    const a = i * 2.399 + 0.11,
      start = 20 + (i % 3) * 9,
      reach = 110 + (i % 4) * 26,
      r = start + reach * out(p),
      tail = lerp(42, 2, p);
    const al = (1 - ease((p - 0.15) / 0.85)) * (0.5 + (i % 3) * 0.15);
    c.strokeStyle = rgba(255, 219, 133, al);
    c.lineWidth = i % 4 === 0 ? 3 : 1.5;
    c.beginPath();
    c.moveTo(x + Math.cos(a) * (r - tail), y + Math.sin(a) * (r - tail) * 0.73);
    c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.73);
    c.stroke();
  }
  star(c, x, y, 45 * (1 - clamp(u / 150)), 1 - clamp(u / 150));
  c.restore();
}
function shards(c, x, y, u, royal) {
  if (u < 0 || u > 1250) return;
  const p = clamp(u / (royal ? 1120 : 800)),
    fade = 1 - ease((p - 0.14) / 0.86);
  c.save();
  c.globalCompositeOperation = "lighter";
  for (let i = 0; i < (royal ? 42 : 28); i++) {
    const a = i * 2.399 + 0.32,
      r = (royal ? 300 : 210) * out(p) * (0.5 + (i % 5) * 0.12);
    const xx = x + Math.cos(a) * r,
      yy = y + Math.sin(a) * r * 0.72 + p * p * 30;
    const sz = (royal ? 7 : 5) + (i % 4) * 2,
      al = fade * (0.55 + (i % 3) * 0.18);
    c.save();
    c.translate(xx, yy);
    c.rotate(a + p * 1.8);
    c.globalAlpha = al;
    c.fillStyle = i % 3 ? "#ecc173" : "#fff2be";
    c.beginPath();
    c.moveTo(0, -sz);
    c.lineTo(sz * 0.5, 0);
    c.lineTo(0, sz * 0.7);
    c.lineTo(-sz * 0.27, 0);
    c.closePath();
    c.fill();
    c.restore();
    if (i % 4 === 0) star(c, xx, yy, 7 * (1 - p * 0.6), al);
  }
  c.restore();
}

const CAPTURE_SCALE = 1.46,
  FW = 75 * CAPTURE_SCALE,
  FH = 101 * CAPTURE_SCALE;
const EDGES = [
  [-0.5, -0.5],
  [-0.18, -0.5],
  [0.2, -0.5],
  [0.5, -0.5],
  [0.5, -0.15],
  [0.5, 0.22],
  [0.5, 0.5],
  [0.13, 0.5],
  [-0.22, 0.5],
  [-0.5, 0.5],
  [-0.5, 0.11],
  [-0.5, -0.2],
];
const CRACK_CENTER = [-0.04 * FW, 0.03 * FH];
const SEAMS = EDGES.map((e, i) => {
  const ex = e[0] * FW,
    ey = e[1] * FH,
    dx = ex - CRACK_CENTER[0],
    dy = ey - CRACK_CENTER[1],
    len = Math.hypot(dx, dy),
    nx = -dy / len,
    ny = dx / len;
  return [
    CRACK_CENTER,
    ...[0.24, 0.52, 0.77].map((t, j) => {
      const side = ((i + j) % 2 ? 1 : -1) * (j === 1 ? 3.6 : 2.4);
      return [
        CRACK_CENTER[0] + dx * t + nx * side,
        CRACK_CENTER[1] + dy * t + ny * side,
      ];
    }),
    [ex, ey],
  ];
});
function strokePartial(c, points, progress) {
  const lengths = points
    .slice(1)
    .map((v, i) => Math.hypot(v[0] - points[i][0], v[1] - points[i][1]));
  let remain = lengths.reduce((a, b) => a + b, 0) * clamp(progress);
  c.beginPath();
  c.moveTo(...points[0]);
  for (let i = 0; i < lengths.length && remain > 0; i++) {
    const u = Math.min(1, remain / lengths[i]);
    c.lineTo(
      lerp(points[i][0], points[i + 1][0], u),
      lerp(points[i][1], points[i + 1][1], u),
    );
    remain -= lengths[i];
  }
  c.stroke();
}
function crackProgress(t, start, finish) {
  return clamp((t - start) / Math.max(1, finish - start - 85));
}
function crackLight(c, x, y, t, start, finish, king) {
  if (t < start || t >= finish) return;
  const p = crackProgress(t, start, finish);
  c.save();
  c.globalCompositeOperation = "lighter";
  glow(
    c,
    x,
    y,
    lerp(105, king ? 230 : 174, p),
    [243, 176, 68],
    lerp(0.025, 0.22, p),
  );
  for (let i = 0; i < 10; i++) {
    const a = i * 2.399 + 0.2,
      travel = clamp((p - 0.2 - (i % 3) * 0.08) / 0.75),
      r = lerp(165 + (i % 3) * 13, 62, ease(travel));
    const alpha = clamp((p - 0.16) * 1.5) * (0.45 + 0.04 * (i % 4));
    c.strokeStyle = rgba(247, 219, 160, alpha);
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(x + Math.cos(a) * (r + 10), y + Math.sin(a) * (r + 10) * 0.83);
    c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.83);
    c.stroke();
  }
  c.restore();
}
function cracks(c, x, y, t, start, finish) {
  if (t < start || t >= finish) return;
  const p = crackProgress(t, start, finish),
    u = Math.min(t - start, finish - start - 85);
  c.save();
  c.translate(x, y);
  rounded(c, -FW / 2, -FH / 2, FW, FH, 5);
  c.clip();
  const groups = [
    { ids: [0, 4, 8], start: 0, span: 0.5 },
    { ids: [2, 6, 10], start: 0.3, span: 0.55 },
    { ids: [1, 3, 5, 7, 9, 11], start: 0.76, span: 0.24 },
  ];
  for (const group of groups)
    for (const [n, i] of group.ids.entries()) {
      const progress = clamp((p - group.start - n * 0.025) / group.span);
      if (progress <= 0) continue;
      c.lineJoin = "round";
      c.lineCap = "round";
      c.strokeStyle = "rgba(30,16,6,.94)";
      c.lineWidth = 2.8;
      strokePartial(c, SEAMS[i], progress);
      c.shadowColor = "#ffd675";
      c.shadowBlur = lerp(1, 13, Math.pow(p, 2));
      c.strokeStyle = rgba(255, 220, 139, 0.55 + 0.42 * p);
      c.lineWidth = 0.9 + 1.1 * p;
      strokePartial(c, SEAMS[i], progress);
      c.shadowBlur = 0;
      c.strokeStyle = rgba(255, 250, 226, 0.2 + 0.73 * Math.pow(p, 2));
      c.lineWidth = 0.45 + 0.55 * p;
      strokePartial(c, SEAMS[i], progress);
      if (p > 0.5 && i % 4 === 0) {
        const b = SEAMS[i][2];
        c.strokeStyle = rgba(255, 231, 165, 0.8 * p);
        c.lineWidth = 0.65;
        strokePartial(
          c,
          [b, [b[0] + 9, b[1] - 6], [b[0] + 14, b[1] - 7]],
          clamp((p - 0.5) * 2),
        );
      }
    }
  // Local seams get brighter; the entire illustration stays legible until release.
  const g = c.createRadialGradient(
    CRACK_CENTER[0],
    CRACK_CENTER[1],
    2,
    CRACK_CENTER[0],
    CRACK_CENTER[1],
    41,
  );
  g.addColorStop(0, rgba(255, 233, 173, 0.15 * p * p));
  g.addColorStop(1, "#ffd47700");
  c.fillStyle = g;
  c.fillRect(-FW / 2, -FH / 2, FW, FH);
  c.restore();
}
function fracture(c, img, x, y, u, royal) {
  const life = royal ? 820 : 620;
  if (u < 0 || u > life) return;
  const p = clamp(u / life);
  for (let i = 0; i < SEAMS.length; i++) {
    const seam = SEAMS[i],
      next = SEAMS[(i + 1) % SEAMS.length],
      points = [...seam, ...[...next].reverse().slice(0, -1)],
      end = seam[seam.length - 1],
      nend = next[next.length - 1],
      cx = (CRACK_CENTER[0] + end[0] + nend[0]) / 3,
      cy = (CRACK_CENTER[1] + end[1] + nend[1]) / 3;
    const a = Math.atan2(cy, cx) + (i % 2 ? 0.09 : -0.09),
      reach = (royal ? 214 : 158) + (i % 4) * 16,
      dr = out(p) * reach,
      alpha = 1 - ease((p - 0.1) / 0.9);
    c.save();
    c.translate(x + Math.cos(a) * dr, y + Math.sin(a) * dr * 0.74 + p * p * 65);
    c.translate(cx, cy);
    c.rotate((i % 2 ? 1 : -1) * p * (0.38 + (i % 3) * 0.26));
    c.translate(-cx, -cy);
    c.globalAlpha = alpha;
    c.beginPath();
    c.moveTo(...points[0]);
    for (const point of points.slice(1)) c.lineTo(...point);
    c.closePath();
    c.save();
    c.clip();
    c.drawImage(img, -FW / 2, -FH / 2, FW, FH);
    c.fillStyle = rgba(255, 228, 156, 0.55 * (1 - p));
    c.fillRect(-FW / 2, -FH / 2, FW, FH);
    c.restore();
    c.shadowColor = "#ffe5a7";
    c.shadowBlur = 5 * (1 - p);
    c.strokeStyle = rgba(255, 245, 210, 0.95 * (1 - p));
    c.lineWidth = 1.6;
    c.stroke();
    c.restore();
  }
}
function release(c, x, y, u, royal) {
  if (u < 0 || u > 950) return;
  const p = clamp(u / (royal ? 810 : 570));
  c.save();
  c.globalCompositeOperation = "lighter";
  glow(c, x, y, royal ? 400 : 245, [255, 193, 88], 0.5 * Math.exp(-u / 150));
  glow(c, x, y, royal ? 146 : 99, [255, 240, 189], 0.92 * Math.exp(-u / 100));
  const ring = out(p);
  c.strokeStyle = rgba(255, 220, 141, 0.72 * (1 - p));
  c.lineWidth = lerp(8, 1, p);
  c.beginPath();
  c.ellipse(
    x,
    y + 30,
    lerp(27, royal ? 320 : 218, ring),
    lerp(10, royal ? 141 : 88, ring),
    0,
    0,
    Math.PI * 2,
  );
  c.stroke();
  slash(c, x, y, royal ? 550 : 385, royal ? 43 : 31, Math.exp(-u / 110), -0.2);
  c.restore();
}
function royalLight(c, x, y, u) {
  if (u < 0 || u > 2450) return;
  const charge = clamp(u / 750),
    blast = u - 750,
    fade = 1 - ease((blast - 470) / 1350);
  c.save();
  c.globalCompositeOperation = "lighter";
  if (blast < 0) {
    glow(c, x, y, 145, [242, 178, 72], 0.23 * charge);
    glow(c, x, y, lerp(130, 58, charge), [255, 224, 152], 0.47 * charge);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6 + 0.2,
        r = lerp(160, 42, ease(charge));
      const xx = x + Math.cos(a) * r,
        yy = y + Math.sin(a) * r;
      star(c, xx, yy, 3 + charge * 4, charge * 0.9);
    }
    c.strokeStyle = rgba(255, 219, 139, 0.7 * charge);
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(
      x,
      y,
      lerp(160, 53, charge),
      lerp(80, 26, charge),
      -0.2,
      0,
      Math.PI * 2,
    );
    c.stroke();
  } else {
    const a = (0.7 + 0.3 * Math.exp(-blast / 120)) * fade;
    glow(c, x, y, 470, [227, 147, 39], 0.4 * a);
    glow(c, x, y, 215, [255, 214, 123], 0.62 * a);
    for (let i = 0; i < 21; i++) {
      const angle = (i * Math.PI * 2) / 21 + 0.09,
        len = (305 + (i % 5) * 35) * lerp(0.5, 1, out(blast / 210)),
        spread = 0.02 + (i % 4) * 0.018;
      const g = c.createLinearGradient(
        x,
        y,
        x + Math.cos(angle) * len,
        y + Math.sin(angle) * len,
      );
      g.addColorStop(0, rgba(255, 244, 195, 0.74 * a));
      g.addColorStop(0.23, rgba(255, 215, 124, 0.48 * a));
      g.addColorStop(0.7, rgba(232, 160, 59, 0.15 * a));
      g.addColorStop(1, "#e5a14800");
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(
        x + Math.cos(angle - spread) * len,
        y + Math.sin(angle - spread) * len,
      );
      c.lineTo(
        x + Math.cos(angle + spread) * len,
        y + Math.sin(angle + spread) * len,
      );
      c.closePath();
      c.fill();
    }
    // One expanding burst rather than repeated screen-wide flashes.
    const spread = out(blast / 420);
    c.strokeStyle = rgba(255, 238, 172, 0.75 * (1 - clamp(blast / 650)));
    c.lineWidth = lerp(10, 1, spread);
    c.beginPath();
    c.arc(x, y, lerp(40, 360, spread), 0, Math.PI * 2);
    c.stroke();
  }
  c.restore();
}

// Approved crack-charge-v4 artwork, kept in card-local units (75 × 101).
// This renderer accepts only a back texture and a public royal cue. Face artwork
// is rendered by CardFace after the shared timeline allows it.
export function paintCaptureBack(c, back, t, q, scale = 1) {
  c.save();
  c.scale(scale, scale);
  if (q.reduced) {
    if (t < q.reveal)
      card(c, back, 0, 0, {
        scale: t >= q.ready ? CAPTURE_SCALE : 1,
        alpha: 1 - ease((t - q.melt) / (q.reveal - q.melt)),
      });
    c.restore();
    return;
  }
  crackLight(c, 0, -28, t, q.crack, q.melt, false);
  if (t < q.melt) {
    const p = clamp((t - q.lift) / (q.ready - q.lift));
    const lift =
      28 * out(p) + (t >= q.hit ? 8 * (1 - ease((t - q.lift) / 110)) : 0);
    card(c, back, 0, -lift, { scale: 1 + (CAPTURE_SCALE - 1) * ease(p) });
    cracks(c, 0, -lift, t, q.crack, q.melt);
  }
  shock(c, 0, 0, t - q.hit);
  fracture(c, back, 0, -28, t - q.melt, false);
  release(c, 0, -28, t - q.melt, false);
  shards(c, 0, -28, t - q.melt, false);
  if (t >= q.melt && t < q.reveal)
    glow(c, 0, -28, 96, [244, 207, 123], 0.13 * (1 - ease((t - q.melt) / 640)));
  c.restore();
}
export function paintRoyalLight(c, elapsed, scale = 1) {
  c.save();
  c.scale(scale, scale);
  royalLight(c, 0, 0, elapsed + 750);
  c.restore();
}

/** 取られた駒。中央へ運ぶ時刻は共通だが、ひびは暗く、破片は下へ落とす。
 * 加算発光・星・光輪は使わない。受け取るのは裏面だけで正体は参照しない。 */
export function paintLostBack(c, back, t, q, scale = 1) {
  c.save();
  c.scale(scale, scale);
  if (q.reduced) {
    if (t < q.reveal)
      card(c, back, 0, 0, {
        scale: t >= q.ready ? CAPTURE_SCALE : 1,
        alpha: 1 - ease((t - q.melt) / (q.reveal - q.melt)),
      });
    c.restore();
    return;
  }
  if (t < q.melt) {
    const p = clamp((t - q.lift) / (q.ready - q.lift));
    const lift =
      28 * out(p) + (t >= q.hit ? 8 * (1 - ease((t - q.lift) / 110)) : 0);
    card(c, back, 0, -lift, { scale: 1 + (CAPTURE_SCALE - 1) * ease(p) });
    if (t >= q.crack) {
      c.translate(0, -lift);
      c.fillStyle = "#391b2590";
      c.fillRect(-FW / 2, -FH / 2, FW, FH);
      const p = ease((t - q.crack) / Math.max(1, q.melt - q.crack));
      for (const index of [1, 4, 7, 10]) {
        c.strokeStyle = "#060d17";
        c.lineWidth = 5;
        strokePartial(c, SEAMS[index], p);
        c.strokeStyle = "#bb6965";
        c.lineWidth = 1.3;
        strokePartial(c, SEAMS[index], p);
      }
    }
  } else if (t < q.reveal) {
    const p = clamp((t - q.melt) / (q.reveal - q.melt));
    c.translate(0, -28);
    // Four jagged pieces separate and lose height under gravity.
    const edge = [
      [-FW / 2, -FH / 2],
      [FW / 2, -FH / 2],
      [FW / 2, FH / 2],
      [-FW / 2, FH / 2],
    ];
    for (let i = 0; i < 4; i++) {
      const a = edge[i],
        b = edge[(i + 1) % 4];
      const dx = (a[0] + b[0]) / FW,
        dy = (a[1] + b[1]) / FH;
      c.save();
      c.translate(dx * 23 * p, dy * 14 * p + 65 * p * p);
      c.rotate((i % 2 ? 1 : -1) * p * 0.22);
      c.globalAlpha *= 1 - ease(p);
      c.beginPath();
      c.moveTo(...a);
      c.lineTo(...b);
      c.lineTo(b[0] * 0.45 + 4, b[1] * 0.45 - 3);
      c.lineTo(0, 0);
      c.lineTo(a[0] * 0.45 + 4, a[1] * 0.45 - 3);
      c.closePath();
      c.clip();
      c.drawImage(back, -FW / 2, -FH / 2, FW, FH);
      c.fillStyle = "#281521a6";
      c.fillRect(-FW / 2, -FH / 2, FW, FH);
      c.restore();
    }
  }
  c.restore();
}
