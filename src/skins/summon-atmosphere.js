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

const colorValue = (color) =>
  color?.isColor ? color.clone() : new T.Color(color);

/**
 * Receding mist behind the actual pointed doorway. The provided geometry is
 * adopted by the returned Mesh and is disposed by the scene's normal cleanup.
 * Coordinates follow pointedOutline(3, 7.3, 10.8), with y=0 on the landing.
 */
export function makeSummonPortal(color = "#d8c29b", geometry) {
  if (!geometry?.isBufferGeometry) {
    throw new TypeError("makeSummonPortal requires the doorway geometry");
  }
  const material = new T.ShaderMaterial({
    name: "summon-receding-mist",
    uniforms: {
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uColor: { value: colorValue(color) },
    },
    depthWrite: true,
    toneMapped: true,
    side: T.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vDoor;
      void main() {
        vDoor = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uTime;
      uniform float uReveal;
      uniform vec3 uColor;
      varying vec2 vDoor;
      ${noiseGLSL}

      void main() {
        vec2 p = vec2(vDoor.x / 3.0, (vDoor.y - 4.9) / 5.9);
        float reveal = smoothstep(0.0, 1.0, uReveal);
        float t = uTime * 0.065;
        float depth = length(p * vec2(1.0, 0.80));

        // Two slowly travelling banks give a sense of distance. Their scale
        // differs, so the interior never resembles a flat coloured panel.
        vec2 drift = vec2(t * 0.15, -t * 0.31);
        float farMist = mistNoise(p * 2.2 + drift + vec2(3.7, 8.1));
        vec2 warp = vec2(farMist - 0.5, farMist * 0.37);
        float nearMist = mistNoise(p * vec2(3.0, 4.8) + warp * 1.25
                                + vec2(-t * 0.34, t * 0.52));
        float centre = exp(-dot(p * vec2(1.65, 1.14), p * vec2(1.65, 1.14)));
        float distantLight = centre * (0.19 + farMist * 0.34);
        float cloud = smoothstep(0.26, 0.75, nearMist)
                    * exp(-depth * depth * 1.7);

        // The jambs stay dark, with a warmer diffused source further inside.
        // No rotating rings, strobing, or rapid exposure changes.
        vec3 deepShadow = vec3(0.003, 0.0045, 0.009);
        vec3 middleFog = mix(uColor * 0.28, vec3(0.11, 0.14, 0.18), 0.52);
        vec3 fogLight = mix(uColor, vec3(0.91, 0.94, 1.0), 0.54);
        vec3 result = deepShadow + middleFog * cloud * (0.22 + reveal * 0.46);
        // A distant source and broad light through the mist make an interior,
        // rather than a flat grey cutout between the opening leaves.
        vec2 source = p - vec2(0.0, 0.08);
        float core = exp(-dot(source * vec2(2.9, 2.0), source * vec2(2.9, 2.0)));
        float shafts = pow(0.5 + 0.5 * sin(atan(source.y, source.x) * 13.0 + farMist * 1.4), 8.0);
        float radial = exp(-depth * 2.7) * shafts * .22;
        result += fogLight * distantLight * (0.035 + reveal * 1.3);
        result += mix(uColor, vec3(1.0, 0.96, 0.86), .5) * (core * 2.8 + radial) * reveal;
        result += uColor * cloud * .27 * reveal;
        // The floor's mist is denser but does not make a glowing border.
        float lowMist = exp(-pow((vDoor.y - 0.8) / 1.55, 2.0))
                      * exp(-p.x * p.x * 2.2);
        result += middleFog * lowMist * (0.03 + 0.13 * reveal)
                * (0.45 + farMist * 0.55);
        gl_FragColor = vec4(result, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const portal = new T.Mesh(geometry, material);
  portal.name = "mist-beyond-summoning-door";
  portal.castShadow = false;
  portal.receiveShadow = false;
  portal.userData.update = (seconds, reveal = 0) => {
    material.uniforms.uTime.value = seconds;
    material.uniforms.uReveal.value = T.MathUtils.clamp(reveal, 0, 1);
  };
  return portal;
}
