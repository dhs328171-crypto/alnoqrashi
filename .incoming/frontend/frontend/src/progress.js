// ═══════════════════════════════════════════════
//  progress.js — نقاط الخبرة (XP) والمستويات وسلسلة الأيام + حفظ التقدم
//  التخزين في localStorage، ولو المتصفح منعه المنصة بتشتغل عادي من غير حفظ.
// ═══════════════════════════════════════════════
const KEY = 'nokrashy.progress.v1';
export const XP_PER_LEVEL = 40;

const defaults = () => ({ xp: 0, done: [], quizDone: [], lesson: 0, streak: 0, lastDay: '', finished: false, name: '' });

const dayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

export function loadProgress() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaults(), ...JSON.parse(raw) };
  } catch (e) {
    /* التخزين مش متاح */
  }
  return defaults();
}

export function saveProgress(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch (e) {
    /* مش مشكلة */
  }
}

export function resetProgress() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {
    /* noop */
  }
  return defaults();
}

// بيحدّث سلسلة الأيام المتتالية ويرجّع true لو النهارده يوم جديد
export function touchStreak(p, now = new Date()) {
  const today = dayKey(now);
  if (p.lastDay === today) return false;
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  p.streak = p.lastDay === dayKey(y) ? p.streak + 1 : 1;
  p.lastDay = today;
  return true;
}

export const levelOf = (xp) => Math.floor(xp / XP_PER_LEVEL) + 1;
export const levelProgress = (xp) => (xp % XP_PER_LEVEL) / XP_PER_LEVEL;

export const RANKS = ['مبتدئ', 'متحمّس', 'مبرمج صغير', 'شاطر', 'محترف', 'أستاذ', 'خبير'];
export const rankOf = (xp) => RANKS[Math.min(RANKS.length - 1, levelOf(xp) - 1)];
