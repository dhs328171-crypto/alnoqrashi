// ═══════════════════════════════════════════════
//  certificate.js — شهادة إتمام المنهج (بتتحسم على Canvas وتتنزّل PNG)
// ═══════════════════════════════════════════════
const FONT = '"Cairo", "Segoe UI", Tahoma, sans-serif';

export function drawCertificate({ name = '', level = 1, rank = '', xp = 0, lessons = 0, date = new Date() } = {}) {
  const W = 1400;
  const H = 990;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');
  const who = name.trim().slice(0, 30) || 'بطل البرمجة';

  const bg = x.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#02050d');
  bg.addColorStop(1, '#0b2145');
  x.fillStyle = bg;
  x.fillRect(0, 0, W, H);

  // شبكة خفيفة
  x.strokeStyle = 'rgba(0, 240, 255, 0.06)';
  x.lineWidth = 1;
  for (let i = 0; i <= W; i += 50) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); }
  for (let j = 0; j <= H; j += 50) { x.beginPath(); x.moveTo(0, j); x.lineTo(W, j); x.stroke(); }

  // إطار نيون
  x.shadowColor = '#00f0ff';
  x.shadowBlur = 24;
  x.strokeStyle = '#00f0ff';
  x.lineWidth = 6;
  x.strokeRect(40, 40, W - 80, H - 80);
  x.shadowBlur = 0;
  x.strokeStyle = 'rgba(255, 200, 61, 0.7)';
  x.lineWidth = 2;
  x.strokeRect(62, 62, W - 124, H - 124);

  x.direction = 'rtl';
  x.textAlign = 'center';
  x.textBaseline = 'middle';

  x.fillStyle = '#00f0ff';
  x.font = `600 30px ${FONT}`;
  x.fillText('PYTHON · HOLOGRAM ACADEMY', W / 2, 150);

  x.shadowColor = '#00f0ff';
  x.shadowBlur = 18;
  x.fillStyle = '#ffffff';
  x.font = `800 92px ${FONT}`;
  x.fillText('شهادة إتمام', W / 2, 270);
  x.shadowBlur = 0;

  x.fillStyle = '#9fc4d6';
  x.font = `400 36px ${FONT}`;
  x.fillText('بتشهد أكاديمية مستر نقراشي إن', W / 2, 400);

  x.shadowColor = '#ffc83d';
  x.shadowBlur = 16;
  x.fillStyle = '#ffc83d';
  x.font = `800 84px ${FONT}`;
  x.fillText(who, W / 2, 520);
  x.shadowBlur = 0;
  x.fillRect(W / 2 - 330, 575, 660, 3);

  x.fillStyle = '#d9f6ff';
  x.font = `400 38px ${FONT}`;
  x.fillText(`خلّص منهج بايثون للمبتدئين (${lessons} درس)`, W / 2, 660);
  x.fillText('وكتب الكود بنفسه وشغّله بنجاح', W / 2, 720);

  x.fillStyle = '#ff2bd6';
  x.font = `600 34px ${FONT}`;
  x.fillText(`المستوى ${level} · ${rank} · ${xp} XP`, W / 2, 820);

  x.fillStyle = '#7fa6b8';
  x.font = `400 28px ${FONT}`;
  const when = date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  x.fillText(when, W / 2, 900);
  return c;
}

export function downloadCanvas(canvas, filename = 'certificate.png') {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, 'image/png');
}
