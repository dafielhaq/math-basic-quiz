/**
 * Math Quiz progress recorder.
 *
 * This code lives in Google Apps Script, not in the app.
 * It receives one row per answered question, checks the token and the nickname,
 * stores the row, and builds the summary tabs.
 *
 * Setup steps are in apps-script/README.md.
 */

// ----------------------------------------------------------------- settings

const TOKEN = '140514';                  // must match js/config.js in the app
const ALLOWED = ['Zaim'];                // nicknames that may write data
const ROWS_PER_HOUR = 200;               // more than this in one hour is delayed, not lost

const TABS = {
  data: 'Data',
  rejected: 'Rejected',
  sessions: 'Sessions',
  topics: 'Topics',
  totals: 'Totals',
  progress: 'Progress',
  tutor: 'Tutor',
};

// column order used everywhere in this file
const DATA_HEADERS = [
  'Waktu', 'Nama', 'Sesi', 'Mode', 'Topik ke', 'Topik', 'Jenis soal', 'Soal',
  'Pilihan huruf', 'Jawaban dipilih', 'Huruf benar', 'Jawaban benar', 'Benar',
  'Jenis kesalahan', 'Waktu (ms)', 'Tingkat', 'Tanda waktu',
];
const IDX = {};
DATA_HEADERS.forEach((h, i) => { IDX[h] = i; });

const REJECT_HEADERS = ['Waktu', 'Nama', 'Alasan', 'Keterangan'];

// ----------------------------------------------------------------- web entry points

function doGet() {
  return json({ ok: true, message: 'Math quiz endpoint is running', tabs: Object.values(TABS) });
}

function doPost(e) {
  let payload = null;
  try {
    payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json({ ok: false, error: 'isi kiriman bukan JSON' });
  }
  const rows = payload && payload.rows;
  if (!Array.isArray(rows) || !rows.length) {
    return json({ ok: false, error: 'tidak ada baris yang dikirim' });
  }

  // wrong token: nothing is written, the app keeps its rows and shows the problem
  if (payload.token !== TOKEN) {
    addRejected([new Date(), '', 'token salah', rows.length + ' baris ditolak']);
    return json({ ok: false, error: 'token tidak cocok', processed: 0, written: 0, refused: 0, deferred: rows.length });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const dataSheet = tab(TABS.data, DATA_HEADERS);
    let written = 0;
    let refused = 0;
    let deferred = 0;
    const accepted = [];
    const rejected = [];
    const already = countThisHour();

    for (let i = 0; i < rows.length; i++) {
      if (already + written >= ROWS_PER_HOUR) {
        deferred = rows.length - i;   // the rest stays on the phone and is sent later
        break;
      }
      const row = rows[i];
      const nickname = String(row.nickname || '').trim();
      if (ALLOWED.indexOf(nickname) === -1) {
        rejected.push([new Date(), nickname || '(kosong)', 'nama tidak ada di daftar', String(row.topic_name || '')]);
        refused++;
        continue;
      }
      const problem = checkRow(row);
      if (problem) {
        rejected.push([new Date(), nickname, problem, String(row.question_text || '').slice(0, 80)]);
        refused++;
        continue;
      }
      accepted.push(DATA_HEADERS.map((h) => rowValue(row, h)));
      written++;
    }

    if (accepted.length) {
      dataSheet.getRange(dataSheet.getLastRow() + 1, 1, accepted.length, DATA_HEADERS.length).setValues(accepted);
    }
    if (rejected.length) {
      const sh = tab(TABS.rejected, REJECT_HEADERS);
      sh.getRange(sh.getLastRow() + 1, 1, rejected.length, REJECT_HEADERS.length).setValues(rejected);
    }
    if (written) {
      rebuildMetrics();
    }
    return json({ ok: true, processed: written + refused, written, refused, deferred });
  } finally {
    lock.releaseLock();
  }
}

