// ═══════════════════════════════════════════════
//  ui_effects.js — تأثيرات واجهة النيون والـ Glassmorphism والتوهج
//  أصوات الواجهة · مطر الأكواد · توهج الزجاج مع الماوس · إشعارات · كتابة الترجمة
// ═══════════════════════════════════════════════
const SOUND_NAMES = ['hover', 'click', 'gesture', 'boot', 'success', 'error'];
const RAIN_CHARS = '01{}[]()<>=+-*/:;#def print for if while class import return PYTHON'.split('');

export class UIEffects {
  constructor() {
    this.enabled = true;
    this.sounds = {};
    this._typeTokens = new WeakMap();

    for (const n of SOUND_NAMES) {
      const a = new Audio(`assets/audio/ui_${n}.wav`);
      a.preload = 'auto';
      this.sounds[n] = a;
    }
    this._initGlow();
    this._initMatrix();
    this._bindSfx();
  }

  // ───────────── أصوات Sci-Fi ─────────────
  play(name, volume = 0.5) {
    if (!this.enabled) return;
    const base = this.sounds[name];
    if (!base) return;
    const a = base.cloneNode();
    a.volume = volume;
    a.play().catch(() => {}); // قبل أول ضغطة المتصفح بيمنع الصوت
  }

  _bindSfx() {
    document.addEventListener('pointerover', (e) => {
      if (e.target.closest?.('[data-sfx], .lesson-chip')) this.play('hover', 0.25);
    });
    document.addEventListener('click', (e) => {
      if (e.target.closest?.('[data-sfx], .lesson-chip')) this.play('click', 0.4);
    });
  }

  // ───────────── توهج الزجاج اللي بيتبع الماوس ─────────────
  _initGlow() {
    document.addEventListener('pointermove', (e) => {
      const glass = e.target.closest?.('.glass');
      if (!glass) return;
      const r = glass.getBoundingClientRect();
      glass.style.setProperty('--mx', `${e.clientX - r.left}px`);
      glass.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  }

  // ───────────── مطر الأكواد (Matrix) في الخلفية ─────────────
  _initMatrix() {
    const canvas = document.getElementById('matrix');
    if (!canvas || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    const size = 15;
    let drops = [];
    const resize = () => {
      canvas.width = innerWidth;
      canvas.height = innerHeight;
      drops = Array.from({ length: Math.ceil(canvas.width / size) }, () => Math.random() * -50);
    };
    resize();
    addEventListener('resize', resize);
    setInterval(() => {
      if (document.hidden) return;
      ctx.fillStyle = 'rgba(2,5,13,0.12)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${size}px "JetBrains Mono", monospace`;
      ctx.fillStyle = 'rgba(0,240,255,0.55)';
      drops.forEach((y, i) => {
        ctx.fillText(RAIN_CHARS[(Math.random() * RAIN_CHARS.length) | 0], i * size, y * size);
        drops[i] = y * size > canvas.height && Math.random() > 0.975 ? 0 : y + 1;
      });
    }, 60);
  }

  // ───────────── شاشة الإقلاع ─────────────
  setBootProgress(p, label) {
    const bar = document.getElementById('boot-bar');
    const lab = document.getElementById('boot-label');
    if (bar) bar.style.width = `${Math.round(p * 100)}%`;
    if (lab && label) lab.textContent = label;
  }

  enableStart() {
    const b = document.getElementById('boot-start');
    if (b) b.disabled = false;
  }

  hideBoot() {
    document.getElementById('boot')?.classList.add('hide');
  }

  // ───────────── ترجمة بتتكتب حرف حرف ─────────────
  typeText(el, text, cps = 36) {
    const token = Symbol();
    this._typeTokens.set(el, token);
    el.textContent = '';
    return new Promise((resolve) => {
      let i = 0;
      const step = () => {
        if (this._typeTokens.get(el) !== token) return resolve();
        i = Math.min(text.length, i + Math.max(1, Math.round(cps / 30)));
        el.textContent = text.slice(0, i);
        if (i >= text.length) return resolve();
        setTimeout(step, 1000 / 30);
      };
      step();
    });
  }

  // ───────────── إشعارات ─────────────
  toast(msg, type = 'info', ms = 3800) {
    const box = document.getElementById('toasts');
    if (!box) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => {
      t.style.transition = 'opacity .4s';
      t.style.opacity = '0';
      setTimeout(() => t.remove(), 450);
    }, ms);
  }

  // ───────────── إيماءات اليد ─────────────
  setGestureActive(name) {
    document.querySelectorAll('[data-gesture]').forEach((li) => li.classList.toggle('active', li.dataset.gesture === name));
    if (name && name !== 'none' && name !== 'unknown') this.play('gesture', 0.35);
  }
}
