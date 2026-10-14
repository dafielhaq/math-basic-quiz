// tests/verify.mjs
// Independent answer checks. These do NOT call the generator code.
// They read the finished question and recompute the answer from scratch.
// true  = the question's answer matches
// false = the answer is wrong
// null  = this question cannot be checked by machine (text only)

const N = (s) => {
  const raw = String(s).trim();
  const fr = /^(-?\d+)\/(\d+)$/.exec(raw);
  if (fr) return Number(fr[1]) / Number(fr[2]);
  if (raw.includes(',')) return Number(raw.replace(/\./g, '').replace(',', '.'));
  return Number(raw);
};

const isPrime = (n) => {
  if (!Number.isInteger(n) || n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
};

// Evaluate a plain arithmetic string. Returns a number, or null if not arithmetic.
export function evalArith(raw) {
  let s = String(raw).trim();
  s = s.replace(/[\u00b2\u00b3]/g, (m) => (m === '\u00b2' ? '**2' : '**3'));
  s = s.replace(/\u221a\s*(\d+(?:[.,]\d+)?)/g, 'Math.sqrt($1)');
  s = s.replace(/\s+[x\u00d7]\s+/g, '*');
  s = s.replace(/\s+:\s+/g, '/');
  s = s.replace(/,/g, '.');
  s = s.replace(/Math\.sqrt\((\d+)\.(\d+)\)/g, 'Math.sqrt($1.$2)');
  if (/Math\.sqrt/.test(s)) {
    const m = /^Math\.sqrt\(([\d.]+)\)$/.exec(s);
    return m ? Math.sqrt(Number(m[1])) : null;
  }
  if (!/^[\d+\-*/(). ]+$/.test(s)) return null;
  try {
    // Safe: the whitelist above allows digits and arithmetic signs only, so no
    // letters or quotes can reach Function. Input comes from our own generators.
    const v = new Function(`return (${s});`)();
    return typeof v === 'number' && isFinite(v) ? v : null;
  } catch (e) {
    return null;
  }
}

const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

// Evaluate one working line of a "find the mistake" question.
export function evalLine(line) {
  const s = String(line).trim();
  const parts = s.includes(' dan ') ? s.split(' dan ') : [s];
  let decided = null;
  for (const p of parts) {
    const r = evalPart(p.trim());
    if (r === false) return false;
    if (r === true) decided = true;
  }
  return decided;
}

function evalPart(s) {
  if (/^Luas = /.test(s) && !/ x /.test(s)) return null;           // formula wording, not arithmetic
  if (/^3x/.test(s)) {                                            // substitution lines
    const m = /^3x \+ 2 = (.+) = ([\d,.]+)$/.exec(s);
    if (!m) return null;
    if (!/ x /.test(m[1])) return null;                           // semantic error, machine cannot judge
    const mid = evalArith(m[1]);
    return mid === null ? null : close(mid, N(m[2]));
  }
  if (/jadi \? = /.test(s)) return null;                          // wrong inverse operation, not arithmetic
  if (/dari /.test(s)) {
    const m = /^([\d,.]+)% dari ([\d,.]+) = ([\d,.]+)$/.exec(s);
    if (!m) return null;
    return close((N(m[1]) * N(m[2])) / 100, N(m[3]));
  }
  if (/^Bulatkan ([\d,.]+) menjadi ([\d,.]+)$/.test(s)) {
    const m = /^Bulatkan ([\d,.]+) menjadi ([\d,.]+)$/.exec(s);
    const x = N(m[1]);
    const got = N(m[2]);
    return close(Math.round(x * 10) / 10, got);
  }
  const unit = /^([\d,]+) (\w+) = ([\d,]+) (\w+)$/.exec(s);
  if (unit) {
    const f = { km: ['m', 1000], m: ['cm', 100], kg: ['g', 1000], g: ['mg', 1000], jam: ['menit', 60], menit: ['detik', 60] };
    const conv = f[unit[2]];
    if (!conv || conv[0] !== unit[4]) return null;
    return close(N(unit[1]) * conv[1], N(unit[3]));
  }
  const eq = s.split(' = ');
  if (eq.length !== 2) return null;
  const left = evalArith(eq[0]);
  if (left === null) return null;
  let rightRaw = eq[1];
  if (/%$/.test(rightRaw)) {
    const r = evalArith(rightRaw.replace('%', ''));
    return r === null ? null : close(left, r / 100);
  }
  const right = evalArith(rightRaw);
  if (right === null) return null;
  return close(left, right);
}

// Recompute the expected answer of a finished question. null = cannot check.
export function expectedAnswer(q) {
  const t = q.text;
  const A = q.answer;
  const id = q.topicId;

  if (q.type !== 'direct') return null;

  const mul = /^(\d+) x (\d+) = \?$/.exec(t);
  if (id === 1 && mul) return N(A) === Number(mul[1]) * Number(mul[2]);
  const div = /^(\d+) : (\d+) = \?$/.exec(t);
  if (id === 2 && div) return N(A) === Number(div[1]) / Number(div[2]);
  const two = /^(\d+) ([+\-]) (\d+) = \?$/.exec(t);
  if (id === 3 && two) return N(A) === (two[2] === '+' ? Number(two[1]) + Number(two[3]) : Number(two[1]) - Number(two[3]));
  const by10 = /^(\d+) x (10|100|1000) = \?$/.exec(t);
  if (id === 4 && by10) return N(A) === Number(by10[1]) * Number(by10[2]);
  const neg = /^(-?\d+) ([+\-]) (\d+) = \?$/.exec(t);
  if (id === 5 && neg) return N(A) === (neg[2] === '+' ? Number(neg[1]) + Number(neg[3]) : Number(neg[1]) - Number(neg[3]));

  if (id === 6) {
    let m = /^(\d+) \+ (\d+) x (\d+) = \?$/.exec(t);
    if (m) return N(A) === Number(m[1]) + Number(m[2]) * Number(m[3]);
    m = /^(\d+) x (\d+) - (\d+) = \?$/.exec(t);
    if (m) return N(A) === Number(m[1]) * Number(m[2]) - Number(m[3]);
    m = /^(\d+) \+ (\d+) : (\d+) = \?$/.exec(t);
    if (m) return N(A) === Number(m[1]) + Number(m[2]) / Number(m[3]);
  }
  if (id === 7) {
    let m = /^\((\d+) \+ (\d+)\) x (\d+) = \?$/.exec(t);
    if (m) return N(A) === (Number(m[1]) + Number(m[2])) * Number(m[3]);
    m = /^(\d+) x \((\d+) - (\d+)\) = \?$/.exec(t);
    if (m) return N(A) === Number(m[1]) * (Number(m[2]) - Number(m[3]));
  }
  if (id === 8) {
    let m = /^(\d+)\u00b2 = \?$/.exec(t);
    if (m) return N(A) === Number(m[1]) ** 2;
    m = /^(\d+)\u00b3 = \?$/.exec(t);
    if (m) return N(A) === Number(m[1]) ** 3;
    m = /^(\d+)\u00b2 \+ (\d+) = \?$/.exec(t);
    if (m) return N(A) === Number(m[1]) ** 2 + Number(m[2]);
  }
  const sq = /^\u221a(\d+) = \?$/.exec(t);
  if (id === 9 && sq) return close(N(A), Math.sqrt(Number(sq[1])));

  if (id === 10) {
    const m = /^(\d+)\/(\d+) \+ (\d+)\/(\d+) = \?$/.exec(t);
    if (m) return close(N(A), Number(m[1]) / Number(m[2]) + Number(m[3]) / Number(m[4]));
  }
  const fon = /^(\d+)\/(\d+) dari (\d+) = \?$/.exec(t);
  if (id === 11 && fon) return N(A) === (Number(fon[3]) / Number(fon[2])) * Number(fon[1]);
  const simp = /^Sederhanakan (\d+)\/(\d+)$/.exec(t);
  if (id === 12 && simp) {
    const g = (a, b) => (b ? g(b, a % b) : a);
    const k = g(Number(simp[1]), Number(simp[2]));
    return close(N(A), Number(simp[1]) / k / (Number(simp[2]) / k));
  }
  if (id === 13) {
    let m = /^(\d+)\/(\d+) = \? %$/.exec(t);
    if (m) return close(N(A.replace('%', '')), (Number(m[1]) * 100) / Number(m[2]));
    m = /^([\d,]+) = \? %$/.exec(t);
    if (m) return close(N(A.replace('%', '')), N(m[1]) * 100);
    m = /^(\d+)% = \? \(bentuk desimal\)$/.exec(t);
    if (m) return close(N(A), Number(m[1]) / 100);
  }
  const pct = /^(\d+)% dari (\d+) = \?$/.exec(t);
  if (id === 14 && pct) return close(N(A), (Number(pct[1]) * Number(pct[2])) / 100);

  if (id === 15) {
    let m = /^([\d,]+) \+ ([\d,]+) = \?$/.exec(t);
    if (m) return close(N(A), N(m[1]) + N(m[2]));
    m = /^([\d,]+) - ([\d,]+) = \?$/.exec(t);
    if (m) return close(N(A), N(m[1]) - N(m[2]));
  }
  if (id === 16) {
    let m = /^Bulatkan ([\d,]+) ke persepuluhan terdekat$/.exec(t);
    if (m) {
      const x = N(m[1]);
      const hundredths = Math.round((x * 100) % 10);
      const want = hundredths >= 5 ? Math.round(x * 10 + 0.0001) / 10 : Math.floor(x * 10 + 0.0001) / 10;
      return close(N(A), want);
    }
    m = /^Taksiran dari (\d+) x (\d+) \u2248 \?$/.exec(t);
    if (m) {
      const a10 = Math.round(Number(m[1]) / 10) * 10, b10 = Math.round(Number(m[2]) / 10) * 10;
      return N(A) === a10 * b10;
    }
    m = /^Bulatkan (\d+) ke puluhan terdekat$/.exec(t);
    if (m) return N(A) === Math.round(Number(m[1]) / 10) * 10;
  }
  if (id === 17) {
    if (/^Bilangan genap adalah/.test(t)) return N(A) % 2 === 0;
    if (/^Bilangan ganjil adalah/.test(t)) return Math.abs(N(A) % 2) === 1;
    let m = /^Faktor dari (\d+) adalah/.exec(t);
    if (m) return Number(m[1]) % N(A) === 0;
    m = /^Kelipatan (\d+) adalah/.exec(t);
    if (m) return N(A) % Number(m[1]) === 0;
  }
  if (id === 18) {
    if (/PRIMA adalah/.test(t)) return isPrime(N(A));
    if (/BUKAN prima adalah/.test(t)) return !isPrime(N(A));
  }
  if (id === 19) {
    let m = /^Mana yang lebih kecil: (-?\d+) atau (-?\d+)\?$/.exec(t);
    if (m) return N(A) === Math.min(Number(m[1]), Number(m[2]));
    m = /^Mana yang lebih besar: ([\d,]+) atau ([\d,]+)\?$/.exec(t);
    if (m) return close(N(A), Math.max(N(m[1]), N(m[2])));
    m = /^Urutan dari kecil ke besar: (.+)$/.exec(t);
    if (m) {
      const sorted = m[1].split(',').map((s) => Number(s.trim())).sort((p, q) => p - q).join(', ');
      return A === sorted;
    }
  }
  if (id === 20) {
    let m = /^(\d+) \+ \? = (\d+)$/.exec(t);
    if (m) return N(A) === Number(m[2]) - Number(m[1]);
    m = /^(\d+) - \? = (\d+)$/.exec(t);
    if (m) return N(A) === Number(m[1]) - Number(m[2]);
    m = /^\? x (\d+) = (\d+)$/.exec(t);
    if (m) return N(A) === Number(m[2]) / Number(m[1]);
    m = /^\? : (\d+) = (\d+)$/.exec(t);
    if (m) return N(A) === Number(m[2]) * Number(m[1]);
  }
  if (id === 21) {
    let m = /^Perbandingan (\d+) : (\d+)\. Kalau bagian pertama (\d+), berapa bagian kedua\?$/.exec(t);
    if (m) return close(N(A), (Number(m[3]) / Number(m[1])) * Number(m[2]));
    m = /^Sederhanakan (\d+) : (\d+)$/.exec(t);
    if (m) {
      const g = (a, b) => (b ? g(b, a % b) : a);
      const k = g(Number(m[1]), Number(m[2]));
      return A === `${Number(m[1]) / k} : ${Number(m[2]) / k}`;
    }
  }
  if (id === 22) {
    const m = /^(\d+) (\w+) = \? (\w+)$/.exec(t);
    if (m) {
      const f = { km: ['m', 1000], m: ['cm', 100], kg: ['g', 1000], g: ['mg', 1000], jam: ['menit', 60], liter: ['ml', 1000], menit: ['detik', 60] };
      const conv = f[m[2]];
      if (conv && conv[0] === m[3]) return N(A) === Number(m[1]) * conv[1];
    }
  }
  if (id === 23) {
    let m = /^Kalau x = (\d+), berapa nilai (\d+)x \+ (\d+)\?$/.exec(t);
    if (m) return N(A) === Number(m[2]) * Number(m[1]) + Number(m[3]);
    m = /^Kalau x = (\d+), berapa nilai (\d+)x - (\d+)\?$/.exec(t);
    if (m) return N(A) === Number(m[2]) * Number(m[1]) - Number(m[3]);
  }
  if (id === 24) {
    let m = /^Persegi panjang dengan panjang (\d+) cm dan lebar (\d+) cm\. Berapa luasnya\?$/.exec(t);
    if (m) return N(A) === Number(m[1]) * Number(m[2]);
    m = /^Persegi panjang dengan panjang (\d+) cm dan lebar (\d+) cm\. Berapa kelilingnya\?$/.exec(t);
    if (m) return N(A) === 2 * (Number(m[1]) + Number(m[2]));
    m = /^Segitiga dengan alas (\d+) cm dan tinggi (\d+) cm\. Berapa luasnya\?$/.exec(t);
    if (m) return close(N(A), (Number(m[1]) * Number(m[2])) / 2);
    m = /^Persegi dengan sisi (\d+) cm\. Berapa luasnya\?$/.exec(t);
    if (m) return N(A) === Number(m[1]) ** 2;
  }
  return null;
}

// Extra semantic check for the "which number is prime / factor / multiple" questions:
// every wrong option must really be a wrong option.
export function wrongOptionsAreWrong(q) {
  const t = q.text;
  const wrongs = q.options.filter((_, i) => i !== q.correctIndex);
  if (/Bilangan berikut yang PRIMA adalah/.test(t)) return wrongs.every((v) => !isPrime(N(v)));
  if (/Bilangan berikut yang BUKAN prima adalah/.test(t)) return wrongs.every((v) => isPrime(N(v)));
  let m = /^Faktor dari (\d+) adalah/.exec(t);
  if (m) return wrongs.every((v) => Number(m[1]) % N(v) !== 0);
  m = /^Kelipatan (\d+) adalah/.exec(t);
  if (m) return wrongs.every((v) => N(v) % Number(m[1]) !== 0);
  if (/^Bilangan genap adalah/.test(t)) return wrongs.every((v) => N(v) % 2 !== 0);
  if (/^Bilangan ganjil adalah/.test(t)) return wrongs.every((v) => Math.abs(N(v) % 2) !== 1);
  return null;
}
