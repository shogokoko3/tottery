import { useEffect, useRef } from "react";
import { ContourMotion } from "./contour-motion.jsx";
import { CONTOURS } from "./object-contours.js";
// Earth and hell retain fixed shapes with a slow glow. Other fields use traced contours.
export const OBJECTS = {
  earth: [
    [0.17, 0.155, 0.026, 0.045, "flame"],
    [0.145, 0.607, 0.024, 0.035, "flame"],
    [0.932, 0.575, 0.021, 0.041, "flame"],
    [0.864, 0.66, 0.018, 0.031, "flame"],
  ],
  hell: [
    [0.145, 0.18, 0.02, 0.03, "flame"],
    [0.855, 0.179, 0.02, 0.03, "flame"],
    [0.367, 0.842, 0.018, 0.027, "flame"],
    [0.632, 0.842, 0.018, 0.027, "flame"],
  ],
};
export function BackgroundObjects(props) {
  return CONTOURS[props.theme] ? (
    <ContourMotion {...props} />
  ) : (
    <LegacyObjects {...props} />
  );
}
function LegacyObjects({ src, theme, paused, showRegions }) {
  const ref = useRef(),
    pause = useRef(paused),
    regions = useRef(showRegions);
  pause.current = paused;
  regions.current = showRegions;
  useEffect(() => {
    let raf,
      disposed = false,
      last = 0,
      elapsed = 0;
    const image = new Image(),
      canvas = ref.current,
      ctx = canvas.getContext("2d");
    const patches = (OBJECTS[theme] || []).map(([x, y, rx, ry, kind]) => ({
      x,
      y,
      rx,
      ry,
      kind,
      canvas: document.createElement("canvas"),
    }));
    function draw(now) {
      if (disposed) return;
      raf = requestAnimationFrame(draw);
      if (now - last < 33) return;
      let dt = last ? Math.min(now - last, 80) : 0;
      last = now;
      if (!pause.current) elapsed += dt / 1000;
      let size = Math.round(canvas.clientWidth * Math.min(devicePixelRatio, 2));
      if (!size) return;
      if (canvas.width !== size) {
        canvas.width = size;
        canvas.height = size;
      }
      ctx.clearRect(0, 0, size, size);
      patches.forEach((p, index) => {
        let left = (p.x - p.rx) * size,
          top = (p.y - p.ry) * size,
          width = Math.ceil(p.rx * 2 * size),
          height = Math.ceil(p.ry * 2 * size);
        let layer = p.canvas;
        if (layer.width !== width || layer.height !== height) {
          layer.width = width;
          layer.height = height;
        }
        let g = layer.getContext("2d");
        g.clearRect(0, 0, width, height);
        g.globalCompositeOperation = "source-over";
        const t = elapsed + index * 1.3;
        const calmFlame =
          p.kind === "flame" && ["earth", "hell"].includes(theme);
        if (calmFlame) {
          // Keep silhouette and position fixed; a visible but slow six-second glow.
          g.filter = `brightness(${1.13 + Math.sin((t * Math.PI * 2) / 6) * 0.23})`;
          g.drawImage(
            image,
            (left / size) * image.width,
            (top / size) * image.height,
            (width / size) * image.width,
            (height / size) * image.height,
            0,
            0,
            width,
            height,
          );
          g.filter = "none";
        } else {
          const strength = size * (p.kind === "flame" ? 0.003 : 0.0035);
          // Existing heaven banner/flame motion is retained.
          for (let row = 0; row < height; row += 2) {
            let v = row / height,
              taper = Math.sin(Math.PI * v),
              speed = p.kind === "flame" ? 2.5 : 0.75;
            let dx = Math.sin(t * speed + v * 3) * strength * taper;
            if (p.kind === "banner") dx *= v;
            let dy = 0;
            const sx =
              (Math.max(0, Math.min(size - width, left + dx)) / size) *
              image.width;
            const sy =
              (Math.max(0, Math.min(size - 2, top + row + dy)) / size) *
              image.height;
            g.drawImage(
              image,
              sx,
              sy,
              (width / size) * image.width,
              (2 / size) * image.height,
              0,
              row,
              width,
              2,
            );
          }
        }
        if (regions.current) {
          g.fillStyle = "rgba(41,255,176,.38)";
          g.fillRect(0, 0, width, height);
        }
        // Feather to the unchanged source at the object's boundary, preventing seams.
        g.globalCompositeOperation = "destination-in";
        g.save();
        g.translate(width / 2, height / 2);
        g.scale(width / 2, height / 2);
        let mask = g.createRadialGradient(0, 0, 0.62, 0, 0, 1);
        mask.addColorStop(0, "#fff");
        mask.addColorStop(1, "#fff0");
        g.fillStyle = mask;
        g.fillRect(-1, -1, 2, 2);
        g.restore();
        g.globalCompositeOperation = "source-over";
        ctx.drawImage(layer, left, top);
      });
    }
    image.onload = () => {
      if (!disposed) raf = requestAnimationFrame(draw);
    };
    image.src = src;
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      image.onload = null;
    };
  }, [src, theme]);
  return <canvas ref={ref} className="background-objects" aria-hidden="true" />;
}
