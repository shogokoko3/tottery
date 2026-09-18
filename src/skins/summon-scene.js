import * as T from "three";
import { SUMMON_WORLDS, summonFrame, smooth } from "./summon-plan.js";
import { SUMMON_ARCHITECTURE } from "./summon-architecture.js";
import { makeSummonPortal } from "./summon-atmosphere.js";
import { makeSummonGoldLight } from "./summon-gold.js";

const W = 12,
  H = 18;
const FOV = 50,
  INITIAL_DISTANCE = H / (2 * Math.tan((FOV * Math.PI) / 360));
const point = ([u, v]) => new T.Vector2((u - 0.5) * W, (1 - v) * H);
const mix = (a, b, t) => a + (b - a) * t;

function paintedMaterial(texture, gold) {
  return new T.ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      uGold: { value: gold ? 1 : 0 },
      uTime: { value: 0 },
    },
    side: T.DoubleSide,
    vertexShader: `varying vec2 vUv; void main() { vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      uniform sampler2D uMap; uniform float uGold; uniform float uTime; varying vec2 vUv;
      void main() {
        vec3 c=texture2D(uMap,vUv).rgb;
        float value=dot(c,vec3(.2126,.7152,.0722));
        // Preserve all carved relief and its painted shadows while gilding the metal.
        vec3 gilded=vec3(2.25,1.36,.27)*pow(value,.77);
        float phase=fract((uTime+.25)/3.1);
        float sweep=exp(-pow((vUv.x+vUv.y*.38-(phase*1.85-.25))/.075,2.0));
        float charge=smoothstep(1.,3.8,uTime);
        gilded+=vec3(1.25,.91,.34)*sqrt(value)*sweep*(.55+charge*.6);
        gilded+=vec3(.2,.12,.02)*pow(value,.55)*charge;
        c=mix(c,gilded,uGold*.91);
        gl_FragColor=vec4(c,1.0);
        #include <colorspace_fragment>
      }`,
  });
}

