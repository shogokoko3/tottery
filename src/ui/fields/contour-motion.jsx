import { useEffect, useRef } from "react";
import { CONTOURS } from "./object-contours.js";

const SIZE = 1254;
const KINDS = { water: 0, leaf: 1, cloud: 2, banner: 3, flame: 4 };
// Reuse the two players' masks so a turn change does not retrace 1.6M pixels.
const maskCache = new Map();
function cachedMask(image, theme, src) {
  const key = `${theme}:${src}`;
  if (!maskCache.has(key)) {
    if (maskCache.size >= 2) maskCache.delete(maskCache.keys().next().value);
    maskCache.set(key, makeMask(image, theme));
  }
  return maskCache.get(key);
}

function makeMask(image, theme) {
  const spec = CONTOURS[theme],
    canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, SIZE, SIZE);
  const art = ctx.getImageData(0, 0, SIZE, SIZE).data;
  ctx.clearRect(0, 0, SIZE, SIZE);
  spec.regions.forEach((region, i) => {
    ctx.fillStyle = `rgb(${i + 1},0,0)`;
    ctx.fill(new Path2D(region.path));
  });
  ctx.globalCompositeOperation = "destination-out";
  for (const hole of spec.cutouts) {
    const path = new Path2D(hole.path);
    if (hole.width) {
      ctx.lineWidth = hole.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke(path);
    } else ctx.fill(path);
  }
  const pixels = ctx.getImageData(0, 0, SIZE, SIZE).data;
  const distance = new Float32Array(SIZE * SIZE),
    ids = new Uint8Array(SIZE * SIZE);
  for (let i = 0; i < distance.length; i++) {
    const p = i * 4,
      r = art[p],
      g = art[p + 1],
      b = art[p + 2];
    // The traced outline defines the object. These conservative colour guards
    // additionally reject brown rigging and gaps showing through green leaves.
    const colourOK =
      theme === "sea"
        ? b >= r * 0.98 && g >= r * 0.96
        : theme === "forest"
          ? g >= r * 0.96 && g >= b * 1.1
          : true;
    const inside = pixels[p + 3] > 250 && colourOK;
    ids[i] = inside ? pixels[p] : 0;
    distance[i] = inside ? 64 : 0;
  }
  // Distance to the actual selected edge, including holes, in source pixels.
  // Motion is bounded to less than one third of this distance in the shader.
  const diagonal = Math.SQRT2;
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x;
      if (!distance[i]) continue;
      distance[i] = Math.min(
        distance[i],
        x ? distance[i - 1] + 1 : 1,
        y ? distance[i - SIZE] + 1 : 1,
        x && y ? distance[i - SIZE - 1] + diagonal : 64,
        x < SIZE - 1 && y ? distance[i - SIZE + 1] + diagonal : 64,
      );
    }
  for (let y = SIZE - 1; y >= 0; y--)
    for (let x = SIZE - 1; x >= 0; x--) {
      const i = y * SIZE + x;
      if (!distance[i]) continue;
      distance[i] = Math.min(
        distance[i],
        x < SIZE - 1 ? distance[i + 1] + 1 : 1,
        y < SIZE - 1 ? distance[i + SIZE] + 1 : 1,
        x < SIZE - 1 && y < SIZE - 1 ? distance[i + SIZE + 1] + diagonal : 64,
        x && y < SIZE - 1 ? distance[i + SIZE - 1] + diagonal : 64,
      );
    }
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let i = 0; i < distance.length; i++) {
    data[i * 4] = Math.floor(Math.min(63.75, distance[i]) * 4);
    data[i * 4 + 1] = ids[i];
    data[i * 4 + 3] = 255;
    data[i * 4 + 2] = ids[i]
      ? KINDS[spec.regions[ids[i] - 1].kind || spec.kind]
      : 0;
  }
  return data;
}

