// js/app.js
// The flow of the app: which screen is shown, and what every tap does.

import { CONFIG } from './config.js';
import { buildSession, answerCurrent, scoreSession } from './quiz.js';
import * as store from './store.js';
import * as ui from './ui.js';

const state = {
  screen: 'start',        // start | quiz | result | history
  session: null,
  answered: false,
  chosenIndex: -1,
  summary: null,
  shownAt: 0,
  note: '',
  noteUntil: 0,
};

// ---------------------------------------------------------------- rendering

function updateFooter() {
  const el = ui.$('#net-state');
  if (!el) return;
  const pending = store.pendingCount();
  if (state.note && Date.now() < state.noteUntil) { el.textContent = state.note; return; }
  state.note = '';
  if (!CONFIG.ENDPOINT) el.textContent = 'Hasil disimpan di HP ini.';
  else if (!navigator.onLine) el.textContent = pending ? `Tanpa internet. ${pending} jawaban menunggu.` : 'Tanpa internet. Hasil disimpan dulu.';
  else if (pending) el.textContent = `${pending} jawaban menunggu terkirim.`;
  else el.textContent = 'Terhubung. Hasil terkirim ke sheet tutor.';
}

function render(scrollTop = true) {
  const app = ui.$('#app');
  const pending = store.pendingCount();
  const endpointSet = !!CONFIG.ENDPOINT;
  if (state.screen === 'quiz' && state.session) {
    app.innerHTML = ui.renderQuiz({ session: state.session, answered: state.answered, chosenIndex: state.chosenIndex });
  } else if (state.screen === 'result' && state.summary) {
    app.innerHTML = ui.renderResult({ summary: state.summary, pending, endpointSet });
  } else if (state.screen === 'history') {
    app.innerHTML = ui.renderHistory({ history: store.getHistory(), pending });
  } else {
    app.innerHTML = ui.renderStart({ history: store.getHistory(), pending, endpointSet });
  }
  const soundBtn = ui.$('#sound-btn');
  if (soundBtn) soundBtn.setAttribute('aria-pressed', String(store.soundOn()));
  updateFooter();
  if (scrollTop) window.scrollTo({ top: 0, behavior: 'auto' });
}

function note(text, seconds = 4) {
  state.note = text;
  state.noteUntil = Date.now() + seconds * 1000;
  updateFooter();
}

// ---------------------------------------------------------------- actions

function startSession(mode) {
  state.session = buildSession(mode, store.getHistory());
  state.answered = false;
  state.chosenIndex = -1;
  state.screen = 'quiz';
  state.shownAt = performance.now();
  render();
}

function choose(index) {
  if (!state.session || state.answered) return;
  const timeMs = performance.now() - state.shownAt;
  const answer = answerCurrent(state.session, index, timeMs);
  state.answered = true;
  state.chosenIndex = index;
  store.queueRows([store.rowFor(state.session, answer)]);   // saved right away, so nothing is lost
  if (store.soundOn()) ui.playSound(answer.correct ? 'ok' : 'no');
  render(false);
}

function nextQuestion() {
  if (!state.session) return;
  if (state.session.index + 1 < state.session.questions.length) {
    state.session.index += 1;
    state.answered = false;
    state.chosenIndex = -1;
    state.shownAt = performance.now();
    render();
    return;
  }
  finishSession();
}

function finishSession() {
  const summary = scoreSession(state.session);
  store.saveSession(summary);
  state.summary = summary;
  state.screen = 'result';
  render();
  flush(false);
}

async function flush(showNote = true) {
  const result = await store.flushQueue();
  if (result && result.error) { if (showNote) note(`Belum bisa dikirim: ${result.error}. Dicoba lagi nanti.`); }
  else if (result && result.sent > 0) { if (showNote) note(`${result.sent} jawaban terkirim${result.deferred ? `, ${result.deferred} ditunda` : ''}.`); }
  else if (showNote) note(result && result.left ? 'Masih ada yang menunggu.' : 'Tidak ada yang perlu dikirim.');
  updateFooter();
  // refresh the "waiting to send" line on the result screen once the send is done
  if (state.screen === 'result' && result && !result.error && result.left === 0) render(false);
}

document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-action]');
  if (!b || b.disabled) return;
  const action = b.dataset.action;
  if (action === 'start-diagnostic') startSession('diagnostic');
  else if (action === 'start-practice') startSession('practice');
  else if (action === 'repeat-weak') startSession('practice');
  else if (action === 'choose') choose(Number(b.dataset.index));
  else if (action === 'next') nextQuestion();
  else if (action === 'home') { state.screen = 'start'; render(); }
  else if (action === 'history') { state.screen = 'history'; render(); }
  else if (action === 'flush') flush(true);
});

ui.$('#sound-btn').addEventListener('click', () => {
  const on = !store.soundOn();
  store.setSoundOn(on);
  ui.$('#sound-btn').setAttribute('aria-pressed', String(on));
  if (on) ui.playSound('ok');
  note(on ? 'Suara hidup.' : 'Suara mati.', 2);
});

window.addEventListener('online', () => { flush(false); updateFooter(); });
window.addEventListener('offline', updateFooter);

// ---------------------------------------------------------------- start up

ui.initSound();
render();
flush(false);   // send anything left over from earlier sessions

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
