// ═══════════════════════════════════════════════
//  hologram_3d.js — محرك Three.js لمستر نقراشي
//  تحميل المجسم + الإضاءة/البيئة + شيدر الهولوجرام + الأنيميشن
// ═══════════════════════════════════════════════
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const TARGET_HEIGHT = 3.0; // الطول الموحّد للمجسم في المشهد
const BG = 0x02050d;

const MOODS = {
  idle: 0x00f0ff,
  happy: 0x39ff88,
  thinking: 0x9b6bff,
  error: 0xff3860,
};

// ألوان مميزة لأجزاء معينة (بيتعرفوا من اسم الـ mesh)
const PART_STYLES = [
  { re: /tarboosh|tassel|fez|طربوش/i, color: 0xff3355 },
  { re: /bowtie|بابيون/i, color: 0xff2bd6 },
  { re: /mouth|lip/i, color: 0xffffff },
  { re: /^eye|glass/i, color: 0xfff27a },
];

// أشكال الفم (Visemes) كأوزان للـ Blend Shapes
const VISEMES = {
  sil: { jawOpen: 0, mouthWide: 0, mouthRound: 0, mouthSmile: 0.1 },
  aa: { jawOpen: 0.95, mouthWide: 0.15, mouthRound: 0, mouthSmile: 0 },
  ee: { jawOpen: 0.35, mouthWide: 0.9, mouthRound: 0, mouthSmile: 0.4 },
  oo: { jawOpen: 0.45, mouthWide: 0, mouthRound: 0.95, mouthSmile: 0 },
  mm: { jawOpen: 0, mouthWide: 0, mouthRound: 0, mouthSmile: 0 },
  cons: { jawOpen: 0.3, mouthWide: 0.25, mouthRound: 0, mouthSmile: 0 },
};

