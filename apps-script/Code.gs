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

// Who can open the page is controlled by the deployment settings, not here.
// The key below is only a second lock: without it nothing is shown.
const DASHBOARD_KEY = 'zaim-ringkasan';

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'health') {
    return json({ ok: true, message: 'Math quiz endpoint is running', tabs: Object.values(TABS) });
  }
  if (p.action === 'metrics') {
    if (p.tutor !== DASHBOARD_KEY) return json({ ok: false, error: 'tidak tersedia' });
    return json(dashboardMetrics());
  }
  if (p.tutor !== DASHBOARD_KEY) {
    return json({ ok: true, message: 'Endpoint is running. Add the tutor key to see the summary.', tabs: Object.values(TABS) });
  }
  return HtmlService.createHtmlOutput(buildDashboardHtml(dashboardMetrics()))
    .setTitle('Ringkasan Latihan Matematika');
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

// ----------------------------------------------------------------- the tutor page

// short plain words for every mistake tag, so the page never shows a code
const TAG_LABELS = {
  sign_error: 'Tanda plus atau minus salah',
  order_ops: 'Urutan pengerjaan salah',
  bracket_ignored: 'Tanda kurung tidak dikerjakan lebih dulu',
  exponent_base_error: 'Pangkat dihitung sebagai perkalian biasa',
  sqrt_confusion: 'Akar kuadrat tertukar dengan membagi dua',
  forgot_root: 'Lupa menarik akarnya',
  table_neighbor: 'Tertukar dengan hasil tabel sebelahnya',
  sum_error: 'Dijumlah padahal seharusnya dikali',
  sum_instead_of_product: 'Luas dijumlah padahal seharusnya dikali',
  subtract_instead: 'Dikurangi padahal seharusnya dikali atau dibagi',
  subtract_instead_divide: 'Dikurangi padahal seharusnya dibagi',
  off_by_one: 'Selisih satu angka',
  off_by_ten: 'Selisih sepuluh angka',
  place_value_error: 'Puluhan dan satuan tertukar',
  digit_swap: 'Angka tertukar posisi',
  digit_concat: 'Angka disambung jadi bilangan baru',
  decimal_shift: 'Jumlah nol di belakang salah',
  decimal_place: 'Letak koma salah',
  fraction_add_wrong: 'Pembilang dan penyebut dua-duanya dijumlah',
  fraction_mul_wrong: 'Pecahan dikali padahal seharusnya dijumlah',
  fraction_flip: 'Pembilang dan penyebut tertukar',
  denominator_only: 'Hanya penyebutnya yang diubah',
  simplify_one_side: 'Hanya satu sisi yang dibagi',
  forgot_multiply: 'Lupa mengalikan setelah membagi',
  invert_fraction: 'Pembagian terbalik',
  percent_off_by_one: 'Nol pada persen kurang atau lebih satu',
  numerator_as_percent: 'Angka atas pecahan langsung jadi persen',
  percent_as_value: 'Angka persen dipakai sebagai jawaban',
  missing_percent_sign: 'Tanda persennya hilang',
  not_rounded: 'Tidak dibulatkan',
  round_up_always: 'Selalu dibulatkan ke atas',
  round_down_always: 'Selalu dibulatkan ke bawah',
  wrong_place: 'Dibulatkan ke tempat yang salah',
  estimation_error: 'Taksiran jauh dari hasil yang masuk akal',
  exact_value: 'Menulis hasil tepat padahal diminta taksiran',
  partial_rounding: 'Hanya satu angka yang dibulatkan',
  parity_error: 'Genap dan ganjil tertukar',
  factor_multiple_confusion: 'Faktor dan kelipatan tertukar',
  prime_rule_error: 'Prima dan bukan prima tertukar',
  one_is_not_prime: 'Angka 1 dianggap prima',
  negative_order_error: 'Urutan bilangan negatif salah',
  order_error: 'Urutan dari kecil ke besar salah',
  wrong_inverse_op: 'Operasi kebalikannya salah dipakai',
  no_change: 'Angka dipakai apa adanya, tidak dihitung',
  wrong_operation: 'Operasi tidak sesuai soal',
  ratio_add: 'Perbandingan dijumlah',
  ratio_subtract: 'Perbandingan dikurangi',
  ratio_flip: 'Perbandingan dibalik',
  ratio_wrong_op: 'Perbandingan langsung dikali',
  conversion_wrong: 'Faktor konversi satuan salah',
  substitution_error: 'Angka dimasukkan tapi operasinya salah',
  formula_swap: 'Dua besaran pada rumus tertukar',
  perimeter_confusion: 'Rumus keliling dipakai untuk mencari luas',
  area_perimeter_swap: 'Luas dan keliling tertukar',
  triangle_formula_confusion: 'Rumus segitiga dipakai pada bangun lain',
  forgot_factor_2: 'Angka 2 pada rumus keliling terlupa',
  forgot_half: 'Lupa dibagi 2 pada luas segitiga',
  multiplied_instead_of_divided: 'Dikali padahal seharusnya dibagi',
  wrong_line_pick: 'Baris yang sudah benar dianggap salah',
};

