// ═══════════════════════════════════════════════
//  audio_handler.js — صوت الطالب + صوت مستر نقراشي + Lip-Sync (Visemes)
//  - تسجيل المايك (MediaRecorder) + تعرّف على الكلام (Web Speech API)
//  - نطق الردود بالـ SpeechSynthesis مع تحويل الحروف لـ Visemes
//  - مسار جاهز لصوت جاي من الباك إند (playAudioUrl) بتحريك الفم من شدة الصوت
// ═══════════════════════════════════════════════

const DIACRITICS = /[ً-ْٰ]/;
const AA = 'اأإآى';
const OO = 'وؤuo';
const EE = 'يئie';
const MM = 'مبفpbfm';

export function charToViseme(ch) {
  const c = ch.toLowerCase();
  if (c === ' ' || c === '\n' || c === '،' || c === '.' || c === ',' || c === '؟') return 'sil';
  if (AA.includes(c) || c === 'a') return 'aa';
  if (OO.includes(c)) return 'oo';
  if (EE.includes(c)) return 'ee';
  if (MM.includes(c)) return 'mm';
  return 'cons';
}

export class AudioHandler {
  constructor({ lang = 'ar-EG' } = {}) {
    this.lang = lang;
    this.muted = false;
    this.listening = false;

    // callbacks
    this.onViseme = () => {};
    this.onEnergy = () => {};
    this.onSpeakStart = () => {};
    this.onSpeakEnd = () => {};
    this.onLevel = () => {};
    this.onInterim = () => {};
    this.onFinal = () => {};
    this.onRecording = () => {};
    this.onListeningChange = () => {};
    this.onError = () => {};
    this.onVoicesChanged = () => {};

    this._token = 0;
    this._voice = null;
    this._visTimer = null;
    this._fallbackTimer = null;
    this._cursor = 0;

    if ('speechSynthesis' in window) {
      speechSynthesis.onvoiceschanged = () => this._pickVoice();
      this._pickVoice();
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognizer = SR ? this._buildRecognizer(SR) : null;
  }

  get canListen() {
    return !!this.recognizer;
  }

  getArabicVoices() {
    return speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith('ar'));
  }

  setVoiceByName(name) {
    this._voice = this.getArabicVoices().find((v) => v.name === name) || this._voice;
  }

  // بنفضّل صوت رجالي عربي (مصري لو متاح)، ولو مفيش بناخد أقرب صوت عربي
  _pickVoice() {
    const MALE = /shakir|naayf|hamed|majed|maged|tarik|tarek|male|شاكر|حامد|ماجد|طارق/i;
    const ar = this.getArabicVoices();
    if (!this._voice || !ar.includes(this._voice)) {
      this._voice =
        ar.find((v) => v.lang === 'ar-EG' && MALE.test(v.name)) ||
        ar.find((v) => MALE.test(v.name)) ||
        ar.find((v) => v.lang === 'ar-EG') ||
        ar[0] ||
        null;
    }
    this.onVoicesChanged(ar, this._voice);
  }