const VERTEX = `attribute vec2 position;
varying vec2 uv;
void main(){uv=vec2((position.x+1.)*.5,(1.-position.y)*.5);gl_Position=vec4(position,0.,1.);}`;
const FRAGMENT = `precision highp float;
uniform sampler2D illustration;
uniform sampler2D mask;
uniform float clock, amplitude, showRegions;
varying vec2 uv;
void main(){
 vec4 selection=texture2D(mask,uv);
 float distance=selection.r*255./4.;
 if(distance<.7){gl_FragColor=vec4(0.);return;}
 vec2 p=uv*1254.;
 float phase=floor(selection.g*255.+.5)*1.37;
 float t=clock+phase;
 float kind=floor(selection.b*255.+.5);
 vec2 offset;
 if(kind<.5){
  // Travelling wave fronts in the painted water: long swell plus finer ripple.
  // No added wave graphics, sparkle or alternating movement of the whole patch.
  float swell=p.y*.055+p.x*.018-t*1.35;
  float ripple=p.y*.12-p.x*.035-t*1.95;
  offset=vec2(sin(swell)+.22*sin(ripple),.38*cos(swell)+.12*cos(ripple))*amplitude;
 }else if(kind<1.5){
  // A coherent gust through each blade; its contour and stalk are protected.
  float gust=sin(t*.82)+.17*sin(t*1.51+.4);
  offset=vec2(gust,sin(t*.82+.25)*.27)*amplitude;
 }else if(kind<2.5){
  // Broad, slow advection of cloud lobes. Keep surrounding rock and floor fixed.
  offset=vec2(sin(p.y*.018-t*.48),.27*cos(p.x*.014-t*.37))*amplitude;
 }else if(kind<3.5){
  // The attachment stays still while a broad fold travels down the cloth.
  float anchored=smoothstep(0.,100.,p.y);
  float fold=sin(p.y*.036-t*1.28);
  offset=vec2(fold+.20*sin(p.y*.065-t*1.9),.16*cos(p.y*.036-t*1.28))*amplitude*anchored;
 }else{
  // Small upward flicker inside the original flame; the bowl stays still.
  offset=vec2(.9*sin(p.y*.22-t*2.4),1.5*sin(t*1.9));
 }
 offset*=smoothstep(1.,22.,distance);
 float travel=length(offset);
 offset*=min(1.,distance*.30/max(.01,travel));
 vec2 source=uv+offset/1254.;
 vec4 sourceMask=texture2D(mask,source);
 // Also check the sampled source: never borrow pixels from a neighbouring object.
 if(sourceMask.r<.01 || abs(sourceMask.g-selection.g)>.001)source=uv;
 vec3 colour=texture2D(illustration,source).rgb;
 if(kind>2.5 && kind<3.5){
  float clothLight=sin(p.y*.036-t*1.28+.8)*.20;
  colour*=1.+clothLight*smoothstep(2.,15.,distance)*smoothstep(0.,80.,p.y);
 }else if(kind>3.5){
  float fireLight=.76+.84*(.5+.5*sin(t*1.9))+.06*sin(t*3.1);
  colour*=fireLight;
 }
 if(showRegions>.5){
  colour=mix(texture2D(illustration,uv).rgb,vec3(.16,1.,.69),.38);
  if(distance<2.7)colour=vec3(.75,1.,.86);
 }
 gl_FragColor=vec4(colour,smoothstep(.6,3.5,distance));
}`;

export function ContourMotion({ src, theme, paused, showRegions }) {
  const ref = useRef(),
    options = useRef({ paused, showRegions });
  options.current = { paused, showRegions };
  useEffect(() => {
    const canvas = ref.current,
      gl = canvas.getContext("webgl", {
        alpha: true,
        premultipliedAlpha: false,
        antialias: false,
      });
    if (!gl) {
      canvas.dataset.motionState = "unavailable";
      return;
    }
    let disposed = false,
      raf,
      last = 0,
      elapsed = 0;
    const textures = [],
      shaders = [];
    const program = gl.createProgram(),
      buffer = gl.createBuffer();
    function compile(type, source) {
      const shader = gl.createShader(type);
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program, shader);
    }
    function texture(unit, data, width, height) {
      const tex = gl.createTexture();
      textures.push(tex);
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        unit ? gl.NEAREST : gl.LINEAR,
      );
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MAG_FILTER,
        unit ? gl.NEAREST : gl.LINEAR,
      );
      if (width)
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          width,
          height,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          data,
        );
      else
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          data,
        );
    }
    const image = new Image();
    image.onload = () => {
      if (disposed) return;
      try {
        compile(gl.VERTEX_SHADER, VERTEX);
        compile(gl.FRAGMENT_SHADER, FRAGMENT);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS))
          throw new Error(gl.getProgramInfoLog(program));
        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
          gl.STATIC_DRAW,
        );
        const position = gl.getAttribLocation(program, "position");
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
        texture(0, image);
        texture(1, cachedMask(image, theme, src), SIZE, SIZE);
        const uniform = (name) => gl.getUniformLocation(program, name),
          clock = uniform("clock"),
          regions = uniform("showRegions");
        gl.uniform1i(uniform("illustration"), 0);
        gl.uniform1i(uniform("mask"), 1);
        gl.uniform1f(uniform("amplitude"), CONTOURS[theme].amplitude);
        canvas.dataset.motionState = "ready";
        function draw(now) {
          if (disposed) return;
          raf = requestAnimationFrame(draw);
          if (now - last < 33) return;
          const dt = last ? Math.min(now - last, 80) : 0;
          last = now;
          if (!options.current.paused && !document.hidden) elapsed += dt / 1000;
          const size = Math.round(
            canvas.clientWidth * Math.min(devicePixelRatio, 2),
          );
          if (!size) return;
          if (canvas.width !== size) {
            canvas.width = canvas.height = size;
            gl.viewport(0, 0, size, size);
          }
          gl.uniform1f(clock, elapsed);
          gl.uniform1f(regions, options.current.showRegions ? 1 : 0);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
        raf = requestAnimationFrame(draw);
      } catch (error) {
        canvas.dataset.motionState = "error";
        console.error("Background motion:", error);
      }
    };
    image.src = src;
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      image.onload = null;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      textures.forEach((t) => gl.deleteTexture(t));
      shaders.forEach((s) => gl.deleteShader(s));
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, [src, theme]);
  return <canvas ref={ref} className="background-objects" aria-hidden="true" />;
}