const tagLabel = (tag) => TAG_LABELS[tag] || (tag ? 'Kesalahan lain' : '');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function shortDate(v) {
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return '';
  return d.getDate() + ' ' + MONTHS[d.getMonth()];
}

function withTime(v) {
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return '';
  const two = (n) => (n < 10 ? '0' + n : '' + n);
  return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() + ', ' + two(d.getHours()) + ':' + two(d.getMinutes());
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const STATUS_ORDER = { lemah: 0, sedang: 1, kuat: 2 };
const STATUS_WORD = { lemah: 'lemah', sedang: 'sedang', kuat: 'kuat' };

// every number the page shows, computed from the same rows as the summary tabs
function dashboardMetrics() {
  const rows = readData();
  const order = [];
  const bySession = {};
  for (const r of rows) {
    if (!bySession[r.session]) { bySession[r.session] = []; order.push(r.session); }
    bySession[r.session].push(r);
  }
  const sessions = order.map((id, i) => {
    const list = bySession[id];
    const s = scoreOf(list);
    return { label: 'Sesi ' + (i + 1), when: list[0].when, mode: list[0].mode, total: s.total, correct: s.correct, accuracy: s.accuracy, avgMs: s.avgMs };
  });

  const byTopic = {};
  for (const r of rows) {
    if (!byTopic[r.topicId]) byTopic[r.topicId] = { id: r.topicId, name: r.topic, list: [] };
    byTopic[r.topicId].list.push(r);
  }
  const topics = Object.keys(byTopic).map((k) => {
    const t = byTopic[k];
    const s = scoreOf(t.list);
    const st = topicStatus(t.list);
    const counts = {};
    for (const r of t.list) if (!r.correct && r.errorTag) counts[r.errorTag] = (counts[r.errorTag] || 0) + 1;
    const topTag = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || '';
    const perSession = order.map((sid, i) => {
      const part = t.list.filter((r) => r.session === sid);
      if (!part.length) return null;
      const ps = scoreOf(part);
      return { label: 'Sesi ' + (i + 1), when: part[0].when, accuracy: ps.accuracy, correct: ps.correct, total: ps.total };
    }).filter((x) => x);
    return {
      id: t.id, name: t.name, total: s.total, correct: s.correct, accuracy: s.accuracy, avgMs: s.avgMs,
      status: st.status, slow: st.slow, topTag, topTagLabel: tagLabel(topTag), perSession,
    };
  }).sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.accuracy - b.accuracy || a.id - b.id);

  const all = scoreOf(rows);
  const tags = {};
  for (const r of rows) if (!r.correct && r.errorTag) tags[r.errorTag] = (tags[r.errorTag] || 0) + 1;
  const topTags = Object.keys(tags).sort((a, b) => tags[b] - tags[a]).slice(0, 3)
    .map((tag) => ({ tag, label: tagLabel(tag), count: tags[tag] }));

  return {
    generatedAt: new Date().toISOString(),
    nickname: ALLOWED[0],
    totals: {
      sessions: sessions.length,
      questions: all.total,
      correct: all.correct,
      accuracy: all.accuracy,
      minutes: Math.round(rows.reduce((a, r) => a + r.ms, 0) / 60000),
      lastWhen: rows.length ? rows[rows.length - 1].when : null,
    },
    weakCount: topics.filter((t) => t.status === 'lemah').length,
    slowCount: topics.filter((t) => t.slow).length,
    sessions,
    topics,
    tutor: { weakest: topics.slice(0, 3), topTags },
  };
}

