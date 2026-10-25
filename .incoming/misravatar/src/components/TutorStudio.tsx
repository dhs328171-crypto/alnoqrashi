import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, BookOpen, Camera, Check, ChevronLeft, CircleHelp, Clock3, Code2, Eye, Hand, LockKeyhole, Mic, Play, RotateCcw, Save, ShieldCheck, Sparkles, Square, Trophy, UserRound, Volume2, X } from 'lucide-react';
import '../styles.css';

type Lesson = { id: string; title: string; level: string; description: string; task: string; code: string };
type Diagnostic = { line: number; column: number; message: string };
type OutputLine = { level: 'log' | 'warn' | 'error' | 'system'; text: string };
type StudentProfile = { name: string; completed: string[]; points: number; code: Record<string, string>; lastLessonId: string };

const STORAGE_KEY = 'misr-tutor-local-profile-v1';
const LESSONS: Lesson[] = [
  {
    id: 'variables', title: 'المتغيرات وConsole', level: 'البداية',
    description: 'المتغير اسم بنحفظ تحته قيمة نحتاجها بعدين. جرّب تعرض الاسم وعدد الدروس في الـ Console.',
    task: 'غيّر الاسم إلى اسمك أو أي اسم تختاره، ثم شغّل المثال وشاهد الرسالة.',
    code: 'const name = "باشمهندس";\nconst lessonsFinished = 1;\n\nconsole.log("أهلاً " + name);\nconsole.log("الدروس المكتملة:", lessonsFinished);',
  },
  {
    id: 'conditions', title: 'اتخاذ القرار بـ if', level: 'تطبيق',
    description: 'الجملة الشرطية بتختار مسارًا حسب نتيجة المقارنة. جرّب تبدّل قيمة score وشوف أي رسالة هتظهر.',
    task: 'بدّل score إلى 50 أو 95 وشغّل الكود لملاحظة الفرعين.',
    code: 'const score = 82;\n\nif (score >= 60) {\n  console.log("عاش، نجحت في التحدي!");\n} else {\n  console.log("جرّب مرة كمان؛ أنت قريب.");\n}',
  },
  {
    id: 'loops', title: 'التكرار بـ for', level: 'خطوة لقدام',
    description: 'حلقة for بتكرر نفس التعليمات بعدد محدد. عدّ من 1 إلى 5 واطبع كل رقم.',
    task: 'غيّر الحد الأعلى للحلقة أو الرسالة ثم شغّل البرنامج.',
    code: 'for (let step = 1; step <= 5; step++) {\n  console.log("الخطوة رقم", step);\n}\n\nconsole.log("وصلنا يا باشمهندس!");',
  },
];

function readProfile(): StudentProfile {
  const fallback: StudentProfile = { name: '', completed: [], points: 0, code: {}, lastLessonId: LESSONS[0].id };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw) as Partial<StudentProfile>;
    return {
      name: typeof saved.name === 'string' ? saved.name.slice(0, 40) : '',
      completed: Array.isArray(saved.completed) ? saved.completed.filter((item): item is string => typeof item === 'string') : [],
      points: Number.isFinite(saved.points) ? Math.max(0, Number(saved.points)) : 0,
      code: saved.code && typeof saved.code === 'object' ? saved.code as Record<string, string> : {},
      lastLessonId: LESSONS.some((item) => item.id === saved.lastLessonId) ? String(saved.lastLessonId) : LESSONS[0].id,
    };
  } catch { return fallback; }
}

function readNightPreference(): boolean {
  try { return localStorage.getItem('misr-tutor-night-disabled') === 'true'; }
  catch { return false; }
}

