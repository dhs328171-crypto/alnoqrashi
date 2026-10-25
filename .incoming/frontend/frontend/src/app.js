// ═══════════════════════════════════════════════
//  app.js — المايسترو
//  بيربط: حركة اليد ⇄ الصوت ⇄ محرك الـ 3D ⇄ منهج بايثون ⇄ محرر الكود
// ═══════════════════════════════════════════════
import { HandTracker } from './hand_tracking.js';
import { AudioHandler } from './audio_handler.js';
import { UIEffects } from './ui_effects.js';
import { LESSONS, GREETINGS, PRAISE, RETRY, matchFaq, matchCommand, explainError } from './curriculum.js';
import { loadProgress, saveProgress, resetProgress, touchStreak, levelOf, levelProgress, rankOf } from './progress.js';
import { drawCertificate, downloadCanvas } from './certificate.js';

const CONFIG = {
  // لو عندك باك إند (LLM) حطّ العنوان هنا. الطلب: POST {message, lesson, code} → {reply, audio_url?}
  apiUrl: null,
  voiceLang: 'ar-EG',
  pyodideUrl: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/',
};

const $ = (s) => document.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// أي خطأ غير متوقع يظهر على الشاشة بدل ما يفضل مخفي في الـ Console
addEventListener('error', (e) => document.getElementById('boot-label') && (document.getElementById('boot-label').textContent = `خطأ: ${e.message}`));
addEventListener('unhandledrejection', (e) => console.error('unhandled', e.reason));

const ui = new UIEffects();
// المجسم بيتحمّل ديناميكياً: لو Three.js ما اتحمّلش، باقي المنصة (الدروس والشات والصوت) تفضل شغالة
const noopHolo = new Proxy({}, { get: () => () => {} });
let holo = noopHolo;
const audio = new AudioHandler({ lang: CONFIG.voiceLang });
const hands = new HandTracker($('#cam'), $('#cam-overlay'));

const progress = loadProgress();
const state = {
  lesson: Math.min(progress.lesson || 0, LESSONS.length - 1),
  done: new Set(progress.done),
  hintUsed: false,
  solutionUsed: false,
  newDay: false,
  talkToken: 0,
  running: false,
  fails: 0,
  pyodide: null,
  pyLoading: null,
  cooldown: {},
  lastRecording: null,
};

// ───────────── مساعدات الواجهة ─────────────
function setStatus(key, value) {
  const el = $(`#st-${key}`);
  if (el) el.dataset.state = value;
}