function chartSvg(sessions) {
  const W = 640, H = 210, L = 38, R = 14, T = 26, B = 34;   // extra room at the top for the value labels
  const iw = W - L - R;
  const ih = H - T - B;
  const n = sessions.length;
  const px = (i) => (n === 1 ? L + iw / 2 : L + (i * iw) / (n - 1));
  const py = (v) => T + ih - (Math.max(0, Math.min(100, v)) / 100) * ih;
  const parts = [];
  for (const v of [0, 25, 50, 75, 100]) {
    parts.push('<line class="gridline" x1="' + L + '" y1="' + py(v).toFixed(1) + '" x2="' + (W - R) + '" y2="' + py(v).toFixed(1) + '"/>');
    parts.push('<text class="axis" x="' + (L - 6) + '" y="' + (py(v) + 4).toFixed(1) + '" text-anchor="end">' + v + '</text>');
  }
  if (n > 1) {
    parts.push('<polyline class="line" points="'
      + sessions.map((s, i) => px(i).toFixed(1) + ',' + py(s.accuracy).toFixed(1)).join(' ') + '"/>');
  }
  sessions.forEach((s, i) => {
    parts.push('<circle class="dot" cx="' + px(i).toFixed(1) + '" cy="' + py(s.accuracy).toFixed(1) + '" r="4">'
      + '<title>' + escapeHtml(s.label + ', ' + shortDate(s.when) + ': ' + s.accuracy + ' persen benar') + '</title></circle>');
    // the number next to the dot, so a small change is still readable on a 0 to 100 scale
    if (n <= 8 || i % 2 === 0) {
      const above = s.accuracy <= 88;                       // high points get the label below the dot
      const lx = Math.max(L + 20, Math.min(W - R - 20, px(i)));
      const ly = above ? py(s.accuracy) - 11 : py(s.accuracy) + 18;
      parts.push('<text class="val" x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="middle">'
        + s.accuracy + '%</text>');
    }
    if (i % (n > 8 ? 2 : 1) === 0 || i === n - 1) {
      parts.push('<text class="axis" x="' + px(i).toFixed(1) + '" y="' + (H - 12) + '" text-anchor="middle">'
        + (i + 1) + '</text>');
    }
  });
  return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Ketepatan per sesi">'
    + parts.join('') + '</svg>';
}

function topicTile(t) {
  const slow = t.slow ? '<span class="badge">pelan</span>' : '';
  const detailRows = t.perSession.map((p) => '<tr><td>' + escapeHtml(shortDate(p.when)) + '</td><td>'
    + p.correct + ' dari ' + p.total + ' benar</td><td>' + p.accuracy + '%</td></tr>').join('');
  return '<details class="tile ' + t.status + '">'
    + '<summary>'
    + '<span class="tname">' + escapeHtml(t.name) + slow + '</span>'
    + '<span class="row2"><span class="bar"><i class="' + t.status + '" style="width:' + t.accuracy + '%"></i></span>'
    + '<span class="pct">' + t.accuracy + '%</span></span>'
    + '<span class="meta">' + t.correct + ' dari ' + t.total + ' benar, rata-rata ' + (t.avgMs / 1000).toFixed(1).replace('.', ',') + ' detik</span>'
    + '</summary>'
    + '<div class="detail">'
    + '<table><tr><th>Sesi</th><th>Hasil</th><th>Ketepatan</th></tr>' + detailRows + '</table>'
    + (t.topTagLabel ? '<p class="tagline">Kesalahan tersering: ' + escapeHtml(t.topTagLabel) + '</p>' : '')
    + '</div></details>';
}