function findDelimiterIssue(source: string): Diagnostic | null {
  const stack: Array<{ char: string; line: number; column: number }> = [];
  let line = 1;
  let column = 0;
  let quote = '';
  let quoteLine = 1;
  let quoteColumn = 1;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  const matching: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    const next = source[index + 1];
    if (char === '\n') {
      if (quote && quote !== '`') return { line: quoteLine, column: quoteColumn, message: 'نص مفتوح؛ راجع علامة الاقتباس في هذا السطر.' };
      line++; column = 0; lineComment = false; continue;
    }
    column++;
    if (lineComment) continue;
    if (blockComment) {
      if (char === '*' && next === '/') { blockComment = false; index++; column++; }
      continue;
    }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (char === '\\') { escaped = true; continue; }
      if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '/') { lineComment = true; index++; column++; continue; }
    if (char === '/' && next === '*') { blockComment = true; index++; column++; continue; }
    if (char === '"' || char === "'" || char === '`') { quote = char; quoteLine = line; quoteColumn = column; continue; }
    if (char === '(' || char === '[' || char === '{') stack.push({ char, line, column });
    if (char === ')' || char === ']' || char === '}') {
      const open = stack.pop();
      if (!open || open.char !== matching[char]) return { line, column, message: `قوس إغلاق ${char} من غير قوس فتح مناسب.` };
    }
  }
  if (quote) return { line: quoteLine, column: quoteColumn, message: 'نص مفتوح؛ راجع علامة الاقتباس في هذا السطر.' };
  if (blockComment) return { line, column: 1, message: 'تعليق /* مفتوح ولم يُغلق بـ */.' };
  const open = stack.at(-1);
  if (open) return { line: open.line, column: open.column, message: `القوس ${open.char} في هذا السطر محتاج قوس إغلاق.` };
  return null;
}

