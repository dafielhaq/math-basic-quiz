// tests/run-session.mjs
// Checks the session builder: how many questions, which topics, and how many
// questions are not a plain calculation. Run with: node tests/run-session.mjs

import { CONFIG } from '../js/config.js';
import { TOPICS, makeQuestion } from '../js/topics.js';
import { buildSession, practiceTopics, topicStatusFromHistory, scoreSession, answerCurrent, repeatKey } from '../js/quiz.js';

let failures = [];
const ok = (cond, msg) => { if (!cond) failures.push(msg); };

const ROUNDS = 50;
const typesSeen = new Set();

// ---- diagnostic ----
for (let r = 0; r < ROUNDS; r++) {
  const s = buildSession('diagnostic', []);
  s.questions.forEach((q) => typesSeen.add(q.type));
  const expected = TOPICS.length * CONFIG.QUESTIONS_PER_TOPIC;
  ok(s.questions.length === expected, `diagnostic: ${s.questions.length} questions, expected ${expected}`);

  const perTopic = {};
  for (const q of s.questions) perTopic[q.topicId] = (perTopic[q.topicId] || 0) + 1;
  ok(Object.keys(perTopic).length === TOPICS.length, `diagnostic: only ${Object.keys(perTopic).length} topics`);
  for (const [id, n] of Object.entries(perTopic)) ok(n === CONFIG.QUESTIONS_PER_TOPIC, `diagnostic: topic ${id} has ${n} questions`);

  const keys = s.questions.map(repeatKey);
  ok(new Set(keys).size === keys.length, `diagnostic: repeated question inside one session`);

  const notPlain = s.questions.filter((q) => q.type !== 'direct').length;
  ok(notPlain >= Math.ceil(expected * CONFIG.NON_DIRECT_SHARE),
    `diagnostic: only ${notPlain} of ${expected} questions are not a plain calculation`);
  ok(s.questions.every((q) => q.options.length >= 2 && q.options.length <= 4), 'diagnostic: an option count is wrong');
}

// every question type must really be used
for (const t of ['direct', 'meaning', 'first_step', 'find_mistake']) {
  ok(typesSeen.has(t), `question type "${t}" never appeared in ${ROUNDS} sessions`);
}

// ---- practice starts with the weak topics ----
{
  const history = [{
    id: 'x', mode: 'diagnostic', startedAt: 1, endedAt: 2, total: 48, correct: 10, accuracy: 21, avgMs: 5000,
    topics: {
      5: { name: 'Bilangan negatif', correct: 0, total: 2, ms: 1000, slow: false, status: 'lemah' },
      12: { name: 'Menyederhanakan pecahan', correct: 0, total: 2, ms: 1000, slow: false, status: 'lemah' },
      1: { name: 'Tabel perkalian', correct: 2, total: 2, ms: 1000, slow: false, status: 'kuat' },
    },
    weak: [5, 12], slow: [],
  }];
  const topics = practiceTopics(history, 10);
  ok(topics.length === 10, `practice: ${topics.length} topics, expected 10`);
  ok([5, 12].includes(topics[0].id) && topics[0].id === topics[1].id, 'practice: the first two questions should be the same weak topic');
  ok(new Set(topics.slice(0, 4).map((t) => t.id)).size === 2, 'practice: expected two questions per topic');
  ok(new Set(topics.map((t) => t.id)).size === 5, `practice: ${new Set(topics.map((t) => t.id)).size} different topics, expected 5`);
  const s = buildSession('practice', history);
  ok(s.questions.length === CONFIG.PRACTICE_LENGTH, `practice: ${s.questions.length} questions`);
  const notPlain = s.questions.filter((q) => q.type !== 'direct').length;
  ok(notPlain >= Math.ceil(CONFIG.PRACTICE_LENGTH * CONFIG.NON_DIRECT_SHARE), `practice: only ${notPlain} questions are not a plain calculation`);
}

// ---- status rule from history (thresholds: 70% and 40% over the last two sessions) ----
{
  const h = (c) => [{ topics: { 3: { correct: c[0], total: 2 } } }, { topics: { 3: { correct: c[1], total: 2 } } }];
  ok(topicStatusFromHistory(h([0, 0]), 3).status === 'lemah', 'status: 0 of 4 should be lemah');
  ok(topicStatusFromHistory(h([0, 1]), 3).status === 'lemah', 'status: 1 of 4 should be lemah');
  ok(topicStatusFromHistory(h([1, 1]), 3).status === 'sedang', 'status: 2 of 4 should be sedang');
  ok(topicStatusFromHistory(h([2, 1]), 3).status === 'kuat', 'status: 3 of 4 should be kuat');
  ok(topicStatusFromHistory(h([2, 2]), 3).status === 'kuat', 'status: 4 of 4 should be kuat');
  ok(topicStatusFromHistory([], 3).status === 'baru', 'status: no history should be baru');
}

// ---- scoring ----
{
  const topic = TOPICS[0];
  const s = {
    id: 't', mode: 'practice', nickname: 'Zaim', startedAt: 1, index: 0,
    questions: [makeQuestion(topic, 'direct'), makeQuestion(topic, 'direct')],
    answers: [],
  };
  answerCurrent(s, s.questions[0].correctIndex, 4000);                        // right and quick
  s.index = 1;
  answerCurrent(s, (s.questions[1].correctIndex + 1) % s.questions[1].options.length, 20000); // wrong and slow
  const sum = scoreSession(s);
  ok(sum.total === 2 && sum.correct === 1, `scoring: ${sum.correct}/${sum.total}, expected 1/2`);
  ok(sum.topics[topic.id].status === 'sedang', `scoring: 1 of 2 should be sedang, got ${sum.topics[topic.id].status}`);
  ok(sum.topics[topic.id].slow === false, 'scoring: a slow wrong answer must not mark the topic as pelan');
  ok(sum.accuracy === 50, `scoring: accuracy ${sum.accuracy}, expected 50`);

  const s2 = {
    id: 't2', mode: 'practice', nickname: 'Zaim', startedAt: 1, index: 0,
    questions: [makeQuestion(topic, 'direct'), makeQuestion(topic, 'direct')],
    answers: [],
  };
  answerCurrent(s2, s2.questions[0].correctIndex, 4000);
  s2.index = 1;
  answerCurrent(s2, s2.questions[1].correctIndex, 15000);                     // right but slow
  const sum2 = scoreSession(s2);
  ok(sum2.topics[topic.id].status === 'kuat', 'scoring: 2 of 2 should be kuat');
  ok(sum2.topics[topic.id].slow === true, 'scoring: a correct but slow answer should mark the topic as pelan');
  ok(sum2.correct === 2, 'scoring: both answers were correct');
}

if (failures.length) {
  console.log(`FAILURES: ${failures.length}`);
  failures.slice(0, 20).forEach((f) => console.log('  ' + f));
  process.exit(1);
}
console.log(`Session checks passed (${ROUNDS} diagnostic rounds, practice order, status rule, scoring).`);
console.log(`question types used: ${[...typesSeen].sort().join(', ')}`);
