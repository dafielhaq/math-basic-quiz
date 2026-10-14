// tests/run-appsscript.mjs
// Runs apps-script/Code.gs against a fake spreadsheet, so the sheet logic can be
// checked without deploying anything. The data comes from the real generators.
// Run with: node tests/run-appsscript.mjs

import fs from 'node:fs';
import { buildSession, answerCurrent, scoreSession } from '../js/quiz.js';
import { rowFor } from '../js/store.js';
import { TOPICS } from '../js/topics.js';

// ---------------------------------------------------------------- fake spreadsheet

class FakeSheet {
  constructor(name) { this.name = name; this.cells = []; this.charts = []; this.frozen = 0; }

  _pad(row, col) {
    while (this.cells.length < row) this.cells.push([]);
    for (let i = 0; i < row; i++) {
      const line = this.cells[i];
      while (line.length < col) line.push('');
    }
  }

  getRange(row, col, rows = 1, cols = 1) {
    const sh = this;
    sh._pad(row + rows - 1, col + cols - 1);
    return {
      setValues(values) {
        values.forEach((r, i) => r.forEach((v, j) => { sh.cells[row - 1 + i][col - 1 + j] = v; }));
        return this;
      },
      getValues() {
        const out = [];
        for (let i = 0; i < rows; i++) {
          const line = [];
          for (let j = 0; j < cols; j++) line.push(sh.cells[row - 1 + i][col - 1 + j] || '');
          out.push(line);
        }
        return out;
      },
      setFontWeight() { return this; },
    };
  }

  getLastRow() {
    let last = 0;
    this.cells.forEach((line, i) => {
      if (line && line.some((v) => v !== '' && v !== undefined && v !== null)) last = i + 1;
    });
    return last;
  }

  clear() { this.cells = []; }
  setFrozenRows(n) { this.frozen = n; }
  getCharts() { return this.charts; }
  removeChart(c) { this.charts = this.charts.filter((x) => x !== c); }
  insertChart(c) { this.charts.push(c); }
  newChart() {
    const b = { setChartType() { return b; }, addRange() { return b; }, setOption() { return b; }, setPosition() { return b; }, build() { return { fake: true }; } };
    return b;
  }

  // rows of a written table, as objects
  table() {
    const headers = this.cells[0] || [];
    return this.cells.slice(1).map((line) => {
      const o = {};
      headers.forEach((h, i) => { o[h] = line[i]; });
      return o;
    }).filter((o) => Object.values(o).some((v) => v !== '' && v !== undefined));
  }
}

class FakeBook {
  constructor() { this.sheets = {}; }
  getSheetByName(name) { return this.sheets[name] || null; }
  insertSheet(name) { const s = new FakeSheet(name); this.sheets[name] = s; return s; }
}

const ss = new FakeBook();
const output = { text: '' };

