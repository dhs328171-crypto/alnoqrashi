// ─────────────────────────────────────────────
//  Mr. Nokrashy Hologram — Vertex Shader
//  نبضات الهولوجرام + قطع الإشارة الأفقي (Glitch) + دعم الـ Blend Shapes
// ─────────────────────────────────────────────
uniform float uTime;
uniform float uGlitch;   // 0..1  شدة الـ Glitch
uniform float uSpeak;    // 0..1  مستوى الكلام

varying vec3 vNormalW;
varying vec3 vViewDir;
varying vec3 vWorldPos;
varying vec2 vUv;

#include <common>
#include <morphtarget_pars_vertex>

float hash11(float n) {
  return fract(sin(n) * 43758.5453123);
}

void main() {
  // begin_vertex بيعرّف transformed، و morphtarget_vertex بيطبّق حركة الفم (Visemes)
  #include <begin_vertex>
  #include <morphtarget_vertex>

  vec4 world = modelMatrix * vec4(transformed, 1.0);
  vec3 nW = normalize(mat3(modelMatrix) * normal);

  // نبض خفيف على سطح المجسم، وبيزيد وقت الكلام
  float pulse = sin(uTime * 2.0 + world.y * 3.0) * 0.004
              + uSpeak * 0.006 * sin(uTime * 30.0 + world.y * 10.0);
  world.xyz += nW * pulse;

  // شرائح أفقية بتتزحلق وقت الـ Glitch
  float slice = floor(world.y * 14.0 + uTime * 6.0);
  float hit = step(0.82, hash11(slice + floor(uTime * 8.0)));
  world.x += hit * uGlitch * (hash11(slice) - 0.5) * 0.35;

  vWorldPos = world.xyz;
  vNormalW = nW;
  vViewDir = normalize(cameraPosition - world.xyz);
  vUv = uv;

  gl_Position = projectionMatrix * viewMatrix * world;
}