// ----------------------------------------------------------------- row handling

function rowValue(row, header) {
  switch (header) {
    case 'Waktu': return row.timestamp ? new Date(row.timestamp) : new Date();
    case 'Nama': return String(row.nickname || '');
    case 'Sesi': return String(row.session_id || '');
    case 'Mode': return row.mode === 'diagnostic' ? 'Tes diagnostik' : 'Latihan';
    case 'Topik ke': return Number(row.topic_id || 0);
    case 'Topik': return String(row.topic_name || '');
    case 'Jenis soal': return questionTypeName(row.question_type);
    case 'Soal': return String(row.question_text || '');
    case 'Pilihan huruf': return String(row.chosen_letter || '');
    case 'Jawaban dipilih': return String(row.chosen_value || '');
    case 'Huruf benar': return String(row.correct_letter || '');
    case 'Jawaban benar': return String(row.correct_value || '');
    case 'Benar': return row.is_correct === 'TRUE' || row.is_correct === true ? 'TRUE' : 'FALSE';
    case 'Jenis kesalahan': return String(row.error_tag || '');
    case 'Waktu (ms)': return Number(row.time_ms || 0);
    case 'Tingkat': return Number(row.difficulty || 0);
    case 'Tanda waktu': return String(row.speed_flag || '');
    default: return '';
  }
}

function questionTypeName(code) {
  const names = {
    direct: 'hitung',
    meaning: 'arti',
    first_step: 'langkah pertama',
    find_mistake: 'cari yang salah',
  };
  return names[code] || String(code || '');
}

function checkRow(row) {
  if (!row.session_id) return 'sesi tidak ada';
  if (!row.topic_id || !row.topic_name) return 'topik tidak ada';
  if (!row.question_text) return 'soal tidak ada';
  if (!row.correct_value) return 'jawaban benar tidak ada';
  const ms = Number(row.time_ms);
  if (!isFinite(ms) || ms < 0 || ms > 3600000) return 'waktu tidak masuk akal';
  return '';
}

function addRejected(row) {
  const sh = tab(TABS.rejected, REJECT_HEADERS);
  sh.getRange(sh.getLastRow() + 1, 1, 1, REJECT_HEADERS.length).setValues([row]);
}

function countThisHour() {
  const sh = tab(TABS.data, DATA_HEADERS);
  const last = sh.getLastRow();
  if (last < 2) return 0;
  const limit = new Date(Date.now() - 3600000);
  const values = sh.getRange(2, 1, last - 1, 1).getValues();   // Waktu column only
  let n = 0;
  for (const v of values) if (v[0] instanceof Date && v[0] > limit) n++;
  return n;
}

// ----------------------------------------------------------------- summary building

function readData() {
  const sh = tab(TABS.data, DATA_HEADERS);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const values = sh.getRange(2, 1, last - 1, DATA_HEADERS.length).getValues();
  return values
    .filter((r) => r[IDX['Sesi']] !== '' && ALLOWED.indexOf(String(r[IDX['Nama']]).trim()) !== -1)
    .map((r) => ({
      when: r[IDX['Waktu']],
      nickname: r[IDX['Nama']],
      session: String(r[IDX['Sesi']]),
      mode: r[IDX['Mode']],
      topicId: r[IDX['Topik ke']],
      topic: r[IDX['Topik']],
      type: r[IDX['Jenis soal']],
      correct: String(r[IDX['Benar']]).toUpperCase() === 'TRUE',
      errorTag: r[IDX['Jenis kesalahan']],
      ms: Number(r[IDX['Waktu (ms)']]) || 0,
      flag: r[IDX['Tanda waktu']],
    }));
}

function scoreOf(list) {
  const total = list.length;
  const correct = list.filter((r) => r.correct).length;
  const ms = list.reduce((a, r) => a + r.ms, 0);
  return {
    total,
    correct,
    accuracy: total ? Math.round((correct / total) * 100) : 0,
    avgMs: total ? Math.round(ms / total) : 0,
  };
}