/** Painted architecture with depth in the stairway and genuinely hinged leaves. */
export function createSummonScene(canvas, plan) {
  const world = SUMMON_WORLDS[plan.world];
  const architecture =
    SUMMON_ARCHITECTURE[plan.world] || SUMMON_ARCHITECTURE.heaven;
  const renderer = new T.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  const scene = new T.Scene();
  scene.background = new T.Color(world.sky);
  const camera = new T.PerspectiveCamera(FOV, 1, 0.1, 80);
  const doors = [];
  const resources = [];
  let disposed = false,
    width = 1,
    height = 1,
    portal,
    mist,
    paintedFront,
    goldLight;
  const contour = architecture.edge.map(point);
  const bounds = new T.Box2().setFromPoints(contour);
  const centre = (architecture.seam - 0.5) * W;
  const floor = bounds.min.y;
  const doorHeight = bounds.max.y - floor;

  const loader = new T.TextureLoader();
  const loadTexture = async (url) => {
    const texture = await loader.loadAsync(url);
    if (disposed) {
      texture.dispose();
      return texture;
    }
    texture.colorSpace = T.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    resources.push(texture);
    return texture;
  };
  const ready = Promise.all([
    loadTexture(
      `skins/summon/art-v3/${architecture.asset || `${plan.world}.webp`}`,
    ),
    loadTexture(`skins/summon/interior-v4/${plan.world}.webp`),
  ]).then(([texture, interiorTexture]) => {
    if (disposed) {
      return;
    }

    // Painted perspective is preserved exactly at the opening frame. Near steps
    // have their own depth, so the camera rises through them without toy geometry.
    const stageGeometry = new T.PlaneGeometry(W, H, 40, 90);
    const pos = stageGeometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        y = pos.getY(i) + H / 2;
      const near = smooth((floor - 0.15 - y) / Math.max(1, floor));
      const depth = near * 2.4;
      const ratio = (INITIAL_DISTANCE - depth) / INITIAL_DISTANCE;
      pos.setXYZ(i, x * ratio, 9 + (y - 9) * ratio, depth - 0.04);
    }
    stageGeometry.computeBoundingSphere();
    const stageMaterial = new T.MeshBasicMaterial({
      map: texture,
      toneMapped: false,
    });
    stageMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uDoorEdge = {
        value: architecture.edge.map(([u, v]) => new T.Vector2(u, 1 - v)),
      };
      shader.fragmentShader =
        `uniform vec2 uDoorEdge[${architecture.edge.length}];\n` +
        shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `
        #include <map_fragment>
        bool inDoor = false;
        for (int i = 0; i < ${architecture.edge.length}; i++) {
          int j = i == 0 ? ${architecture.edge.length - 1} : i - 1;
          vec2 a = uDoorEdge[i], b = uDoorEdge[j];
          if ((a.y > vMapUv.y) != (b.y > vMapUv.y)) {
            float crossX = (b.x-a.x)*(vMapUv.y-a.y)/(b.y-a.y)+a.x;
            if (vMapUv.x < crossX) inDoor = !inDoor;
          }
        }
        if (inDoor) discard;
      `,
      );
    };
    const stage = new T.Mesh(stageGeometry, stageMaterial);
    scene.add(stage);

    // Register the interior floor to the gate's sill from the settled camera.
    // Depth is assigned to the near aisle, side columns and far focal point;
    // compensating the projection keeps painted architecture straight.
    const pw = bounds.max.x - bounds.min.x;
    const pictureHeight = Math.max(doorHeight, pw * 1.5) * 1.015;
    const pictureWidth = pictureHeight / 1.5;
    const settledZ = INITIAL_DISTANCE / 1.21;
    const portalGeometry = new T.PlaneGeometry(
      pictureWidth,
      pictureHeight,
      32,
      48,
    );
    const interiorPos = portalGeometry.attributes.position;
    const interiorUv = portalGeometry.attributes.uv;
    for (let i = 0; i < interiorPos.count; i++) {
      const u = interiorUv.getX(i),
        v = interiorUv.getY(i);
      const aisle = smooth((0.45 - v) / 0.45);
      const sides = smooth((Math.abs(u - 0.5) - 0.18) / 0.32);
      const z = -6.2 + 2.7 * Math.max(aisle, sides);
      const ratio = (settledZ - z) / settledZ;
      const x = centre + interiorPos.getX(i);
      const y = floor - 0.045 + v * pictureHeight;
      interiorPos.setXYZ(i, x * ratio, 10.15 + (y - 10.15) * ratio, z);
    }
    portalGeometry.computeBoundingSphere();
    portal = makeSummonPortal({
      texture: interiorTexture,
      world: plan.world,
      gold: plan.gold,
      color: world.accent,
      geometry: portalGeometry,
    });
    scene.add(portal);

    const front = paintedMaterial(texture, plan.gold);
    paintedFront = front;
    if (plan.gold) {
      goldLight = makeSummonGoldLight({
        centre,
        floor,
        width: pw,
        height: doorHeight,
        contour,
      });
      scene.add(goldLight.group);
    }
    const edgeMaterial = new T.MeshStandardMaterial({
      color: plan.gold ? "#9d7430" : "#472e1e",
      roughness: 0.63,
      metalness: 0.42,
    });
    scene.add(new T.HemisphereLight("#f5e4cf", "#101823", 2.0));
    // The centre is a shared apex in all hand-traced contours.
    const apex = contour.findIndex((p) => Math.abs(p.x - centre) < 0.005);
    for (const side of [-1, 1]) {
      const outer = side < 0 ? contour.slice(0, apex + 1) : contour.slice(apex);
      const half =
        side < 0
          ? [...outer, new T.Vector2(centre, floor)]
          : [new T.Vector2(centre, floor), ...outer];
      const hingeX = side < 0 ? bounds.min.x : bounds.max.x;
      const local = half.map((p) => new T.Vector2(p.x - hingeX, p.y - floor));
      const leafShape = new T.Shape(local);
      const group = new T.Group();
      group.position.set(hingeX, floor, 0.004);
      const solidGeometry = new T.ExtrudeGeometry(leafShape, {
        depth: 0.09,
        bevelEnabled: false,
        steps: 1,
      });
      solidGeometry.translate(0, 0, -0.095);
      group.add(new T.Mesh(solidGeometry, edgeMaterial));
      const face = new T.ShapeGeometry(leafShape);
      const fp = face.attributes.position,
        uv = face.attributes.uv;
      for (let i = 0; i < fp.count; i++)
        uv.setXY(i, (fp.getX(i) + hingeX) / W + 0.5, (fp.getY(i) + floor) / H);
      group.add(new T.Mesh(face, front));
      goldLight?.lightLeaf(group, local);
      scene.add(group);
      doors.push({ group, side });
    }
    // Light gathers in the centre of the opening, leaving the painting readable.
    mist = new T.PointLight(plan.gold ? "#ffd894" : world.accent, 0, 8);
    mist.position.set(centre, floor + doorHeight * 0.44, 1);
    scene.add(mist);
  });

  function resize(w, h) {
    width = Math.max(1, w);
    height = Math.max(1, h);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  function render(ms) {
    const frame = summonFrame(ms),
      t = ms / 1000;
    // A steady forward/upward glide follows the stairs and settles before opening.
    const approach = smooth((ms - 4400) / 2600) * 0.4;
    camera.position.set(
      0,
      mix(9, 10.15, frame.ascent),
      mix(INITIAL_DISTANCE, INITIAL_DISTANCE / 1.21, frame.ascent) - approach,
    );
    camera.lookAt(0, camera.position.y, 0);
    for (const { group, side } of doors)
      group.rotation.y = -side * frame.opening * 1.4;
    if (paintedFront) paintedFront.uniforms.uTime.value = t;
    goldLight?.group.userData.update(t, renderer.getPixelRatio());
    portal?.userData.update(t, smooth((ms - 4100) / 2100));
    if (mist) mist.intensity = frame.opening * 1.2;
    renderer.render(scene, camera);
    const origin = new T.Vector3(
      centre,
      floor + doorHeight * 0.44,
      0.1,
    ).project(camera);
    return {
      ...frame,
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
    scene.traverse((o) => {
      if (o.geometry) geometries.add(o.geometry);
      if (o.material) materials.add(o.material);
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    resources.forEach((r) => r.dispose());
    renderer.dispose();
  }
  return { ready, resize, render, dispose };
}