  // ───────────── نطق مستر نقراشي ─────────────
  speak(text, { rate = 0.92, pitch = 0.75 } = {}) {
    this.stopSpeaking();
    const token = ++this._token;
    const clean = String(text)
      .replace(/```[\s\S]*?```/g, ' الكود ')
      .replace(/[`*_#>]/g, '')
      .trim();
    if (!clean) return Promise.resolve();

    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (token === this._token) this._endSpeech();
        resolve();
      };

      this.onSpeakStart();
      if (this.muted || !('speechSynthesis' in window)) {
        // من غير صوت: نحرّك الفم على توقيت تقديري
        this._startVisemeLoop(clean);
        this._fallbackTimer = setTimeout(finish, Math.max(900, clean.length * 65));
        return;
      }

      const u = new SpeechSynthesisUtterance(clean);
      u.lang = this.lang;
      u.rate = rate;
      u.pitch = pitch;
      if (this._voice) u.voice = this._voice;
      u.onstart = () => this._startVisemeLoop(clean);
      u.onboundary = (e) => {
        if (typeof e.charIndex === 'number') this._cursor = e.charIndex;
      };
      u.onend = finish;
      u.onerror = finish;
      this._utterance = u; // مرجع عشان الـ GC في Chrome ما يلغيش النطق
      speechSynthesis.speak(u);

      // حماية: لو الصوت ما بدأش خالص (مفيش voice عربي) نكمّل بالتوقيت التقديري
      this._fallbackTimer = setTimeout(() => {
        if (!speechSynthesis.speaking && !speechSynthesis.pending) {
          this._startVisemeLoop(clean);
          this._fallbackTimer = setTimeout(finish, Math.max(900, clean.length * 65));
        }
      }, 1200);
    });
  }

  stopSpeaking() {
    const wasActive = this._visTimer || this._fallbackTimer || this._playing;
    this._token++;
    clearTimeout(this._fallbackTimer);
    this._fallbackTimer = null;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    this._stopAudioElement();
    if (wasActive) this._endSpeech();
  }

  _endSpeech() {
    this._stopVisemeLoop();
    clearTimeout(this._fallbackTimer);
    this._fallbackTimer = null;
    this.onViseme('sil');
    this.onSpeakEnd();
  }

  _startVisemeLoop(text) {
    this._stopVisemeLoop();
    this._cursor = 0;
    this._visTimer = setInterval(() => {
      while (this._cursor < text.length && DIACRITICS.test(text[this._cursor])) this._cursor++;
      const ch = text[this._cursor] ?? ' ';
      this._cursor++;
      this.onViseme(charToViseme(ch));
    }, 78);
  }

  _stopVisemeLoop() {
    clearInterval(this._visTimer);
    this._visTimer = null;
  }

  // ───────────── صوت جاهز من الباك إند (TTS خارجي) ─────────────
  async playAudioUrl(url) {
    this.stopSpeaking();
    const token = ++this._token;
    this._ensureContext();
    const el = (this._el = new Audio());
    el.crossOrigin = 'anonymous';
    el.src = url;
    const src = this._ctx.createMediaElementSource(el);
    const analyser = this._ctx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    analyser.connect(this._ctx.destination);
    const buf = new Uint8Array(analyser.fftSize);
    this._playing = true;
    this.onSpeakStart();

    const pump = () => {
      if (!this._playing) return;
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += (v - 128) * (v - 128);
      this.onEnergy(Math.min(1, Math.sqrt(sum / buf.length) / 40));
      requestAnimationFrame(pump);
    };
    await new Promise((resolve) => {
      el.onended = el.onerror = resolve;
      el.play().then(pump).catch(resolve);
    });
    if (token === this._token) this._endSpeech();
    this._playing = false;
  }

  _stopAudioElement() {
    this._playing = false;
    if (this._el) {
      this._el.pause();
      this._el = null;
    }
  }

  _ensureContext() {
    if (!this._ctx) this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this._ctx.state === 'suspended') this._ctx.resume();
  }

  // ───────────── صوت الطالب ─────────────
  _buildRecognizer(SR) {
    const rec = new SR();
    rec.lang = this.lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (interim) this.onInterim(interim);
      if (final) this.onFinal(final.trim());
    };
    rec.onerror = (e) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') this.onError(`خطأ التعرف على الصوت: ${e.error}`);
    };
    rec.onend = () => this.stopListening();
    return rec;
  }

  async startListening() {
    if (this.listening) return;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('المتصفح مش بيدعم المايك (لازم localhost أو https)');
    this.stopSpeaking();
    this._stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });

    // مستوى الصوت (عداد الراديو)
    this._ensureContext();
    const src = this._ctx.createMediaStreamSource(this._stream);
    const analyser = this._ctx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    this._micSrc = src;
    const buf = new Uint8Array(analyser.fftSize);
    this.listening = true;
    const meter = () => {
      if (!this.listening) return;
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += (v - 128) * (v - 128);
      this.onLevel(Math.min(1, Math.sqrt(sum / buf.length) / 45));
      requestAnimationFrame(meter);
    };
    meter();

    // تسجيل الصوت كملف (جاهز لو هتبعته لباك إند)
    if (window.MediaRecorder) {
      const chunks = [];
      this._recorder = new MediaRecorder(this._stream);
      this._recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      this._recorder.onstop = () => this.onRecording(new Blob(chunks, { type: this._recorder?.mimeType || 'audio/webm' }));
      this._recorder.start();
    }

    if (this.recognizer) {
      try {
        this.recognizer.start();
      } catch (e) {
        /* already started */
      }
    } else {
      this.onError('التعرف على الكلام مش مدعوم في المتصفح ده، جرّب Chrome أو Edge. أو اكتب سؤالك.');
    }
    this.onListeningChange(true);
  }

  stopListening() {
    if (!this.listening) return;
    this.listening = false;
    try { this.recognizer?.stop(); } catch (e) { /* noop */ }
    if (this._recorder && this._recorder.state !== 'inactive') this._recorder.stop();
    this._recorder = null;
    this._micSrc?.disconnect();
    this._stream?.getTracks().forEach((t) => t.stop());
    this._stream = null;
    this.onLevel(0);
    this.onListeningChange(false);
  }
}