// a topic is strong, medium or weak, using the links from the last two sessions only
function topicStatus(records) {
  const sessions = [];
  const bySession = {};
  for (const r of records) {
    if (!bySession[r.session]) { bySession[r.session] = []; sessions.push(r.session); }
    bySession[r.session].push(r);
  }
  const recent = sessions.slice(-2);
  const slice = recent.reduce((all, s) => all.concat(bySession[s]), []);
  const s = scoreOf(slice);
  let status = 'lemah';
  if (s.accuracy >= 70) status = 'kuat';
  else if (s.accuracy >= 40) status = 'sedang';
  const slowCorrect = slice.filter((r) => r.correct && r.ms > 10000).length;
  return { status, slow: slowCorrect > 0, ...s };
}

function rebuildMetrics() {
  const rows = readData();
  buildSessions(rows);
  const topicStats = buildTopics(rows);
  buildTotals(rows);
  buildProgress(rows);
  buildTutor(topicStats, rows);
}

function buildSessions(rows) {
  const order = [];
  const bySession = {};
  for (const r of rows) {
    if (!bySession[r.session]) { bySession[r.session] = []; order.push(r.session); }
    bySession[r.session].push(r);
  }
  const out = order.map((id) => {
    const list = bySession[id];
    const s = scoreOf(list);
    const names = weakTopics(list).map((t) => t.topic);
    const weak = names.length > 10 ? `${names.slice(0, 10).join(', ')} dan ${names.length - 10} lagi` : names.join(', ');
    return [list[0].when, list[0].mode, s.total, s.correct, s.accuracy, s.avgMs, weak];
  });
  writeTable(TABS.sessions, ['Tanggal', 'Mode', 'Jumlah soal', 'Benar', 'Ketepatan %', 'Rata-rata waktu (ms)', 'Topik lemah di sesi ini'], out);
}

function weakTopics(list) {
  const byTopic = {};
  for (const r of list) {
    if (!byTopic[r.topicId]) byTopic[r.topicId] = { topic: r.topic, correct: 0, total: 0 };
    byTopic[r.topicId].total++;
    if (r.correct) byTopic[r.topicId].correct++;
  }
  return Object.keys(byTopic).map((k) => byTopic[k]).filter((t) => t.correct === 0);
}

function buildTopics(rows) {
  const byTopic = {};
  for (const r of rows) {
    if (!byTopic[r.topicId]) byTopic[r.topicId] = { topicId: r.topicId, topic: r.topic, list: [] };
    byTopic[r.topicId].list.push(r);
  }
  const stats = Object.keys(byTopic).map((k) => {
    const t = byTopic[k];
    const s = scoreOf(t.list);
    const st = topicStatus(t.list);
    const tagCount = {};
    for (const r of t.list) if (!r.correct && r.errorTag) tagCount[r.errorTag] = (tagCount[r.errorTag] || 0) + 1;
    const topTag = Object.keys(tagCount).sort((a, b) => tagCount[b] - tagCount[a])[0] || '';
    return {
      topicId: t.topicId, topic: t.topic, total: s.total, correct: s.correct,
      accuracy: s.accuracy, avgMs: s.avgMs, topTag, status: st.status, slow: st.slow,
    };
  }).sort((a, b) => a.topicId - b.topicId);

  const statusOrder = { lemah: 0, sedang: 1, kuat: 2 };
  // weakest first, so the tutor sees them at the top of the Topics tab
  const sorted = stats.slice().sort((a, b) => statusOrder[a.status] - statusOrder[b.status]
    || a.accuracy - b.accuracy || a.topicId - b.topicId);
  const out = sorted.map((s) => [s.topic, s.total, s.correct, s.accuracy, s.avgMs,
    s.topTag, s.status, s.slow ? 'ya' : '']);
  writeTable(TABS.topics, ['Topik', 'Jumlah soal', 'Benar', 'Ketepatan %', 'Rata-rata waktu (ms)',
    'Kesalahan tersering', 'Status', 'Pelan'], out);
  return stats;
}

