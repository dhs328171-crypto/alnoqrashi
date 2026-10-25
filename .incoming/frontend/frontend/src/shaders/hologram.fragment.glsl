// ─────────────────────────────────────────────
//  Mr. Nokrashy Hologram — Fragment Shader
//  لون نيون متوهج + خطوط شاشة + Fresnel + شفافية + وميض
// ─────────────────────────────────────────────
uniform float uTime;
uniform float uGlitch;
uniform float uSpeak;
uniform float uOpacity;
uniform float uHasScan;
uniform vec3 uColor;
uniform vec3 uAccent;
uniform sampler2D uScan;

varying vec3 vNormalW;
varying vec3 vViewDir;
varying vec3 vWorldPos;
varying vec2 vUv;

float hash11(float n) {
  return fract(sin(n) * 43758.5453123);
}

void main() {
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(vViewDir);

  // حواف متوهجة (Fresnel)
  float fres = pow(1.0 - abs(dot(N, V)), 2.2);

  // خطوط المسح: ثابتة في العالم عشان تفضل مع المجسم وهو بيلف
  float lines = smoothstep(0.35, 0.9, 0.5 + 0.5 * sin(vWorldPos.y * 180.0 - uTime * 3.0));
  float tex = 1.0;
  if (uHasScan > 0.5) {
    tex = texture2D(uScan, vec2(vWorldPos.x * 2.0, vWorldPos.y * 40.0 - uTime * 0.6)).r;
  }
  float scan = mix(0.45, 1.0, lines) * mix(0.7, 1.0, tex);

  // شريط ضوء بيطلع لفوق
  float b = fract(vWorldPos.y * 0.25 - uTime * 0.15);
  float band = exp(-pow((b - 0.5) * 14.0, 2.0));

  // وميض وانقطاع لحظي
  float flick = 0.92 + 0.08 * sin(uTime * 47.0) * sin(uTime * 13.0);
  float drop = step(0.985, hash11(floor(uTime * 20.0))) * 0.5;

  vec3 col = mix(uColor * 0.55, uColor, fres);
  col += uAccent * fres * 0.35;
  col += vec3(1.0) * band * 0.6;
  col += uColor * uSpeak * 0.25;
  col *= scan * flick;

  // انفصال الألوان (RGB split) وقت الـ Glitch
  col.r *= 1.0 + uGlitch * 0.6;
  col.b *= 1.0 - uGlitch * 0.3;

  float alpha = (0.18 + fres * 0.75 + band * 0.4 + uSpeak * 0.1) * scan * uOpacity;
  alpha *= (1.0 - drop);
  // المجسم "بيطلع" من المنصة
  alpha *= smoothstep(-0.05, 0.15, vWorldPos.y);

  gl_FragColor = vec4(col, alpha);
}