function buildDashboardHtml(m) {
  const t = m.totals;
  const appUrl = 'https://dafielhaq.github.io/math-basic-quiz/';
  const body = t.sessions === 0
    ? '<section class="card empty"><h2>Belum ada data</h2>'
      + '<p class="muted">Belum ada jawaban yang masuk. Jalankan tes diagnostik dulu di aplikasi di HP, lalu buka halaman ini lagi.</p>'
      + '<p><a href="' + appUrl + '">Buka aplikasi latihan</a></p></section>'
    : '<section class="totals">'
      + '<div class="stat"><div class="label">Sesi</div><div class="num">' + t.sessions + '</div></div>'
      + '<div class="stat"><div class="label">Soal dijawab</div><div class="num">' + t.questions + '</div></div>'
      + '<div class="stat"><div class="label">Benar</div><div class="num">' + t.correct + '</div></div>'
      + '<div class="stat"><div class="label">Ketepatan</div><div class="num">' + t.accuracy + '%</div></div>'
      + '</section>'
      + '<section class="card"><h2>Ketepatan per sesi</h2>' + chartSvg(m.sessions)
      + '<p class="muted">Angka di bawah grafik adalah nomor sesi. Naik berarti cara belajar sekarang berhasil. '
      + 'Sesi terakhir: ' + escapeHtml(withTime(t.lastWhen)) + '. Total waktu latihan ' + t.minutes + ' menit.</p></section>'
      + '<section class="card"><h2>Peta topik</h2>'
      + '<p class="muted">Urut dari yang paling perlu dilatih. Klik satu topik untuk melihat riwayatnya. '
      + m.weakCount + ' topik lemah, ' + m.slowCount + ' topik pelan.</p>'
      + '<div class="tiles">' + m.topics.map(topicTile).join('') + '</div></section>'
      + '<section class="card"><h2>Untuk sesi di kertas berikutnya</h2>'
      + '<ol class="big-list">' + m.tutor.weakest.map((w) =>
        '<li><strong>' + escapeHtml(w.name) + '</strong> <span class="muted">(' + STATUS_WORD[w.status] + ', '
        + w.accuracy + '% benar dari ' + w.total + ' soal)</span>'
        + (w.topTagLabel ? '<div class="tagline">Kesalahan tersering: ' + escapeHtml(w.topTagLabel) + '</div>' : '')
        + '</li>').join('') + '</ol>'
      + (m.tutor.topTags.length
        ? '<h3>Kesalahan yang paling sering muncul</h3><ul class="plain">'
          + m.tutor.topTags.map((x) => '<li>' + escapeHtml(x.label) + ' <span class="muted">(' + x.count + ' kali)</span></li>').join('')
          + '</ul>'
        : '<p class="muted">Belum ada kesalahan yang tercatat.</p>')
      + '<p class="muted">Kerjakan topik di atas di kertas. Tulis semua langkahnya, lalu minta dia menjelaskan ulang dengan kata-katanya sendiri.</p>'
      + '</section>';

  return '<!doctype html><html lang="id"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<title>Ringkasan Latihan Matematika</title><style>'
    + ':root{--bg:#f4f5fb;--card:#fff;--ink:#1b1d2b;--soft:#5a5f78;--line:#e3e5f0;--primary:#4f46e5;--ok:#16a34a;--warn:#d97706;--no:#dc2626}'
    + '*{box-sizing:border-box}'
    + 'body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}'
    + '.wrap{max-width:900px;margin:0 auto;padding:18px 14px 48px}'
    + 'h1{font-size:1.3rem;margin:0 0 4px;letter-spacing:-.02em}'
    + 'h2{font-size:1.05rem;margin:0 0 12px}'
    + 'h3{font-size:.95rem;margin:18px 0 8px}'
    + 'a{color:var(--primary)}'
    + '.muted{color:var(--soft);font-size:13.5px}'
    + '.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;margin:14px 0;box-shadow:0 1px 2px rgba(20,22,50,.05),0 8px 24px rgba(20,22,50,.05)}'
    + '.totals{display:grid;grid-template-columns:1fr 1fr;gap:10px}'
    + '@media(min-width:640px){.totals{grid-template-columns:repeat(4,1fr)}}'
    + '.stat{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px}'
    + '.stat .label{color:var(--soft);font-size:12.5px}'
    + '.stat .num{font-size:1.55rem;font-weight:800;letter-spacing:-.02em}'
    + '.chart{width:100%;height:auto;display:block}'
    + '.gridline{stroke:#e6e8f3;stroke-width:1}'
    + '.axis{fill:#7c8199;font-size:12px}'
    + '.val{fill:#33354d;font-size:12px;font-weight:700}'
    + '.line{fill:none;stroke:#4f46e5;stroke-width:2.5;stroke-linejoin:round}'
    + '.dot{fill:#4f46e5}'
    + '.tiles{display:grid;gap:9px}'
    + '@media(min-width:640px){.tiles{grid-template-columns:1fr 1fr}}'
    + '.tile{border:1px solid var(--line);border-left:5px solid #c9cbdb;border-radius:12px;padding:10px 12px;background:#fff}'
    + '.tile.kuat{border-left-color:var(--ok)}.tile.sedang{border-left-color:var(--warn)}.tile.lemah{border-left-color:var(--no)}'
    + '.tile summary{cursor:pointer;list-style:none}.tile summary::-webkit-details-marker{display:none}'
    + '.tname{font-weight:700;font-size:14.5px}'
    + '.badge{display:inline-block;font-size:11px;font-weight:700;padding:1px 7px;border-radius:999px;background:#fdf4e3;color:var(--warn);margin-left:6px}'
    + '.row2{display:flex;align-items:center;gap:8px;margin-top:7px}'
    + '.bar{flex:1;height:8px;background:#eef0f7;border-radius:999px;overflow:hidden}'
    + '.bar i{display:block;height:100%;border-radius:999px;background:var(--primary)}'
    + '.bar i.kuat{background:var(--ok)}.bar i.sedang{background:var(--warn)}.bar i.lemah{background:var(--no)}'
    + '.pct{font-size:13px;font-weight:700;min-width:40px;text-align:right}'
    + '.meta{color:var(--soft);font-size:12.5px;margin-top:4px;display:block}'
    + '.detail{margin-top:10px;border-top:1px dashed var(--line);padding-top:9px}'
    + 'table{width:100%;border-collapse:collapse;font-size:13px}'
    + 'th,td{text-align:left;padding:4px 6px;border-bottom:1px solid var(--line)}'
    + 'th{color:var(--soft);font-weight:600}'
    + '.big-list{margin:0;padding-left:20px}.big-list li{margin-bottom:10px}'
    + '.tagline{color:var(--soft);font-size:13px}'
    + 'ul.plain{margin:0;padding-left:20px;font-size:14px}ul.plain li{margin-bottom:5px}'
    + '</style></head><body><div class="wrap">'
    + '<h1>Ringkasan Latihan Matematika</h1>'
    + '<p class="muted">Untuk ' + escapeHtml(m.nickname) + '. Diperbarui ' + escapeHtml(withTime(m.generatedAt)) + '.</p>'
    + '<p class="muted"><a href="' + appUrl + '">Buka aplikasi latihan</a></p>'
    + body
    + '</div></body></html>';
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