function sandboxDocument(): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; connect-src 'none'; img-src data:; style-src 'unsafe-inline';"><meta name="referrer" content="no-referrer"></head><body><script>
(() => {
  const send = (type, data) => parent.postMessage({ channel: 'misr-tutor-sandbox', type, ...data }, '*');
  const stringify = (value) => {
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? String(item) + 'n' : item); }
    catch { try { return String(value); } catch { return '[قيمة غير قابلة للعرض]'; } }
  };
  addEventListener('message', async (event) => {
    const message = event.data;
    if (!message || message.channel !== 'misr-tutor-parent' || message.type !== 'run' || typeof message.code !== 'string') return;
    const runId = message.runId;
    let emitted = 0;
    let totalChars = 0;
    let outputCapped = false;
    const emit = (level, args) => {
      if (emitted >= 100 || totalChars >= 20000) {
        if (!outputCapped) { outputCapped = true; send('output', { runId, level: 'warn', text: 'تم تحديد مخرجات Console لتظل الصفحة مستجيبة.' }); }
        return;
      }
      const text = args.map(stringify).join(' ').slice(0, 1800);
      emitted++;
      totalChars += text.length;
      send('output', { runId, level, text });
    };
    const safeConsole = {
      log: (...args) => emit('log', args), info: (...args) => emit('log', args),
      warn: (...args) => emit('warn', args), error: (...args) => emit('error', args),
      clear: () => send('clear', { runId }),
    };
    send('started', { runId });
    try {
      const execute = new Function('console', '"use strict";\\n' + message.code);
      const result = execute(safeConsole);
      if (result && typeof result.then === 'function') await result;
    } catch (error) {
      const messageText = error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error);
      send('error', { runId, name: error && error.name ? String(error.name) : 'Error', message: messageText.slice(0, 1800) });
    }
    send('done', { runId });
  });
  send('ready', {});
})();
</script></body></html>`;
}

const SANDBOX_DOCUMENT = sandboxDocument();
const FEATURE_PLACEHOLDERS = [
  { icon: Mic, title: 'Qwen باللهجة المصرية', copy: 'مكان جاهز لربط المحادثة وTTS بعد إعداد خادم ومفتاح آمن. غير متصل الآن.' },
  { icon: Eye, title: 'حركة الشفاه والوجه', copy: 'تحتاج رأسًا متحركًا بفك وvisemes؛ الرأس الحالي ثابت، لذلك لا ندّعي مزامنة شفاه.' },
  { icon: Camera, title: 'كاميرا MediaPipe', copy: 'معطّلة تمامًا في هذه النسخة. يلزم إذن صريح ومعالجة محلية قبل تفعيلها.' },
  { icon: Hand, title: 'الإشارة وتتبع الانتباه', copy: 'موضع سطر الخطأ ظاهر في المحرر؛ حركة الذراع وتتبع النظر الدقيق يحتاجان أصولًا/تجهيزًا إضافيًا.' },
  { icon: Trophy, title: 'كأس ثلاثي الأبعاد واحتفال', copy: 'النقاط محلية وتعمل؛ حركة High-Five ومسار كأس 3D غير مضافين بعد.' },
  { icon: UserRound, title: 'الهوية الحيوية', copy: 'الاسم والترحيب واستئناف آخر درس تعمل محليًا بإدخال يدوي. لا تعرف على الوجه ولا حفظ لبيانات حيوية.' },
];

export default function TutorStudio() {
  const initialProfile = useMemo(readProfile, []);
  const [profile, setProfile] = useState<StudentProfile>(initialProfile);
  const [lessonId, setLessonId] = useState(initialProfile.lastLessonId);
  const lesson = LESSONS.find((item) => item.id === lessonId) ?? LESSONS[0];
  const [code, setCode] = useState(() => initialProfile.code[initialProfile.lastLessonId] ?? lesson.code);
  const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null);
  const [output, setOutput] = useState<OutputLine[]>([{ level: 'system', text: 'الـ Console جاهز. راجع المثال واضغط «تشغيل داخل مساحة معزولة».' }]);
  const [sandboxVersion, setSandboxVersion] = useState(0);
  const [sandboxReady, setSandboxReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [completedPulse, setCompletedPulse] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [nightDisabled, setNightDisabled] = useState(readNightPreference);
  const [localHour, setLocalHour] = useState(() => new Date().getHours());
  const [wipe, setWipe] = useState(false);
  const [canUndoClear, setCanUndoClear] = useState(false);
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const runIdRef = useRef(0);
  const inboundMessagesRef = useRef(0);
  const timerRef = useRef<number | undefined>(undefined);
  const previousCodeRef = useRef<string | null>(null);
  const wipeTimerRef = useRef<number | undefined>(undefined);
  const isQuietHours = localHour >= 0 && localHour < 6 && !nightDisabled;
  const lines = code.split('\n');

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); } catch { /* Private browsing may block local storage. */ }
  }, [profile]);

  useEffect(() => {
    const timer = window.setInterval(() => setLocalHour(new Date().getHours()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const message = event.data;
      if (!message || message.channel !== 'misr-tutor-sandbox') return;
      inboundMessagesRef.current++;
      if (inboundMessagesRef.current > 120) return;
      if (message.type === 'ready') { setSandboxReady(true); return; }
      if (message.runId !== runIdRef.current) return;
      if (message.type === 'started') setRunning(true);
      if (message.type === 'output') {
        const level: OutputLine['level'] = message.level === 'warn' || message.level === 'error' ? message.level : 'log';
        setOutput((current) => [...current, { level, text: String(message.text ?? '').slice(0, 1800) }].slice(-80));
      }
      if (message.type === 'clear') setOutput([]);
      if (message.type === 'error') {
        setRunning(false);
        const line = Number.isInteger(message.line) && message.line > 0 ? Number(message.line) : undefined;
        if (line) setDiagnostic({ line, column: 1, message: `${message.name}: ${message.message}` });
        setOutput((current) => [...current, { level: 'error' as const, text: `${message.name ?? 'Error'}: ${message.message ?? 'حدث خطأ أثناء التشغيل.'}` }].slice(-80));
      }
      if (message.type === 'done') {
        setRunning(false);
        window.clearTimeout(timerRef.current);
        setOutput((current) => [...current, { level: 'system' as const, text: 'انتهى التنفيذ.' }].slice(-80));
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => () => {
    window.clearTimeout(timerRef.current);
    window.clearTimeout(wipeTimerRef.current);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  const appendOutput = (item: OutputLine) => setOutput((current) => [...current, item].slice(-80));

  const focusDiagnostic = () => {
    if (!diagnostic || !editorRef.current) return;
    const lineStart = code.split('\n').slice(0, diagnostic.line - 1).reduce((total, item) => total + item.length + 1, 0);
    const position = Math.min(code.length, lineStart + diagnostic.column - 1);
    editorRef.current.focus();
    editorRef.current.setSelectionRange(position, Math.min(code.length, position + 1));
    editorRef.current.scrollTop = Math.max(0, (diagnostic.line - 1) * 24 - 72);
    if (gutterRef.current) gutterRef.current.scrollTop = editorRef.current.scrollTop;
  };

  const changeLesson = (nextId: string) => {
    if (nextId === lessonId) return;
    setProfile((current) => ({ ...current, code: { ...current.code, [lessonId]: code }, lastLessonId: nextId }));
    const nextLesson = LESSONS.find((item) => item.id === nextId);
    if (!nextLesson) return;
    setLessonId(nextId);
    setCode(profile.code[nextId] ?? nextLesson.code);
    setDiagnostic(null);
    setOutput([{ level: 'system', text: `بدأ درس «${nextLesson.title}». راجع الكود قبل تشغيله.` }]);
    setCanUndoClear(false);
  };

  const onCodeChange = (value: string) => {
    setCode(value);
    setDiagnostic(findDelimiterIssue(value));
    setProfile((current) => ({ ...current, code: { ...current.code, [lessonId]: value }, lastLessonId: lessonId }));
  };

  const runCode = () => {
    if (code.length > 20000) {
      appendOutput({ level: 'warn', text: 'حدّ الكود ٢٠ ألف حرف في هذه المساحة التعليمية.' });
      return;
    }
    const issue = findDelimiterIssue(code);
    if (issue) {
      setDiagnostic(issue);
      appendOutput({ level: 'error', text: `فحص أولي: ${issue.message} (السطر ${issue.line}، العمود ${issue.column}).` });
      return;
    }
    if (!sandboxReady || !frameRef.current?.contentWindow) {
      appendOutput({ level: 'warn', text: 'مساحة التشغيل ما زالت تجهز؛ انتظر لحظة ثم حاول.' });
      return;
    }
    window.clearTimeout(timerRef.current);
    const runId = ++runIdRef.current;
    inboundMessagesRef.current = 0;
    setDiagnostic(null);
    setOutput([]);
    setRunning(true);
    appendOutput({ level: 'system', text: 'يجري تشغيل البرنامج داخل إطار معزول…' });
    frameRef.current.contentWindow.postMessage({ channel: 'misr-tutor-parent', type: 'run', runId, code }, '*');
    timerRef.current = window.setTimeout(() => {
      if (runIdRef.current !== runId) return;
      setRunning(false);
      setSandboxReady(false);
      setSandboxVersion((current) => current + 1);
      setOutput((current) => [...current, { level: 'error' as const, text: 'أُوقف التنفيذ بعد ٢ ثانية لحماية الصفحة. قد يحتوي الكود على حلقة لا تنتهي؛ راجعه ثم حاول مجددًا.' }].slice(-80));
    }, 2000);
  };

  const stopCode = () => {
    window.clearTimeout(timerRef.current);
    runIdRef.current++;
    setRunning(false);
    setSandboxReady(false);
    setSandboxVersion((current) => current + 1);
    appendOutput({ level: 'system', text: 'أُعيد ضبط مساحة التشغيل.' });
  };

  const clearCode = () => {
    if (!code.trim()) return;
    const accepted = window.confirm('هنمسح الكود من المحرر. يمكنك استعادته بزر «تراجع». هل نكمل؟');
    if (!accepted) return;
    previousCodeRef.current = code;
    setCanUndoClear(true);
    setWipe(true);
    window.clearTimeout(wipeTimerRef.current);
    wipeTimerRef.current = window.setTimeout(() => {
      onCodeChange('');
      setWipe(false);
      appendOutput({ level: 'system', text: 'اتمسح الكود. استخدم «تراجع» لاستعادته.' });
    }, 360);
  };

  const undoClear = () => {
    if (previousCodeRef.current === null) return;
    onCodeChange(previousCodeRef.current);
    previousCodeRef.current = null;
    setCanUndoClear(false);
    setDiagnostic(null);
  };

  const completeLesson = () => {
    setProfile((current) => {
      if (current.completed.includes(lessonId)) return current;
      return { ...current, completed: [...current.completed, lessonId], points: current.points + 10 };
    });
    setCompletedPulse(true);
    window.setTimeout(() => setCompletedPulse(false), 900);
  };

  const speakText = (text: string) => {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      appendOutput({ level: 'warn', text: 'القراءة الصوتية غير مدعومة في هذا المتصفح؛ نص الدرس متاح للقراءة.' });
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ar-EG';
    utterance.rate = isQuietHours ? 0.82 : 0.93;
    utterance.pitch = isQuietHours ? 0.9 : 1;
    utterance.volume = isQuietHours ? 0.78 : 1;
    const voice = window.speechSynthesis.getVoices().find((item) => item.lang.toLowerCase().startsWith('ar-eg'))
      ?? window.speechSynthesis.getVoices().find((item) => item.lang.toLowerCase().startsWith('ar'));
    if (voice) utterance.voice = voice;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const speakLesson = () => {
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    speakText(`${lesson.title}. ${lesson.description} ${lesson.task}`);
  };

  const greetStudent = () => {
    if (!profile.name.trim()) return;
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const lastLesson = LESSONS.find((item) => item.id === profile.lastLessonId) ?? LESSONS[0];
    speakText(`أهلاً يا باشمهندس ${profile.name}. وقفنا المرة اللي فاتت عند درس ${lastLesson.title}. جاهز نكمل؟`);
  };

  const clearLocalProfile = () => {
    if (!window.confirm('سيُحذف الاسم والتقدم والنقاط والمسودات المحفوظة على هذا الجهاز فقط. هل تريد المتابعة؟')) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* Storage may be unavailable. */ }
    const empty: StudentProfile = { name: '', completed: [], points: 0, code: {}, lastLessonId: LESSONS[0].id };
    setProfile(empty);
    setLessonId(LESSONS[0].id);
    setCode(LESSONS[0].code);
    setDiagnostic(null);
    appendOutput({ level: 'system', text: 'تم حذف الملف والتقدم المحليين من هذا المتصفح.' });
  };

  return (
    <section className={`tutor-section ${isQuietHours && !nightDisabled ? 'quiet-hours' : ''}`} id="tutor-studio" dir="rtl" data-night={isQuietHours ? 'true' : 'false'}>
      <div className="tutor-head">
        <div>
          <span className="tutor-kicker"><Code2 size={15} /> مساحة تعليم محلية</span>
          <h2>اتعلّم الكود <em>خطوة بخطوة</em></h2>
          <p>جرّب الدرس بنفسك؛ الشخصية المصرية تفضل هي المدرّس. ما تكتبه يُحفظ محليًا على جهازك.</p>
        </div>
        <div className="tutor-privacy"><ShieldCheck size={16} /><span>بدون كاميرا<br />بدون رفع للكود</span></div>
      </div>

      <div className="tutor-profile-row">
        <label className="tutor-name"><UserRound size={16} /><span>اسم اختياري</span><input value={profile.name} maxLength={40} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} placeholder="اكتب اسمًا محليًا" aria-label="اسم محلي اختياري" /></label>
        <button className="tutor-text-button" onClick={greetStudent} disabled={!profile.name.trim()} title="قراءة ترحيب محلي بالاسم المكتوب"><Volume2 size={14} /> اسمع ترحيبي</button>
        <div className="tutor-score"><Trophy size={16} /><strong>{profile.points}</strong><span>نقطة</span><i /> <span>{profile.completed.length} من {LESSONS.length} دروس</span></div>
        <button className="tutor-text-button" onClick={clearLocalProfile} title="حذف البيانات المحلية"><X size={14} /> حذف بياناتي</button>
      </div>

      <div className="tutor-workspace">
        <aside className="lesson-rail" aria-label="اختيار الدرس">
          <div className="rail-title"><BookOpen size={17} /><span>مسار التعلّم</span></div>
          {LESSONS.map((item, index) => (
            <button key={item.id} className={`lesson-card ${lessonId === item.id ? 'active' : ''}`} disabled={wipe} onClick={() => changeLesson(item.id)} aria-current={lessonId === item.id ? 'step' : undefined}>
              <span className="lesson-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="lesson-card-copy"><strong>{item.title}</strong><small>{item.level}</small></span>
              {profile.completed.includes(item.id) ? <Check size={16} className="lesson-done" /> : <ChevronLeft size={15} />}
            </button>
          ))}
          <div className="lesson-coach-note"><Sparkles size={16} /><p>{profile.name ? `أهلاً يا ${profile.name}، ` : ''}اختار الدرس، اقرأ الفكرة، وجرب بنفسك.</p></div>
          <div className="placeholder-nudge"><CircleHelp size={16} /><span>شرح Qwen التفاعلي</span><small>مكان مخصص للربط — غير متصل</small></div>
        </aside>

        <div className="lesson-main">
          <div className="lesson-intro">
            <div><span className="lesson-level">الدرس {LESSONS.findIndex((item) => item.id === lessonId) + 1} · {lesson.level}</span><h3>{lesson.title}</h3><p>{lesson.description}</p></div>
            <button className="tutor-secondary-button" onClick={speakLesson} aria-pressed={speaking}><Volume2 size={16} />{speaking ? 'إيقاف القراءة' : 'اسمع شرح الدرس'}</button>
          </div>
          <div className="lesson-task"><span>المطلوب</span><p>{lesson.task}</p></div>

          <div className="editor-topbar"><div className="editor-file"><span className="file-dot" /> main.js <span className="unsaved-label">محفوظ محليًا</span></div><div className="editor-tools"><button onClick={clearCode} title="مسح مع تأكيد"><X size={14} /><span>مسح</span></button><button onClick={undoClear} disabled={!canUndoClear} title="استعادة ما مُسح"><RotateCcw size={14} /><span>تراجع</span></button></div></div>
          <div className={`code-editor ${wipe ? 'is-wiping' : ''}`}>
            <div className="line-gutter" ref={gutterRef} aria-hidden="true">{lines.map((_line, index) => <span key={index} className={diagnostic?.line === index + 1 ? 'line-error' : ''}>{String(index + 1).padStart(2, '0')}</span>)}</div>
            <textarea ref={editorRef} dir="ltr" spellCheck={false} autoCapitalize="off" autoCorrect="off" value={code} onChange={(event) => onCodeChange(event.target.value)} onScroll={(event) => { if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop; }} aria-label="محرر JavaScript" aria-describedby="editor-note" />
            {wipe && <div className="wipe-overlay" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /></div>}
          </div>
          <div className="editor-note-row"><small id="editor-note">JavaScript · شغّل الكود بنفسك بعد مراجعته</small><span><LockKeyhole size={12} /> داخل المتصفح</span></div>
          {diagnostic && <div className="code-diagnostic" role="alert"><AlertTriangle size={16} /><span><b>ملاحظة صياغة أولية</b>{diagnostic.message} · السطر {diagnostic.line}، العمود {diagnostic.column}</span><button onClick={focusDiagnostic}>انتقل للسطر</button></div>}
          <div className="run-row"><button className="run-button" onClick={runCode} disabled={!sandboxReady || running}><Play size={16} fill="currentColor" /> تشغيل داخل مساحة معزولة</button><button className="stop-button" onClick={stopCode} disabled={!running}><Square size={14} fill="currentColor" /> إيقاف وإعادة ضبط</button><span className="run-safety"><ShieldCheck size={14} /> لا يعمل على الخادم</span></div>

          <div className="console-panel">
            <div className="console-heading"><span><span className="console-indicator" /> Console</span><button onClick={() => setOutput([])} title="مسح المخرجات"><X size={13} /> مسح المخرجات</button></div>
            <div className="console-output" role="log" aria-live="polite">{output.map((item, index) => <div key={`${index}-${item.text}`} className={`console-line ${item.level}`}><span>{item.level === 'error' ? '!' : item.level === 'system' ? '›' : '›'}</span><code>{item.text}</code></div>)}{running && <div className="console-running">البرنامج يعمل…</div>}</div>
          </div>

          <div className={`lesson-complete ${completedPulse ? 'reward-pulse' : ''}`}><div><Trophy size={18} /><span><strong>{profile.completed.includes(lessonId) ? 'الدرس مسجّل عندك' : 'خلصت التمرين؟'}</strong><small>نقاط وتقدم محفوظين على جهازك فقط.</small></span></div><button onClick={completeLesson} disabled={profile.completed.includes(lessonId)}>{profile.completed.includes(lessonId) ? <><Check size={15} /> مكتمل</> : <><Save size={15} /> أتممت الدرس +١٠</>}</button></div>
        </div>
      </div>

      <div className="tutor-options-row">
        <div className="quiet-card"><Clock3 size={17} /><div><strong>{isQuietHours ? 'وضع الهدوء الليلي يعمل' : 'وضع هدوء بعد منتصف الليل'}</strong><small>{isQuietHours ? 'إضاءة أدفأ وقراءة أبطأ حسب الساعة المحلية.' : 'يعمل تلقائيًا من ٠٠:٠٠ إلى ٠٦:٠٠ حسب ساعة جهازك.'}</small></div><button aria-pressed={nightDisabled} onClick={() => { const next = !nightDisabled; setNightDisabled(next); try { localStorage.setItem('misr-tutor-night-disabled', String(next)); } catch { /* local preference only */ } }}>{nightDisabled ? 'تفعيل' : 'تعطيل'}</button></div>
        <div className="vision-card"><Camera size={17} /><div><strong>الكاميرا غير مفعلة</strong><small>لا تتبع وجه أو يد في هذه النسخة. كل درس يعمل بالماوس واللمس ولوحة المفاتيح.</small></div><span>اختياري لاحقًا</span></div>
      </div>

      <div className="future-features">
        <div className="future-heading"><div><span>المخطط للمراحل القادمة</span><h3>أماكن جاهزة… بلا وعود وهمية</h3></div><button onClick={() => setShowAllFeatures((value) => !value)}>{showAllFeatures ? 'إخفاء التفاصيل' : 'عرض المتطلبات المؤجلة'} <ChevronLeft size={14} /></button></div>
        {showAllFeatures && <div className="future-grid">{FEATURE_PLACEHOLDERS.map(({ icon: Icon, title, copy }) => <article key={title}><Icon size={17} /><div><strong>{title}</strong><p>{copy}</p></div><span>غير مفعّل</span></article>)}</div>}
        <p className="future-privacy"><ShieldCheck size={15} /> مفيش تعرّف على وجه الطالب أو رفع للصوت/الفيديو/الكود. الأدوات غير المتاحة مش شغالة في الخلفية.</p>
      </div>

      <iframe key={sandboxVersion} ref={frameRef} className="sandbox-frame" title="بيئة تشغيل معزولة لكود الطالب" sandbox="allow-scripts" srcDoc={SANDBOX_DOCUMENT} tabIndex={-1} aria-hidden="true" />
    </section>
  );
}