// أسماء بديلة للـ Blend Shapes (لو المجسم الحقيقي بأسماء تانية)
const ALIASES = {
  mouthOpen: 'jawOpen',
  viseme_aa: 'jawOpen',
  viseme_O: 'mouthRound',
  viseme_U: 'mouthRound',
  viseme_E: 'mouthWide',
  viseme_I: 'mouthWide',
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
const sin01 = (p) => Math.sin(Math.PI * clamp(p, 0, 1));

export class Hologram3D {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.opts = {
      vertexUrl: 'src/shaders/hologram.vertex.glsl',
      fragmentUrl: 'src/shaders/hologram.fragment.glsl',
      modelUrl: 'assets/models/mr_nokrashy.gltf',
      scanUrl: 'assets/textures/scanlines.png',
      ...opts,
    };
    this.clock = new THREE.Clock();
    this.ready = false;
    this.usingFallback = false;

    this.materials = [];
    this.baseMat = null;
    this.morphMeshes = [];
    this.fallbackMouth = null;
    this.eyes = [];

    this.mouthTarget = { ...VISEMES.sil };
    this.mouthCurrent = { ...VISEMES.sil };

    this.look = { x: 0, y: 0, t: -99 };
    this.yawTarget = 0;
    this.lastYawInput = -99;
    this.zoomTarget = 6.4;
    this.zoom = 6.4;
    this.fit = 1;

    this.fx = {};
    this.thinking = false;
    this.speakTarget = 0;
    this.speakCur = 0;
    this.glitchLevel = 0;
    this.nextBlink = 2;
    this.nextGlitch = 5;

    this.moodTarget = new THREE.Color(MOODS.idle);
    this.moodColor = new THREE.Color(MOODS.idle);
  }

  // ───────────── التهيئة ─────────────
  async init(onProgress = () => {}) {
    const r = (this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    }));
    r.setClearColor(BG, 1);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(BG, 0.04);
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);

    this._buildEnvironment();
    this._buildScreen();

    onProgress(0.1, 'تحميل شيدر الهولوجرام...');
    const [vs, fs] = await Promise.all([this._text(this.opts.vertexUrl), this._text(this.opts.fragmentUrl)]);
    const scan = await this._loadScan();

    onProgress(0.4, 'تجهيز الخامات...');
    this._makeMaterials(vs, fs, scan);

    onProgress(0.55, 'تحميل مستر نقراشي...');
    await this._loadModel();

    onProgress(0.9, 'تشغيل محرك العرض...');
    this._setupComposer();
    this.resize();
    new ResizeObserver(() => this.resize()).observe(this.canvas.parentElement);
    r.setAnimationLoop(() => this._tick());
    this.ready = true;
    onProgress(1, 'المجسم جاهز');
  }

  async _text(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`تعذر تحميل ${url} (${res.status})`);
    return res.text();
  }

  async _loadScan() {
    try {
      const tex = await new THREE.TextureLoader().loadAsync(this.opts.scanUrl);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      return tex;
    } catch (e) {
      console.warn('scanlines texture missing, using procedural lines only', e);
      return null;
    }
  }

  _makeMaterials(vs, fs, scan) {
    const dummy = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    dummy.needsUpdate = true;
    this.baseMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uGlitch: { value: 0 },
        uSpeak: { value: 0 },
        uOpacity: { value: 0.9 },
        uHasScan: { value: scan ? 1 : 0 },
        uColor: { value: new THREE.Color(MOODS.idle) },
        uAccent: { value: new THREE.Color(0xff2bd6) },
        uScan: { value: scan || dummy },
      },
      vertexShader: vs,
      fragmentShader: fs,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.materials = [this.baseMat];
    this.styled = new Map();
    for (const s of PART_STYLES) {
      const m = this.baseMat.clone();
      m.uniforms.uScan.value = this.baseMat.uniforms.uScan.value; // clone() بينسخ الخامة؛ نشاركها عشان ما تتحملش تاني
      m.uniforms.uColor.value = new THREE.Color(s.color);
      this.styled.set(s, m);
      this.materials.push(m);
    }
  }

  _materialFor(mesh) {
    const label = `${mesh.name} ${mesh.parent?.name ?? ''}`;
    for (const s of PART_STYLES) if (s.re.test(label)) return this.styled.get(s);
    return this.baseMat;
  }

  async _loadModel() {
    let root;
    try {
      const gltf = await new GLTFLoader().loadAsync(this.opts.modelUrl);
      root = gltf.scene;
    } catch (e) {
      console.warn('GLTF load failed → procedural fallback model', e);
      this.usingFallback = true;
      root = this._buildProceduralModel();
    }
    this._prepareModel(root);
  }

  _prepareModel(root) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.material = this._materialFor(o);
      o.frustumCulled = false; // الـ Glitch والـ Blend Shapes بيحركوا الرؤوس
      if (o.morphTargetDictionary) this.morphMeshes.push(o);
    });

    // توحيد الحجم وتثبيت القدمين على المنصة
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    root.scale.multiplyScalar(TARGET_HEIGHT / (size.y || 1));
    box.setFromObject(root);
    const c = box.getCenter(new THREE.Vector3());
    root.position.x -= c.x;
    root.position.z -= c.z;
    root.position.y -= box.min.y;

    this.pivot = new THREE.Group();
    this.pivot.add(root);
    this.scene.add(this.pivot);
    this.model = root;

    this.head = root.getObjectByName('Head') || null;
    this.armR = root.getObjectByName('ArmR') || null;
    this.armL = root.getObjectByName('ArmL') || null;
    this.eyes = ['EyeL', 'EyeR'].map((n) => root.getObjectByName(n)).filter(Boolean);
    this.base = {
      head: this.head ? this.head.rotation.clone() : new THREE.Euler(),
      eyeY: this.eyes.map((e) => e.scale.y),
      armRSign: Math.sign(this.armR?.position.x) || 1,
      armLSign: Math.sign(this.armL?.position.x) || -1,
    };
  }

  // مجسم احتياطي بالكود لو ملف الـ GLTF مش موجود
  _buildProceduralModel() {
    const root = new THREE.Group();
    root.name = 'Mr_Nokrashy';
    const mk = (name, geo, x, y, z, parent = root) => {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
      m.name = name;
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    };
    const grp = (name, x, y, z) => {
      const g = new THREE.Group();
      g.name = name;
      g.position.set(x, y, z);
      root.add(g);
      return g;
    };
    mk('Body', new THREE.BoxGeometry(1.1, 1.25, 0.55), 0, 0.625, 0);
    mk('Neck', new THREE.CylinderGeometry(0.17, 0.17, 0.3, 16), 0, 1.3, 0);
    mk('BowTie', new THREE.BoxGeometry(0.34, 0.1, 0.04), 0, 1.18, 0.29);
    mk('LegL', new THREE.BoxGeometry(0.4, 0.95, 0.42), 0.26, -0.475, 0);
    mk('LegR', new THREE.BoxGeometry(0.4, 0.95, 0.42), -0.26, -0.475, 0);
    const head = grp('Head', 0, 1.75, 0);
    mk('HeadMesh', new THREE.SphereGeometry(0.5, 32, 20), 0, 0, 0, head);
    mk('Tarboosh', new THREE.CylinderGeometry(0.28, 0.34, 0.38, 32), 0, 0.59, 0, head);
    mk('Tassel', new THREE.BoxGeometry(0.03, 0.3, 0.03), 0.27, 0.62, 0, head);
    mk('EyeL', new THREE.SphereGeometry(0.05, 12, 8), 0.17, 0.07, 0.45, head);
    mk('EyeR', new THREE.SphereGeometry(0.05, 12, 8), -0.17, 0.07, 0.45, head);
    mk('Nose', new THREE.SphereGeometry(0.055, 12, 8), 0, -0.03, 0.5, head);
    mk('Mustache', new THREE.BoxGeometry(0.36, 0.045, 0.05), 0, -0.105, 0.49, head);
    this.fallbackMouth = mk('Mouth', new THREE.CircleGeometry(1, 24), 0, -0.2, 0.47, head);
    this.fallbackMouth.scale.set(0.085, 0.006, 1);
    for (const side of [-1, 1]) {
      const arm = grp(side < 0 ? 'ArmR' : 'ArmL', side * 0.64, 1.1, 0);
      mk('ArmMesh', new THREE.CylinderGeometry(0.12, 0.09, 0.9, 16), 0, -0.45, 0, arm);
      mk('Hand', new THREE.SphereGeometry(0.11, 16, 10), 0, -0.98, 0, arm);
    }
    root.position.y = 0.95;
    return root;
  }

  // ───────────── البيئة (منصة + جسيمات + شبكة) ─────────────
  _buildEnvironment() {
    const add = (o) => (this.scene.add(o), o);
    const glow = (color, opacity) =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

    this.ringMat = glow(MOODS.idle, 0.9);
    const flat = (geo, mat, y) => {
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2;
      m.position.y = y;
      return add(m);
    };
    this.ring1 = flat(new THREE.RingGeometry(0.95, 1.0, 72), this.ringMat, 0.01);
    this.ring2 = flat(new THREE.RingGeometry(1.25, 1.27, 72), glow(MOODS.idle, 0.5), 0.01);
    this.ring2.material = this.ringMat.clone();
    this.ring2.material.opacity = 0.45;
    flat(new THREE.CircleGeometry(1.0, 64), glow(MOODS.idle, 0.07), 0.005);

    const grid = new THREE.GridHelper(16, 32, 0x00f0ff, 0x0a4a66);
    grid.material.transparent = true;
    grid.material.opacity = 0.35;
    grid.position.y = -0.01;
    add(grid);

    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 3.4, 48, 1, true), glow(MOODS.idle, 0.045));
    beam.position.y = 1.7;
    this.beam = add(beam);

    const n = 220;
    const pos = new Float32Array(n * 3);
    this.pSpeed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const rad = Math.sqrt(Math.random()) * 1.4;
      pos.set([Math.cos(a) * rad, Math.random() * 3.4, Math.sin(a) * rad], i * 3);
      this.pSpeed[i] = 0.1 + Math.random() * 0.35;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.particles = add(
      new THREE.Points(
        geo,
        new THREE.PointsMaterial({
          color: MOODS.idle,
          size: 0.035,
          transparent: true,
          opacity: 0.8,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      ),
    );
  }

  // ───────────── شاشة الكود الهولوجرام (جنب مستر نقراشي) ─────────────
  _buildScreen() {
    const c = document.createElement('canvas');
    c.width = 768;
    c.height = 432;
    this.screenCtx = c.getContext('2d');
    this.screenTex = new THREE.CanvasTexture(c);
    this.screenTex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({
      map: this.screenTex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.screen = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.07), mat);
    this.screen.position.set(1.75, 2.45, 0.1);
    this.screen.rotation.y = -0.3;
    this.screen.frustumCulled = false;
    this.scene.add(this.screen);
    this.screenTarget = 0;
    this.screenAlpha = 0;
  }

  /** بيعرض كود على الشاشة وينوّر الأسطر في hi (أرقام من 1). */
  showCode(code, hi = [], title = '') {
    const ctx = this.screenCtx;
    const { width: W, height: H } = ctx.canvas;
    const color = '#' + this.moodColor.getHexString();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0, 24, 44, 0.78)';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, W - 12, H - 12);

    ctx.fillStyle = color;
    ctx.font = '600 24px "Cairo", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.fillText(title || 'الكود', W - 28, 36);
    ctx.fillRect(24, 64, W - 48, 2);

    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    const lines = String(code).split('\n').slice(0, 9);
    const lh = 38;
    lines.forEach((text, i) => {
      const y = 98 + i * lh;
      const on = hi.includes(i + 1);
      if (on) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.fillRect(18, y - lh / 2 + 2, W - 36, lh - 4);
        ctx.fillStyle = color;
        ctx.fillRect(18, y - lh / 2 + 2, 6, lh - 4);
      }
      ctx.font = '22px "JetBrains Mono", Consolas, monospace';
      ctx.fillStyle = on ? '#ffffff' : 'rgba(190, 240, 255, 0.55)';
      ctx.fillText(String(i + 1).padStart(2, ' '), 36, y);
      ctx.font = `${on ? '700' : '400'} 25px "JetBrains Mono", Consolas, monospace`;
      ctx.fillText(text.replace(/\t/g, '    ').slice(0, 34), 84, y);
    });
    this.screenTex.needsUpdate = true;
    this.screenTarget = 1;
  }

  hideScreen() {
    this.screenTarget = 0;
  }

  _setupComposer() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.65, 0.12);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  resize() {
    const el = this.canvas.parentElement;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h) return;
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.fit = Math.max(1, 0.95 / this.camera.aspect); // شاشة طولية → ابعد الكاميرا
  }

  // ───────────── واجهة التحكم (بتناديها app.js) ─────────────
  setViseme(name, intensity = 1) {
    const v = VISEMES[name] || VISEMES.sil;
    for (const k in v) this.mouthTarget[k] = v[k] * intensity;
  }

  setMouthEnergy(e) {
    const v = clamp(e, 0, 1);
    this.mouthTarget = { jawOpen: v, mouthWide: v * 0.15, mouthRound: (1 - v) * 0.1 * v, mouthSmile: 0 };
  }

  setSpeaking(on) {
    this.speakTarget = on ? 1 : 0;
    if (!on) this.setViseme('sil');
  }

  setLookAt(x, y) {
    this.look.x = clamp(x, -1, 1);
    this.look.y = clamp(y, -1, 1);
    this.look.t = this.clock.elapsedTime;
  }

  rotateBy(dyaw) {
    this.yawTarget += dyaw;
    this.lastYawInput = this.clock.elapsedTime;
  }

  zoomBy(amount) {
    this.zoomTarget = clamp(this.zoomTarget - amount * 3, 3.8, 9);
  }

  setMood(mood) {
    this.mood = mood;
    this.moodTarget.set(MOODS[mood] ?? MOODS.idle);
  }

  setThinking(on) {
    this.thinking = on;
    this.setMood(on ? 'thinking' : 'idle');
  }

  glitch(strength = 0.6) {
    this.glitchLevel = Math.max(this.glitchLevel, strength);
  }

  _trigger(name, dur) {
    this.fx[name] = { t0: this.clock.elapsedTime, dur };
  }

  _p(name, t) {
    const f = this.fx[name];
    if (!f) return null;
    const p = (t - f.t0) / f.dur;
    if (p >= 1) {
      delete this.fx[name];
      return null;
    }
    return p;
  }

  wave() { this._trigger('wave', 2.4); }
  nod() { this._trigger('nod', 0.8); }
  shake() { this._trigger('shake', 0.9); }
  point() { this._trigger('point', 2.2); }
  celebrate() { this._trigger('celebrate', 2.2); this.setMood('happy'); this.glitch(0.4); }

  // ───────────── الحلقة الرئيسية ─────────────
  _tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;

    this.nextGlitch -= dt;
    if (this.nextGlitch <= 0) {
      this.glitch(0.35);
      this.nextGlitch = 7 + Math.random() * 8;
    }
    this.glitchLevel = Math.max(0, this.glitchLevel - dt * 2.2);
    this.speakCur = damp(this.speakCur, this.speakTarget, 8, dt);
    this.moodColor.lerp(this.moodTarget, 1 - Math.exp(-dt * 6));

    for (const m of this.materials) {
      m.uniforms.uTime.value = t;
      m.uniforms.uGlitch.value = this.glitchLevel;
      m.uniforms.uSpeak.value = this.speakCur;
    }
    this.baseMat.uniforms.uColor.value.copy(this.moodColor);
    this.ringMat.color.copy(this.moodColor);
    this.ring2.material.color.copy(this.moodColor);
    this.beam.material.color.copy(this.moodColor);
    this.particles.material.color.copy(this.moodColor);

    this.screenAlpha = damp(this.screenAlpha, this.screenTarget, 6, dt);
    this.screen.material.opacity = this.screenAlpha * (0.9 + 0.1 * Math.sin(t * 40));
    this.screen.visible = this.screenAlpha > 0.01;
    this.screen.position.y = 2.45 + Math.sin(t * 1.2) * 0.04;

    this._updateMouth(dt);
    if (this.model) this._updatePose(dt, t);

    this.zoom = damp(this.zoom, this.zoomTarget, 6, dt);
    this.camera.position.set(0, 1.9, this.zoom * this.fit);
    this.camera.lookAt(0, 1.45, 0);

    this.ring1.rotation.z += dt * 0.4;
    this.ring2.rotation.z -= dt * 0.25;
    const p = this.particles.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + this.pSpeed[i] * dt;
      if (y > 3.4) y = 0;
      p.setY(i, y);
    }
    p.needsUpdate = true;

    this.composer.render();
  }

  _updateMouth(dt) {
    const c = this.mouthCurrent;
    for (const k in c) c[k] = damp(c[k], this.mouthTarget[k] ?? 0, 24, dt);

    for (const mesh of this.morphMeshes) {
      for (const [name, idx] of Object.entries(mesh.morphTargetDictionary)) {
        const key = ALIASES[name] ?? name;
        if (key in c) mesh.morphTargetInfluences[idx] = c[key];
      }
    }
    if (this.fallbackMouth) {
      this.fallbackMouth.scale.x = 0.085 + 0.04 * c.mouthWide - 0.045 * c.mouthRound;
      this.fallbackMouth.scale.y = 0.006 + 0.045 * c.jawOpen + 0.032 * c.mouthRound;
      this.fallbackMouth.position.y = -0.2 - 0.03 * c.jawOpen;
    }
  }

  _updatePose(dt, t) {
    const b = this.base;

    // نَفَس + قفزة الاحتفال
    let jump = 0;
    const pc = this._p('celebrate', t);
    if (pc !== null) jump = Math.abs(Math.sin(pc * Math.PI * 3)) * 0.12 * sin01(pc * 1.2);
    this.pivot.position.y = Math.sin(t * 1.6) * 0.012 + jump;

    // الدوران حوالين نفسه (قبضة اليد) ثم يرجع يبصّ للكاميرا
    if (t - this.lastYawInput > 4) this.yawTarget = damp(this.yawTarget, Math.sin(t * 0.35) * 0.18, 1.5, dt);
    this.pivot.rotation.y = damp(this.pivot.rotation.y, this.yawTarget, 8, dt);

    // الرأس: يبص ناحية اليد، يهز، يفكر
    if (this.head) {
      const fresh = t - this.look.t < 1.2;
      const lx = fresh ? this.look.x : Math.sin(t * 0.5) * 0.15;
      const ly = fresh ? this.look.y : 0;
      const pn = this._p('nod', t);
      const ps = this._p('shake', t);
      const nod = pn === null ? 0 : Math.sin(pn * Math.PI * 2) * 0.22;
      const shake = ps === null ? 0 : Math.sin(ps * Math.PI * 4) * 0.28 * (1 - ps);
      const talk = this.speakCur * 0.04 * Math.sin(t * 7);
      const tilt = this.thinking ? 0.18 : 0;
      this.head.rotation.y = damp(this.head.rotation.y, b.head.y + lx * 0.55 + shake, 10, dt);
      this.head.rotation.x = damp(this.head.rotation.x, b.head.x + ly * 0.3 + nod + talk - (this.thinking ? 0.08 : 0), 10, dt);
      this.head.rotation.z = damp(this.head.rotation.z, b.head.z + tilt, 8, dt);
    }

    // الأذرع: سلام / إشارة / احتفال
    let rzR = 0, rxR = 0, rzL = 0;
    const pw = this._p('wave', t);
    if (pw !== null) rzR = Math.min(1, sin01(pw) * 2.2) * (2.3 + 0.35 * Math.sin(t * 16));
    const pp = this._p('point', t);
    if (pp !== null) {
      const e = Math.min(1, sin01(pp) * 2.2);
      rxR = -1.35 * e;
      rzR = Math.max(rzR, 0.25 * e);
    }
    if (pc !== null) {
      const e = Math.min(1, sin01(pc) * 2.5);
      rzR = Math.max(rzR, 2.9 * e);
      rzL = 2.9 * e;
    }
    const idleSway = Math.sin(t * 1.3) * 0.03;
    if (this.armR) {
      this.armR.rotation.z = b.armRSign * (rzR + idleSway);
      this.armR.rotation.x = rxR;
    }
    if (this.armL) this.armL.rotation.z = b.armLSign * (rzL + idleSway);

    // رمشة
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) {
      this._trigger('blink', 0.14);
      this.nextBlink = 2 + Math.random() * 3.5;
    }
    const pb = this._p('blink', t);
    const blink = pb === null ? 1 : 1 - 0.9 * sin01(pb);
    this.eyes.forEach((e, i) => (e.scale.y = b.eyeY[i] * blink));
  }
}
