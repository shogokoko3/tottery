import { useEffect, useRef } from "react";
const ease = (x) => {
  x = Math.max(0, Math.min(1, x));
  return x * x * (3 - 2 * x);
};
export function FieldAbilityCanvas({
  theme,
  event,
  startedAt,
  flipped = false,
}) {
  const ref = useRef(),
    live = useRef();
  live.current = { theme, event, startedAt, flipped };
  useEffect(() => {
    let frame,
      localStart = performance.now();
    const canvas = ref.current,
      ctx = canvas.getContext("2d");
    function draw(now) {
      const { theme, event, startedAt, flipped } = live.current;
      const time = Math.min(
        6,
        Math.max(0, (now - (startedAt ?? localStart)) / 1000),
      );
      const w = canvas.clientWidth,
        h = canvas.clientHeight,
        d = Math.min(devicePixelRatio, 2);
      if (canvas.width !== Math.round(w * d)) {
        canvas.width = Math.round(w * d);
        canvas.height = Math.round(h * d);
      }
      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const glow = (x, y, r, color, a) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, color);
        g.addColorStop(1, "transparent");
        ctx.globalAlpha = a;
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      };
      if (event && time < 6) {
        let f = Math.sin(Math.PI * Math.min(time / 6, 1)),
          hit = event.hit,
          targets = event.targets;
        ctx.globalAlpha = 1;
        if (theme === "forest") {
          let dim = ease(time / 0.65) * (1 - ease((time - 4.3) / 1.7));
          ctx.fillStyle = "#020a10";
          ctx.globalAlpha = dim * 0.88;
          ctx.fillRect(0, 0, w, h);
          ctx.globalAlpha = 1;
        }
        if (theme === "ice") {
          const storm = ease(time / 1.25) * (1 - ease((time - 3.85) / 1.8));
          ctx.globalAlpha = storm * 0.985;
          const veil = ctx.createLinearGradient(0, 0, w, h);
          veil.addColorStop(0, "#edfaff");
          veil.addColorStop(0.5, "#c3e3f0");
          veil.addColorStop(1, "#effbff");
          ctx.fillStyle = veil;
          ctx.fillRect(0, 0, w, h);
          for (let i = 0; i < 12; i++) {
            let xx = ((i * 173 + time * 190) % (w + 300)) - 150,
              yy = (i * 0.13 * h + Math.sin(time * 1.3 + i) * h * 0.12) % h;
            glow(xx, yy, w * 0.36, "#ffffff", storm * 0.35);
          }
          ctx.strokeStyle = "#ffffff";
          for (let layer = 0; layer < 3; layer++) {
            ctx.lineWidth = [0.8, 1.7, 3][layer];
            for (let i = 0; i < 180; i++) {
              let xx = (i * 47.3 + time * (260 + layer * 150)) % w,
                yy = (i * 71.9 + time * (90 + layer * 40)) % h,
                len = 10 + layer * 14;
              ctx.globalAlpha = storm * (0.25 + layer * 0.22);
              ctx.beginPath();
              ctx.moveTo(xx, yy);
              ctx.lineTo(xx - len, yy - len * 0.32);
              ctx.stroke();
            }
          }
        }

        if (theme === "sea") {
          // Three broad spiral currents curl clockwise and contract into the board center.
          const unit = Math.min(w, h),
            cx = w * 0.5,
            cy = h * 0.5;
          const pull = ease((time - 1.5) / 2.7),
            envelope =
              ease((time - 0.45) / 0.9) * (1 - ease((time - 4.4) / 1.25));
          const radius = unit * 0.58 * (1 - pull * 0.62),
            rotation = time * 0.65;
          ctx.save();
          ctx.beginPath();
          ctx.rect(w * 0.06, h * 0.06, w * 0.88, h * 0.88);
          ctx.clip();
          ctx.lineCap = "round";
          let basin = ctx.createRadialGradient(cx, cy, 0, cx, cy, unit * 0.42);
          basin.addColorStop(0, "#063c55");
          basin.addColorStop(0.5, "#137c9944");
          basin.addColorStop(1, "#137c9900");
          ctx.globalAlpha = envelope * 0.55;
          ctx.fillStyle = basin;
          ctx.fillRect(0, 0, w, h);
          function spiral(u, arm) {
            const r = radius * (0.04 + 0.96 * u),
              angle = rotation + (arm * Math.PI * 2) / 3 + (1 - u) * 4.5;
            return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
          }
          for (let arm = 0; arm < 3; arm++) {
            // A dark water body under a narrower turquoise shoulder and white foam rim.
            for (let layer = 0; layer < 3; layer++)
              for (let j = 0; j < 96; j++) {
                let u = j / 96,
                  v = (j + 1) / 96,
                  aa = spiral(u, arm),
                  bb = spiral(v, arm);
                ctx.globalAlpha =
                  envelope *
                  [0.36, 0.52, 0.7][layer] *
                  Math.sin(Math.PI * (0.08 + u * 0.88));
                ctx.strokeStyle = ["#075c7c", "#52c6d4", "#e1ffff"][layer];
                ctx.lineWidth =
                  unit * [0.061, 0.034, 0.0055][layer] * (0.25 + u * 0.75);
                ctx.beginPath();
                ctx.moveTo(...aa);
                ctx.lineTo(...bb);
                ctx.stroke();
              }
            // Small groups of foam travel inward along the current, without flashing.
            for (let group = 0; group < 5; group++) {
              let u = 1 - ((time * 0.19 + group * 0.2) % 1),
                edge = Math.sin(Math.PI * u);
              for (let dot = 0; dot < 3; dot++) {
                let v = Math.max(0.01, u - dot * 0.009),
                  point = spiral(v, arm);
                ctx.globalAlpha = envelope * edge * 0.65;
                ctx.fillStyle = "#efffff";
                ctx.beginPath();
                ctx.ellipse(
                  point[0],
                  point[1],
                  unit * 0.003,
                  unit * 0.0018,
                  rotation + arm,
                  0,
                  Math.PI * 2,
                );
                ctx.fill();
              }
            }
          }
          ctx.globalAlpha = envelope * 0.6;
          ctx.strokeStyle = "#9bdae3";
          ctx.lineWidth = unit * 0.003;
          ctx.beginPath();
          ctx.arc(
            cx,
            cy,
            unit * 0.024 * (1 - pull * 0.3),
            rotation,
            rotation + Math.PI * 1.65,
          );
          ctx.stroke();
          ctx.restore();
        }
        for (const target of targets) {
          let x = w * ((0.5 + (flipped ? 8 - target.col : target.col)) / 9),
            y = h * ((0.5 + (flipped ? 8 - target.row : target.row)) / 9),
            rr = w * 0.059;
          if (theme === "earth") {
            const orbitEnd = 1.75,
              arrival = 3.05,
              cx = w * 0.5,
              cy = h * 0.5,
              radius = w * 0.115;
            function position(u, i) {
              const phase = (i * Math.PI * 2) / 5,
                ang = phase + Math.min(u, orbitEnd) * 2.7;
              let ox = cx + Math.cos(ang) * radius,
                oy = cy + Math.sin(ang) * radius;
              if (u <= orbitEnd) return [ox, oy];
              let q = ease((u - orbitEnd) / (arrival - orbitEnd));
              return [
                ox + (x - ox) * q + Math.sin(q * Math.PI) * w * 0.035,
                oy + (y - oy) * q - Math.sin(q * Math.PI) * h * 0.065,
              ];
            }
            const fade =
              ease(time / 0.35) * (1 - ease((time - arrival) / 0.65));
            for (let i = 0; i < 5; i++) {
              ctx.save();
              ctx.strokeStyle = "#86ffda";
              ctx.lineWidth = 2;
              ctx.shadowColor = "#58ffc5";
              ctx.shadowBlur = 10;
              for (let j = 16; j > 0; j--) {
                let u = Math.max(0, time - j * 0.022),
                  v = Math.max(0, u + 0.025),
                  a = position(u, i),
                  b = position(v, i);
                ctx.globalAlpha = fade * (1 - j / 18) * 0.7;
                ctx.beginPath();
                ctx.moveTo(...a);
                ctx.lineTo(...b);
                ctx.stroke();
              }
              let [ox, oy] = position(time, i);
              ctx.restore();
              glow(ox, oy, rr * 0.65, "#54ffc6", fade * 0.65);
              glow(ox, oy, rr * 0.23, "#ecfff5", fade);
            }
            if (hit)
              glow(
                x,
                y,
                rr * 2,
                "#a8ffe0",
                Math.sin(Math.PI * ease((time - arrival) / 2.6)) * 0.8,
              );
          }
          if (theme === "forest") {
            let b = ease((time - 1) / 1.1) * (1 - ease((time - 4.2) / 1.8));
            ctx.globalAlpha = b * 0.95;
            let g = ctx.createLinearGradient(x - w * 0.19, 0, x, y + rr);
            g.addColorStop(0, "#fffab3");
            g.addColorStop(1, "#fffde010");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(x - w * 0.23, 0);
            ctx.lineTo(x - w * 0.17, 0);
            ctx.lineTo(x + rr, y + rr);
            ctx.lineTo(x - rr, y + rr);
            ctx.fill();
            glow(x, y, rr * 1.8, "#fff6ba", b * 0.8);
          }
          if (theme === "ice") {
            let reveal =
              ease((time - 4.05) / 0.55) * (1 - ease((time - 5.1) / 0.9));
            glow(x, y, rr * 1.8, "#c2faff", reveal * 0.9);
            ctx.strokeStyle = "#e3fcff";
            ctx.globalAlpha = reveal;
            ctx.lineWidth = 2;
            for (let i = 0; i < 8; i++) {
              let a = (i * Math.PI) / 4;
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(
                x + Math.cos(a) * rr * 1.25,
                y + Math.sin(a) * rr * 1.25,
              );
              ctx.stroke();
            }
          }
          if (theme === "sky") {
            let b = Math.sin(Math.PI * ease(time / 5.8));
            for (let i = 0; i < 12; i++) {
              let a = i * 2.4;
              glow(
                x + Math.cos(a + time * 0.2) * rr * 0.65,
                y + Math.sin(a) * rr * 0.35,
                rr * 0.94,
                "#f8fbff",
                b * 0.9,
              );
            }
          }
          if (theme === "heaven") {
            const bloom =
              ease((time - 0.3) / 1.15) * (1 - ease((time - 4.05) / 1.9));
            glow(x, y, rr * 4.5, "#ffe7a1", bloom * 0.85);
            glow(x, y, rr * 2.8, "#fff4cc", bloom);
            ctx.save();
            ctx.globalAlpha = bloom;
            ctx.fillStyle = "#fffef2";
            ctx.shadowColor = "#fff6cc";
            ctx.shadowBlur = rr;
            ctx.beginPath();
            ctx.ellipse(x, y, rr * 1.05, rr * 1.45, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            ctx.globalAlpha = bloom * 0.65;
            let beam = ctx.createLinearGradient(x, 0, x, y + rr);
            beam.addColorStop(0, "#fff3bd08");
            beam.addColorStop(1, "#fffce8");
            ctx.fillStyle = beam;
            ctx.fillRect(x - rr * 0.7, 0, rr * 1.4, y + rr);
            ctx.strokeStyle = "#fff5d4";
            ctx.lineWidth = 2;
            for (let ring = 0; ring < 3; ring++) {
              ctx.globalAlpha = bloom * (0.65 - ring * 0.14);
              ctx.beginPath();
              ctx.ellipse(
                x,
                y,
                rr * (1.7 + ring * 0.5),
                rr * (0.55 + ring * 0.18),
                time * 0.3 + ring * 0.3,
                0,
                Math.PI * 2,
              );
              ctx.stroke();
            }
          }

          if (theme === "hell") {
            let b = Math.sin(Math.PI * ease(time / 4.7));
            for (let i = 0; i < 14; i++) {
              let dx = Math.sin(i * 5 + time * 5) * rr * 0.55,
                dy = -(time * 70 + i * 13) % (rr * 2);
              glow(
                x + dx,
                y + dy + rr * 0.4,
                rr * 0.65,
                i % 2 ? "#ff541c" : "#ffbb47",
                b * 0.85,
              );
            }
            let smoke = ease((time - 2.2) / 0.8) * (1 - ease((time - 4) / 2));
            for (let i = 0; i < 9; i++)
              glow(
                x + Math.sin(i * 3 + time) * rr * 0.7,
                y - rr * 0.3 - (time - 3) * rr * 0.3,
                rr * 1.15,
                "#8c8392",
                smoke * 0.6,
              );
          }
        }
      }
      ctx.globalAlpha = 1;
      frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <canvas ref={ref} aria-hidden="true" className="field-ability-canvas" />
  );
}