function addMessage(role, text) {
  const log = $('#chat-log');
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

function consoleWrite(text, cls = '') {
  const c = $('#console');
  c.innerHTML = '';
  const span = document.createElement('span');
  if (cls) span.className = cls;
  span.textContent = text;
  c.appendChild(span);
}

function setMoodChip(mood) {
  $('#mood-chip').textContent = `MOOD // ${mood.toUpperCase()}`;
}

// ───────────── الكلام ─────────────
function interrupt() {
  state.talkToken++;
  audio.stopSpeaking();
}

// tk = رقم القطع اللي التدفق بدأ بيه. لو الطالب قاطع (interrupt) بعدها، الجملة دي بتتجاهل نفسها
// وبترجّع false، فالتدفق القديم ما يقدرش يتكلم فوق التدفق الجديد.
async function say(text, { mood = 'idle', action = null, chat = true, tk = state.talkToken } = {}) {
  if (tk !== state.talkToken) return false;
  if (chat) addMessage('teacher', text);
  if (mood !== 'idle') {
    holo.setMood(mood);
    setMoodChip(mood);
  }
  if (action) holo[action]?.();
  const typing = ui.typeText($('#subtitle'), text, 40);
  $('#stage-status').textContent = 'SPEAKING';
  await audio.speak(text);
  await typing;
  if (tk !== state.talkToken) return false;
  $('#stage-status').textContent = 'READY';
  if (mood !== 'idle') {
    await sleep(900);
    if (tk !== state.talkToken) return false;
    if (!holo.thinking) holo.setMood('idle');
    setMoodChip('idle');
  }
  return true;
}

async function sayLines(lines, opts = {}) {
  const token = state.talkToken;
  for (const line of lines) {
    if (token !== state.talkToken) return false;
    await say(line, { ...opts, tk: token });
    if (token !== state.talkToken) return false;
    await sleep(250);
  }
  return true;
}

// ───────────── الدروس ─────────────
function renderLessonList() {
  const box = $('#lesson-list');
  box.innerHTML = '';
  LESSONS.forEach((l, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lesson-chip';
    b.textContent = l.title;
    b.setAttribute('role', 'tab');
    b.addEventListener('click', () => startLesson(i));
    box.appendChild(b);
  });
  markLessons();
}

function markLessons() {
  document.querySelectorAll('.lesson-chip').forEach((b, i) => {
    b.classList.toggle('active', i === state.lesson);
    b.classList.toggle('done', state.done.has(i));
    b.setAttribute('aria-selected', i === state.lesson);
  });
}

// ───────────── نقاط الخبرة والتقدم ─────────────
function renderXp() {
  $('#xp-level').textContent = levelOf(progress.xp);
  $('#xp-rank').textContent = rankOf(progress.xp);
  $('#xp-points').textContent = `${progress.xp} XP`;
  $('#xp-bar').style.transform = `scaleX(${levelProgress(progress.xp)})`;
  $('#xp-streak').textContent = progress.streak;
}

function persist() {
  progress.done = [...state.done];
  progress.lesson = state.lesson;
  saveProgress(progress);
}

// بيزوّد النقاط وبيرجّع true لو الطالب طلع مستوى جديد
function addXp(n, why) {
  const before = levelOf(progress.xp);
  progress.xp += n;
  persist();
  renderXp();
  ui.toast(`+${n} XP · ${why}`, 'success', 2600);
  const up = levelOf(progress.xp) > before;
  if (up) {
    ui.play('success');
    holo.celebrate();
    ui.toast(`مستوى جديد: ${levelOf(progress.xp)} · ${rankOf(progress.xp)} 🎉`, 'success', 5000);
  }
  return up;
}

// ───────────── شرح المثال سطر سطر على شاشة الهولوجرام ─────────────
async function explainCode() {
  const L = LESSONS[state.lesson];
  if (!L.steps) return true;
  const token = state.talkToken;
  for (const s of L.steps) {
    if (token !== state.talkToken) {
      holo.hideScreen();
      return false;
    }
    holo.showCode(L.example, s.lines, L.title);
    await say(s.say, { action: 'point', tk: token });
    await sleep(250);
  }
  const alive = token === state.talkToken;
  if (alive) await sleep(700);
  holo.hideScreen();
  return alive;
}

// ───────────── سؤال اختيار من متعدد بعد حل الدرس ─────────────
function renderQuiz(idx = state.lesson) {
  const L = LESSONS[idx];
  const qz = L.quiz;
  const box = document.createElement('div');
  box.className = 'msg quiz';
  const q = document.createElement('div');
  q.className = 'quiz-q';
  q.textContent = qz.q;
  const opts = document.createElement('div');
  opts.className = 'quiz-opts';
  const btns = qz.options.map((text, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'quiz-opt';
    b.textContent = text;
    b.addEventListener('click', () => onQuizAnswer(i, qz, idx, btns));
    opts.appendChild(b);
    return b;
  });
  box.append(q, opts);
  const log = $('#chat-log');
  log.appendChild(box);
  log.scrollTop = log.scrollHeight;
}

async function onQuizAnswer(i, qz, lessonIdx, btns) {
  interrupt();
  const tk = state.talkToken;
  btns.forEach((b) => (b.disabled = true));
  btns[qz.answer].classList.add('right');
  const ok = i === qz.answer;
  if (!ok) btns[i].classList.add('wrong');
  if (ok) {
    ui.play('success');
    holo.nod();
    if (!progress.quizDone.includes(lessonIdx)) {
      progress.quizDone.push(lessonIdx);
      addXp(5, 'إجابة صح');
    }
  } else {
    ui.play('error');
    holo.shake();
  }
  if (!(await say(`${ok ? 'صح! ' : 'مش بالظبط. '}${qz.why}`, { mood: ok ? 'happy' : 'thinking', tk }))) return;
  if (lessonIdx < LESSONS.length - 1) {
    await say('قول "الدرس اللي بعده"، أو اعمل علامة تمام بإيدك 👍، أو دوس على الدرس اللي عايزه.', { tk });
  } else {
    await nextLesson();
  }
}

async function startLesson(i) {
  interrupt();
  const tk = state.talkToken;
  holo.hideScreen();
  state.lesson = Math.max(0, Math.min(LESSONS.length - 1, i));
  state.fails = 0;
  state.hintUsed = false;
  persist();
  const L = LESSONS[state.lesson];
  markLessons();
  $('#code').value = L.example;
  consoleWrite('>>> الناتج هيظهر هنا');
  addMessage('system', `الدرس: ${L.title}`);
  if (!(await sayLines(L.intro, { action: 'nod' }))) return;
  if (!(await explainCode())) return;
  $('#code').value = L.starter;
  await say(`دورك دلوقتي. ${L.task}`, { action: 'point', tk });
}

// اسم الدرس من غير الرقم والنقطة (عشان يتنطق كويس)
const plainTitle = (L) => L.title.replace(/^[٠-٩0-9\s·]+/, '');

function nextLesson() {
  if (state.lesson >= LESSONS.length - 1) {
    if (state.done.size >= LESSONS.length) return finishCourse();
    return say('ده آخر درس. لسه فيه دروس ما حلّيتهاش، دوس عليها من المنهج وكمّلها وبعدين هتاخد شهادتك.', { action: 'nod' });
  }
  return startLesson(state.lesson + 1);
}

// ───────────── شهادة إتمام المنهج ─────────────
async function finishCourse() {
  if (!progress.finished) {
    progress.finished = true;
    addXp(25, 'خلّصت المنهج كله');
  }
  holo.celebrate();
  renderCertificate();
  await say('كده خلّصنا كل الدروس! إنت بقيت بتعرف أساسيات بايثون. اكتب اسمك واطلع شهادتك يا بطل!', { mood: 'happy', action: 'celebrate' });
}

function renderCertificate() {
  const box = document.createElement('div');
  box.className = 'msg cert';
  const label = document.createElement('label');
  label.htmlFor = 'cert-name';
  label.textContent = 'اسمك على الشهادة';
  const input = document.createElement('input');
  input.id = 'cert-name';
  input.maxLength = 30;
  input.placeholder = 'مثلاً: زياد';
  input.value = progress.name || '';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn primary';
  btn.textContent = 'اطلع الشهادة 🎓';
  const out = document.createElement('div');
  out.className = 'cert-out';
  btn.addEventListener('click', () => {
    progress.name = input.value.trim();
    persist();
    const canvas = drawCertificate({
      name: progress.name,
      level: levelOf(progress.xp),
      rank: rankOf(progress.xp),
      xp: progress.xp,
      lessons: LESSONS.length,
    });
    canvas.className = 'cert-canvas';
    const dl = document.createElement('button');
    dl.type = 'button';
    dl.className = 'btn';
    dl.textContent = 'نزّل الصورة ⬇';
    dl.addEventListener('click', () => downloadCanvas(canvas, 'nokrashy-certificate.png'));
    out.replaceChildren(canvas, dl);
    ui.play('success');
  });
  box.append(label, input, btn, out);
  const log = $('#chat-log');
  log.appendChild(box);
  log.scrollTop = log.scrollHeight;
}

function repeatLesson() {
  const L = LESSONS[state.lesson];
  return sayLines([...L.intro, `المطلوب: ${L.task}`], { action: 'nod' });
}

function showHint() {
  const L = LESSONS[state.lesson];
  state.hintUsed = true;
  return say(`تلميح: ${L.hint}`, { action: 'point' });
}

async function showSolution() {
  const L = LESSONS[state.lesson];
  state.hintUsed = true;
  state.solutionUsed = true;
  $('#code').value = L.solution;
  await say('ده الحل. اقراه كويس وافهم كل سطر، وبعدين شغّله.', { action: 'nod' });
}

// ───────────── تشغيل بايثون (Pyodide) ─────────────
function ensurePyodide() {
  if (state.pyodide) return Promise.resolve(state.pyodide);
  if (!state.pyLoading) {
    setStatus('py', 'loading');
    state.pyLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `${CONFIG.pyodideUrl}pyodide.js`;
      s.onload = async () => {
        try {
          state.pyodide = await window.loadPyodide({ indexURL: CONFIG.pyodideUrl });
          setStatus('py', 'ok');
          resolve(state.pyodide);
        } catch (e) {
          reject(e);
        }
      };
      s.onerror = () => reject(new Error('تعذر تحميل Pyodide. اتأكد من الإنترنت.'));
      document.head.appendChild(s);
    });
    state.pyLoading.catch(() => {
      state.pyLoading = null;
      setStatus('py', 'error');
    });
  }
  return state.pyLoading;
}

