// js/ui.js
// All the screens, written as HTML strings. No state kept here.

import { TOPICS } from './topics.js';
import { topicStatusFromHistory } from './quiz.js';
import { CONFIG } from './config.js';

export const $ = (sel, root = document) => root.querySelector(sel);

const ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESCAPE[c]);
export const letter = (i) => 'ABCD'[i] || '?';

const TYPE_LABEL = {
  direct: 'hitung',
  meaning: 'arti',
  first_step: 'langkah pertama',
  find_mistake: 'cari yang salah',
};
const STATUS_LABEL = { kuat: 'kuat', sedang: 'sedang', lemah: 'lemah', baru: 'belum dicoba' };
const MODE_LABEL = { diagnostic: 'Tes diagnostik', practice: 'Latihan' };

export const fmtMs = (ms) => `${(ms / 1000).toFixed(1).replace('.', ',')} dtk`;
export const fmtDate = (ts) => new Date(ts).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const pct = (n) => `${Math.round(n)}%`;

// ---------------------------------------------------------------- sound

const sounds = {};

export function initSound() {
  for (const [k, file] of [['ok', 'assets/success.mp3'], ['no', 'assets/failed.mp3']]) {
    const a = new Audio(file);
    a.preload = 'auto';
    a.volume = 0.85;
    sounds[k] = a;
  }
}

export function playSound(kind) {
  const a = sounds[kind];
  if (!a) return;
  try {
    a.currentTime = 0;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) { /* phone refused to play, not a problem */ }
}

// ---------------------------------------------------------------- small pieces

function topicMap(topics, { showAll }) {
  const ids = showAll ? TOPICS.map((t) => t.id) : Object.keys(topics).map(Number);
  return `<div class="grid">${ids.map((id) => {
    const t = topics[id];
    const name = t ? t.name : TOPICS.find((x) => x.id === id).name;
    if (!t) {
      return `<div class="tile baru"><div class="tname">${esc(name)}</div><div class="tmeta">belum dicoba</div></div>`;
    }
    const slow = t.slow ? '<span class="badge">pelan</span>' : '';
    return `<div class="tile ${t.status}">
      <div class="tname">${esc(name)}${slow}</div>
      <div class="tmeta">${t.correct}/${t.total} benar</div>
    </div>`;
  }).join('')}</div>`;
}

function legend() {
  return `<div class="legend">
    <span><i class="dot kuat"></i> kuat (semua benar)</span>
    <span><i class="dot sedang"></i> sedang (sebagian benar)</span>
    <span><i class="dot lemah"></i> lemah (belum ada yang benar)</span>
    <span><i class="dot baru"></i> belum dicoba</span>
  </div>`;
}

function nameList(ids) {
  if (!ids.length) return '<p class="muted">Tidak ada.</p>';
  return `<ul class="rows">${ids.map((id) => `<li><span>${esc(nameOf(id))}</span><span class="k">topik ${id}</span></li>`).join('')}</ul>`;
}
const nameOf = (id) => (TOPICS.find((t) => t.id === id) || { name: `Topik ${id}` }).name;

// ---------------------------------------------------------------- start screen