function buildTotals(rows) {
  const sessions = {};
  for (const r of rows) sessions[r.session] = true;
  const s = scoreOf(rows);
  const minutes = Math.round(rows.reduce((a, r) => a + r.ms, 0) / 60000);
  const last = rows.length ? rows[rows.length - 1].when : '';
  const out = [
    ['Jumlah sesi', Object.keys(sessions).length],
    ['Jumlah soal dijawab', s.total],
    ['Jumlah benar', s.correct],
    ['Ketepatan keseluruhan %', s.accuracy],
    ['Total waktu latihan (menit)', minutes],
    ['Tanggal sesi terakhir', last],
  ];
  writeTable(TABS.totals, ['Ukuran', 'Nilai'], out);
}

function buildProgress(rows) {
  const order = [];
  const bySession = {};
  for (const r of rows) {
    if (!bySession[r.session]) { bySession[r.session] = []; order.push(r.session); }
    bySession[r.session].push(r);
  }
  const topics = {};
  for (const r of rows) {
    if (!topics[r.topicId]) topics[r.topicId] = { topic: r.topic, perSession: {} };
    const t = topics[r.topicId];
    if (!t.perSession[r.session]) t.perSession[r.session] = { correct: 0, total: 0 };
    t.perSession[r.session].total++;
    if (r.correct) t.perSession[r.session].correct++;
  }

  const headers = ['Topik'].concat(order.map((_, i) => `Sesi ${i + 1}`)).concat(['Perubahan', 'Arah', '3 sesi terakhir vs sebelumnya']);
  const lines = Object.keys(topics).map(Number).sort((a, b) => a - b).map((id) => {
    const t = topics[id];
    const per = order.map((sid) => {
      const p = t.perSession[sid];
      return p ? Math.round((p.correct / p.total) * 100) : '';
    });
    const filled = per.filter((v) => v !== '');
    const change = filled.length > 1 ? filled[filled.length - 1] - filled[0] : '';
    const recent = filled.slice(-3);
    const earlier = filled.slice(0, -3);
    let verse = '';
    if (recent.length && earlier.length) {
      const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
      const diff = Math.round(avg(recent) - avg(earlier));
      verse = diff > 0 ? `naik ${diff} poin` : diff < 0 ? `turun ${Math.abs(diff)} poin` : 'datar';
    }
    const dir = change === '' ? 'baru' : change > 0 ? 'naik' : change < 0 ? 'turun' : 'datar';
    return [t.topic].concat(per).concat([change, dir, verse]);
  });

  // overall block, used by the chart
  const overall = order.map((sid, i) => {
    const list = bySession[sid];
    const s = scoreOf(list);
    return [`Sesi ${i + 1}`, list[0].when, s.accuracy, s.avgMs];
  });

  const sh = tab(TABS.progress, headers);
  sh.clear();
  writeRows(sh, 1, headers, lines);
  const startRow = lines.length + 4;
  writeRows(sh, startRow, ['Sesi', 'Tanggal', 'Ketepatan %', 'Rata-rata waktu (ms)'], overall);

  // line chart of accuracy per session
  try {
    sh.getCharts().forEach((c) => sh.removeChart(c));
    if (overall.length > 1) {
      const chart = sh.newChart()
        .setChartType(Charts.ChartType.LINE)
        .addRange(sh.getRange(startRow, 1, overall.length + 1, 1))
        .addRange(sh.getRange(startRow, 3, overall.length + 1, 1))
        .setOption('useFirstColumnAsDomain', true)
        .setOption('title', 'Ketepatan per sesi')
        .setOption('legend', { position: 'none' })
        .setPosition(startRow, 5, 0, 0)
        .build();
      sh.insertChart(chart);
    }
  } catch (err) {
    // charts are a nice extra, never let them stop the summaries
  }
}