async function runCode() {
  if (state.running) return;
  state.running = true;
  $('#btn-run').disabled = true;
  interrupt();
  const tk = state.talkToken;
  const idx = state.lesson;
  holo.setThinking(true);
  setMoodChip('thinking');
  consoleWrite('⏳ بجهّز بايثون...', 'info');

  const code = $('#code').value;
  let out = '';
  let error = null;
  try {
    const py = await ensurePyodide();
    py.setStdout({ batched: (s) => (out += `${s}\n`) });
    py.setStderr({ batched: (s) => (out += `${s}\n`) });
    const globals = py.globals.get('dict')();
    try {
      await py.runPythonAsync(code, { globals });
    } finally {
      globals.destroy();
    }
  } catch (e) {
    error = String(e.message || e);
  }

  holo.setThinking(false);
  setMoodChip('idle');
  state.running = false;
  $('#btn-run').disabled = false;

  if (error) {
    const lines = error.trim().split('\n');
    consoleWrite(`${out}${lines.slice(-4).join('\n')}`, 'err');
    ui.play('error');
    holo.shake();
    await say(explainError(error), { mood: 'error', tk });
    return;
  }

  consoleWrite(out || '(الكود اشتغل من غير ما يطبع حاجة)', out ? 'ok' : 'info');
  if (state.lesson !== idx) return; // الطالب راح لدرس تاني أثناء التشغيل
  const L = LESSONS[idx];
  if (L.check(code, out)) {
    const first = !state.done.has(idx);
    if (first) {
      // 10 نقاط للحل، +5 لو من غير تلميح، ونقاط أقل لو استخدم الحل الجاهز
      const clean = state.fails === 0 && !state.hintUsed;
      addXp(state.solutionUsed ? 3 : clean ? 15 : 10, clean ? 'حل من غير تلميح' : 'حل الدرس');
    }
    state.done.add(idx);
    state.fails = 0;
    state.solutionUsed = false;
    persist();
    markLessons();
    ui.play('success');
    ui.toast('أحسنت! الدرس اتحل ✓', 'success');
    holo.celebrate();
    await say(pick(PRAISE), { mood: 'happy', tk });
    if (L.quiz && first) {
      await say('سؤال سريع قبل ما نكمّل. اختار الإجابة الصح.', { tk });
      if (state.lesson === idx) renderQuiz(idx); // السؤال بيظهر حتى لو الطالب قاطع الكلام
    } else if (tk !== state.talkToken) {
      return;
    } else if (idx < LESSONS.length - 1) {
      await say('قول "الدرس اللي بعده"، أو اعمل علامة تمام بإيدك 👍، أو دوس على الدرس اللي عايزه.', { tk });
    } else {
      await nextLesson();
    }
  } else {
    state.fails++;
    ui.play('error');
    holo.shake();
    await say(state.fails >= 2 ? `${pick(RETRY)} خد التلميح: ${L.hint}` : pick(RETRY), { mood: 'thinking', tk });
  }
}

