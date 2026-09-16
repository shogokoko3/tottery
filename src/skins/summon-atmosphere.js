import * as T from "three";

const noiseGLSL = /* glsl */ `
  float hash21(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * 0.1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
  }
  float noise2(vec2 p) {
    vec2 cell = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(cell), hash21(cell + vec2(1.0, 0.0)), f.x),
               mix(hash21(cell + vec2(0.0, 1.0)), hash21(cell + vec2(1.0)), f.x), f.y);
  }
  float mistNoise(vec2 p) {
    float n = 0.55 * noise2(p);
    p = mat2(1.61, 1.17, -1.17, 1.61) * p + vec2(4.1, 1.7);
    n += 0.29 * noise2(p);
    p = mat2(1.61, 1.17, -1.17, 1.61) * p + vec2(2.3, 7.9);
    return n + 0.16 * noise2(p);
  }
`;

// Fog stays close to the floor; the few motes change character with the world.
const atmosphere = {
  earth: { fog: 0.018, count: 5, speed: 0.038, direction: 1, dust: "#adceb6" },
  sea: { fog: 0.02, count: 6, speed: 0.046, direction: 1, dust: "#b2e0e8" },
  forest: { fog: 0.016, count: 7, speed: 0.032, direction: 1, dust: "#d4e8a8" },
  ice: { fog: 0.024, count: 10, speed: 0.064, direction: -1, dust: "#dceeff" },
  sky: { fog: 0.024, count: 5, speed: 0.03, direction: 1, dust: "#deedff" },
  heaven: { fog: 0.016, count: 7, speed: 0.028, direction: 1, dust: "#f3deb0" },
  hell: { fog: 0.014, count: 9, speed: 0.078, direction: 1, dust: "#ff9c55" },
};

const colorValue = (color) =>
  color?.isColor ? color.clone() : new T.Color(color);

/**
 * The painted world beyond the doorway, with restrained atmosphere at its floor.
 * Geometry and material belong to the returned mesh. The caller owns the texture.
 */
export function makeSummonPortal({
  texture,
  world = "earth",
  gold = false,
  color = "#d8c29b",
  geometry,
}) {
  if (!geometry?.isBufferGeometry) {
    throw new TypeError("makeSummonPortal requires the doorway geometry");
  }
  if (!texture?.isTexture) {
    throw new TypeError("makeSummonPortal requires the interior texture");
  }
  const theme = atmosphere[world] || atmosphere.earth;
  const dust = new T.Color(theme.dust);
  if (gold) dust.lerp(new T.Color("#ffe0a8"), 0.28);
  const material = new T.ShaderMaterial({
    name: "summon-painted-interior",
    uniforms: {
      uMap: { value: texture },
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uColor: { value: colorValue(color) },
      uDustColor: { value: dust },
      uFogStrength: { value: theme.fog },
      uParticleCount: { value: theme.count },
      uParticleMotion: { value: new T.Vector2(theme.speed, theme.direction) },
      uEmbers: { value: world === "hell" ? 1 : 0 },
    },
    depthWrite: true,
    toneMapped: false,
    side: T.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D uMap;
      uniform float uTime;
      uniform float uReveal;
      uniform vec3 uColor;
      uniform vec3 uDustColor;
      uniform float uFogStrength;
      uniform float uParticleCount;
      uniform vec2 uParticleMotion;
      uniform float uEmbers;
      varying vec2 vUv;
      ${noiseGLSL}

      void main() {
        // Never displace or fade the painted architecture as the doors open.
        vec3 painted = texture2D(uMap, vUv).rgb;
        float reveal = smoothstep(0.0, 1.0, uReveal);
        float activity = 0.2 + 0.8 * reveal;
        float sides = smoothstep(0.0, 0.035, vUv.x)
                    * smoothstep(0.0, 0.035, 1.0 - vUv.x);
        float bottom = smoothstep(0.0, 0.025, vUv.y);
        vec3 result = painted * (0.965 + 0.035 * sides)
                              * (0.975 + 0.025 * bottom);

        // Thin drifting wisps occupy only the lowest third of the artwork.
        float floorMask = 1.0 - smoothstep(0.09, 0.30, vUv.y);
        float floorBank = exp(-pow((vUv.y - 0.085) / 0.095, 2.0));
        float t = uTime * 0.025;
        float farMist = mistNoise(vUv * vec2(5.0, 16.0)
                               + vec2(t * 0.7, -t * 0.15));
        float nearMist = mistNoise(vUv * vec2(9.0, 25.0)
                                + vec2(-t * 1.1, t * 0.2));
        float wisps = smoothstep(0.37, 0.72, farMist * 0.6 + nearMist * 0.4);
        float fog = floorMask * floorBank * wisps * uFogStrength * activity;
        vec3 fogColor = mix(uColor * 0.22, painted, 0.45);
        result = mix(result, fogColor, fog);

        // Existing painted highlights respond by less than one percent.
        float brightness = dot(painted, vec3(0.2126, 0.7152, 0.0722));
        float highlight = smoothstep(0.22, 0.75, brightness);
        result += painted * highlight * floorMask * (farMist - 0.5)
                * 0.012 * activity;

        // Sparse dust, snow, or embers. Every position depends on absolute time,
        // so scrubbing or pausing a preview reproduces the same exact frame.
        vec2 pixel = fwidth(vUv);
        float feather = max(pixel.x * 0.65, pixel.y) * 0.65;
        float motes = 0.0;
        for (int i = 0; i < 10; i++) {
          float index = float(i);
          if (index >= uParticleCount) continue;
          float seed = hash21(vec2(index + 1.7, 8.3));
          float offset = hash21(vec2(index + 4.2, 1.1));
          float lifetime = fract(seed + uTime * uParticleMotion.x
                               * (0.65 + offset * 0.7));
          float travel = uParticleMotion.y > 0.0 ? lifetime : 1.0 - lifetime;
          vec2 position = vec2(0.08 + offset * 0.84, 0.025 + travel * 0.25);
          position.x += sin(uTime * 0.17 + seed * 18.0) * 0.012;
          vec2 delta = (vUv - position) * vec2(0.65, 1.0);
          delta.y *= mix(1.0, 0.65, uEmbers);
          float radius = mix(0.0009, 0.0017, seed);
          float point = 1.0 - smoothstep(radius, radius + feather, length(delta));
          float fade = smoothstep(0.0, 0.16, lifetime)
                     * (1.0 - smoothstep(0.75, 1.0, lifetime));
          motes += point * fade * (0.35 + seed * 0.35);
        }
        result += uDustColor * motes * activity * (0.16 + 0.1 * uEmbers)
                * floorMask;
        gl_FragColor = vec4(result, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const portal = new T.Mesh(geometry, material);
  portal.name = "painted-world-beyond-summoning-door";
  portal.castShadow = false;
  portal.receiveShadow = false;
  portal.userData.update = (seconds, reveal = 0) => {
    material.uniforms.uTime.value = seconds;
    material.uniforms.uReveal.value = T.MathUtils.clamp(reveal, 0, 1);
  };
  return portal;
}
