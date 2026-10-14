// js/store.js
// Saving on the phone and sending to Google Sheets. No DOM here.

import { CONFIG } from './config.js';

const KEY_HISTORY = 'mq_history_v1';
const KEY_QUEUE = 'mq_queue_v1';
const KEY_SOUND = 'mq_sound_v1';
const MAX_QUEUE = 800;   // ponytail: hard cap so the queue cannot grow forever

const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
};

// ---------------------------------------------------------------- history

export const getHistory = () => read(KEY_HISTORY, []);

export function saveSession(summary) {
  const history = getHistory();
  history.push(summary);
  write(KEY_HISTORY, history.slice(-200));
  return history;
}

export const lastSession = () => {
  const h = getHistory();
  return h.length ? h[h.length - 1] : null;
};

export const previousSession = () => {
  const h = getHistory();
  return h.length > 1 ? h[h.length - 2] : null;
};

// ---------------------------------------------------------------- sound setting

export const soundOn = () => read(KEY_SOUND, CONFIG.SOUND_START_ON) !== false;
export const setSoundOn = (on) => write(KEY_SOUND, !!on);

// ---------------------------------------------------------------- rows for the sheet

const LETTERS = 'ABCD';
export const letter = (i) => LETTERS[i] || '?';

export function rowFor(session, answer) {
  const q = session.questions[answer.qIndex];
  const chosen = q.options[answer.chosenIndex] === undefined ? '' : q.options[answer.chosenIndex];
  const correctOption = q.options[q.correctIndex];
  const text = q.lines ? `${q.text} [${q.lines.join(' | ')}]` : q.text;
  return {
    timestamp: new Date().toISOString(),
    nickname: session.nickname,
    session_id: session.id,
    mode: session.mode,
    topic_id: q.topicId,
    topic_name: q.topicName,
    question_type: q.type,
    question_text: text,
    chosen_letter: letter(answer.chosenIndex),
    chosen_value: chosen,
    correct_letter: letter(q.correctIndex),
    correct_value: correctOption,
    is_correct: answer.correct ? 'TRUE' : 'FALSE',
    error_tag: answer.errorTag || '',
    time_ms: Math.round(answer.timeMs),
    difficulty: q.difficulty,
    speed_flag: answer.timeMs < CONFIG.GUESS_MS ? 'terlalu_cepat'
      : answer.timeMs > CONFIG.TOO_LONG_MS ? 'terlalu_lama' : '',
  };
}

// ---------------------------------------------------------------- send queue

export const pendingCount = () => read(KEY_QUEUE, []).length;

export function queueRows(rows) {
  const queue = read(KEY_QUEUE, []);
  queue.push(...rows);
  write(KEY_QUEUE, queue.slice(-MAX_QUEUE));
}

let sending = false;
let sendingSince = 0;
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;   // rows older than a week are dropped
const SEND_TIMEOUT_MS = 30000;             // a stuck request must not block later sends

// Send everything waiting. Returns a small status object, never throws.
export async function flushQueue() {
  // a request that hangs must not block the next try for the rest of the session
  if (sending && Date.now() - sendingSince < SEND_TIMEOUT_MS) return null;
  let queue = read(KEY_QUEUE, []);
  if (!queue.length) return { sent: 0, left: 0 };
  const fresh = queue.filter((r) => Date.now() - Date.parse(r.timestamp) < MAX_AGE_MS);
  if (fresh.length !== queue.length) {
    write(KEY_QUEUE, fresh);
    queue = fresh;
  }
  if (!queue.length) return { sent: 0, left: 0, dropped: true };
  if (!CONFIG.ENDPOINT) return { sent: 0, left: queue.length, error: 'alamat endpoint belum diisi' };

  sending = true;
  sendingSince = Date.now();
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), SEND_TIMEOUT_MS);
  try {
    const body = JSON.stringify({ token: CONFIG.TOKEN, rows: queue });
    // text/plain keeps the request simple, so the browser sends no preflight
    const res = await fetch(CONFIG.ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
      signal: stop.signal,
    });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch (e) { data = null; }
    if (!res.ok || !data || data.ok !== true) {
      return { sent: 0, left: queue.length, error: (data && data.error) || `HTTP ${res.status}` };
    }
    const processed = Math.max(0, Math.min(queue.length, data.processed || 0));
    write(KEY_QUEUE, queue.slice(processed));
    return {
      sent: processed, left: queue.length - processed,
      written: data.written || 0, refused: data.refused || 0, deferred: data.deferred || 0,
    };
  } catch (e) {
    return { sent: 0, left: queue.length, error: String((e && e.message) || e) };
  } finally {
    clearTimeout(timer);
    sending = false;
  }
}