// ───────────── كلام الطالب (صوت أو كتابة) ─────────────
async function askBackend(text) {
  try {
    const res = await fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, lesson: LESSONS[state.lesson].id, code: $('#code').value }),
    });
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch (e) {
    console.warn('backend failed', e);
    return null;
  }
}

async function handleStudent(raw) {
  const text = raw.trim();
  if (!text) return;
  interrupt();
  const tk = state.talkToken;
  addMessage('student', text);

  switch (matchCommand(text)) {
    case 'next': return nextLesson();
    case 'prev': return startLesson(state.lesson - 1);
    case 'run': return runCode();
    case 'repeat': return repeatLesson();
    case 'explain': return explainCode();
    case 'certificate':
      if (progress.finished) return renderCertificate();
      return say('الشهادة بتتفتح لما تخلّص كل الدروس. كمّل وإنت قربت!', { action: 'nod' });
    case 'hint': return showHint();
    case 'solution': return showSolution();
    default:
  }

  const faq = matchFaq(text);
  if (faq) return say(faq, { action: 'nod', tk });

  if (CONFIG.apiUrl) {
    holo.setThinking(true);
    const data = await askBackend(text);
    holo.setThinking(false);
    if (tk !== state.talkToken) return; // الطالب قاطع وإحنا مستنيين الرد
    if (data?.reply) {
      addMessage('teacher', data.reply);
      if (data.audio_url) return audio.playAudioUrl(data.audio_url);
      return say(data.reply, { chat: false, action: 'nod', tk });
    }
  }
  return say('سؤال حلو! أنا حالياً بجاوب على أساسيات بايثون: المتغيرات والشرط والتكرار والدوال والقوائم. جرّب تسأل عن واحدة منهم، أو قول "أعد الشرح".', { action: 'nod' });
}

