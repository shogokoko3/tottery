const api = (() => {
  "use strict";
  const SKIN_ID = "genie-magician";
  const DURATION = Object.freeze({ swap: 2400, capture: 4000 });
  const squareKey = (p) => `${p.row},${p.col}`;
  const bySquare = (a, b) => a.row - b.row || a.col - b.col;
  const validCell = (p, n) =>
    p &&
    Number.isInteger(p.row) &&
    Number.isInteger(p.col) &&
    p.row >= 0 &&
    p.col >= 0 &&
    p.row < n &&
    p.col < n;
  function pointInTriangle(p, cells) {
    if (!Array.isArray(cells) || cells.length !== 3) return false;
    const cross = (a, b, c) =>
      (b.col - a.col) * (c.row - a.row) - (b.row - a.row) * (c.col - a.col);
    if (cross(...cells) === 0) return false;
    const signs = cells.map((a, i) => cross(a, cells[(i + 1) % 3], p));
    return !(signs.some((s) => s < 0) && signs.some((s) => s > 0));
  }
  function publicPiece(piece, viewer) {
    const result = {
      row: piece.row,
      col: piece.col,
      owner: piece.owner,
      face: "back",
    };
    if (piece.owner === viewer || piece.revealed === true) {
      result.face = "front";
      result.rank = String(piece.rank);
      result.suit = piece.suit;
      result.isKing = piece.isKing === true;
    }
    return result;
  }
  // Read committed state transitions only. Selections and redraws never emit an event.
  // Histories detect a second king-A shuffle, including a random identity permutation.
  function eventFromStates(
    before,
    after,
    { loadouts, viewer = null, skinId = SKIN_ID } = {},
  ) {
    const swap = after?.lastSwap;
    const n = before?.board?.length;
    if (
      before?.phase !== "play" ||
      !["play", "gameover"].includes(after?.phase) ||
      ![5, 9].includes(n) ||
      !swap ||
      swap.owner !== before.currentTurn ||
      loadouts?.[swap.owner]?.A !== skinId
    )
      return null;
    if (
      !Array.isArray(swap.cells) ||
      swap.cells.length !== 3 ||
      !swap.cells.every((p) => validCell(p, n))
    )
      return null;
    const cells = swap.cells
      .map(({ row, col }) => ({ row, col }))
      .sort(bySquare);
    if (new Set(cells.map(squareKey)).size !== 3) return null;
    const previous = cells.map((p) => before.board[p.row]?.[p.col]);
    if (previous.some((p) => !p?.alive)) return null;
    if (!previous.some((p) => p.rank === "A" && p.owner === swap.owner))
      return null;
    const next = previous.map((p) => after.pieces?.[p.id]);
    const keys = new Set(cells.map(squareKey));
    if (
      next.some(
        (p, i) =>
          !p?.alive ||
          !keys.has(squareKey(p)) ||
          !Array.isArray(p.history) ||
          p.history.length !== (previous[i].history?.length || 0) + 1,
      )
    )
      return null;
    if (new Set(next.map(squareKey)).size !== 3) return null;
    const allAllies = previous.every((p) => p.owner === swap.owner);
    const defeated = allAllies
      ? Object.values(before.pieces || {}).filter(
          (p) =>
            p.alive &&
            p.owner !== swap.owner &&
            after.pieces?.[p.id]?.alive === false &&
            pointInTriangle(p, cells),
        )
      : [];
    return {
      size: n,
      cells,
      beforeCards: previous.map((p) => publicPiece(p, viewer)).sort(bySquare),
      afterCards: next.map((p) => publicPiece(p, viewer)).sort(bySquare),
      defeated: defeated.map((p) => publicPiece(p, viewer)).sort(bySquare),
    };
  }
  function validateEvent(event) {
    const n = event?.size;
    if (![5, 9].includes(n)) throw new TypeError("Board size must be 5 or 9.");
    if (
      event.cells?.length !== 3 ||
      !event.cells.every((p) => validCell(p, n)) ||
      new Set(event.cells.map(squareKey)).size !== 3
    )
      throw new TypeError("Three distinct board cells are required.");
    const keys = new Set(event.cells.map(squareKey));
    for (const name of ["beforeCards", "afterCards"]) {
      if (
        event[name]?.length !== 3 ||
        new Set(event[name].map(squareKey)).size !== 3 ||
        event[name].some((p) => !keys.has(squareKey(p)))
      )
        throw new TypeError(`${name} must cover the three selected cells.`);
    }
    if (
      !Array.isArray(event.defeated) ||
      new Set(event.defeated.map(squareKey)).size !== event.defeated.length ||
      event.defeated.some(
        (p) =>
          !validCell(p, n) ||
          keys.has(squareKey(p)) ||
          !pointInTriangle(p, event.cells),
      )
    )
      throw new TypeError(
        "Defeated cells must be unique and inside the triangle.",
      );
    const owner = event.beforeCards[0].owner;
    if (
      event.defeated.length &&
      (event.beforeCards.some((p) => p.owner !== owner) ||
        event.defeated.some((p) => p.owner === owner))
    )
      throw new TypeError(
        "Surround effects may only remove enemies enclosed by three allies.",
      );
    return event;
  }
  function duration(event) {
    return event.defeated.length ? DURATION.capture : DURATION.swap;
  }
  function phaseAt(event, t) {
    const count = event.defeated.length;
    if (t >= duration(event))
      return count ? `完了：${count}体撃破` : "完了：入れ替え";
    if (t < 420) return "開幕：3つのシルクハット";
    if (t < 800) return "吸い込み：駒が帽子の中へ";
    if (t < 1620) return "シャッフル：紫の煙で中身を隠す";
    if (t < 2070) return "再登場：3か所から同時にポン！";
    if (!count) return "余韻：金の星が消える";
    if (t < 2440) return `包囲成立：${count}体の敵に金の輪`;
    if (t < 3250) return `一斉吸収：${count}体が帽子の中へ`;
    return "フィナーレ：金の紙吹雪";
  }
  function createRenderer(ctx) {
    const settings = { sparkles: 1 };
    let unit = 1;
    const clamp = (x) => Math.max(0, Math.min(1, x));
    const ease = (x) => {
      x = clamp(x);
      return x * x * (3 - 2 * x);
    };
    const rise = (t, a, b) => ease((t - a) / (b - a));
    function ellipse(x, y, rx, ry, fill, stroke, width = 0.3) {
      ctx.beginPath();
      ctx.ellipse(
        x,
        y,
        Math.max(0.01, rx),
        Math.max(0.01, ry),
        0,
        0,
        Math.PI * 2,
      );
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = width;
        ctx.stroke();
      }
    }
    function glow(x, y, r, alpha, color = "162,91,226") {
      if (alpha <= 0) return;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(" + color + "," + alpha + ")");
      g.addColorStop(0.4, "rgba(" + color + "," + alpha * 0.65 + ")");
      g.addColorStop(1, "rgba(" + color + ",0)");
      ellipse(x, y, r, r, g);
    }
    function star(x, y, r, alpha, angle = 0) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.globalAlpha = clamp(alpha);
      ctx.fillStyle = "#ffe3a0";
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4,
          rr = i % 2 ? r * 0.22 : r;
        const px = Math.cos(a) * rr,
          py = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    function puff(x, y, r, alpha, seed) {
      for (let i = 0; i < 7; i++) {
        const a = i * 2.399 + seed;
        glow(
          x + Math.cos(a) * r * 0.42,
          y + Math.sin(a) * r * 0.35,
          r * 0.7,
          alpha * 0.5,
        );
      }
    }
    function ring(x, y, alpha, t) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(unit, unit);
      x = 0;
      y = 0;
      ctx.globalAlpha = clamp(alpha);
      ctx.shadowColor = "#d7a5f0";
      ctx.shadowBlur = 9;
      ellipse(x, y + 9, 13.5, 5.6, null, "#bc80ec", 0.8);
      ctx.shadowBlur = 0;
      ellipse(x, y + 9, 13.1, 5.25, null, "#ffdc87", 0.32);
      ctx.setLineDash([0.55, 1.15]);
      ctx.lineDashOffset = -t / 220;
      ellipse(x, y + 9, 11.8, 4.55, null, "#e0b867", 0.22);
      ctx.restore();
    }
    function hat(x, y, scale, alpha, angle, t) {
      if (alpha <= 0 || scale <= 0) return;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.scale(scale, scale);
      ctx.globalAlpha = clamp(alpha);
      glow(0, -4, 19, 0.26);
      ellipse(0, 13, 12, 3, "#03081588");
      const barrel = ctx.createLinearGradient(-12, 0, 12, 0);
      barrel.addColorStop(0, "#160f21");
      barrel.addColorStop(0.23, "#504057");
      barrel.addColorStop(0.5, "#292335");
      barrel.addColorStop(0.82, "#111122");
      barrel.addColorStop(1, "#63505e");
      ctx.beginPath();
      ctx.moveTo(-11, -6);
      ctx.bezierCurveTo(-10, 0, -8, 4, -8, 10);
      ctx.bezierCurveTo(-6, 13, 6, 13, 8, 10);
      ctx.bezierCurveTo(8, 4, 10, 0, 11, -6);
      ctx.closePath();
      ctx.fillStyle = barrel;
      ctx.fill();
      ctx.strokeStyle = "#9b794e";
      ctx.lineWidth = 0.35;
      ctx.stroke();
      const ribbon = ctx.createLinearGradient(-9, 4, 9, 7);
      ribbon.addColorStop(0, "#ac5178");
      ribbon.addColorStop(0.5, "#76304c");
      ribbon.addColorStop(1, "#482333");
      ctx.beginPath();
      ctx.moveTo(-9, 3);
      ctx.quadraticCurveTo(0, 5, 9, 3);
      ctx.lineTo(8.3, 7);
      ctx.quadraticCurveTo(0, 9, -8.3, 7);
      ctx.closePath();
      ctx.fillStyle = ribbon;
      ctx.fill();
      ctx.strokeStyle = "#cb9f54";
      ctx.lineWidth = 0.23;
      ctx.stroke();
      star(0, 6, 1.4, 0.95, Math.PI / 4);
      const brim = ctx.createLinearGradient(-15, -9, 15, -3);
      brim.addColorStop(0, "#775971");
      brim.addColorStop(0.45, "#2c253b");
      brim.addColorStop(1, "#100f1c");
      ellipse(0, -7, 15.5, 5.5, brim, "#c49b56", 0.4);
      ellipse(0, -7.3, 10.7, 3.8, "#090713", "#ce9d65", 0.28);
      const mouth = ctx.createRadialGradient(0, -7, 0, 0, -7, 11);
      mouth.addColorStop(0, "#a363d966");
      mouth.addColorStop(1, "#22152b00");
      ellipse(0, -7, 10.1, 3.3, mouth);
      ellipse(0, -7.3, 14.9, 5.05, null, "#f1c887", 0.18);
      ctx.beginPath();
      ctx.moveTo(-6.6, -1);
      ctx.quadraticCurveTo(-5.7, 3, -5.6, 6);
      ctx.strokeStyle = "#d1b2d132";
      ctx.lineWidth = 0.6;
      ctx.stroke();
      for (let i = 0; i < 4; i++)
        star(
          Math.sin(i * 2.2 + t / 450) * 9,
          -9 - Math.abs(Math.cos(i * 1.7 + t / 700)) * 7,
          0.35 + 0.15 * (i % 2),
          0.7,
          t / 700,
        );
      ctx.restore();
    }
    function wand(t, alpha) {
      ctx.save();
      ctx.globalAlpha = clamp(alpha);
      ctx.translate(50, 17);
      ctx.rotate(-0.55 + Math.sin(t / 280) * 0.32);
      const body = ctx.createLinearGradient(0, -0.6, 0, 0.6);
      body.addColorStop(0, "#98878e");
      body.addColorStop(0.5, "#241f29");
      body.addColorStop(1, "#06070e");
      ctx.fillStyle = body;
      ctx.fillRect(-13, -0.65, 22, 1.3);
      ctx.fillStyle = "#f0dfb5";
      ctx.fillRect(7, -0.68, 3, 1.36);
      ctx.fillRect(-13, -0.68, 2, 1.36);
      star(10, 0, 2, 0.9, t / 500);
      ctx.restore();
    }
    function confetti(x, y, power, alpha, seed) {
      for (let i = 0; i < Math.round(44 * settings.sparkles); i++) {
        const a = i * 2.399 + seed,
          d = (5 + (i % 7) * 2.8) * power;
        const px = x + Math.cos(a) * d,
          py = y + Math.sin(a) * d * 0.6 - power * 9 + power * power * 9;
        ctx.save();
        ctx.globalAlpha = clamp(alpha);
        ctx.translate(px, py);
        ctx.rotate(a + power * 4);
        ctx.fillStyle = i % 3 ? "#e8bc64" : "#bc7cdb";
        ctx.fillRect(-0.35, -0.65, 0.7, 1.3);
        ctx.restore();
        if (i % 7 === 0) star(px, py, 1, alpha, a);
      }
    }
    function card(p, x, y, opacity, scale, n) {
      if (opacity <= 0 || scale <= 0) return;
      const w = 59 / n,
        h = 77 / n;
      ctx.save();
      ctx.globalAlpha = clamp(opacity);
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.shadowColor = "#0007";
      ctx.shadowBlur = 4;
      const back = p.face !== "front";
      ctx.fillStyle = back
        ? p.owner === 0
          ? "#4a303e"
          : "#173b54"
        : "#eee4cd";
      ctx.strokeStyle = p.owner === 0 ? "#b97062" : "#568cb1";
      ctx.lineWidth = 0.25;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 0.5);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = back ? "#d3be91" : "#292638";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${back ? h * 0.29 : h * 0.36}px Georgia, serif`;
      if (back) {
        const r = h * 0.11;
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(r, 0);
        ctx.lineTo(0, r);
        ctx.lineTo(-r, 0);
        ctx.closePath();
        ctx.fill();
      } else ctx.fillText(String(p.rank || ""), 0, -h * 0.08);
      if (!back) {
        const suit =
          {
            spade: "♠",
            heart: "♥",
            diamond: "♦",
            club: "♣",
            spades: "♠",
            hearts: "♥",
            diamonds: "♦",
            clubs: "♣",
          }[p.suit] || "";
        ctx.font = `${h * 0.19}px Georgia, serif`;
        ctx.fillText(suit, 0, h * 0.25);
        if (p.isKing) {
          ctx.font = `${h * 0.2}px Georgia, serif`;
          ctx.fillText("♔", w * 0.23, -h * 0.31);
        }
      }
      ctx.restore();
    }
    function safeHat(x, y, scale, alpha, angle, t) {
      x = Math.max(16.5 * scale, Math.min(100 - 16.5 * scale, x));
      y = Math.max(13.5 * scale, Math.min(100 - 14 * scale, y));
      hat(x, y, scale, alpha, angle, t);
    }
    return function render(
      event,
      time,
      {
        width = ctx.canvas.width,
        height = ctx.canvas.height,
        flip = false,
        clear = true,
        drawCard = card,
        guide = false,
        sparkles = 1,
      } = {},
    ) {
      settings.sparkles = Math.max(0.5, Math.min(1.5, sparkles));
      const n = event.size,
        t = Math.max(0, Math.min(duration(event), time));
      unit = Math.min(1, 5.58 / n);
      const position = (p) => [
        (((flip ? n - 1 - p.col : p.col) + 0.5) * 100) / n,
        (((flip ? n - 1 - p.row : p.row) + 0.5) * 100) / n,
      ];
      const points = event.cells.map(position);
      const center = points.reduce(
        (p, q) => [p[0] + q[0] / 3, p[1] + q[1] / 3],
        [0, 0],
      );
      const finish = [
        Math.max(21, Math.min(79, center[0])),
        Math.max(23, Math.min(78, center[1] - 10)),
      ];
      const mouth = [finish[0], finish[1] - 8];
      const selected = new Map(event.beforeCards.map((p) => [squareKey(p), p]));
      const result = new Map(event.afterCards.map((p) => [squareKey(p), p]));
      ctx.save();
      ctx.setTransform(width / 100, 0, 0, height / 100, 0, 0);
      if (clear) ctx.clearRect(0, 0, 100, 100);
      const enter = rise(t, 0, 360),
        swallow = rise(t, 420, 760),
        mixIn = rise(t, 760, 1120),
        mixOut = rise(t, 1300, 1630),
        returning = rise(t, 1610, 1920),
        fade = rise(t, 1930, 2330);
      function triangle(a) {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.beginPath();
        points.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p)));
        ctx.closePath();
        ctx.fillStyle = "#aa67d821";
        ctx.fill();
        ctx.shadowColor = "#af70f5";
        ctx.shadowBlur = 10;
        ctx.strokeStyle = "#bd85ef";
        ctx.lineWidth = 0.75;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "#f7d285";
        ctx.lineWidth = 0.26;
        ctx.stroke();
        ctx.restore();
        points.forEach((p) => ring(...p, a * 0.8, t));
      }
      if (guide && event.defeated.length) triangle(0.65);
      else if (event.defeated.length && t >= 2070)
        triangle(rise(t, 2070, 2340) * (1 - rise(t, 3690, 4000)));
      event.cells.forEach((cell, i) => {
        const p = points[i];
        const before = selected.get(squareKey(cell)),
          after = result.get(squareKey(cell));
        if (t < 1610)
          drawCard(
            before,
            p[0],
            p[1] - swallow * 7 * unit,
            1 - swallow,
            1 - swallow * 0.86,
            n,
          );
        else
          drawCard(
            after,
            p[0],
            p[1] - (1 - returning) * 7 * unit,
            returning,
            0.14 + returning * 0.86,
            n,
          );
      });
      event.defeated.forEach((victim, i) => {
        const p = position(victim),
          delay = (160 * i) / Math.max(1, event.defeated.length - 1),
          u = rise(t, 2440 + delay, 3040 + delay);
        const side =
          p[0] < mouth[0]
            ? Math.max(4, p[0] - 22)
            : p[0] > mouth[0]
              ? Math.min(96, p[0] + 22)
              : mouth[0] + (i % 2 ? 12 : -12);
        const control = [side, Math.max(3, Math.min(p[1], mouth[1]) - 27)];
        const at = (q) => [
          (1 - q) ** 2 * p[0] + 2 * (1 - q) * q * control[0] + q * q * mouth[0],
          (1 - q) ** 2 * p[1] + 2 * (1 - q) * q * control[1] + q * q * mouth[1],
        ];
        const pos = at(u);
        drawCard(victim, ...pos, 1 - rise(u, 0.7, 1), 1 - u * 0.94, n);
        const a = guide ? 0.9 : rise(t, 2100, 2350) * (1 - u);
        ctx.save();
        ctx.globalAlpha = a;
        ellipse(...p, 39 / n, 49 / n, null, "#f6d58f", 0.3);
        ctx.restore();
        if (u > 0 && u < 1) {
          ctx.save();
          ctx.globalAlpha = Math.sin(Math.PI * u) * 0.78;
          ctx.beginPath();
          for (let j = 0; j <= 14; j++) {
            const q = at((u * j) / 14);
            j ? ctx.lineTo(...q) : ctx.moveTo(...q);
          }
          ctx.strokeStyle = "#d4abea";
          ctx.lineWidth = 0.32;
          ctx.shadowColor = "#b385e0";
          ctx.shadowBlur = 5;
          ctx.stroke();
          ctx.restore();
          puff(...pos, 4, 0.28 * Math.sin(Math.PI * u), i + t / 300);
        }
      });
      if (guide)
        points.forEach(([x, y]) => safeHat(x, y - 4, unit * 0.94, 0.9, 0, 0));
      else if (t < 2330) {
        points.forEach((p) => ring(...p, enter * (1 - fade) * 0.8, t));
        if (t > 690 && t < 1640) {
          const cloud = rise(t, 690, 1040) * (1 - rise(t, 1360, 1640));
          puff(...center, 29, cloud * 0.76, t / 500);
          puff(center[0] - 8, center[1] + 3, 22, cloud * 0.5, t / 300);
          for (let i = 0; i < 4; i++) {
            const a = t / 250 + (i * Math.PI) / 2;
            ctx.save();
            ctx.globalAlpha = cloud * 0.7;
            ctx.beginPath();
            ctx.ellipse(
              ...center,
              23 + i,
              9 + i * 1.2,
              a * 0.2,
              a,
              a + Math.PI * 1.4,
            );
            ctx.strokeStyle = i % 2 ? "#ddb364" : "#cb91f2";
            ctx.lineWidth = i % 2 ? 0.36 : 0.68;
            ctx.stroke();
            ctx.restore();
            star(
              center[0] + Math.cos(a) * 26,
              center[1] + Math.sin(a) * 12,
              1.3,
              cloud,
              a,
            );
          }
        }
        points.forEach(([x, y], i) => {
          const hidden = rise(t, 920, 1120) * (1 - rise(t, 1290, 1470)),
            inward = mixIn * (1 - mixOut),
            xx =
              x +
              (center[0] - x) * inward * 0.75 +
              Math.sin(t / 140 + i * 2.1) * inward * 5,
            yy = y + (center[1] - y) * inward * 0.75,
            pop = enter + Math.sin(Math.PI * enter) * 0.12;
          puff(x, y - 4, 9, swallow * (1 - returning) * 0.28, t / 400 + i);
          safeHat(
            xx,
            yy - 4 * enter,
            unit * pop * (1 - fade),
            enter * (1 - hidden) * (1 - fade),
            Math.sin(t / 170 + i * 2.1) * inward * 0.4,
            t,
          );
          if (returning > 0 && returning < 1)
            confetti(
              x,
              y - 4,
              returning * 0.6,
              Math.sin(returning * Math.PI) * 0.65,
              i,
            );
        });
        wand(t, (1 - rise(t, 410, 720)) * enter);
      }
      if (!guide && event.defeated.length && t >= 2240) {
        const h = rise(t, 2240, 2450),
          hf = rise(t, 3250, 3570),
          pulse = 1 + Math.sin((t - 2450) / 100) * 0.025 * (1 - hf);
        puff(finish[0], finish[1] - 3, 20, h * (1 - hf) * 0.4, t / 600);
        safeHat(
          ...finish,
          1.1 * h * (1 - hf) * pulse,
          h * (1 - hf),
          Math.sin(t / 110) * 0.04 * (1 - hf),
          t,
        );
        if (t > 3250) {
          const burst = clamp((t - 3250) / 750);
          confetti(
            ...mouth,
            burst * (event.defeated.length >= 10 ? 1.3 : 1.1),
            Math.sin(Math.PI * burst),
            0.4,
          );
          glow(...mouth, 30, Math.sin(Math.PI * burst) * 0.22, "244,192,100");
        }
      }
      ctx.restore();
    };
  }
  // Mount on the actual board grid, excluding coordinate labels. The caller supplies
  // committed before/after public card snapshots and keeps result UI behind `busy`.
  function createPlayer({
    board,
    getPieceElements = () => [],
    flip = false,
    onBusyChange = () => {},
    onPhase = () => {},
    playSound = () => null,
    drawCard,
  } = {}) {
    if (!board?.ownerDocument)
      throw new TypeError("A board element is required.");
    const doc = board.ownerDocument,
      win = doc.defaultView,
      canvas = doc.createElement("canvas");
    const oldPosition = board.style.position;
    if (win.getComputedStyle(board).position === "static")
      board.style.position = "relative";
    canvas.className = "tottery-silk-hat-overlay";
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: "20",
    });
    board.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      canvas.remove();
      board.style.position = oldPosition;
      throw new Error("Canvas 2D is unavailable.");
    }
    const render = createRenderer(ctx);
    let active = null,
      frame = 0,
      watchdog = null,
      disposed = false;
    const cleanups = [];
    function finish(reason = "ended") {
      if (!active) return;
      const item = active;
      active = null;
      win.cancelAnimationFrame(frame);
      win.clearTimeout(watchdog);
      for (const cleanup of cleanups.splice(0)) cleanup();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      board.inert = item.wasInert;
      if (typeof item.stopAudio === "function") item.stopAudio();
      onBusyChange(false);
      item.resolve({ reason });
    }
    function resize() {
      const rect = board.getBoundingClientRect(),
        dpr = Math.min(win.devicePixelRatio || 1, 2);
      // Grid cells occupy the content box; borders and padding are not cells.
      const style = win.getComputedStyle(board);
      const px = (name) => parseFloat(style[name]) || 0;
      const width =
        rect.width -
        px("borderLeftWidth") -
        px("borderRightWidth") -
        px("paddingLeft") -
        px("paddingRight");
      const height =
        rect.height -
        px("borderTopWidth") -
        px("borderBottomWidth") -
        px("paddingTop") -
        px("paddingBottom");
      Object.assign(canvas.style, {
        left: `${px("paddingLeft")}px`,
        top: `${px("paddingTop")}px`,
        right: "auto",
        bottom: "auto",
        width: `${width}px`,
        height: `${height}px`,
      });
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      if (active) paint();
    }
    function paint() {
      if (!active) return;
      const t = Math.min(
        duration(active.event),
        (win.performance.now() - active.start) * active.speed,
      );
      render(active.event, t, {
        flip: active.flip,
        drawCard: drawCard ? (...args) => drawCard(ctx, ...args) : undefined,
      });
      const phase = phaseAt(active.event, t);
      if (phase !== active.phase) {
        active.phase = phase;
        onPhase(phase);
      }
      if (t >= duration(active.event)) finish();
    }
    function loop() {
      paint();
      if (active) frame = win.requestAnimationFrame(loop);
    }
    const observer = new win.ResizeObserver(resize);
    observer.observe(board);
    resize();
    const visibility = () => {
      if (doc.hidden) finish("hidden");
    };
    doc.addEventListener("visibilitychange", visibility);
    return {
      play(
        raw,
        {
          speed = 1,
          muted = false,
          volume = 1,
          reducedMotion = win.matchMedia("(prefers-reduced-motion: reduce)")
            .matches,
        } = {},
      ) {
        if (disposed) return Promise.resolve({ reason: "disposed" });
        const event = JSON.parse(JSON.stringify(validateEvent(raw)));
        finish("replaced");
        if (reducedMotion) {
          onPhase(phaseAt(event, duration(event)));
          return Promise.resolve({ reason: "reduced-motion" });
        }
        const playbackSpeed = Math.max(0.5, Math.min(2, Number(speed) || 1));
        return new Promise((resolve) => {
          const wasInert = board.inert;
          board.inert = true;
          active = {
            event,
            start: win.performance.now(),
            speed: playbackSpeed,
            flip: typeof flip === "function" ? !!flip() : !!flip,
            wasInert,
            resolve,
            phase: "",
            stopAudio: null,
          };
          const hidden = new Set();
          for (const cell of [...event.cells, ...event.defeated])
            for (const el of getPieceElements(cell) || []) {
              if (!el?.style || hidden.has(el)) continue;
              hidden.add(el);
              const value = el.style.getPropertyValue("visibility"),
                priority = el.style.getPropertyPriority("visibility");
              el.style.setProperty("visibility", "hidden", "important");
              cleanups.push(() =>
                value
                  ? el.style.setProperty("visibility", value, priority)
                  : el.style.removeProperty("visibility"),
              );
            }
          onBusyChange(true);
          try {
            if (!muted && volume > 0)
              active.stopAudio = playSound(
                event.defeated.length ? "capture" : "swap",
                {
                  speed: playbackSpeed,
                  volume: Math.max(0, Math.min(1, volume)),
                },
              );
          } catch (_) {
            /* Sound failure never blocks the board. */
          }
          watchdog = win.setTimeout(
            () => finish("timeout"),
            duration(event) / playbackSpeed + 1000,
          );
          frame = win.requestAnimationFrame(loop);
        });
      },
      skip() {
        finish("skipped");
      },
      dispose() {
        if (disposed) return;
        finish("disposed");
        disposed = true;
        observer.disconnect();
        doc.removeEventListener("visibilitychange", visibility);
        canvas.remove();
        board.style.position = oldPosition;
      },
      get busy() {
        return !!active;
      },
    };
  }
  return Object.freeze({
    SKIN_ID,
    DURATION,
    pointInTriangle,
    publicPiece,
    eventFromStates,
    validateEvent,
    duration,
    phaseAt,
    createRenderer,
    createPlayer,
  });
})();
export default api;
export const {
  SKIN_ID,
  DURATION,
  pointInTriangle,
  publicPiece,
  eventFromStates,
  validateEvent,
  duration,
  phaseAt,
  createRenderer,
  createPlayer,
} = api;