const source = fs.readFileSync('apps-script/Code.gs', 'utf8');
// Safe: the source is our own file in this project, not user input. Loading it
// this way lets the Apps Script code run in Node against the fake spreadsheet.
const api = new Function(
  'SpreadsheetApp', 'Charts', 'LockService', 'ContentService',
  `${source}\n; return { doPost: doPost, doGet: doGet, rebuildMetrics: rebuildMetrics, TOKEN: TOKEN };`,
)(
  { getActiveSpreadsheet: () => ss },
  { ChartType: { LINE: 'LINE' } },
  { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  { MimeType: { JSON: 'json' }, createTextOutput: (t) => ({ text: t, setMimeType() { return this; } }) },
);

const post = (payload) => {
  const res = api.doPost({ postData: { contents: JSON.stringify(payload) } });
  output.text = res && res.text ? res.text : JSON.stringify(res);
  return JSON.parse(output.text);
};

let failures = [];
const ok = (cond, msg) => { if (!cond) failures.push(msg); };

// ---------------------------------------------------------------- make real rows

// a session where the first two topics are always answered wrong and the rest always right
function makeRows(mode, wrongTopics) {
  const session = buildSession(mode, []);
  for (let i = 0; i < session.questions.length; i++) {
    session.index = i;
    const q = session.questions[i];
    const wrong = wrongTopics.includes(q.topicId);
    const pickIndex = wrong ? (q.correctIndex + 1) % q.options.length : q.correctIndex;
    answerCurrent(session, pickIndex, wrong ? 15000 : 4000);
  }
  return { session, rows: session.answers.map((a) => rowFor(session, a)), summary: scoreSession(session) };
}

const s1 = makeRows('diagnostic', [1, 2]);
const s2 = makeRows('diagnostic', [1, 2, 3]);

// ---------------------------------------------------------------- happy path

let res = post({ token: '140514', rows: s1.rows });
ok(res.ok === true, `first post refused: ${JSON.stringify(res)}`);
ok(res.written === s1.rows.length, `first post wrote ${res.written} of ${s1.rows.length}`);
ok(res.refused === 0 && res.deferred === 0, 'first post should not refuse or defer anything');

const data = ss.getSheetByName('Data');
ok(data.getLastRow() === s1.rows.length + 1, `Data has ${data.getLastRow()} rows, expected ${s1.rows.length + 1}`);
const firstRow = data.getRange(2, 1, 1, 17).getValues()[0];
ok(firstRow[1] === 'Zaim', 'Data row: wrong nickname column');
ok(firstRow[5] === s1.session.questions[0].topicName, 'Data row: topic name missing');
ok(['TRUE', 'FALSE'].includes(firstRow[12]), `Data row: Benar column is "${firstRow[12]}"`);

const sessions = ss.getSheetByName('Sessions').table();
ok(sessions.length === 1, `Sessions tab has ${sessions.length} rows, expected 1`);
ok(Number(sessions[0]['Jumlah soal']) === 48, `Sessions: ${sessions[0]['Jumlah soal']} questions, expected 48`);
ok(Number(sessions[0]['Benar']) === s1.summary.correct, `Sessions: ${sessions[0]['Benar']} correct, expected ${s1.summary.correct}`);
ok(String(sessions[0]['Mode']) === 'Tes diagnostik', 'Sessions: wrong mode name');

const topics = ss.getSheetByName('Topics').table();
ok(topics.length === TOPICS.length, `Topics tab has ${topics.length} rows, expected ${TOPICS.length}`);
ok(topics[0]['Status'] === 'lemah', `Topics: the first row should be a weak topic, got ${topics[0]['Status']}`);
const weakNames = topics.slice(0, 2).map((t) => t['Topik']).sort().join('|');
ok(weakNames === [TOPICS[0].name, TOPICS[1].name].sort().join('|'), `Topics: first two weak topics are ${weakNames}`);
ok(topics.every((t) => ['kuat', 'sedang', 'lemah'].includes(t['Status'])), 'Topics: a status value is unknown');

const totals = ss.getSheetByName('Totals').table();
const totalQuestions = Number(totals.find((r) => r['Ukuran'] === 'Jumlah soal dijawab')['Nilai']);
ok(totalQuestions === 48, `Totals: ${totalQuestions} questions, expected 48`);

// ---------------------------------------------------------------- second session and progress

res = post({ token: '140514', rows: s2.rows });
ok(res.ok === true && res.written === 48, 'second post failed');

const sessions2 = ss.getSheetByName('Sessions').table();
ok(sessions2.length === 2, `Sessions tab has ${sessions2.length} rows after two sessions`);

const progress = ss.getSheetByName('Progress');
const progressText = progress.cells.map((r) => r.join(',')).join('\n');
ok(progressText.includes('Sesi 1') && progressText.includes('Sesi 2'), 'Progress: session columns missing');
ok(progressText.includes('Rata-rata waktu (ms)'), 'Progress: overall block for the chart missing');
ok(progress.getCharts().length === 1, `Progress: ${progress.getCharts().length} charts, expected 1`);

const tutor = ss.getSheetByName('Tutor').table();
ok(tutor.some((r) => String(r['Bagian']).includes('Tiga topik paling perlu dilatih')), 'Tutor: weakest topics block missing');
ok(tutor.some((r) => String(r['Bagian']).includes('Tiga kesalahan yang paling sering')), 'Tutor: top error tags block missing');
ok(tutor.some((r) => String(r['Isi']).includes('kertas')), 'Tutor: the paper practice note is missing');

// the third topic was wrong in the second session only, so it must not be weak yet
const t3 = topics && ss.getSheetByName('Topics').table().find((t) => t['Topik'] === TOPICS[2].name);
ok(t3['Status'] !== 'kuat', 'Topics: a topic wrong in the latest session should not be strong');

// ---------------------------------------------------------------- refusals

res = post({ token: 'salah', rows: s1.rows });
ok(res.ok === false && /token/.test(res.error), 'a wrong token must be refused');
ok(ss.getSheetByName('Rejected').getLastRow() >= 2, 'a wrong token must be written to the Rejected tab');
ok(ss.getSheetByName('Data').getLastRow() === 2 * 48 + 1, 'a wrong token must not add rows to the Data tab');

const badRows = s1.rows.map((r) => ({ ...r, nickname: 'orang lain' }));
res = post({ token: '140514', rows: badRows });
ok(res.ok === true && res.refused === badRows.length && res.written === 0, 'a nickname outside the list must be refused');
ok(res.processed === badRows.length, 'refused rows must be counted as processed so the phone drops them');

// ---------------------------------------------------------------- rate limit

const manyRows = [];
for (let i = 0; i < 250; i++) manyRows.push({ ...s1.rows[i % s1.rows.length] });
const before = ss.getSheetByName('Data').getLastRow();
const alreadyThisHour = before - 1;          // every row so far was written during this test run
const room = 200 - alreadyThisHour;
res = post({ token: '140514', rows: manyRows });
ok(res.written === room, `rate limit: wrote ${res.written}, expected ${room}`);
ok(res.deferred === 250 - room, `rate limit: deferred ${res.deferred}, expected ${250 - room}`);
ok(res.processed === res.written + res.refused, 'rate limit: processed must be written + refused');
ok(ss.getSheetByName('Data').getLastRow() === before + room, 'rate limit: the Data tab grew by the wrong amount');

// ---------------------------------------------------------------- health check

const health = JSON.parse(api.doGet().text);
ok(health.ok === true, 'doGet must answer ok');

if (failures.length) {
  console.log(`FAILURES: ${failures.length}`);
  failures.forEach((f) => console.log('  ' + f));
  process.exit(1);
}
console.log('Apps Script checks passed (write, refusals, rate limit, Sessions, Topics, Totals, Progress, Tutor tabs).');
console.log(`Data rows now: ${ss.getSheetByName('Data').getLastRow()}, Rejected rows: ${ss.getSheetByName('Rejected').getLastRow()}`);