// ───────────── حركات اليد ─────────────
const GESTURE_ACTIONS = {
  open: { cooldown: 20000, run: () => { holo.wave(); return say('أهلاً بيك يا بطل! أنا شايفك.', { action: 'nod' }); } },
  point: { cooldown: 4000, run: () => repeatLesson() },
  victory: { cooldown: 3000, run: () => runCode() },
  thumbs_up: { cooldown: 3000, run: () => nextLesson() },
};

hands.onStatus = (txt) => { $('#cam-state').textContent = txt; };
hands.onGesture = ({ gesture }) => {
  ui.setGestureActive(gesture);
  $('#stage-status').textContent = gesture === 'none' ? 'READY' : `GESTURE // ${gesture.toUpperCase()}`;
  const action = GESTURE_ACTIONS[gesture];
  if (!action || !state.started) return;
  const now = performance.now();
  if (now - (state.cooldown[gesture] ?? -1e9) < action.cooldown) return;
  state.cooldown[gesture] = now;
  interrupt();
  action.run();
};
hands.onMove = ({ x, y, dx, dy, gesture }) => {
  if (gesture === 'open') holo.setLookAt((x - 0.5) * 2, (y - 0.5) * 2);
  else if (gesture === 'fist') holo.rotateBy(dx * 7);
  else if (gesture === 'pinch') holo.zoomBy(-dy * 4);
};
hands.onLost = () => ui.setGestureActive('none');

$('#btn-cam').addEventListener('click', async () => {
  const btn = $('#btn-cam');
  if (hands.running) {
    hands.stop();
    btn.classList.remove('active');
    setStatus('hand', 'idle');
    ui.setGestureActive('none');
    return;
  }
  try {
    setStatus('hand', 'loading');
    await hands.start();
    setStatus('hand', 'live');
    btn.classList.add('active');
    ui.toast('تتبع اليد شغال ✋', 'success');
  } catch (e) {
    console.error(e);
    hands.stop();
    setStatus('hand', 'error');
    ui.toast(`مش قادر أشغّل الكاميرا: ${e.message || e.name}`, 'error', 6000);
  }
});

// ───────────── الصوت والمايك ─────────────
audio.onViseme = (v) => holo.setViseme(v);
audio.onEnergy = (e) => holo.setMouthEnergy(e);
audio.onSpeakStart = () => holo.setSpeaking(true);
audio.onSpeakEnd = () => holo.setSpeaking(false);
audio.onLevel = (l) => { $('#mic-meter-bar').style.transform = `scaleX(${l})`; };
audio.onInterim = (t) => { $('#transcript').textContent = t; };
audio.onFinal = (t) => { $('#transcript').textContent = ''; handleStudent(t); };
audio.onRecording = (blob) => { state.lastRecording = blob; /* جاهز للإرسال للباك إند */ };
audio.onError = (m) => ui.toast(m, 'error', 6000);
audio.onListeningChange = (on) => {
  $('#btn-mic').classList.toggle('active', on);
  setStatus('mic', on ? 'live' : 'idle');
  if (!on) $('#transcript').textContent = '';
};

$('#btn-mic').addEventListener('click', async () => {
  if (audio.listening) return audio.stopListening();
  interrupt();
  try {
    await audio.startListening();
  } catch (e) {
    setStatus('mic', 'error');
    ui.toast(`مش قادر أفتح المايك: ${e.message || e.name}`, 'error', 6000);
  }
});

audio.onVoicesChanged = (voices, current) => {
  const sel = $('#voice-select');
  if (!voices.length) {
    sel.innerHTML = '<option>مفيش صوت عربي على جهازك</option>';
    return;
  }
  sel.innerHTML = '';
  voices.forEach((v) => {
    const o = document.createElement('option');
    o.value = v.name;
    o.textContent = `${v.name} (${v.lang})`;
    o.selected = v === current;
    sel.appendChild(o);
  });
};
if ('speechSynthesis' in window) audio._pickVoice(); // الأصوات ممكن تكون اتحمّلت قبل ما نربط القائمة
$('#voice-select').addEventListener('change', (e) => {
  audio.setVoiceByName(e.target.value);
  interrupt();
  say('أهلاً، ده صوتي الجديد. تحب أكمل الدرس؟', { chat: false });
});

