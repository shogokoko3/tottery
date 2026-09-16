import * as T from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { SUMMON_WORLDS, summonFrame, smooth } from "./summon-plan.js";

const TAU = Math.PI * 2;
const mix = (a, b, t) => a + (b - a) * t;
const seeded = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** A real stage: the camera climbs independent steps; doors open on hinges. */
export function createSummonScene(canvas, plan) {
  const world = SUMMON_WORLDS[plan.world];
  const renderer = new T.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  const scene = new T.Scene();
  scene.background = new T.Color(world.sky);
  scene.fog = new T.FogExp2(world.fog, 0.025);
  const camera = new T.PerspectiveCamera(58, 1, 0.1, 120);
  const animated = [],
    disposables = [],
    glows = [];
  let disposed = false;
  const environment = new RoomEnvironment(),
    pmrem = new T.PMREMGenerator(renderer);
  const environmentTarget = pmrem.fromScene(environment, 0.06);
  scene.environment = environmentTarget.texture;
  scene.environmentIntensity = 0.55;
  environment.dispose();
  pmrem.dispose();
  disposables.push(environmentTarget);
  const metalColor = plan.gold ? "#e9a823" : "#7e391d";
  const trimColor = plan.gold ? "#ffd75d" : "#be7446";
  const accent = new T.Color(world.accent);
  const stone = new T.MeshStandardMaterial({
    color: new T.Color(world.stone).multiplyScalar(0.48),
    roughness: 0.68,
    metalness: 0.18,
    flatShading: true,
  });
  const darkStone = new T.MeshStandardMaterial({
    color: new T.Color(world.stone).multiplyScalar(0.29),
    roughness: 0.65,
    metalness: 0.2,
  });
  const metal = new T.MeshStandardMaterial({
    color: metalColor,
    roughness: 0.3,
    metalness: 0.72,
  });
  const trim = new T.MeshStandardMaterial({
    color: trimColor,
    roughness: 0.27,
    metalness: 0.55,
    emissive: metalColor,
    emissiveIntensity: 0.06,
  });
  const recess = new T.MeshStandardMaterial({
    color: "#111d26",
    metalness: 0.4,
    roughness: 0.35,
  });
  const glowMat = new T.MeshBasicMaterial({
    color: world.accent,
    transparent: true,
    opacity: 0.82,
  });
  const carvedMetal = new T.MeshStandardMaterial({
    color: plan.gold ? "#ffbb28" : "#ae5830",
    roughness: plan.gold ? 0.36 : 0.54,
    metalness: plan.gold ? 0.59 : 0.43,
    emissive: plan.gold ? "#b36b00" : "#4e1303",
    emissiveIntensity: plan.gold ? 0.12 : 0.025,
    bumpScale: 0.075,
  });
  const assetsReady = [
    new T.TextureLoader()
      .loadAsync("skins/summon/gate-relief.webp")
      .then((texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = T.SRGBColorSpace;
        texture.anisotropy = Math.min(
          8,
          renderer.capabilities.getMaxAnisotropy(),
        );
        disposables.push(texture);
        carvedMetal.map = texture;
        carvedMetal.bumpMap = texture;
        carvedMetal.needsUpdate = true;
      }),
  ];
  const add = (geo, material, x, y, z, parent = scene) => {
    const mesh = new T.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const box = (w, h, d, x, y, z, mat = stone, parent = scene) =>
    add(new T.BoxGeometry(w, h, d), mat, x, y, z, parent);
  const cyl = (r1, r2, h, x, y, z, mat = stone, sides = 12, parent = scene) =>
    add(new T.CylinderGeometry(r1, r2, h, sides), mat, x, y, z, parent);
  const line = (a, b, radius, mat = trim, parent = scene) => {
    const aa = new T.Vector3(...a),
      bb = new T.Vector3(...b),
      dir = bb.clone().sub(aa);
    const mesh = cyl(
      radius,
      radius,
      dir.length(),
      ...aa.clone().add(bb).multiplyScalar(0.5).toArray(),
      mat,
      8,
      parent,
    );
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize());
    return mesh;
  };
  const ring = (r, tube, x, y, z, mat = trim, parent = scene) =>
    add(new T.TorusGeometry(r, tube, 6, 64), mat, x, y, z, parent);
  const stoneTex = document.createElement("canvas");
  stoneTex.width = stoneTex.height = 256;
  const sx = stoneTex.getContext("2d");
  sx.fillStyle = "#c7c5ba";
  sx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) {
    const v = 150 + seeded(i + 90) * 90;
    sx.fillStyle = `rgba(${v},${v},${v},.24)`;
    sx.fillRect(seeded(i) * 256, seeded(i + 1) * 256, 1 + seeded(i + 2) * 4, 1);
  }
  sx.strokeStyle = "#858681";
  sx.lineWidth = 2;
  sx.strokeRect(1, 1, 254, 254);
  const stoneMap = new T.CanvasTexture(stoneTex);
  stoneMap.colorSpace = T.SRGBColorSpace;
  stoneMap.wrapS = stoneMap.wrapT = T.RepeatWrapping;
  stoneMap.repeat.set(2, 2);
  disposables.push(stoneMap);
  stone.map = stoneMap;

  scene.add(
    new T.HemisphereLight(
      plan.world === "hell" ? "#b0a9e3" : "#daedff",
      "#100d1d",
      0.75,
    ),
  );
  const key = new T.DirectionalLight("#fff0d4", 2.9);
  key.position.set(-6, 17, 12);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -15;
  key.shadow.camera.right = 15;
  key.shadow.camera.top = 18;
  key.shadow.camera.bottom = -15;
  key.shadow.bias = -0.001;
  scene.add(key);
  const rim = new T.DirectionalLight(world.accent, 2.5);
  rim.position.set(7, 10, -6);
  scene.add(rim);
  const doorLight = new T.PointLight(
    plan.gold ? "#ffe3a5" : world.accent,
    0,
    23,
    1.7,
  );
  doorLight.position.set(0, 6.6, 1.5);
  scene.add(doorLight);

  // The ascent ends on the landing, with each stair independently catching light.
  box(22, 0.6, 26, 0, -0.5, 13, darkStone);
  box(18, 3, 12, 0, 1.5, -0.9);
  for (let i = 0; i < 15; i++) {
    const y = 0.12 + i * 0.2,
      z = 22.4 - i * 1.15;
    box(7.5, 0.23, 1.17, 0, y, z);
    box(7.56, 0.032, 0.07, 0, y + 0.129, z + 0.535, trim);
    for (const s of [-1, 1]) {
      box(0.35, 0.65, 1.2, s * 4.08, y + 0.15, z, darkStone);
      if (i % 3 === 0) {
        cyl(0.25, 0.34, 1.1, s * 4.07, y + 0.9, z, stone);
        cyl(0.33, 0.33, 0.12, s * 4.07, y + 1.47, z, trim);
      }
    }
  }
  for (const s of [-1, 1])
    line([s * 4.08, 1.85, 22.4], [s * 4.08, 4.6, 6.1], 0.09);
  const floorMat = stone.clone(),
    floorMap = stoneMap.clone();
  floorMap.repeat.set(12, 8);
  disposables.push(floorMap);
  floorMat.map = floorMap;
  box(18, 0.035, 11.2, 0, 3.025, -0.5, floorMat);
  const carpet = new T.MeshStandardMaterial({
    color:
      plan.world === "heaven"
        ? "#453a68"
        : plan.world === "hell"
          ? "#721e38"
          : "#152d3b",
    roughness: 0.92,
  });
  box(2.8, 0.045, 8, 0, 3.064, 1.8, carpet);
  for (const s of [-1, 1]) box(0.036, 0.05, 8, s * 1.36, 3.085, 1.8, trim);

  // Receding colonnades create parallax and a hall rather than a flat gate card.
  for (const z of [5.2, -0.8])
    for (const s of [-1, 1]) {
      const x = s * 5.6;
      box(1.55, 0.48, 1.6, x, 3.25, z, darkStone);
      cyl(0.72, 0.81, 0.24, x, 3.61, z, trim);
      cyl(0.5, 0.58, 7.4, x, 7.42, z, stone, 16);
      for (let a = 0; a < 8; a++) {
        const q = (a / 8) * TAU;
        cyl(
          0.026,
          0.026,
          6.8,
          x + Math.sin(q) * 0.52,
          7.4,
          z + Math.cos(q) * 0.52,
          darkStone,
          5,
        );
      }
      cyl(0.73, 0.57, 0.42, x, 11.2, z, trim);
      box(1.55, 0.38, 1.65, x, 11.55, z);
      box(1.3, 0.24, 13, x, 11.85, -0.8, darkStone);
    }
  // Back wall, inset door jambs, pointed archivolts.
  for (const s of [-1, 1]) {
    box(0.78, 7.3, 0.94, s * 3.55, 6.72, 0);
    box(0.15, 7.5, 0.17, s * 3.12, 6.8, 0.6, trim);
    for (let j = 0; j < 5; j++)
      box(0.97, 0.13, 1.1, s * 3.55, 3.4 + j * 1.38, 0, metal);
    line([s * 3.55, 10.35, 0.15], [0, 12.13, 0.15], 0.45, stone);
    line([s * 3.18, 9.98, 0.67], [0, 11.62, 0.67], 0.13, trim);
    line([s * 3.95, 10.65, 0.08], [0, 12.66, 0.08], 0.09, trim);
    box(1.0, 0.42, 1.2, s * 3.55, 3.2, 0, metal);
    cyl(0, 0.37, 1.2, s * 3.55, 11.26, 0, trim, 4);
  }
  // Doors each pivot at the outer jamb. Raised geometry retains highlights in motion.
  const doors = [];
  for (const s of [-1, 1]) {
    const pivot = new T.Group();
    pivot.position.set(s * 3.1, 3.13, 0.3);
    scene.add(pivot);
    doors.push({ pivot, s });
    const shape = new T.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(-s * 3.08, 0);
    shape.lineTo(-s * 3.08, 8.31);
    shape.lineTo(0, 6.72);
    shape.closePath();
    const leaf = add(
      new T.ExtrudeGeometry(shape, {
        depth: 0.3,
        bevelEnabled: true,
        bevelSize: 0.09,
        bevelThickness: 0.05,
        bevelSegments: 2,
        steps: 1,
      }),
      metal,
      0,
      0,
      0,
      pivot,
    );
    leaf.castShadow = true;
    const face = new T.ShapeGeometry(shape),
      pos = face.attributes.position,
      uv = face.attributes.uv;
    for (let i = 0; i < pos.count; i++)
      uv.setXY(i, (pos.getX(i) + s * 3.1 + 3.1) / 6.2, pos.getY(i) / 8.31);
    add(face, carvedMetal, 0, 0, 0.37, pivot);
    for (let j = 0; j < 7; j++)
      for (const xx of [0.13, 2.98])
        add(
          new T.SphereGeometry(0.063, 6, 4),
          trim,
          -s * xx,
          0.39 + j * 0.85,
          0.46,
          pivot,
        );
    ring(0.16, 0.046, -s * 2.75, 3.68, 0.55, trim, pivot);
    line([-s * 0.21, 6.65, 0.43], [-s * 2.88, 8.0, 0.43], 0.085, trim, pivot);
  }
  const emblemCanvas = document.createElement("canvas");
  emblemCanvas.width = emblemCanvas.height = 256;
  const ec = emblemCanvas.getContext("2d");
  ec.fillStyle = trimColor;
  ec.textAlign = "center";
  ec.textBaseline = "middle";
  ec.font = "128px serif";
  ec.fillText(world.crest, 128, 140);
  const emblemTex = new T.CanvasTexture(emblemCanvas);
  disposables.push(emblemTex);
  const emblemMat = new T.MeshBasicMaterial({
    map: emblemTex,
    transparent: true,
    depthWrite: false,
  });
  const seal = add(
    new T.CylinderGeometry(0.7, 0.7, 0.17, 12),
    darkStone,
    0,
    12.03,
    0.73,
  );
  seal.rotation.x = Math.PI / 2;
  ring(0.72, 0.065, 0, 12.03, 0.84, trim);
  add(new T.PlaneGeometry(1.55, 1.55), emblemMat, 0, 12.03, 0.86);
  assetsReady.push(
    new T.TextureLoader()
      .loadAsync(`skins/summon/crest-${plan.world}.png`)
      .then((texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = T.SRGBColorSpace;
        disposables.push(texture);
        emblemMat.map = texture;
        emblemMat.needsUpdate = true;
      }),
  );

  const haloCanvas = document.createElement("canvas");
  haloCanvas.width = haloCanvas.height = 128;
  const hc = haloCanvas.getContext("2d"),
    hg = hc.createRadialGradient(64, 64, 0, 64, 64, 64);
  hg.addColorStop(0, "#ffffffff");
  hg.addColorStop(0.12, "#ffffffc0");
  hg.addColorStop(0.42, "#ffffff35");
  hg.addColorStop(1, "#ffffff00");
  hc.fillStyle = hg;
  hc.fillRect(0, 0, 128, 128);
  const haloTex = new T.CanvasTexture(haloCanvas);
  disposables.push(haloTex);
  function glow(x, y, z, color, size, strength = 1) {
    const material = new T.SpriteMaterial({
      map: haloTex,
      color,
      transparent: true,
      opacity: strength,
      blending: T.AdditiveBlending,
      depthWrite: false,
    });
    const sprite = new T.Sprite(material);
    sprite.position.set(x, y, z);
    sprite.scale.set(size, size, 1);
    scene.add(sprite);
    glows.push(sprite);
    return sprite;
  }
  // One painted far plane per world supplies dense illustration detail; the
  // stairs, columns and hinged doors in front still have genuine camera parallax.
  assetsReady.push(
    new T.TextureLoader()
      .loadAsync(`skins/summon/${plan.world}-hall.webp`)
      .then((texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = T.SRGBColorSpace;
        disposables.push(texture);
        add(
          new T.PlaneGeometry(22.5, 41),
          new T.MeshBasicMaterial({
            map: texture,
            color: "#bac7dc",
            fog: false,
          }),
          0,
          6.4,
          -12,
        );
      }),
  );
  for (const s of [-1, 1])
    for (const z of [3.6, 13.5, 20.5]) {
      const y = z < 5 ? 4.6 : z < 17 ? 2.75 : 1.35,
        x = s * 4.85;
      cyl(0.28, 0.44, 1.15, x, y, z, darkStone);
      cyl(0.48, 0.28, 0.31, x, y + 0.67, z, metal);
      const flameColor =
        plan.world === "hell"
          ? "#ff854f"
          : plan.world === "earth"
            ? "#74ffd6"
            : plan.world === "ice"
              ? "#a4e5ff"
              : "#ffc36e";
      const flameMat = new T.MeshBasicMaterial({
        color: flameColor,
        transparent: true,
        opacity: 0.9,
      });
      const flame = add(
        new T.SphereGeometry(0.25, 8, 8),
        flameMat,
        x,
        y + 1.05,
        z,
      );
      flame.scale.set(0.64, 1.9, 0.64);
      glow(x, y + 1.05, z, flameColor, 2.8, 0.58);
      const lamp = new T.PointLight(flameColor, 10, 6, 2);
      lamp.position.set(x, y + 1, z);
      if (z < 5) scene.add(lamp);
      animated.push((t) => {
        flame.scale.y = 1.8 + Math.sin(t * 5 + z) * 0.14;
        lamp.intensity = 9.3 + Math.sin(t * 4 + z) * 0.7;
      });
    }

  const portalMat = new T.MeshBasicMaterial({
    color: plan.gold ? "#fff0bc" : world.accent,
    transparent: true,
    opacity: 0.0,
    side: T.DoubleSide,
  });
  const portalShape = new T.Shape();
  portalShape.moveTo(-3.06, 3.13);
  portalShape.lineTo(3.06, 3.13);
  portalShape.lineTo(3.06, 9.85);
  portalShape.lineTo(0, 11.44);
  portalShape.lineTo(-3.06, 9.85);
  portalShape.closePath();
  const portal = add(new T.ShapeGeometry(portalShape), portalMat, 0, 0, -0.14);
  portal.castShadow = false;
  const bloom = glow(0, 7.4, 0.1, plan.gold ? "#ffd68e" : world.accent, 12, 0);
  bloom.material.depthTest = true;
  const inner = glow(0, 7, -0.35, "#fff7e6", 6, 0);

  const particles = new Float32Array(100 * 3),
    original = new Float32Array(100 * 3);
  for (let i = 0; i < 100; i++) {
    original[i * 3] = (seeded(i + 800) - 0.5) * 26;
    original[i * 3 + 1] = seeded(i + 1000) * 15;
    original[i * 3 + 2] = seeded(i + 1200) * 38 - 9;
  }
  particles.set(original);
  const pg = new T.BufferGeometry();
  pg.setAttribute("position", new T.BufferAttribute(particles, 3));
  const motes = new T.Points(
    pg,
    new T.PointsMaterial({
      color: world.accent,
      size: plan.world === "ice" ? 0.055 : 0.032,
      transparent: true,
      opacity: 0.55,
      blending: T.AdditiveBlending,
      depthWrite: false,
    }),
  );
  scene.add(motes);
  let width = 1,
    height = 1;
  function resize(w, h) {
    width = Math.max(1, w);
    height = Math.max(1, h);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = camera.aspect < 0.65 ? 63 : 53;
    camera.updateProjectionMatrix();
  }
  function render(ms) {
    const f = summonFrame(ms),
      t = ms / 1000;
    camera.position.set(
      mix(-1.4, 0, f.ascent),
      mix(2.7, 9.2, f.ascent),
      mix(30, 20.8, f.ascent),
    );
    camera.lookAt(mix(0.2, 0, f.ascent), mix(6.1, 7.35, f.ascent), -0.25);
    for (const { pivot, s } of doors) pivot.rotation.y = -s * f.opening * 1.39;
    portalMat.opacity = smooth((ms - 4250) / 1600) * 0.97;
    doorLight.intensity = 80 * f.opening;
    bloom.material.opacity = f.opening * 0.62;
    inner.material.opacity = f.opening * 0.88;
    trim.emissiveIntensity = 0.06 + f.opening * (plan.gold ? 0.28 : 0.08);
    for (const update of animated) update(t);
    for (let i = 0; i < 100; i++) {
      particles[i * 3 + 1] =
        (original[i * 3 + 1] +
          t * (plan.world === "ice" ? -0.28 : 0.075) +
          30) %
        15;
      particles[i * 3] = original[i * 3] + Math.sin(t * 0.25 + i) * 0.18;
    }
    pg.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
    const origin = new T.Vector3(0, 7.1, 0.7).project(camera);
    return {
      ...f,
      origin: {
        x: ((origin.x + 1) * width) / 2,
        y: ((1 - origin.y) * height) / 2,
      },
    };
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    const geometries = new Set(),
      materials = new Set();
    scene.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material)
        for (const m of Array.isArray(object.material)
          ? object.material
          : [object.material])
          materials.add(m);
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    disposables.forEach((t) => t.dispose());
    // The same canvas is reused by StrictMode/preview world changes. Explicitly
    // losing its shared GL context would also kill the next renderer instance.
    renderer.dispose();
  }
  return { resize, render, dispose, ready: Promise.all(assetsReady) };
}