export function renderStart({ history, pending, endpointSet, sound }) {
  const last = history.length ? history[history.length - 1] : null;
  const prev = history.length > 1 ? history[history.length - 2] : null;

  let progress = '<p class="muted">Belum ada hasil. Mulai dengan tes diagnostik supaya kelihatan topik yang perlu dilatih.</p>';
  if (last) {
    const diff = prev ? last.correct - prev.correct : null;
    const deltaText = diff === null ? '<span class="muted">ini sesi pertama</span>'
      : diff > 0 ? `<span class="delta up">naik ${diff} soal benar</span>`
        : diff < 0 ? `<span class="delta down">turun ${Math.abs(diff)} soal benar</span>`
          : '<span class="delta same">sama seperti sesi sebelumnya</span>';
    progress = `
      <div class="stat-grid">
        <div class="stat"><div class="label">Skor sesi terakhir</div><div class="num">${last.correct}/${last.total}</div></div>
        <div class="stat"><div class="label">Ketepatan</div><div class="num">${pct(last.accuracy)}</div></div>
        <div class="stat"><div class="label">Waktu rata-rata</div><div class="num">${fmtMs(last.avgMs)}</div></div>
        <div class="stat"><div class="label">Dibanding sebelumnya</div><div class="num" style="font-size:.95rem">${deltaText}</div></div>
      </div>
      <p class="muted">Sesi terakhir: ${esc(MODE_LABEL[last.mode] || last.mode)}, ${esc(fmtDate(last.endedAt))}.</p>
      ${last.weak.length ? `<p class="muted">Yang masih lemah: ${last.weak.map((id) => esc(nameOf(id))).join(', ')}.</p>` : '<p class="muted">Tidak ada topik lemah di sesi terakhir.</p>'}`;
  }

  const upload = pending > 0
    ? `<div class="notice warn">Ada ${pending} jawaban yang belum terkirim. ${endpointSet ? 'Coba kirim lagi.' : 'Isi alamat endpoint di js/config.js dulu.'}</div>`
    : `<div class="notice">${endpointSet ? 'Semua hasil sudah terkirim ke tutor.' : 'Alamat endpoint belum diisi, hasil masih disimpan di HP ini.'}</div>`;

  return `
    <div class="card">
      <h1>Hai, ${esc(CONFIG.NICKNAME)}</h1>
      <p class="muted">Latihan ini untuk melatih hitungan dasar. Hasilnya bisa dilihat oleh tutor, jadi kerjakan sendiri tanpa alat bantu.</p>
      ${upload}
      <button class="btn primary" data-action="start-diagnostic">Tes diagnostik (${TOPICS.length * CONFIG.QUESTIONS_PER_TOPIC} soal)</button>
      <button class="btn" data-action="start-practice">Latihan (${CONFIG.PRACTICE_LENGTH} soal)</button>
      <div class="btn-row" style="margin-top:10px">
        <button class="btn ghost" data-action="history">Riwayat</button>
        <button class="btn ghost" data-action="flush">Kirim hasil</button>
      </div>
    </div>

    <div class="card">
      <h2>Perkembangan</h2>
      ${progress}
    </div>

    ${last ? `<div class="card"><h2>Peta topik</h2><p class="muted">Dari sesi terakhir.</p>${topicMap(last.topics, { showAll: false })}${legend()}</div>` : ''}`;
}

// ---------------------------------------------------------------- quiz screen

