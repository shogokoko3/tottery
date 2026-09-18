import * as T from "three";
import { smooth } from "./summon-plan.js";

// Small, gate-bound lights: no full-screen bloom pass on mobile.
export function makeSummonGoldLight({ centre, floor, width, height, contour }) {
  const group = new T.Group();
  const clock = { value: 0 },
    strength = { value: 0 },
    openingLight = { value: 0 },
    spillingLight = { value: 0 };

  // This light sits inside the actual opening. Opaque door leaves occlude it,
  // so the first light is seen through the crack, then fills the open doorway.
  const apertureGeometry = new T.ShapeGeometry(new T.Shape(contour));
  const ap = apertureGeometry.attributes.position,
    au = apertureGeometry.attributes.uv;
  for (let i = 0; i < ap.count; i++)
    au.setXY(
      i,
      (ap.getX(i) - centre) / width + 0.5,
      (ap.getY(i) - floor) / height,
    );
  const apertureMaterial = new T.ShaderMaterial({
    uniforms: { uTime: clock, uLight: openingLight },
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `
      uniform float uTime,uLight; varying vec2 vUv;
      void main(){
        vec2 p=vUv-vec2(.5,.43);
        float centre=exp(-dot(p*vec2(1.,.8),p*vec2(1.,.8))*12.);
        float column=exp(-p.x*p.x*35.)*.22;
        float mist=.8+.2*sin(vUv.y*9.-uTime*1.1+sin(vUv.x*8.));
        vec3 color=mix(vec3(1.,.55,.12),vec3(1.,.93,.68),centre);
        gl_FragColor=vec4(color,(centre*.8+column)*mist*uLight);
        #include <colorspace_fragment>
      }`,
  });
  const aperture = new T.Mesh(apertureGeometry, apertureMaterial);
  aperture.position.z = -0.13;
  group.add(aperture);

  // Soft shafts spill into the hall as the leaves separate; the central glow
  // above stays behind the leaves, preserving the gate and interior relief.
  const raysMaterial = new T.ShaderMaterial({
    uniforms: { uTime: clock, uLight: spillingLight },
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `
      uniform float uTime,uLight; varying vec2 vUv;
      void main(){
        vec2 p=(vUv-.5)*2.;
        float r=length(p), a=atan(p.y,p.x);
        float shafts=pow(.5+.5*sin(a*13.+sin(a*5.)*.8+uTime*.13),10.);
        float fade=(1.-smoothstep(.28,1.,r))*smoothstep(.025,.15,r);
        float glow=exp(-r*r*6.)*.1;
        gl_FragColor=vec4(1.,.8,.37,(shafts*fade*.38+glow)*uLight);
        #include <colorspace_fragment>
      }`,
  });
  const rays = new T.Mesh(
    new T.PlaneGeometry(width * 2.4, height * 1.6),
    raysMaterial,
  );
  rays.position.set(centre, floor + height * 0.43, 0.35);
  group.add(rays);
  const edgeMaterial = new T.ShaderMaterial({
    uniforms: { uTime: clock, uStrength: strength },
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
    blending: T.AdditiveBlending,
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uTime, uStrength; varying vec2 vUv;
      void main(){
        float d=abs(vUv.y-.5)*2.;
        float halo=exp(-d*d*9.)*.32;
        float core=exp(-d*d*350.);
        float travel=pow(.5+.5*sin(vUv.x*12.-uTime*2.3),6.);
        vec3 c=mix(vec3(1.,.46,.06),vec3(1.,.89,.52),core);
        gl_FragColor=vec4(c,(halo+core*.5)*( .75+travel*.5)*uStrength);
        #include <colorspace_fragment>
      }`,
  });

  function lightLeaf(leaf, points) {
    // Follow the traced silhouette and centre seam, rotating with each leaf.
    const positions = [],
      uvs = [],
      indices = [];
    let distance = 0;
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length];
      const delta = b.clone().sub(a),
        length = delta.length();
      if (length < 0.001) continue;
      const n = new T.Vector2(-delta.y, delta.x).multiplyScalar(0.14 / length);
      const offset = positions.length / 3;
      for (const [p, sign] of [
        [a, -1],
        [a, 1],
        [b, -1],
        [b, 1],
      ])
        positions.push(p.x + n.x * sign, p.y + n.y * sign, 0.02);
      uvs.push(
        distance / height,
        0,
        distance / height,
        1,
        (distance + length) / height,
        0,
        (distance + length) / height,
        1,
      );
      indices.push(
        offset,
        offset + 2,
        offset + 1,
        offset + 1,
        offset + 2,
        offset + 3,
      );
      distance += length;
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute(
      "position",
      new T.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    const rim = new T.Mesh(geometry, edgeMaterial);
    leaf.add(rim);
  }

  const count = 44,
    positions = [],
    phases = [];
  for (let i = 0; i < count; i++) {
    // Deterministic placement, independent of the draw's random source.
    const u = (i * 0.61803398875) % 1,
      v = (i * 0.381966 + 0.17) % 1;
    positions.push(
      centre + (u - 0.5) * width * 1.48,
      floor + v * height,
      0.2 + (i % 5) * 0.12,
    );
    phases.push((i * 0.75487766) % 1);
  }
  const dustGeometry = new T.BufferGeometry();
  dustGeometry.setAttribute(
    "position",
    new T.Float32BufferAttribute(positions, 3),
  );
  dustGeometry.setAttribute("aPhase", new T.Float32BufferAttribute(phases, 1));
  const dustMaterial = new T.ShaderMaterial({
    uniforms: {
      uTime: clock,
      uStrength: strength,
      uFloor: { value: floor },
      uHeight: { value: height },
      uPixels: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
    vertexShader: `
      uniform float uTime,uFloor,uHeight,uPixels; attribute float aPhase;
      varying float vLight;
      void main(){
        vec3 p=position;
        float life=fract((p.y-uFloor)/uHeight+uTime*.085);
        p.y=uFloor+life*uHeight;
        p.x+=sin(uTime*.8+aPhase*16.)*.11;
        vLight=sin(life*3.14159)*(.4+.6*pow(.5+.5*sin(uTime*2.+aPhase*30.),2.));
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
        gl_PointSize=(aPhase>.78?17.:7.)*uPixels;
      }`,
    fragmentShader: `
      uniform float uStrength; varying float vLight;
      void main(){
        vec2 p=abs(gl_PointCoord-.5)*2.;
        float core=exp(-dot(p,p)*19.);
        float rays=exp(-min(p.x,p.y)*32.)*pow(1.-max(p.x,p.y),2.)*.6;
        gl_FragColor=vec4(1.,.77,.3,(core+rays)*vLight*uStrength);
        #include <colorspace_fragment>
      }`,
  });
  const dust = new T.Points(dustGeometry, dustMaterial);
  // The shader moves points above their original positions.
  dust.frustumCulled = false;
  group.add(dust);
  group.userData.update = (seconds, pixelRatio) => {
    clock.value = seconds;
    openingLight.value =
      smooth((seconds - 4.05) / 1.65) * (1 - smooth((seconds - 6.8) / 1.5));
    spillingLight.value =
      smooth((seconds - 4.4) / 1.8) * (1 - smooth((seconds - 7.1) / 1.25));
    strength.value =
      smooth((seconds - 0.35) / 1.5) *
      (1 - smooth((seconds - 7.3) / 1.3)) *
      (1 + 0.35 * smooth((seconds - 2.4) / 1.6));
    dustMaterial.uniforms.uPixels.value = pixelRatio;
  };
  return { group, lightLeaf };
}
