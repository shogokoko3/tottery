// Canvas artwork and timing carried over from the approved magician preview.
// order maps board slot -> image piece; animation needs the inverse mapping.
export function createBattlePassPainter(ctx, art, order) {
  if (
    !Array.isArray(order) ||
    order.length !== 25 ||
    new Set(order).size !== 25 ||
    order.some((piece) => !Number.isInteger(piece) || piece < 0 || piece > 24)
  ) {
    throw new TypeError("25 unique image pieces are required.");
  }
  const permutation = Array(25);
  order.forEach((piece, slot) => {
    permutation[piece] = slot;
  });
  let width = 360,
    height = 480,
    time = 0,
    complete = false,
    reduced = false;
  const design = { sparkles: "華やか" };
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = (v) => {
    v = clamp(v);
    return v * v * (3 - 2 * v);
  };
  const lerp = (a, b, p) => a + (b - a) * p;
  const particles = Array.from({ length: 76 }, (_, i) => ({
    angle: i * 2.3999632,
    r: 0.24 + ((i * 47) % 79) / 100,
    spin: (i % 2 ? 1 : -1) * ((i % 7) + 1),
    size: 1 + (i % 4) * 0.55,
  }));
  function position(slot, gap = 4) {
    const w = width / 5,
      h = height / 5;
    return {
      x: ((slot % 5) + 0.5) * w,
      y: (Math.floor(slot / 5) + 0.5) * h,
      w: w - gap,
      h: h - gap,
    };
  }
  function outline(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }
  function star(x, y, r, alpha = 1, rotation = 0) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.quadraticCurveTo(r * 0.16, -r * 0.16, r, 0);
    ctx.quadraticCurveTo(r * 0.16, r * 0.16, 0, r);
    ctx.quadraticCurveTo(-r * 0.16, r * 0.16, -r, 0);
    ctx.quadraticCurveTo(-r * 0.16, -r * 0.16, 0, -r);
    ctx.fillStyle = "#ffe7ac";
    ctx.fill();
    ctx.restore();
  }
  function tile(
    piece,
    p,
    scale = 1,
    rotation = 0,
    glow = 0,
    hidden = false,
    alpha = 1,
    gap = 4,
  ) {
    const size = position(piece, gap),
      w = size.w,
      h = size.h;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(rotation);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    if (glow > 0) {
      ctx.shadowColor = "#f4c779";
      ctx.shadowBlur = glow * 15;
    }
    outline(-w / 2, -h / 2, w, h, 2);
    ctx.fillStyle = "#191b30";
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.save();
    ctx.clip();
    if (!hidden && art.complete && art.naturalWidth) {
      ctx.drawImage(
        art,
        ((piece % 5) * art.naturalWidth) / 5,
        (Math.floor(piece / 5) * art.naturalHeight) / 5,
        art.naturalWidth / 5,
        art.naturalHeight / 5,
        -w / 2,
        -h / 2,
        w,
        h,
      );
    } else {
      const fill = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
      fill.addColorStop(0, "#484065");
      fill.addColorStop(1, "#161b30");
      ctx.fillStyle = fill;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = "#a58b59";
      ctx.lineWidth = 0.7;
      outline(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 1);
      ctx.stroke();
      star(0, 0, w * 0.18, 1);
    }
    ctx.restore();
    ctx.strokeStyle = glow > 0 ? "#ffe6a5" : "#87734f";
    ctx.lineWidth = glow > 0 ? 1.4 : 0.7;
    outline(-w / 2, -h / 2, w, h, 2);
    ctx.stroke();
    ctx.restore();
  }
  function magicHat(alpha, turn = 0) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(width * 0.5, height * 0.51);
    ctx.rotate(Math.sin(turn * 2) * 0.07);
    const s = width / 360;
    ctx.scale(s, s);
    const halo = ctx.createRadialGradient(0, -24, 4, 0, -24, 110);
    halo.addColorStop(0, "#c6a0ff65");
    halo.addColorStop(0.45, "#885bbc24");
    halo.addColorStop(1, "#9364d800");
    ctx.fillStyle = halo;
    ctx.fillRect(-130, -145, 260, 260);
    ctx.shadowColor = "#bc8be9";
    ctx.shadowBlur = 20;
    ctx.fillStyle = "#14111f";
    ctx.strokeStyle = "#eccb7f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 33, 63, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    const body = ctx.createLinearGradient(-40, 0, 40, 0);
    body.addColorStop(0, "#17152a");
    body.addColorStop(0.5, "#393047");
    body.addColorStop(1, "#100f1c");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-35, 31);
    ctx.lineTo(-45, -39);
    ctx.quadraticCurveTo(0, -53, 45, -39);
    ctx.lineTo(35, 31);
    ctx.quadraticCurveTo(0, 45, -35, 31);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#77273e";
    ctx.beginPath();
    ctx.moveTo(-37, 7);
    ctx.quadraticCurveTo(0, 18, 37, 7);
    ctx.lineTo(35, 26);
    ctx.quadraticCurveTo(0, 37, -35, 26);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#0b0d1b";
    ctx.beginPath();
    ctx.ellipse(0, -39, 45, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    star(23, 19, 10, 1, turn * 0.15);
    for (let k = 0; k < 3; k++) {
      ctx.save();
      ctx.translate(Math.sin(turn * 1.8 + k * 2.1) * 28, -54 - k * 19);
      ctx.rotate(-0.25 + k * 0.2);
      ctx.strokeStyle = ["#d9b1ff", "#ffe4a8", "#b9a0ed"][k];
      ctx.globalAlpha = alpha * (0.55 + 0.15 * Math.sin(turn * 3 + k));
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 27 - k * 3, 6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
  function burst(p) {
    if (p <= 0 || p >= 1) return;
    const n = design.sparkles === "華やか" ? 76 : 32;
    for (let i = 0; i < n; i++) {
      const a = particles[i],
        r = width * (0.1 + 0.64 * ease(p)) * a.r;
      star(
        width * 0.5 + Math.cos(a.angle) * r,
        height * 0.5 + Math.sin(a.angle) * r * 1.2,
        a.size * (1 + Math.sin(p * Math.PI)),
        (1 - p) * 0.9,
        a.spin * p,
      );
    }
  }
  function draw() {
    ctx.clearRect(0, 0, width, height);
    const bg = ctx.createRadialGradient(
      width * 0.5,
      height * 0.5,
      10,
      width * 0.5,
      height * 0.5,
      height * 0.65,
    );
    bg.addColorStop(0, "#28243e");
    bg.addColorStop(1, "#060f1c");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    if (complete || time >= 7100 || (reduced && time >= 1000)) {
      const fade = complete
        ? 1
        : ease((time - (reduced ? 1000 : 6650)) / (reduced ? 200 : 450));
      if (art.complete && art.naturalWidth) {
        ctx.globalAlpha = fade;
        ctx.drawImage(art, 0, 0, width, height);
        ctx.globalAlpha = 1;
      }
      ctx.shadowColor = "#efcb75";
      ctx.shadowBlur = complete ? 5 : 16;
      ctx.strokeStyle = "#e6c681";
      ctx.lineWidth = 2;
      outline(2, 2, width - 4, height - 4, 4);
      ctx.stroke();
      ctx.shadowBlur = 0;
      if (!reduced) burst((time - 6800) / 1800);
      return;
    }
    const assemble = reduced
      ? ease((time - 450) / 500)
      : ease((time - 6470) / 650);
    for (let i = 0; i < 25; i++) {
      const start = position(permutation[i]),
        dest = position(i, 4 * (1 - assemble));
      let p = { ...start },
        scale = 1,
        rotate = 0,
        glow = 0,
        hidden = false,
        alpha = 1;
      if (reduced) {
        p.x = lerp(start.x, dest.x, assemble);
        p.y = lerp(start.y, dest.y, assemble);
      } else if (time < 750) {
        glow = ease(time / 750) * 0.5;
      } else if (time >= 750 && time < 1800) {
        glow = ease((time - 750) / 1000) * 0.8;
        scale = 1 + Math.sin(((time - 750) / 1050) * Math.PI) * 0.015;
      } else if (time >= 1800) {
        const lift = ease((time - 1800) / 1100);
        const theta = (i * Math.PI * 2) / 25 + (time - 1800) / 880;
        const rx = width * 0.35,
          ry = height * 0.31;
        const orbit = {
          x: width * 0.5 + Math.cos(theta) * rx,
          y: height * 0.5 + Math.sin(theta) * ry,
        };
        p.x = lerp(start.x, orbit.x, lift);
        p.y = lerp(start.y, orbit.y, lift);
        scale = lerp(1, 0.43, lift);
        rotate = Math.sin(theta) * 0.27 * lift;
        glow = 0.85;
        if (time >= 4050) {
          const delay =
            (Math.abs((i % 5) - 2) + Math.abs(Math.floor(i / 5) - 2)) * 115;
          const flight = ease((time - 4050 - delay) / 1560);
          const launchAngle =
            (i * Math.PI * 2) / 25 + (4050 + delay - 1800) / 880;
          const from = {
            x: width * 0.5 + Math.cos(launchAngle) * rx,
            y: height * 0.5 + Math.sin(launchAngle) * ry,
          };
          if (time >= 4050 + delay) {
            p.x =
              lerp(from.x, dest.x, flight) +
              Math.sin(flight * Math.PI) * width * 0.1 * Math.sin(launchAngle);
            p.y =
              lerp(from.y, dest.y, flight) -
              Math.sin(flight * Math.PI) * height * 0.1;
            scale = lerp(0.43, 1, flight);
            rotate = Math.sin(flight * Math.PI) * 0.3 * Math.cos(launchAngle);
            glow = 1 - flight * 0.6;
            if (flight > 0 && flight < 1) {
              ctx.beginPath();
              ctx.moveTo(from.x, from.y);
              ctx.quadraticCurveTo(width * 0.5, height * 0.3, p.x, p.y);
              ctx.strokeStyle = "#ddbb7945";
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          }
        }
        if (time >= 6470) {
          p = dest;
          scale = 1;
          rotate = 0;
          glow = 1 - assemble;
        }
      }
      tile(i, p, scale, rotate, glow, hidden, alpha, 4 * (1 - assemble));
    }
    if (!reduced && time > 1150 && time < 5700) {
      const hatIn = ease((time - 1150) / 700),
        hatOut = 1 - ease((time - 4620) / 850);
      magicHat(hatIn * hatOut, time / 1000);
    }
    if (!reduced && time > 850 && time < 6800) {
      const n = design.sparkles === "華やか" ? 36 : 14,
        a = ease((time - 850) / 800) * (1 - ease((time - 6100) / 650));
      for (let k = 0; k < n; k++) {
        const p = particles[k],
          angle = p.angle + time / 1700;
        const r = width * (0.28 + 0.14 * Math.sin(k));
        star(
          width * 0.5 + Math.cos(angle) * r,
          height * 0.5 + Math.sin(angle) * r * 1.4,
          p.size * 0.75,
          a * 0.65,
          angle,
        );
      }
    }
    if (time > 6470 && !reduced) {
      ctx.globalAlpha = ease((time - 6600) / 500);
      if (art.complete && art.naturalWidth)
        ctx.drawImage(art, 0, 0, width, height);
      ctx.globalAlpha = 1;
      burst((time - 6800) / 1800);
    }
  }
  return function paint(options) {
    width = options.width;
    height = options.height;
    time = options.time;
    complete = !!options.complete;
    reduced = !!options.reduced;
    draw();
  };
}
