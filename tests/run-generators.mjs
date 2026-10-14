// tests/run-generators.mjs
// Stress test for the question generators. Run with:  node tests/run-generators.mjs
//
// For every topic it builds 1000 questions in each question type and checks:
//   - the four options are different (no two options mean the same number)
//   - only one option is marked correct, and it is really correct
//   - the correct option is not always in the same position
//   - the wrong options carry an error tag
//   - the question text can change from run to run (no repetition)
// It also prints which topics could be checked by machine and which not.

import { TOPICS, makeQuestion, valueKey } from '../js/topics.js';
import { expectedAnswer, evalLine, wrongOptionsAreWrong } from './verify.mjs';

const RUNS = Number(process.argv[2] || 1000);
const TYPES = ['direct', 'meaning', 'first_step', 'find_mistake'];

let failures = [];
const fail = (topic, type, msg) => failures.push(`topic ${topic} [${type}] ${msg}`);

function checkShape(topic, type, q, i) {
  const where = `run ${i}`;
  if (!q.text || typeof q.text !== 'string') fail(topic, type, `${where}: empty question text`);
  if (!q.options || q.options.length < 2 || q.options.length > 4) {
    fail(topic, type, `${where}: ${q.options ? q.options.length : 0} options`);
    return false;
  }
  if (q.options.some((o) => typeof o !== 'string' || !o.trim())) {
    fail(topic, type, `${where}: empty option value`);
    return false;
  }
  const keys = q.options.map(valueKey);
  if (new Set(keys).size !== keys.length) fail(topic, type, `${where}: duplicate options "${q.options.join(' | ')}"`);
  if (q.correctIndex < 0 || q.correctIndex >= q.options.length) fail(topic, type, `${where}: correctIndex out of range`);
  if (q.tags[q.correctIndex] !== null) fail(topic, type, `${where}: correct option has an error tag`);
  q.tags.forEach((t, k) => { if (k !== q.correctIndex && !t) fail(topic, type, `${where}: wrong option without error tag`); });
  if (valueKey(q.options[q.correctIndex]) !== valueKey(q.answer)) fail(topic, type, `${where}: marked option is not the answer`);
  if (!q.explanation || q.explanation.length < 10) fail(topic, type, `${where}: explanation too short`);
  // the app writes numbers the Indonesian way: 4,5 not 4.5
  const dotted = [...q.options, q.answer, ...(q.lines || [])].filter((v) => /\./.test(v));
  if (dotted.length) fail(topic, type, `${where}: English decimal point in "${dotted[0]}"`);
  if (!(q.difficulty >= 1 && q.difficulty <= 3)) fail(topic, type, `${where}: bad difficulty`);
  return true;
}

const report = [];

for (const topic of TOPICS) {
  for (const type of TYPES) {
    if (type !== 'direct' && !topic.variants.includes(type)) continue;
    const stats = { runs: 0, checkedByMachine: 0, machineWrong: 0, letters: {}, texts: new Set(), lineConfirmed: 0, lineRuns: 0 };
    for (let i = 0; i < RUNS; i++) {
      let q;
      try {
        q = makeQuestion(topic, type);
      } catch (e) {
        fail(topic.id, type, `run ${i}: generator threw: ${e.message}`);
        break;
      }
      stats.runs++;
      if (!checkShape(topic.id, type, q, i)) continue;
      stats.letters[q.correctIndex] = (stats.letters[q.correctIndex] || 0) + 1;
      stats.texts.add(q.text);

      if (type === 'direct') {
        const want = expectedAnswer(q);
        if (want !== null) {
          stats.checkedByMachine++;
          if (want !== true) { stats.machineWrong++; fail(topic.id, type, `run ${i}: wrong answer "${q.text}" -> ${q.answer}`); }
        }
        const wok = wrongOptionsAreWrong(q);
        if (wok === false) fail(topic.id, type, `run ${i}: a wrong option is actually right "${q.text}" [${q.options.join(', ')}]`);
      }

      if (type === 'find_mistake') {
        stats.lineRuns++;
        const marked = Number(q.options[q.correctIndex].replace('Baris ', '')) - 1;
        let falseCount = 0;
        q.lines.forEach((line, k) => {
          const v = evalLine(line);
          if (v === false) {
            falseCount++;
            if (k !== marked) fail(topic.id, type, `run ${i}: line ${k + 1} is arithmetically wrong but not marked`);
          }
        });
        if (falseCount === 0) { /* the wrong line is a wording mistake, not arithmetic */ } else if (falseCount === 1) stats.lineConfirmed++;
        if (falseCount > 1) fail(topic.id, type, `run ${i}: ${falseCount} wrong lines, question is ambiguous`);
        if (q.lines.length !== 3 || new Set(q.lines).size !== 3) fail(topic.id, type, `run ${i}: lines are not 3 different lines`);
      }
    }

    if (stats.runs > 0) {
      const letters = Object.keys(stats.letters).length;
      const share = {};
      for (let k = 0; k < letters; k++) share[k] = Math.round(((stats.letters[k] || 0) / stats.runs) * 100);
      report.push({
        topic: topic.id, name: topic.name, type,
        runs: stats.runs, options: letters,
        lowest: Math.min(...Object.values(share)), highest: Math.max(...Object.values(share)),
        share, distinct: stats.texts.size,
        checked: stats.checkedByMachine,
        line: stats.lineRuns ? Math.round((stats.lineConfirmed / stats.lineRuns) * 100) + '%' : '-',
      });
    }
  }
}

// ---- results ----
const pad = (s, n) => String(s).padEnd(n);
console.log(`\nRuns per topic and type: ${RUNS}\n`);
console.log(pad('topic', 34) + pad('type', 14) + pad('opts', 5) + pad('answer spread', 15) + pad('distinct Q', 11) + 'auto-check');
console.log('-'.repeat(96));
for (const r of report) {
  console.log(pad(`${r.topic}. ${r.name}`, 34) + pad(r.type, 14) + pad(r.options, 5)
    + pad(`${r.lowest}-${r.highest}%`, 15) + pad(r.distinct, 11)
    + (r.type === 'direct' ? `${Math.round((r.checked / r.runs) * 100)}%` : r.type === 'find_mistake' ? `line ${r.line}` : '-'));
}

const totalRuns = report.reduce((s, r) => s + r.runs, 0);
console.log(`\ntotal questions built: ${totalRuns}`);
if (failures.length) {
  const grouped = {};
  for (const f of failures) {
    const key = f.replace(/ run \d+.*$/, '').replace(/\[(\w+)\].*/, '[$1]');
    grouped[key] = (grouped[key] || 0) + 1;
  }
  console.log(`\nFAILURES: ${failures.length}`);
  Object.entries(grouped).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${v} x  ${k}`));
  console.log('\nfirst examples:');
  failures.slice(0, 10).forEach((f) => console.log('  ' + f));
  process.exit(1);
}
console.log('\nAll checks passed.');