function buildTutor(topicStats, rows) {
  const statusOrder = { lemah: 0, sedang: 1, kuat: 2 };
  const weakest = topicStats.slice()
    .sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || a.accuracy - b.accuracy)
    .slice(0, 3);
  const tagCount = {};
  for (const r of rows) if (!r.correct && r.errorTag) tagCount[r.errorTag] = (tagCount[r.errorTag] || 0) + 1;
  const topTags = Object.keys(tagCount).sort((a, b) => tagCount[b] - tagCount[a]).slice(0, 3);

  const out = [
    ['Tiga topik paling perlu dilatih', ''],
    [1, weakest[0] ? `${weakest[0].topic} (${weakest[0].accuracy}% benar, status ${weakest[0].status})` : ''],
    [2, weakest[1] ? `${weakest[1].topic} (${weakest[1].accuracy}% benar, status ${weakest[1].status})` : ''],
    [3, weakest[2] ? `${weakest[2].topic} (${weakest[2].accuracy}% benar, status ${weakest[2].status})` : ''],
    ['', ''],
    ['Tiga kesalahan yang paling sering', ''],
    [1, topTags[0] ? `${topTags[0]} (${tagCount[topTags[0]]} kali)` : ''],
    [2, topTags[1] ? `${topTags[1]} (${tagCount[topTags[1]]} kali)` : ''],
    [3, topTags[2] ? `${topTags[2]} (${tagCount[topTags[2]]} kali)` : ''],
    ['', ''],
    ['Cara pakai', 'Ambil topik lemah di atas, kerjakan di kertas. Tulis setiap langkah, lalu minta dia menjelaskan ulang dengan kata-katanya sendiri.'],
  ];
  writeTable(TABS.tutor, ['Bagian', 'Isi'], out);
}

// ----------------------------------------------------------------- sheet helpers

function book() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function tab(name, headers) {
  const ss = book();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

// writes a full table, replacing whatever was there
function writeTable(name, headers, rows) {
  const sh = tab(name, headers);
  sh.clear();
  writeRows(sh, 1, headers, rows);
}

function writeRows(sh, startRow, headers, rows) {
  const padded = rows.map((r) => {
    const row = r.slice(0, headers.length);
    while (row.length < headers.length) row.push('');
    return row;
  });
  const all = [headers].concat(padded);
  sh.getRange(startRow, 1, all.length, headers.length).setValues(all);
  sh.getRange(startRow, 1, 1, headers.length).setFontWeight('bold');
  if (startRow === 1) sh.setFrozenRows(1);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ----------------------------------------------------------------- menu

function onOpen() {
  book().addMenu('Latihan MTK', [
    { name: 'Bangun ulang ringkasan', functionName: 'rebuildMetrics' },
    { name: 'Uji tulis satu baris contoh', functionName: 'writeSampleRow' },
  ]);
}

// puts one made up row in the Data tab, to check the sheet works
function writeSampleRow() {
  const row = {
    timestamp: new Date().toISOString(), nickname: ALLOWED[0], session_id: 'contoh-' + Date.now(),
    mode: 'practice', topic_id: 1, topic_name: 'Tabel perkalian', question_type: 'direct',
    question_text: '7 x 8 = ?', chosen_letter: 'A', chosen_value: '54', correct_letter: 'B',
    correct_value: '56', is_correct: 'FALSE', error_tag: 'table_neighbor', time_ms: 4300,
    difficulty: 2, speed_flag: '',
  };
  const sh = tab(TABS.data, DATA_HEADERS);
  sh.getRange(sh.getLastRow() + 1, 1, 1, DATA_HEADERS.length)
    .setValues([DATA_HEADERS.map((h) => rowValue(row, h))]);
  rebuildMetrics();
}
