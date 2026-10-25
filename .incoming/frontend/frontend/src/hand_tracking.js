// ═══════════════════════════════════════════════
//  hand_tracking.js — التقاط حركات اليد والـ Gestures (MediaPipe)
//  الإيماءات: open · fist · pinch · point · victory · thumbs_up
// ═══════════════════════════════════════════════
const MP_VERSION = '0.10.14';
const MP_BUNDLE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/vision_bundle.mjs`;
const MP_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
const MP_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z - b.z) * 0.5);

export class HandTracker {
  constructor(video, overlay) {
    this.video = video;
    this.overlay = overlay;
    this.ctx = overlay.getContext('2d');
    this.running = false;
    this.landmarker = null;
    this.stream = null;

    // callbacks
    this.onGesture = () => {};   // ({gesture, prev}) عند تغيّر الإيماءة وثباتها
    this.onMove = () => {};      // ({x, y, dx, dy, gesture, pinchRatio}) كل فريم
    this.onStatus = () => {};    // (نص)
    this.onLost = () => {};

    this._gesture = 'none';
    this._cand = 'none';
    this._candCount = 0;
    this._lostFrames = 0;
    this._pos = null;
    this._lastVideoTime = -1;
  }

  async start() {
    if (this.running) return;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('المتصفح مش بيدعم الكاميرا (لازم localhost أو https)');
    this.onStatus('بطلب إذن الكاميرا...');
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
      audio: false,
    });
    this.video.srcObject = this.stream;
    await this.video.play();

    this.onStatus('بحمّل موديل اليد...');
    await this._ensureModel();

    this.overlay.width = this.video.videoWidth || 640;
    this.overlay.height = this.video.videoHeight || 480;
    this.running = true;
    this.onStatus('ارفع إيدك قدام الكاميرا ✋');
    this._loop();
  }

  stop() {
    this.running = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    this._gesture = 'none';
    this._pos = null;
    this.onStatus('الكاميرا مقفولة');
  }

  async _ensureModel() {
    if (this.landmarker) return;
    const { FilesetResolver, HandLandmarker } = await import(MP_BUNDLE);
    const fileset = await FilesetResolver.forVisionTasks(MP_WASM);
    const make = (delegate) =>
      HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MP_MODEL, delegate },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.6,
        minTrackingConfidence: 0.5,
      });
    try {
      this.landmarker = await make('GPU');
    } catch (e) {
      console.warn('GPU delegate failed, falling back to CPU', e);
      this.landmarker = await make('CPU');
    }
  }

  _loop() {
    if (!this.running) return;
    const step = () => {
      if (!this.running) return;
      if (this.video.readyState >= 2 && this.video.currentTime !== this._lastVideoTime) {
        this._lastVideoTime = this.video.currentTime;
        const res = this.landmarker.detectForVideo(this.video, performance.now());
        this._handle(res.landmarks?.[0] ?? null);
      }
      if ('requestVideoFrameCallback' in this.video) this.video.requestVideoFrameCallback(step);
      else requestAnimationFrame(step);
    };
    step();
  }

  _handle(lm) {
    const { width: W, height: H } = this.overlay;
    this.ctx.clearRect(0, 0, W, H);

    if (!lm) {
      if (++this._lostFrames === 10) {
        this._setStable('none');
        this._pos = null;
        this.onLost();
      }
      return;
    }
    this._lostFrames = 0;
    this._draw(lm, W, H);

    const { gesture, pinchRatio } = this._classify(lm);

    // موضع الكف (معكوس X عشان يبقى زي المراية) مع تنعيم
    const raw = { x: 1 - lm[9].x, y: lm[9].y };
    const prev = this._pos;
    const pos = prev ? { x: prev.x + (raw.x - prev.x) * 0.35, y: prev.y + (raw.y - prev.y) * 0.35 } : raw;
    const dx = prev ? pos.x - prev.x : 0;
    const dy = prev ? pos.y - prev.y : 0;
    this._pos = pos;

    // ثبات الإيماءة 5 فريمات قبل ما نعتمدها
    if (gesture === this._cand) this._candCount++;
    else {
      this._cand = gesture;
      this._candCount = 1;
    }
    if (this._candCount >= 5 && gesture !== this._gesture) this._setStable(gesture);

    this.onMove({ x: pos.x, y: pos.y, dx, dy, gesture: this._gesture, pinchRatio });
  }

  _setStable(gesture) {
    const prev = this._gesture;
    this._gesture = gesture;
    this.onGesture({ gesture, prev });
  }

  _classify(lm) {
    const size = dist(lm[0], lm[9]) || 0.001; // حجم الكف كمقياس
    const ext = (tip, pip) => dist(lm[tip], lm[0]) > dist(lm[pip], lm[0]) * 1.08;
    const idx = ext(8, 6);
    const mid = ext(12, 10);
    const ring = ext(16, 14);
    const pink = ext(20, 18);
    const thumb = dist(lm[4], lm[5]) > size * 0.55;
    const pinchRatio = dist(lm[4], lm[8]) / size;
    const count = [idx, mid, ring, pink].filter(Boolean).length;

    let gesture = 'unknown';
    if (pinchRatio < 0.28) gesture = 'pinch';
    else if (count === 4) gesture = 'open';
    else if (count === 0) {
      const up = lm[4].y < lm[3].y && lm[3].y < lm[2].y && lm[4].y < lm[5].y - size * 0.3;
      gesture = thumb && up ? 'thumbs_up' : 'fist';
    } else if (idx && count === 1) gesture = 'point';
    else if (idx && mid && count === 2) gesture = 'victory';
    return { gesture, pinchRatio };
  }

  _draw(lm, W, H) {
    const c = this.ctx;
    c.lineWidth = 2.5;
    c.strokeStyle = 'rgba(0,240,255,.9)';
    c.shadowColor = '#00f0ff';
    c.shadowBlur = 8;
    c.beginPath();
    for (const [a, b] of CONNECTIONS) {
      c.moveTo(lm[a].x * W, lm[a].y * H);
      c.lineTo(lm[b].x * W, lm[b].y * H);
    }
    c.stroke();
    c.fillStyle = '#ff2bd6';
    for (const p of lm) {
      c.beginPath();
      c.arc(p.x * W, p.y * H, 3.5, 0, Math.PI * 2);
      c.fill();
    }
  }
}