$('#btn-voice').addEventListener('click', () => {
  audio.muted = !audio.muted;
  const b = $('#btn-voice');
  b.classList.toggle('active', !audio.muted);
  b.textContent = audio.muted ? '🔇' : '🔊';
  if (audio.muted) audio.stopSpeaking();
});

// ───────────── المحرر والشات ─────────────
$('#chat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#chat-input');
  const v = input.value;
  input.value = '';
  handleStudent(v);
});
$('#btn-run').addEventListener('click', runCode);
$('#btn-explain').addEventListener('click', () => { interrupt(); explainCode(); });
$('#btn-hint').addEventListener('click', () => { interrupt(); showHint(); });
$('#btn-solution').addEventListener('click', () => { interrupt(); showSolution(); });
$('#btn-repeat').addEventListener('click', () => { interrupt(); repeatLesson(); });

$('#code').addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const t = e.target;
    const s = t.selectionStart;
    t.value = `${t.value.slice(0, s)}    ${t.value.slice(t.selectionEnd)}`;
    t.selectionStart = t.selectionEnd = s + 4;
  } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    runCode();
  }
});

// ───────────── الإقلاع ─────────────
$('#boot-start').addEventListener('click', async () => {
  state.started = true;
  ui.hideBoot();
  ui.play('boot', 0.6);
  holo.glitch(0.9);
  holo.wave();
  const resuming = state.done.size > 0 || state.lesson > 0;
  const hello = resuming
    ? `أهلاً بيك تاني يا بطل! هنكمّل من درس ${plainTitle(LESSONS[state.lesson])}. إنت دلوقتي في المستوى ${levelOf(progress.xp)}.`
    : pick(GREETINGS);
  await say(hello, { action: 'nod' });
  if (state.newDay && progress.streak > 1) ui.toast(`${progress.streak} أيام متتالية 🔥 كمّل كده!`, 'success', 4500);
  await startLesson(state.lesson);
});

// ───────────── إعادة ضبط التقدم (بضغطتين عشان ما يتمسحش بالغلط) ─────────────
let resetTimer = null;
function disarmReset() {
  clearTimeout(resetTimer);
  resetTimer = null;
  const b = $('#btn-reset');
  b.textContent = 'إعادة ضبط التقدم';
  b.classList.remove('danger');
}
$('#btn-reset').addEventListener('click', () => {
  const b = $('#btn-reset');
  if (!resetTimer) {
    b.textContent = 'اضغط تاني للتأكيد';
    b.classList.add('danger');
    resetTimer = setTimeout(disarmReset, 4000);
    return;
  }
  disarmReset();
  interrupt();
  Object.assign(progress, resetProgress());
  state.done = new Set();
  state.lesson = 0;
  state.hintUsed = false;
  state.solutionUsed = false;
  state.fails = 0;
  touchStreak(progress);
  persist();
  renderXp();
  markLessons();
  ui.toast('اتمسح التقدم. هنبدأ من الأول.', 'info');
  if (state.started) startLesson(0);
});

async function main() {
  state.newDay = touchStreak(progress);
  persist();
  renderXp();
  ui.setBootProgress(0.05, 'تهيئة النظام...');
  try {
    const { Hologram3D } = await import('./hologram_3d.js');
    holo = new Hologram3D($('#hologram-canvas'));
    await holo.init((p, label) => ui.setBootProgress(0.05 + p * 0.95, label));
    setStatus('gl', 'ok');
    if (holo.usingFallback === true) ui.toast('ملف المجسم مش موجود، بستخدم مجسم احتياطي. شغّل tools/generate_assets.py', 'info', 7000);
  } catch (e) {
    // العرض ثلاثي الأبعاد فشل: نوضّح السبب وندّي الطالب وضع نصي بدل ما نقفل عليه
    console.error(e);
    setStatus('gl', 'error');
    ui.setBootProgress(1, `تعذر تشغيل المجسم (${e.message || e}). تقدر تكمل بالوضع النصي.`);
    ui.toast(`خطأ المجسم: ${e.message || e}`, 'error', 12000);
  }
  if (!audio.canListen) ui.toast('التعرف على الصوت مش مدعوم في المتصفح ده، استخدم Chrome أو Edge. تقدر تكتب أسئلتك.', 'info', 7000);
  renderLessonList();
  ui.enableStart();
}

main();