export function renderQuiz({ session, answered, chosenIndex }) {
  const q = session.questions[session.index];
  const total = session.questions.length;
  const n = session.index + 1;
  const head = `
    <div class="quiz-head">
      <span class="chip">${esc(q.topicName)}</span>
      <span class="chip plain">${esc(TYPE_LABEL[q.type] || q.type)}</span>
    </div>
    <div class="bar"><i style="width:${Math.round((n / total) * 100)}%"></i></div>
    <p class="muted" style="margin-top:-8px">Soal ${n} dari ${total}</p>`;

  const lines = q.lines ? `<ul class="lines">${q.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : '';
  const shortQ = q.text.length > 46;
  const options = q.options.map((opt, i) => {
    let cls = 'opt';
    if (answered) {
      if (i === q.correctIndex) cls += ' correct';
      else if (i === chosenIndex) cls += ' wrong';
      else cls += ' dim';
    }
    return `<button class="${cls}" type="button" data-action="choose" data-index="${i}" ${answered ? 'disabled' : ''}>
      <span class="letter">${letter(i)}</span><span class="val">${esc(opt)}</span>
    </button>`;
  }).join('');

  let feedback = '';
  if (answered) {
    const ok = chosenIndex === q.correctIndex;
    feedback = `<div class="feedback ${ok ? 'ok' : 'no'}">
      <div class="title ${ok ? 'ok' : 'no'}">${ok ? 'Benar' : 'Belum tepat'}</div>
      <p style="margin:0 0 4px">${ok ? 'Bagus, lanjut terus.' : `Jawaban yang benar: <strong>${esc(q.options[q.correctIndex])}</strong>. Tidak apa-apa, yang penting tahu caranya.`}</p>
      <p class="muted" style="margin:0 0 12px">${esc(q.explanation)}</p>
      <button class="btn ${ok ? 'primary' : ''}" data-action="next">${n === total ? 'Lihat hasil' : 'Soal berikutnya'}</button>
    </div>`;
  }

  return `<div class="card">${head}
    <p class="question ${shortQ ? 'small' : ''}">${esc(q.text)}</p>
    ${lines}
    <div class="opts">${options}</div>
    ${feedback}
  </div>`;
}

// ---------------------------------------------------------------- result screen

export function renderResult({ summary, pending, endpointSet }) {
  const weakNames = summary.weak.map(nameOf);
  const slowNames = summary.slow.filter((id) => !summary.weak.includes(id)).map(nameOf);
  const upload = pending > 0
    ? endpointSet
      ? `<div class="notice">${pending} jawaban menunggu dikirim. Coba tekan "Kirim hasil" di halaman awal kalau ada internet.</div>`
      : '<div class="notice">Hasil disimpan di HP ini. Alamat endpoint belum diisi.</div>'
    : '<div class="notice">Hasil sudah terkirim.</div>';

  return `
    <div class="card">
      <h1>Hasil ${esc(MODE_LABEL[summary.mode] || summary.mode)}</h1>
      <div class="stat-grid">
        <div class="stat"><div class="label">Benar</div><div class="num">${summary.correct}/${summary.total}</div></div>
        <div class="stat"><div class="label">Ketepatan</div><div class="num">${pct(summary.accuracy)}</div></div>
        <div class="stat"><div class="label">Waktu rata-rata</div><div class="num">${fmtMs(summary.avgMs)}</div></div>
        <div class="stat"><div class="label">Topik dicoba</div><div class="num">${Object.keys(summary.topics).length}</div></div>
      </div>
      ${upload}
    </div>

    <div class="card">
      <h2>Peta topik</h2>
      ${topicMap(summary.topics, { showAll: false })}
      ${legend()}
    </div>

    <div class="card">
      <h2>Untuk dilatih di kertas bersama tutor</h2>
      ${weakNames.length ? nameList(summary.weak) : '<p class="muted">Tidak ada topik lemah. Kerjakan topik yang waktunya masih lambat.</p>'}
      ${slowNames.length ? `<p class="muted">Sudah benar tapi masih lambat: ${slowNames.map(esc).join(', ')}.</p>` : ''}
    </div>

    <div class="card">
      <button class="btn primary" data-action="repeat-weak">Latihan topik lemah (${CONFIG.PRACTICE_LENGTH} soal)</button>
      <button class="btn ghost" data-action="home">Kembali ke halaman awal</button>
    </div>`;
}

// ---------------------------------------------------------------- history screen

export function renderHistory({ history, pending }) {
  if (!history.length) {
    return `<div class="card"><h1>Riwayat</h1><p class="muted">Belum ada sesi.</p>
      <button class="btn ghost" data-action="home">Kembali</button></div>`;
  }
  const rows = history.slice().reverse().slice(0, 20).map((s) => `
    <li><span>${esc(MODE_LABEL[s.mode] || s.mode)}<br><span class="muted">${esc(fmtDate(s.endedAt))}</span></span>
    <span style="text-align:right">${s.correct}/${s.total}<br><span class="muted">${s.accuracy}%</span></span></li>`).join('');

  // status over the last two sessions of every topic, the same rule the sheet uses
  const topics = {};
  for (const t of TOPICS) {
    const st = topicStatusFromHistory(history, t.id);
    if (st.status === 'baru') continue;
    topics[t.id] = { name: t.name, correct: st.correct, total: st.total, status: st.status, slow: false };
  }
  const trend = {};
  for (const t of TOPICS) {
    const sessions = history.filter((s) => s.topics && s.topics[t.id]);
    const first = sessions[0], last = sessions[sessions.length - 1];
    if (!first || first === last) continue;
    const r1 = first.topics[t.id].correct / Math.max(1, first.topics[t.id].total);
    const r2 = last.topics[t.id].correct / Math.max(1, last.topics[t.id].total);
    trend[t.id] = r2 > r1 ? 'naik' : r2 < r1 ? 'turun' : 'datar';
  }
  const trendRows = Object.keys(trend).length
    ? `<ul class="rows">${Object.entries(trend).map(([id, v]) => `<li><span>${esc(nameOf(Number(id)))}</span><span class="delta ${v === 'naik' ? 'up' : v === 'turun' ? 'down' : 'same'}">${v}</span></li>`).join('')}</ul>`
    : '<p class="muted">Butuh minimal 2 sesi untuk melihat arah perkembangan.</p>';

  return `
    <div class="card"><h1>Riwayat</h1>
      <p class="muted">${history.length} sesi tersimpan di HP ini.${pending ? ` ${pending} jawaban belum terkirim.` : ''}</p>
      <ul class="rows">${rows}</ul>
    </div>
    <div class="card"><h2>Peta topik (2 sesi terakhir tiap topik)</h2>
      ${Object.keys(topics).length ? topicMap(topics, { showAll: false }) : '<p class="muted">Belum ada data.</p>'}
      ${legend()}
    </div>
    <div class="card"><h2>Arah perkembangan</h2>${trendRows}</div>
    <div class="card"><button class="btn ghost" data-action="home">Kembali</button></div>`;
}

export { STATUS_LABEL, TYPE_LABEL, MODE_LABEL, nameOf };
