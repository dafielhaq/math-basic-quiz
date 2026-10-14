// js/quiz.js
// Building a quiz session and scoring it. No DOM here.

import { TOPICS, topicById, makeQuestion, shuffle } from './topics.js';
import { CONFIG } from './config.js';

export const SLOW_MS = CONFIG.SLOW_MS;

const VARIANTS = ['meaning', 'first_step', 'find_mistake'];

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// A question repeats only when the text, the working lines and the choices are the same.
export const repeatKey = (q) => `${q.text}|${(q.lines || []).join('~')}|${q.options.slice().sort().join(',')}`;

function nonDirectFor(topic, n) {
  const opts = (topic.variants || VARIANTS).filter((v) => v !== 'direct');
  if (!opts.length) return 'meaning';
  return opts[n % opts.length];
}

// ---------------------------------------------------------------- topic order for practice

export function topicStatusFromHistory(history, topicId) {
  const recent = history.filter((s) => s.topics && s.topics[topicId]).slice(-2);
  if (!recent.length) return { seen: 0, correct: 0, total: 0, rate: 0, status: 'baru' };
  const correct = recent.reduce((a, s) => a + s.topics[topicId].correct, 0);
  const total = recent.reduce((a, s) => a + s.topics[topicId].total, 0);
  const rate = total ? correct / total : 0;
  const status = rate >= 0.7 ? 'kuat' : rate >= 0.4 ? 'sedang' : 'lemah';
  return { seen: recent.length, correct, total, rate, status };
}

export function practiceTopics(history, length) {
  const groups = { lemah: [], sedang: [], baru: [], kuat: [] };
  for (const t of TOPICS) groups[topicStatusFromHistory(history, t.id).status].push(t);
  // weak topics first, then the ones never tried, then the strong ones
  const order = [...shuffle(groups.lemah), ...shuffle(groups.sedang), ...shuffle(groups.baru), ...shuffle(groups.kuat)];
  const plan = [];
  // two questions per topic, so a topic is really measured (same rule as the diagnostic)
  for (const t of order) {
    if (plan.length >= length) break;
    plan.push(t);
    if (plan.length < length) plan.push(t);
  }
  for (const t of order) { if (plan.length >= length) break; plan.push(t); }   // in case there are very few topics
  return plan.slice(0, length);
}

// ---------------------------------------------------------------- session

export function buildSession(mode, history) {
  const plan = [];
  if (mode === 'diagnostic') {
    const perTopic = CONFIG.QUESTIONS_PER_TOPIC;
    for (const t of shuffle(TOPICS)) {
      for (let k = 0; k < perTopic; k++) plan.push({ topic: t });
    }
  } else {
    for (const t of practiceTopics(history, CONFIG.PRACTICE_LENGTH)) plan.push({ topic: t });
  }

  // decide the question type: every third question is not a plain calculation
  let nonDirect = 0;
  let rotation = 0;
  plan.forEach((p, i) => {
    const wantNonDirect = i % 3 === 2;
    p.type = wantNonDirect ? nonDirectFor(p.topic, rotation++) : 'direct';
    if (p.type !== 'direct') nonDirect++;
  });
  const need = Math.ceil(plan.length * CONFIG.NON_DIRECT_SHARE);
  for (const p of plan) {
    if (nonDirect >= need) break;
    if (p.type === 'direct') { p.type = nonDirectFor(p.topic, rotation++); nonDirect++; }
  }

  // build the questions, no repeats inside one session
  const seen = new Set();
  const questions = plan.map((p) => {
    let q = makeQuestion(p.topic, p.type);
    for (let i = 0; i < 15 && seen.has(repeatKey(q)); i++) q = makeQuestion(p.topic, p.type);
    seen.add(repeatKey(q));
    return q;
  });

  return {
    id: newId(),
    mode,
    nickname: CONFIG.NICKNAME,
    startedAt: Date.now(),
    questions,
    answers: [],
    index: 0,
  };
}

export function answerCurrent(session, chosenIndex, timeMs) {
  const q = session.questions[session.index];
  const correct = chosenIndex === q.correctIndex;
  const answer = {
    qIndex: session.index,
    topicId: q.topicId,
    chosenIndex,
    correct,
    timeMs,
    errorTag: correct ? '' : (q.tags[chosenIndex] || 'unknown'),
  };
  session.answers.push(answer);
  return answer;
}

export function scoreSession(session) {
  const topics = {};
  let correct = 0;
  let ms = 0;
  for (const a of session.answers) {
    const q = session.questions[a.qIndex];
    const t = topics[q.topicId] || (topics[q.topicId] = { name: q.topicName, correct: 0, total: 0, ms: 0, slow: false });
    t.total++;
    t.ms += a.timeMs;
    ms += a.timeMs;
    if (a.correct) {
      correct++;
      t.correct++;
      if (a.timeMs > SLOW_MS) t.slow = true;
    }
  }
  Object.values(topics).forEach((t) => {
    t.status = t.correct === 0 ? 'lemah' : t.correct === t.total ? 'kuat' : 'sedang';
    t.avgMs = Math.round(t.ms / t.total);
  });
  const answered = session.answers.length;
  return {
    id: session.id,
    mode: session.mode,
    startedAt: session.startedAt,
    endedAt: Date.now(),
    total: answered,
    correct,
    accuracy: answered ? Math.round((correct / answered) * 100) : 0,
    avgMs: answered ? Math.round(ms / answered) : 0,
    topics,
    weak: Object.keys(topics).filter((k) => topics[k].status === 'lemah').map(Number),
    slow: Object.keys(topics).filter((k) => topics[k].slow).map(Number),
  };
}

export const topicName = (id) => (topicById(id) || { name: '' }).name;
export { shuffle };
