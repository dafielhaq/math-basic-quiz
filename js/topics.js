// js/topics.js
// Question generators. One per topic. Pure JavaScript, no DOM, so Node can test it.
//
// Every generator returns a "base" object:
//   text          question in Indonesian
//   answer        the correct value as a string
//   distractors   wrong options, each with an error tag naming the mistake
//   explanation   short explanation in Indonesian
//   difficulty    1 to 3
//
// makeQuestion() turns a base into a ready question: unique options, the correct
// option in a random position.

// ---------------------------------------------------------------- helpers

export const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const isInt = (v) => Number.isInteger(v);

// n different items from arr
export function sample(arr, n) {
  return shuffle(arr).slice(0, n);
}

// Numbers the Indonesian way: 3,5 instead of 3.5
export function fmt(v) {
  const r = Math.round(v * 10000) / 10000;
  return String(r).replace('.', ',');
}

export const frac = (n, den) => (den === 1 ? String(n) : `${n}/${den}`);
const simplify = (n, den) => { const g = gcd(Math.abs(n), Math.abs(den)) || 1; return [n / g, den / g]; };

const d = (value, tag) => ({ value: String(value), tag });
const base = (text, answer, distractors, explanation, difficulty) =>
  ({ text, answer: String(answer), distractors, explanation, difficulty });

const SUP = { 2: '\u00b2', 3: '\u00b3' };

// Two options that mean the same number (1/2 and 2/4) must not both appear.
export function valueKey(v) {
  const s = String(v).trim();
  const m = /^(-?\d+)\/(\d+)$/.exec(s);
  if (m) return (Number(m[1]) / Number(m[2])).toFixed(6);
  if (/^-?[\d.,]+$/.test(s)) {
    const n = Number(s.replace(/\./g, '').replace(',', '.'));
    if (!Number.isNaN(n)) return n.toFixed(6);
  }
  return 't:' + s;
}

const swapDigits = (n) => {
  const s = String(n);
  if (s.length < 2 || s[0] === s[1]) return n + 1;
  return Number(s.split('').reverse().join(''));
};
const concat = (a, b) => Number(String(a) + String(b));

// ---------------------------------------------------------------- topics 1-6

const T1 = {
  id: 1, name: 'Tabel perkalian', kind: 'mental',
  gen() {
    const a = ri(2, 10), b = ri(2, 10);
    const ans = a * b;
    return base(`${a} x ${b} = ?`, ans, [
      d(a * (b + 1), 'table_neighbor'),
      d(a + b, 'sum_error'),
      d(ans + 10, 'off_by_ten'),
    ], `${a} x ${b} = ${ans}. Artinya ${b} dijumlahkan sebanyak ${a} kali.`,
      a >= 8 || b >= 8 ? 3 : a >= 5 ? 2 : 1);
  },
};

const T2 = {
  id: 2, name: 'Pembagian dasar', kind: 'mental',
  gen() {
    const b = ri(2, 9), q = ri(2, 10), n = b * q;
    return base(`${n} : ${b} = ?`, q, [
      d(q + 1, 'table_neighbor'),
      d(q - 1, 'table_neighbor'),
      d(n - b, 'subtract_instead_divide'),
    ], `${n} : ${b} = ${q}, karena ${b} x ${q} = ${n}.`, n > 50 ? 3 : 2);
  },
};

const T3 = {
  id: 3, name: 'Tambah dan kurang dua angka', kind: 'mental',
  gen() {
    if (Math.random() < 0.5) {
      const a = ri(14, 68), b = ri(13, 79);
      const ans = a + b;
      return base(`${a} + ${b} = ?`, ans, [
        d(ans + 10, 'place_value_error'),
        d(ans - 1, 'off_by_one'),
        d(swapDigits(ans), 'digit_swap'),
      ], `Puluhan: ${Math.floor(a / 10)} + ${Math.floor(b / 10)} = ${Math.floor(a / 10) + Math.floor(b / 10)}. ` +
         `Satuan: ${a % 10} + ${b % 10} = ${a % 10 + b % 10}. Hasilnya ${ans}.`, ans > 100 ? 3 : 2);
    }
    const a = ri(42, 99), b = ri(13, a - 11);
    const ans = a - b;
    return base(`${a} - ${b} = ?`, ans, [
      d(ans + 10, 'place_value_error'),
      d(ans + 1, 'off_by_one'),
      d(swapDigits(ans), 'digit_swap'),
    ], `Kurangi puluhan dulu, lalu satuan. ${a} - ${b} = ${ans}.`, 2);
  },
};

const T4 = {
  id: 4, name: 'Kali 10, 100, 1000', kind: 'mental',
  gen() {
    const k = pick([10, 100, 1000]);
    const a = ri(3, 99);
    const ans = a * k;
    const zeros = String(k).length - 1;
    return base(`${a} x ${k} = ?`, ans, [
      d(ans / 10, 'decimal_shift'),
      d(ans * 10, 'decimal_shift'),
      d(a + k, 'sum_error'),
    ], `Kali ${k} sama dengan menambah ${zeros} angka nol di belakang. ${a} menjadi ${ans}.`,
      k === 1000 ? 3 : 2);
  },
};

const T5 = {
  id: 5, name: 'Bilangan negatif', kind: 'mental',
  gen() {
    const form = pick(['a', 'b', 'c']);
    const a = ri(2, 12), b = ri(2, 15);
    if (form === 'a') {
      const ans = -a + b;
      return base(`-${a} + ${b} = ?`, ans, [
        d(a + b, 'sign_error'),
        d(a - b, 'sign_error'),
        d(-(a + b), 'sign_error'),
      ], `Mulai dari -${a}, lalu maju ${b} langkah ke kanan. Hasilnya ${ans}.`, 2);
    }
    if (form === 'b') {
      const hi = Math.max(a, b) + 1, lo = Math.min(a, b);
      const ans = lo - hi;
      return base(`${lo} - ${hi} = ?`, ans, [
        d(hi - lo, 'sign_error'),
        d(lo + hi, 'sign_error'),
        d(-(lo + hi), 'sign_error'),
      ], `${lo} dikurangi ${hi} melewati nol, jadi hasilnya negatif: ${ans}.`, 2);
    }
    const ans = -(a + b);
    return base(`-${a} - ${b} = ?`, ans, [
      d(-b, 'sign_error'),
      d(a + b, 'sign_error'),
      d(-a + b, 'sign_error'),
    ], `Mengurangi ${b} dari -${a} berarti maju ${b} langkah ke kiri. Hasilnya ${ans}.`, 3);
  },
};

const T6 = {
  id: 6, name: 'Urutan operasi', kind: 'reason',
  gen() {
    const form = pick([1, 2, 3]);
    if (form === 1) {
      const a = ri(2, 12), b = ri(2, 9), c = ri(2, 9);
      const ans = a + b * c;
      return base(`${a} + ${b} x ${c} = ?`, ans, [
        d((a + b) * c, 'order_ops'),
        d(a + b + c, 'order_ops'),
        d(ans + 1, 'off_by_one'),
      ], `Kali dulu: ${b} x ${c} = ${b * c}. Lalu ${a} + ${b * c} = ${ans}.`, 2);
    }
    if (form === 2) {
      const b = ri(3, 9), c = ri(3, 9), a = ri(2, Math.max(2, b * c - 1));
      const ans = b * c - a;
      return base(`${b} x ${c} - ${a} = ?`, ans, [
        d(b * (c - a), 'order_ops'),
        d(b + c - a, 'order_ops'),
        d(ans - 1, 'off_by_one'),
      ], `Kali dulu: ${b} x ${c} = ${b * c}. Lalu ${b * c} - ${a} = ${ans}.`, 2);
    }
    const k = ri(2, 6), q = ri(2, 8), b2 = k * q, a2 = ri(2, 8) * k;
    const ans = a2 + q;
    return base(`${a2} + ${b2} : ${k} = ?`, ans, [
      d((a2 + b2) / k, 'order_ops'),
      d(a2 + b2 - k, 'order_ops'),
      d(ans + k, 'off_by_one'),
    ], `Bagi dulu: ${b2} : ${k} = ${q}. Lalu ${a2} + ${q} = ${ans}.`, 3);
  },
};

const T7 = {
  id: 7, name: 'Tanda kurung', kind: 'reason',
  gen() {
    if (Math.random() < 0.5) {
      const a = ri(2, 12), b = ri(2, 9), c = ri(2, 9);
      const ans = (a + b) * c;
      return base(`(${a} + ${b}) x ${c} = ?`, ans, [
        d(a + b * c, 'bracket_ignored'),
        d(a + b + c, 'bracket_ignored'),
        d(ans - c, 'off_by_one'),
      ], `Isi kurung dulu: ${a} + ${b} = ${a + b}. Lalu ${a + b} x ${c} = ${ans}.`, 2);
    }
    const a = ri(2, 9), c = ri(2, 9), b = ri(c + 1, c + 9);
    const ans = a * (b - c);
    return base(`${a} x (${b} - ${c}) = ?`, ans, [
      d(a * b - c, 'bracket_ignored'),
      d(a * b * c, 'bracket_ignored'),
      d(ans + a, 'off_by_one'),
    ], `Isi kurung dulu: ${b} - ${c} = ${b - c}. Lalu ${a} x ${b - c} = ${ans}.`, 3);
  },
};

const T8 = {
  id: 8, name: 'Pangkat', kind: 'reason',
  gen() {
    const form = pick([1, 2, 3]);
    if (form === 1) {
      const a = ri(3, 12);
      const ans = a * a;
      return base(`${a}${SUP[2]} = ?`, ans, [
        d(a * 2, 'exponent_base_error'),
        d((a - 1) * (a - 1), 'off_by_one'),
        d(ans + a, 'off_by_one'),
      ], `${a}${SUP[2]} artinya ${a} x ${a} = ${ans}.`, a > 8 ? 3 : 2);
    }
    if (form === 2) {
      const a = ri(2, 5);
      const ans = a * a * a;
      return base(`${a}${SUP[3]} = ?`, ans, [
        d(a * 3, 'exponent_base_error'),
        d(a * a, 'exponent_base_error'),
        d(ans + a * a, 'off_by_one'),
      ], `${a}${SUP[3]} artinya ${a} x ${a} x ${a} = ${ans}.`, 3);
    }
    const a = ri(2, 8), b = ri(2, 12);
    const ans = a * a + b;
    return base(`${a}${SUP[2]} + ${b} = ?`, ans, [
      d(a * 2 + b, 'exponent_base_error'),
      d(a * a * b, 'sum_error'),
      d(a + b, 'sum_error'),
    ], `${a}${SUP[2]} artinya ${a} x ${a} = ${a * a}. Lalu ${a * a} + ${b} = ${ans}.`, 3);
  },
};

const T9 = {
  id: 9, name: 'Akar kuadrat', kind: 'mental',
  gen() {
    const a = ri(3, 15);
    const n = a * a;
    return base(`\u221a${n} = ?`, a, [
      d(a * 2, 'sqrt_confusion'),
      d(n, 'forgot_root'),
      d(a + 1, 'off_by_one'),
    ], `\u221a${n} = ${a}, karena ${a} x ${a} = ${n}.`, a > 10 ? 3 : 2);
  },
};

// ---------------------------------------------------------------- topics 10-16

const T10 = {
  id: 10, name: 'Pecahan sederhana', kind: 'mental',
  gen() {
    if (Math.random() < 0.5) {
      const den = ri(4, 10);
      const x = ri(1, den - 2);
      const y = ri(1, den - x - 1);
      const s = simplify(x + y, den);
      const ans = frac(s[0], s[1]);
      return base(`${x}/${den} + ${y}/${den} = ?`, ans, [
        d(frac(x + y, den + den), 'fraction_add_wrong'),
        d(frac(den, x + y), 'fraction_flip'),
        d(frac(x * y, den), 'fraction_mul_wrong'),
      ], `Penyebutnya sama, jadi cukup jumlahkan angka atasnya: ${x} + ${y} = ${x + y}. ` +
         `Hasilnya ${x + y}/${den} = ${ans}.`, 2);
    }
    const den = ri(2, 5);
    const s = simplify(3, 2 * den);
    const ans = frac(s[0], s[1]);
    return base(`1/${den} + 1/${den * 2} = ?`, ans, [
      d(frac(2, den * 2), 'fraction_add_wrong'),
      d(frac(den * 2, 3), 'fraction_flip'),
      d(frac(1, den * 2), 'denominator_only'),
    ], `Samakan penyebut jadi ${den * 2}: 1/${den} = 2/${den * 2}. ` +
       `Lalu 2/${den * 2} + 1/${den * 2} = 3/${den * 2} = ${ans}.`, 3);
  },
};

const T11 = {
  id: 11, name: 'Pecahan dari suatu bilangan', kind: 'mental',
  gen() {
    const den = pick([2, 3, 4, 5, 10]);
    const num = ri(1, den - 1);
    const k = ri(2, 12);
    const total = den * k;
    const ans = num * k;
    return base(`${num}/${den} dari ${total} = ?`, ans, [
      d(k, 'forgot_multiply'),
      d(total - num, 'subtract_instead'),
      d(fmt(total * den / num), 'invert_fraction'),
    ], `${total} : ${den} = ${k} (satu bagian). Lalu ${k} x ${num} = ${ans}.`, 2);
  },
};

const T12 = {
  id: 12, name: 'Menyederhanakan pecahan', kind: 'mental',
  gen() {
    const pair = pick([[1, 2], [2, 3], [3, 4], [1, 3], [2, 5], [3, 5], [4, 5], [1, 4], [5, 6], [3, 7]]);
    const k = ri(2, 7);
    const n = pair[0] * k, den = pair[1] * k;
    const ans = frac(pair[0], pair[1]);
    const wrongs = [
      d(frac(n, pair[1]), 'simplify_one_side'),
      d(frac(pair[1], pair[0]), 'fraction_flip'),
      d(frac(n - k, den - k), 'subtract_instead_divide'),
    ];
    // dividing both sides by 2 is the same value, so it can never be a wrong option
    return base(`Sederhanakan ${n}/${den}`, ans, wrongs,
      `Bagi atas dan bawah dengan angka yang sama. ${n} : ${k} = ${pair[0]} dan ${den} : ${k} = ${pair[1]}. ` +
      `Hasilnya ${ans}.`, k > 5 ? 3 : 2);
  },
};

const T13 = {
  id: 13, name: 'Pecahan, desimal, persen', kind: 'mental',
  gen() {
    const form = pick([1, 2, 3]);
    if (form === 1) {
      const den = pick([2, 4, 5, 10, 20, 25, 50]);
      const num = ri(1, den - 1);
      const pct = (num * 100) / den;
      return base(`${num}/${den} = ? %`, `${pct}%`, [
        d(`${pct * 10}%`, 'percent_off_by_one'),
        d(`${num}%`, 'numerator_as_percent'),
        d(`${fmt(pct / 10)}%`, 'percent_off_by_one'),
      ], `Ubah penyebut jadi 100. ${den} x ${100 / den} = 100, jadi ${num} x ${100 / den} = ${pct}. ` +
         `Berarti ${pct}%.`, 2);
    }
    if (form === 2) {
      const pct = pick([12, 25, 36, 45, 58, 74, 8]);
      const dec = pct / 100;
      return base(`${fmt(dec)} = ? %`, `${pct}%`, [
        d(`${fmt(pct / 10)}%`, 'percent_off_by_one'),
        d(`${pct * 100}%`, 'percent_off_by_one'),
        d(`${pct}`, 'missing_percent_sign'),
      ], `Desimal ke persen: geser koma dua langkah ke kanan. ${fmt(dec)} menjadi ${pct}%.`, 2);
    }
    const pct = pick([10, 20, 25, 40, 60, 75, 50]);
    const dec = pct / 100;
    return base(`${pct}% = ? (bentuk desimal)`, fmt(dec), [
      d(fmt(pct / 10), 'decimal_place'),
      d(fmt(dec / 10), 'decimal_place'),
      d(pct, 'percent_as_value'),
    ], `Persen ke desimal: bagi dengan 100. ${pct} : 100 = ${fmt(dec)}.`, 2);
  },
};

const T14 = {
  id: 14, name: 'Persen dari suatu bilangan', kind: 'mental',
  gen() {
    const p = pick([5, 10, 15, 20, 25, 30, 50, 75]);
    let n = 0, ans = 0;
    for (let i = 0; i < 60; i++) {
      n = ri(2, 24) * 5;
      const v = (n * p) / 100;
      if (isInt(v) && v >= 1) { ans = v; break; }
    }
    const note = p === 25 ? `25% sama dengan seperempat, jadi ${n} : 4 = ${ans}`
      : p === 50 ? `50% sama dengan setengah, jadi ${n} : 2 = ${ans}`
        : p === 10 ? `${n} : 10 = ${ans}`
          : `${n} : 100 x ${p} = ${ans}`;
    return base(`${p}% dari ${n} = ?`, ans, [
      d(p, 'percent_as_value'),
      d(ans * 10, 'percent_off_by_one'),
      d(n - p, 'subtract_instead'),
    ], `${p}% berarti ${p} per 100. ${note}.`, p === 25 || p === 50 ? 1 : 2);
  },
};

const T15 = {
  id: 15, name: 'Desimal', kind: 'mental',
  gen() {
    if (Math.random() < 0.5) {
      const A = ri(11, 99), B = ri(105, 995);      // tenths and hundredths
      const ans = (A * 10 + B) / 100;
      return base(`${fmt(A / 10)} + ${fmt(B / 100)} = ?`, fmt(ans), [
        d(fmt((A + B) / 100), 'decimal_place'),
        d(fmt(ans * 10), 'decimal_place'),
        d(fmt(ans / 10), 'decimal_place'),
      ], `Sejajarkan komanya dulu. ${fmt(A / 10)} + ${fmt(B / 100)} = ${fmt(ans)}.`, 2);
    }
    const A = ri(30, 99), B = ri(105, A * 10 - 5);
    const ans = (A * 10 - B) / 100;
    return base(`${fmt(A / 10)} - ${fmt(B / 100)} = ?`, fmt(ans), [
      d(fmt((A - B) / 100), 'decimal_place'),
      d(fmt(B / 100 - A / 10), 'sign_error'),
      d(fmt(ans * 10), 'decimal_place'),
    ], `Sejajarkan komanya dulu. ${fmt(A / 10)} - ${fmt(B / 100)} = ${fmt(ans)}.`, 3);
  },
};

const T16 = {
  id: 16, name: 'Pembulatan dan taksiran', kind: 'reason',
  gen() {
    const form = pick([1, 2, 3]);
    if (form === 1) {
      const w = ri(2, 40), t = ri(1, 9), h = ri(1, 9);
      const x = w + t / 10 + h / 100;
      const up = w + (t + 1) / 10;
      const down = w + t / 10;
      const ans = h >= 5 ? up : down;
      return base(`Bulatkan ${fmt(x)} ke persepuluhan terdekat`, fmt(ans), [
        d(fmt(x), 'not_rounded'),
        d(fmt(up), 'round_up_always'),
        d(fmt(down), 'round_down_always'),
        d(fmt(t >= 5 ? w + 1 : w), 'wrong_place'),
      ], `Lihat angka perseratusnya, yaitu ${h}. Kalau ${h} lima atau lebih, dibulatkan ke atas. ` +
         `Hasilnya ${fmt(ans)}.`, 3);
    }
    if (form === 2) {
      const a = ri(31, 69), b = ri(11, 29);
      const a10 = Math.round(a / 10) * 10, b10 = Math.round(b / 10) * 10;
      const ans = a10 * b10;
      return base(`Taksiran dari ${a} x ${b} \u2248 ?`, ans, [
        d(a * b, 'exact_value'),
        d(ans + 20, 'estimation_error'),
        d(a10 * b, 'partial_rounding'),
      ], `Bulatkan dulu: ${a} \u2248 ${a10} dan ${b} \u2248 ${b10}. Lalu ${a10} x ${b10} = ${ans}.`, 3);
    }
    const n = ri(105, 989);
    const tens = Math.round(n / 10) * 10;
    return base(`Bulatkan ${n} ke puluhan terdekat`, tens, [
      d(Math.round(n / 100) * 100, 'wrong_place'),
      d(Math.floor(n / 10) * 10 - 10, 'round_down_always'),
      d(n, 'not_rounded'),
    ], `Angka satuannya ${n % 10}. Kalau lima atau lebih, dibulatkan ke atas. Hasilnya ${tens}.`, 2);
  },
};

// ---------------------------------------------------------------- topics 17-24

const T17 = {
  id: 17, name: 'Genap, ganjil, faktor, kelipatan', kind: 'mental',
  gen() {
    const form = pick(['genap', 'ganjil', 'faktor', 'kelipatan']);
    if (form === 'genap' || form === 'ganjil') {
      const good = form === 'genap' ? 2 * ri(6, 60) : 2 * ri(6, 60) + 1;
      // the three wrong options are the other kind of number
      return base(`Bilangan ${form} adalah`, good, [
        d(good + 1, 'parity_error'),
        d(good + 3, 'parity_error'),
        d(good - 1, 'parity_error'),
      ], `Bilangan ${form} ${form === 'genap' ? 'habis dibagi 2' : 'tidak habis dibagi 2'}. ` +
         `Yang benar ${good}.`, 1);
    }
    if (form === 'faktor') {
      const n = pick([12, 18, 20, 24, 30, 36, 40, 48, 60]);
      const divisors = [];
      for (let i = 2; i <= n / 2; i++) if (n % i === 0) divisors.push(i);
      const good = pick(divisors);
      const notDivisors = [];
      for (let v = 2; v <= n + 8; v++) if (n % v !== 0) notDivisors.push(v);
      const near = notDivisors.filter((v) => Math.abs(v - good) <= 10);
      const wrongVals = sample(near.length >= 3 ? near : notDivisors, 3);
      return base(`Faktor dari ${n} adalah`, good, wrongVals.map((v) => d(v, 'factor_multiple_confusion')),
        `Faktor adalah angka yang membagi habis. ${n} : ${good} = ${n / good} (bulat). Yang benar ${good}.`, 2);
    }
    const k = ri(3, 9);
    const good = k * ri(3, 12);
    return base(`Kelipatan ${k} adalah`, good, [
      d(good + 1, 'factor_multiple_confusion'),
      d(good + 2, 'factor_multiple_confusion'),
      d(good - 1, 'factor_multiple_confusion'),
    ], `Kelipatan ${k} didapat dari ${k} dikali bilangan bulat. ${k} x ${good / k} = ${good}.`, 2);
  },
};

const T18 = {
  id: 18, name: 'Bilangan prima', kind: 'reason',
  gen() {
    const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53];
    const odds = [9, 15, 21, 25, 27, 33, 35, 39, 49, 51, 55, 57, 63, 65, 77, 87, 91];
    if (Math.random() < 0.5) {
      const good = pick(primes.filter((p) => p > 5));
      const wrongs = sample(odds, 2).map((v) => d(v, 'prime_rule_error'));
      return base('Bilangan berikut yang PRIMA adalah', good, [...wrongs, d(1, 'one_is_not_prime')],
        `Bilangan prima hanya punya dua faktor: 1 dan dirinya sendiri. ${good} hanya bisa dibagi 1 dan ${good}.`, 2);
    }
    const good = pick(odds);
    return base('Bilangan berikut yang BUKAN prima adalah', good,
      sample(primes, 3).map((v) => d(v, 'prime_rule_error')),
      `${good} masih bisa dibagi angka lain, jadi bukan prima. Sementara bilangan prima hanya bisa dibagi 1 dan dirinya.`, 2);
  },
};

const T19 = {
  id: 19, name: 'Membandingkan bilangan', kind: 'reason',
  gen() {
    const form = pick([1, 2, 3]);
    if (form === 1) {
      let a = -ri(2, 20), b = -ri(2, 20);
      if (a === b) b = -a - 1;
      const ans = Math.min(a, b);
      return base(`Mana yang lebih kecil: ${a} atau ${b}?`, ans, [
        d(Math.max(a, b), 'negative_order_error'),
      ], `Pada bilangan negatif, makin besar angkanya makin kecil nilainya. ${ans} lebih kecil.`, 2);
    }
    if (form === 2) {
      const pairs = [['0,7', '0,68', '0,7'], ['0,9', '0,87', '0,9'], ['1,5', '1,45', '1,5'],
        ['2,09', '2,1', '2,1'], ['0,5', '0,45', '0,5'], ['3,4', '3,39', '3,4']];
      const P = pick(pairs);
      return base(`Mana yang lebih besar: ${P[0]} atau ${P[1]}?`, P[2], [
        d(P[0] === P[2] ? P[1] : P[0], 'decimal_place'),
      ], `Samakan jumlah angka di belakang koma: ${P[0]} dan ${P[1]}. Yang lebih besar ${P[2]}.`, 3);
    }
    const nums = shuffle([-ri(1, 9), ri(1, 9), -(ri(2, 9)) * 10, ri(2, 9) * 10]).slice(0, 4);
    const sorted = nums.slice().sort((p, q) => p - q);
    const correct = sorted.join(', ');
    const wrongs = [];
    while (wrongs.length < 3) {
      const s = shuffle(sorted).join(', ');
      if (s !== correct && !wrongs.some((w) => w.value === s)) wrongs.push(d(s, 'order_error'));
    }
    return base(`Urutan dari kecil ke besar: ${nums.join(', ')}`, correct, wrongs,
      `Bilangan negatif lebih kecil dari bilangan positif. Urutan yang benar ${correct}.`, 3);
  },
};

const T20 = {
  id: 20, name: 'Bilangan yang hilang', kind: 'mental',
  gen() {
    const form = pick(['add', 'sub', 'mul', 'div']);
    const a = ri(2, 9);
    if (form === 'add') {
      const ans = ri(4, 15), sum = a + ans;
      return base(`${a} + ? = ${sum}`, ans, [
        d(sum + a, 'wrong_inverse_op'),
        d(sum * a, 'wrong_inverse_op'),
        d(ans + 1, 'off_by_one'),
      ], `Bagian yang hilang = ${sum} - ${a} = ${ans}. Cek: ${a} + ${ans} = ${sum}.`, 2);
    }
    if (form === 'sub') {
      const ans = ri(4, 15), sum = a + ans + 10;
      return base(`${sum} - ? = ${sum - ans}`, ans, [
        d(ans + sum, 'wrong_inverse_op'),
        d(sum - ans, 'no_change'),
        d(ans - 1, 'off_by_one'),
      ], `Bagian yang hilang = ${sum} - ${sum - ans} = ${ans}. Cek: ${sum} - ${ans} = ${sum - ans}.`, 2);
    }
    if (form === 'mul') {
      const ans = ri(3, 12), prod = a * ans;
      return base(`? x ${a} = ${prod}`, ans, [
        d(prod + a, 'wrong_inverse_op'),
        d(prod - a, 'wrong_inverse_op'),
        d(ans + 1, 'off_by_one'),
      ], `Bagian yang hilang = ${prod} : ${a} = ${ans}. Cek: ${ans} x ${a} = ${prod}.`, 2);
    }
    const ans = ri(3, 12), q = ri(2, 9), prod = ans * q;
    return base(`? : ${q} = ${ans}`, prod, [
      d(ans + q, 'wrong_inverse_op'),
      d(ans - q, 'wrong_inverse_op'),
      d(prod + q, 'off_by_one'),
    ], `Bagian yang hilang = ${ans} x ${q} = ${prod}. Cek: ${prod} : ${q} = ${ans}.`, 3);
  },
};

const T21 = {
  id: 21, name: 'Perbandingan sederhana', kind: 'mental',
  gen() {
    if (Math.random() < 0.5) {
      const r1 = ri(2, 6);
      let r2 = ri(2, 6);
      if (r2 === r1) r2 = r1 === 6 ? 5 : r1 + 1;
      const k = ri(2, 9);
      const a = r1 * k, ans = r2 * k;
      return base(`Perbandingan ${r1} : ${r2}. Kalau bagian pertama ${a}, berapa bagian kedua?`, ans, [
        d(a + r2, 'ratio_add'),
        d(a - r1, 'ratio_subtract'),
        d(a * r2, 'ratio_wrong_op'),
      ], `Bagian pertama ${r1} menjadi ${a}, berarti dikali ${k}. Bagian kedua ${r2} x ${k} = ${ans}.`, 3);
    }
    const r1 = ri(2, 5);
    let r2 = pick([2, 3, 5, 7].filter((v) => v !== r1));
    while (r2 % r1 === 0 || r1 % r2 === 0) r2 = r2 + 1;   // keep the ratio fully reduced
    const k = ri(2, 7);
    const ans = `${r1} : ${r2}`;
    return base(`Sederhanakan ${r1 * k} : ${r2 * k}`, ans, [
      d(`${r2} : ${r1}`, 'ratio_flip'),
      d(`${r1} : ${r2 * k}`, 'simplify_one_side'),
      d(`${r1 * k - k} : ${r2 * k - k}`, 'ratio_subtract'),
    ], `Bagi kedua bagian dengan ${k}. ${r1 * k} : ${k} = ${r1} dan ${r2 * k} : ${k} = ${r2}. Hasilnya ${ans}.`, 2);
  },
};

const T22 = {
  id: 22, name: 'Konversi satuan', kind: 'mental',
  gen() {
    const units = [
      ['km', 'm', 1000], ['m', 'cm', 100], ['kg', 'g', 1000], ['g', 'mg', 1000],
      ['jam', 'menit', 60], ['liter', 'ml', 1000], ['menit', 'detik', 60],
    ];
    const U = pick(units);
    const a = ri(2, 12);
    const ans = a * U[2];
    return base(`${a} ${U[0]} = ? ${U[1]}`, ans, [
      d(ans / 10, 'conversion_wrong'),
      d(ans * 10, 'conversion_wrong'),
      d(a + U[2], 'sum_error'),
    ], `1 ${U[0]} = ${U[2]} ${U[1]}, jadi ${a} x ${U[2]} = ${ans}.`, U[2] === 60 ? 2 : 3);
  },
};

const T23 = {
  id: 23, name: 'Substitusi', kind: 'reason',
  gen() {
    const x = ri(2, 9);
    const coef = pick([2, 3, 4, 5]);
    const form = pick([1, 2]);
    const cst = pick([1, 2, 3, 5, 7]);
    if (form === 1) {
      const ans = coef * x + cst;
      return base(`Kalau x = ${x}, berapa nilai ${coef}x + ${cst}?`, ans, [
        d(coef + x + cst, 'substitution_error'),
        d(coef * x - cst, 'sign_error'),
        d(concat(coef, x) + cst, 'digit_concat'),
      ], `Ganti x dengan ${x}: ${coef} x ${x} = ${coef * x}, lalu ${coef * x} + ${cst} = ${ans}.`, 3);
    }
    const prod = coef * x;
    const sub = Math.min(cst, prod - 1);
    const ans = prod - sub;
    return base(`Kalau x = ${x}, berapa nilai ${coef}x - ${sub}?`, ans, [
      d(coef + x - sub, 'substitution_error'),
      d(prod + sub, 'sign_error'),
      d(concat(coef, x) - sub, 'digit_concat'),
    ], `Ganti x dengan ${x}: ${coef} x ${x} = ${prod}, lalu ${prod} - ${sub} = ${ans}.`, 3);
  },
};

const T24 = {
  id: 24, name: 'Evaluasi rumus', kind: 'reason',
  gen() {
    const form = pick(['area_rect', 'perimeter_rect', 'area_triangle', 'area_square']);
    if (form === 'area_rect') {
      const p = ri(4, 15), l = ri(3, 12);
      const ans = p * l;
      return base(`Persegi panjang dengan panjang ${p} cm dan lebar ${l} cm. Berapa luasnya?`, ans, [
        d(2 * (p + l), 'perimeter_confusion'),
        d(p + l, 'sum_instead_of_product'),
        d(2 * p + l, 'perimeter_confusion'),
      ], `Luas persegi panjang = panjang x lebar = ${p} x ${l} = ${ans} cm${SUP[2]}.`, 2);
    }
    if (form === 'perimeter_rect') {
      const p = ri(4, 15), l = ri(3, 12);
      const ans = 2 * (p + l);
      return base(`Persegi panjang dengan panjang ${p} cm dan lebar ${l} cm. Berapa kelilingnya?`, ans, [
        d(p * l, 'formula_swap'),
        d(p + l, 'forgot_factor_2'),
        d(4 * (p + l), 'off_by_ten'),
      ], `Keliling persegi panjang = 2 x (panjang + lebar) = 2 x (${p} + ${l}) = ${ans} cm.`, 2);
    }
    if (form === 'area_triangle') {
      const t = ri(3, 12), a = ri(2, 10) * 2;
      const ans = (a * t) / 2;
      return base(`Segitiga dengan alas ${a} cm dan tinggi ${t} cm. Berapa luasnya?`, ans, [
        d(a * t, 'forgot_half'),
        d(a + t, 'sum_instead_of_product'),
        d(a * t * 2, 'multiplied_instead_of_divided'),
      ], `Luas segitiga = alas x tinggi : 2 = ${a} x ${t} : 2 = ${a * t} : 2 = ${ans} cm${SUP[2]}.`, 3);
    }
    const s = ri(3, 15);
    const ans = s * s;
    return base(`Persegi dengan sisi ${s} cm. Berapa luasnya?`, ans, [
      d(4 * s, 'perimeter_confusion'),
      d(s * 2, 'area_perimeter_swap'),
      d(s + 4, 'sum_instead_of_product'),
    ], `Luas persegi = sisi x sisi = ${s} x ${s} = ${ans} cm${SUP[2]}.`, 2);
  },
};

// ---------------------------------------------------------------- meaning questions

const W = (value, tag) => [value, tag];

const MEANING = {
  1: {
    text: 'Apa arti dari 7 x 4?',
    correct: '4 dijumlahkan sebanyak 7 kali',
    wrong: [W('7 ditambah 4', 'sum_error'), W('74', 'digit_concat'), W('7 dibagi 4', 'wrong_operation')],
    why: '7 x 4 berarti 4 + 4 + 4 + 4 + 4 + 4 + 4 = 28.',
  },
  2: {
    text: 'Apa arti dari 20 : 4 = 5?',
    correct: '20 dibagi menjadi 4 bagian sama besar, setiap bagian 5',
    wrong: [W('20 dikurangi 4 sebanyak 5 kali', 'subtract_instead_divide'), W('20 dikali 4', 'wrong_operation'), W('5 dibagi 4', 'wrong_operation')],
    why: 'Tanda : berarti membagi. 20 : 4 = 5, karena 4 x 5 = 20.',
  },
  3: {
    text: 'Pada bilangan 47, apa arti angka 4 dan 7?',
    correct: '4 puluhan dan 7 satuan',
    wrong: [W('4 satuan dan 7 puluhan', 'place_value_error'), W('4 ratusan dan 7 puluhan', 'place_value_error'), W('4 puluhan dan 7 ratusan', 'place_value_error')],
    why: 'Angka paling kanan adalah satuan. Jadi 47 = 4 puluhan + 7 satuan.',
  },
  4: {
    text: 'Apa yang terjadi pada bilangan 47 kalau dikali 100?',
    correct: 'ditambah dua angka nol di belakang, jadi 4700',
    wrong: [W('ditambah satu angka nol, jadi 470', 'decimal_shift'), W('koma digeser ke kiri', 'decimal_shift'), W('dikali 10 lalu ditambah 100', 'wrong_operation')],
    why: 'Kali 100 sama dengan menambah dua nol. 47 x 100 = 4700.',
  },
  5: {
    text: 'Apa arti dari -5?',
    correct: '5 langkah ke kiri dari nol',
    wrong: [W('5 langkah ke kanan dari nol', 'sign_error'), W('sama dengan 5', 'sign_error'), W('lebih besar dari 0', 'sign_error')],
    why: 'Tanda minus berarti ke kiri dari nol. Jadi -5 ada di sebelah kiri 0.',
  },
  6: {
    text: 'Pada soal 3 + 4 x 2, mana yang dikerjakan lebih dulu?',
    correct: '4 x 2',
    wrong: [W('3 + 4', 'order_ops'), W('dari kiri ke kanan', 'order_ops'), W('angka yang paling besar', 'order_ops')],
    why: 'Kali dan bagi dikerjakan sebelum tambah dan kurang. 3 + 8 = 11.',
  },
  7: {
    text: 'Apa gunanya tanda kurung dalam hitungan?',
    correct: 'menentukan bagian yang dihitung lebih dulu',
    wrong: [W('menandai jawaban akhir', 'bracket_ignored'), W('membuat angka menjadi besar', 'bracket_ignored'), W('tidak berpengaruh', 'bracket_ignored')],
    why: 'Isi kurung selalu dihitung lebih dulu. (3 + 4) x 2 = 14, bukan 11.',
  },
  8: {
    text: 'Apa arti dari 3\u00b2?',
    correct: '3 x 3',
    wrong: [W('3 x 2', 'exponent_base_error'), W('3 + 2', 'exponent_base_error'), W('3 x 3 x 3', 'exponent_base_error')],
    why: 'Pangkat dua berarti dikali dirinya sendiri. 3\u00b2 = 3 x 3 = 9.',
  },
  9: {
    text: 'Apa arti dari \u221a49?',
    correct: 'bilangan yang kalau dikali dirinya sendiri hasilnya 49',
    wrong: [W('49 dibagi 2', 'sqrt_confusion'), W('49 dikali 49', 'sqrt_confusion'), W('49 dikurangi 7', 'sqrt_confusion')],
    why: '\u221a49 = 7, karena 7 x 7 = 49.',
  },
  10: {
    text: 'Apa arti dari pecahan 3/4?',
    correct: '3 bagian dari 4 bagian yang sama besar',
    wrong: [W('3 ditambah 4', 'fraction_add_wrong'), W('4 bagian dari 3 bagian', 'fraction_flip'), W('3 dikali 4', 'fraction_mul_wrong')],
    why: 'Angka bawah (penyebut) menunjukkan jumlah bagian, angka atas (pembilang) menunjukkan yang diambil.',
  },
  11: {
    text: 'Apa arti dari 3/4 dari 20?',
    correct: '20 dibagi 4 dulu, lalu dikali 3',
    wrong: [W('20 dikali 4 dulu, lalu dibagi 3', 'invert_fraction'), W('20 dibagi 3 dulu, lalu dikali 4', 'invert_fraction'), W('20 dikurangi 3', 'subtract_instead')],
    why: 'Bagi dengan penyebut dulu (20 : 4 = 5), lalu kali dengan pembilang (5 x 3 = 15).',
  },
  12: {
    text: 'Apa arti menyederhanakan pecahan 12/18?',
    correct: 'membagi atas dan bawah dengan angka yang sama, sampai paling sederhana',
    wrong: [W('mengurangi atas dan bawah dengan angka yang sama', 'subtract_instead_divide'), W('membagi hanya angka atasnya', 'simplify_one_side'), W('membalik atas dan bawah', 'fraction_flip')],
    why: '12/18 dibagi 6 atas dan bawah menjadi 2/3. Nilainya tidak berubah.',
  },
  13: {
    text: 'Apa arti dari 75%?',
    correct: '75 dari 100 bagian',
    wrong: [W('75 dari 1000 bagian', 'percent_off_by_one'), W('75 dibagi 1000', 'percent_off_by_one'), W('75 dikali 100', 'percent_off_by_one')],
    why: 'Persen artinya per seratus. 75% = 75/100 = 0,75.',
  },
  14: {
    text: 'Apa arti dari 25% dari 80?',
    correct: '80 dibagi 4, karena 25% itu seperempat',
    wrong: [W('80 dibagi 25', 'percent_off_by_one'), W('80 dikali 25', 'percent_off_by_one'), W('25 dibagi 80', 'invert_fraction')],
    why: '25% = 1/4. Jadi 80 : 4 = 20.',
  },
  15: {
    text: 'Apa arti dari 0,3?',
    correct: '3 persepuluh, sama dengan 3/10',
    wrong: [W('3 perseratus', 'decimal_place'), W('3 perseribu', 'decimal_place'), W('30 persepuluh', 'decimal_place')],
    why: 'Satu angka di belakang koma berarti persepuluhan. 0,3 = 3/10.',
  },
  16: {
    text: 'Bagaimana cara membulatkan 3,47 ke persepuluhan terdekat?',
    correct: 'lihat angka perseratusnya, kalau 5 atau lebih dibulatkan ke atas',
    wrong: [W('ambil angka depannya saja', 'not_rounded'), W('selalu dibulatkan ke atas', 'round_up_always'), W('buang semua angka di belakang koma', 'wrong_place')],
    why: 'Angka perseratusnya 7, jadi dibulatkan ke atas menjadi 3,5.',
  },
  17: {
    text: 'Apa bedanya faktor dan kelipatan?',
    correct: 'faktor membagi habis suatu bilangan, kelipatan adalah hasil kali bilangan itu',
    wrong: [W('sama saja', 'factor_multiple_confusion'), W('faktor selalu lebih besar dari kelipatan', 'factor_multiple_confusion'), W('kelipatan selalu bilangan prima', 'factor_multiple_confusion')],
    why: 'Faktor dari 12: 1, 2, 3, 4, 6, 12. Kelipatan 12: 12, 24, 36, 48.',
  },
  18: {
    text: 'Apa itu bilangan prima?',
    correct: 'bilangan yang hanya bisa dibagi 1 dan dirinya sendiri',
    wrong: [W('semua bilangan ganjil', 'prime_rule_error'), W('bilangan yang bisa dibagi 2', 'prime_rule_error'), W('bilangan yang punya banyak faktor', 'prime_rule_error')],
    why: 'Contoh prima: 2, 3, 5, 7, 11. Angka 9 bukan prima karena bisa dibagi 3.',
  },
  19: {
    text: 'Bilangan -5 dan -3, mana yang lebih kecil?',
    correct: '-5',
    wrong: [W('-3', 'negative_order_error'), W('sama besar', 'negative_order_error')],
    why: 'Pada bilangan negatif, makin jauh dari nol ke kiri makin kecil. Jadi -5 < -3.',
  },
  20: {
    text: 'Apa arti soal 8 + ? = 15?',
    correct: 'mencari angka yang kalau ditambah 8 hasilnya 15',
    wrong: [W('menjumlahkan 8 dan 15', 'wrong_inverse_op'), W('mengalikan 8 dan 15', 'wrong_inverse_op'), W('mengurangi 15 dari 8', 'wrong_inverse_op')],
    why: 'Cari dengan operasi kebalikannya: 15 - 8 = 7. Cek: 8 + 7 = 15.',
  },
  21: {
    text: 'Apa arti perbandingan 2 : 3?',
    correct: 'setiap 2 bagian pertama ada 3 bagian kedua',
    wrong: [W('2 ditambah 3', 'ratio_add'), W('2 dibagi 3 hasilnya', 'ratio_wrong_op'), W('2 lebih kecil dari 3', 'ratio_wrong_op')],
    why: 'Perbandingan 2 : 3 berarti bagian kedua 1,5 kali bagian pertama. Kalau 4 maka 6.',
  },
  22: {
    text: 'Apa arti 1 km = 1000 m?',
    correct: 'ubah km ke m dengan dikali 1000',
    wrong: [W('ubah km ke m dengan dibagi 1000', 'conversion_wrong'), W('ubah km ke m dengan dikali 100', 'conversion_wrong'), W('ubah km ke m dengan dikali 10', 'conversion_wrong')],
    why: 'Dari satuan besar ke satuan kecil, kalikannya. 3 km = 3000 m.',
  },
  23: {
    text: 'Kalau x = 4, apa arti dari 3x + 2?',
    correct: '3 dikali 4 dulu, lalu ditambah 2',
    wrong: [W('3 ditambah 4 ditambah 2', 'substitution_error'), W('34 ditambah 2', 'digit_concat'), W('3 ditambah 4 dikali 2', 'order_ops')],
    why: '3x artinya 3 kali x. Jadi 3 x 4 = 12, lalu 12 + 2 = 14.',
  },
  24: {
    text: 'Rumus luas persegi panjang adalah panjang x lebar. Apa artinya?',
    correct: 'panjang dikali lebar',
    wrong: [W('panjang ditambah lebar', 'sum_instead_of_product'), W('2 dikali (panjang ditambah lebar)', 'perimeter_confusion'), W('panjang dikali lebar lalu dibagi 2', 'triangle_formula_confusion')],
    why: 'Luas persegi panjang = panjang x lebar. Panjang 5 dan lebar 3 berarti 15.',
  },
};

// ---------------------------------------------------------------- first step variants

const firstStep = {
  6: () => {
    const a = ri(2, 12), b = ri(2, 9), c = ri(2, 9);
    return base(`Pada soal ${a} + ${b} x ${c}, mana yang dikerjakan lebih dulu?`, `${b} x ${c}`, [
      d(`${a} + ${b}`, 'order_ops'),
      d('dari kiri ke kanan', 'order_ops'),
      d('angka yang paling besar', 'order_ops'),
    ], `Kali dikerjakan sebelum tambah. Jadi ${b} x ${c} = ${b * c} dulu, lalu ${a} + ${b * c}.`, 2);
  },
  7: () => {
    const a = ri(2, 12), b = ri(2, 9), c = ri(2, 9);
    return base(`Pada soal (${a} + ${b}) x ${c}, mana yang dikerjakan lebih dulu?`, `${a} + ${b} di dalam kurung`, [
      d(`${a} x ${c}`, 'bracket_ignored'),
      d('dari kiri ke kanan', 'order_ops'),
      d(`${b} x ${c}`, 'bracket_ignored'),
    ], `Isi kurung selalu lebih dulu: ${a} + ${b} = ${a + b}, lalu dikali ${c}.`, 2);
  },
  8: () => {
    const a = ri(3, 12);
    return base(`Untuk menghitung ${a}${SUP[2]}, langkah pertama apa?`, `${a} x ${a}`, [
      d(`${a} x 2`, 'exponent_base_error'),
      d(`${a} + ${a}`, 'exponent_base_error'),
      d(`${a} : 2`, 'exponent_base_error'),
    ], `${a}${SUP[2]} artinya ${a} dikali dirinya sendiri, jadi ${a} x ${a} = ${a * a}.`, 3);
  },
  23: () => {
    const x = ri(2, 9);
    return base(`Kalau x = ${x}, langkah pertama untuk menghitung 3x + 2 apa?`, `ganti x dengan ${x}`, [
      d('kalikan 3 dengan 2', 'order_ops'),
      d('jumlahkan 3 dan 2', 'substitution_error'),
      d('pakai angka 32', 'digit_concat'),
    ], `Ganti dulu x dengan ${x}: 3 x ${x} = ${3 * x}, lalu ${3 * x} + 2 = ${3 * x + 2}.`, 3);
  },
  24: () => {
    const p = ri(4, 15), l = ri(3, 12);
    return base(`Sisi persegi panjang ${p} cm dan ${l} cm. Untuk menghitung luasnya, langkah pertama apa?`, `${p} x ${l}`, [
      d(`${p} + ${l}`, 'sum_instead_of_product'),
      d(`2 x ${p}`, 'perimeter_confusion'),
      d('bagi 2 dulu', 'triangle_formula_confusion'),
    ], `Luas persegi panjang = panjang x lebar = ${p} x ${l} = ${p * l} cm${SUP[2]}.`, 2);
  },
};

// ---------------------------------------------------------------- find the mistake variants

// Each returns three working lines. Exactly one line is wrong.
const mistake = {
  5: () => {
    const a = ri(3, 12), b = ri(1, a - 1);
    return {
      lines: [`-${a} + ${b} = ${a + b}`, `-${a} + ${b} = ${-a + b}`, `${-a + b} + ${a} = ${b}`],
      wrongIndex: 0,
      why: `Tanda minusnya hilang. Dari -${a} maju ${b} langkah ke kanan hasilnya ${-a + b}.`,
      difficulty: 2,
    };
  },
  6: () => {
    const a = ri(2, 12), b = ri(2, 9), c = ri(2, 9);
    return {
      lines: [`${a} + ${b} x ${c} = ${(a + b) * c}`, `${a} + ${b} x ${c} = ${a + b * c}`, `${b} x ${c} = ${b * c}`],
      wrongIndex: 0,
      why: `Dikerjakan dari kiri ke kanan. Kali harus dulu: ${b} x ${c} = ${b * c}, lalu ${a} + ${b * c} = ${a + b * c}.`,
      difficulty: 2,
    };
  },
  7: () => {
    const a = ri(2, 12), b = ri(2, 9), c = ri(2, 9);
    return {
      lines: [`(${a} + ${b}) x ${c} = ${a + b * c}`, `(${a} + ${b}) x ${c} = ${(a + b) * c}`, `${a} + ${b} = ${a + b}`],
      wrongIndex: 0,
      why: `Kurung tidak dikerjakan dulu. ${a} + ${b} = ${a + b}, lalu ${a + b} x ${c} = ${(a + b) * c}.`,
      difficulty: 2,
    };
  },
  8: () => {
    const a = ri(3, 12);
    return {
      lines: [`${a}${SUP[2]} = ${a * 2}`, `${a}${SUP[2]} = ${a * a}`, `${a} x ${a} = ${a * a}`],
      wrongIndex: 0,
      why: `${a}${SUP[2]} artinya ${a} x ${a} = ${a * a}, bukan ${a} x 2.`,
      difficulty: 3,
    };
  },
  10: () => {
    const den = ri(4, 10);
    const x = ri(1, den - 2);
    const y = ri(1, den - x - 1);
    const s = simplify(x + y, den);
    return {
      lines: [`${x}/${den} + ${y}/${den} = ${x + y}/${den + den}`, `${x}/${den} + ${y}/${den} = ${frac(s[0], s[1])}`, `${x} + ${y} = ${x + y}`],
      wrongIndex: 0,
      why: `Penyebut tidak boleh dijumlahkan. Karena penyebutnya sama, hanya angka atasnya yang dijumlahkan: ${x + y}/${den}.`,
      difficulty: 2,
    };
  },
  12: () => {
    const pair = pick([[1, 2], [2, 3], [3, 4], [1, 3], [2, 5], [3, 5]]);
    const k = ri(2, 6);
    const n = pair[0] * k, den = pair[1] * k;
    return {
      lines: [`${n}/${den} = ${pair[0]}/${den}`, `${n}/${den} = ${frac(pair[0], pair[1])}`, `${n} : ${k} = ${pair[0]} dan ${den} : ${k} = ${pair[1]}`],
      wrongIndex: 0,
      why: `Pembilang dan penyebut harus dibagi angka yang sama. Bentuk paling sederhananya ${frac(pair[0], pair[1])}.`,
      difficulty: 3,
    };
  },
  13: () => {
    const den = pick([2, 4, 5, 10, 20, 25]);
    const num = ri(1, den - 1);
    const pct = (num * 100) / den;
    return {
      lines: [`${num}/${den} = ${num}%`, `${num}/${den} = ${pct}%`, `${num} x ${100 / den} = ${pct}`],
      wrongIndex: 0,
      why: `Angka atasnya bukan persennya. Penyebut harus dijadikan 100 dulu, jadi ${pct}%.`,
      difficulty: 2,
    };
  },
  14: () => {
    const p = pick([10, 20, 25, 50]);
    const n = ri(2, 12) * 5;
    const ans = (n * p) / 100;
    return {
      lines: [`${p}% dari ${n} = ${p}`, `${p}% dari ${n} = ${fmt(ans)}`, `${n} : 100 x ${p} = ${fmt(ans)}`],
      wrongIndex: 0,
      why: `${p} bukan jawabannya. ${p}% berarti ${p} per 100, jadi ${fmt(ans)}.`,
      difficulty: 2,
    };
  },
  15: () => {
    const A = ri(11, 99), B = ri(105, 995);
    const ans = (A * 10 + B) / 100;
    return {
      lines: [`${fmt(A / 10)} + ${fmt(B / 100)} = ${fmt((A + B) / 100)}`, `${fmt(A / 10)} + ${fmt(B / 100)} = ${fmt(ans)}`, `${fmt(A / 10)} = ${A}/10 dan ${fmt(B / 100)} = ${B}/100`],
      wrongIndex: 0,
      why: `Komanya tidak disejajarkan. Hasil yang benar ${fmt(ans)}.`,
      difficulty: 3,
    };
  },
  16: () => {
    const w = ri(2, 40), t = ri(1, 9), h = ri(5, 9);
    const x = w + t / 10 + h / 100;
    const up = w + (t + 1) / 10;
    return {
      lines: [`Bulatkan ${fmt(x)} menjadi ${fmt(w + t / 10)}`, `Bulatkan ${fmt(x)} menjadi ${fmt(up)}`, `Angka perseratusnya ${h}, jadi dibulatkan ke atas`],
      wrongIndex: 0,
      why: `Angka perseratusnya ${h}, lima atau lebih, jadi harus dibulatkan ke atas menjadi ${fmt(up)}.`,
      difficulty: 3,
    };
  },
  20: () => {
    const a = ri(2, 9), ans = ri(4, 15), sum = a + ans;
    return {
      lines: [`${a} + ? = ${sum}, jadi ? = ${sum} + ${a} = ${sum + a}`, `${a} + ? = ${sum}, jadi ? = ${sum} - ${a} = ${ans}`, `${a} + ${ans} = ${sum}`],
      wrongIndex: 0,
      why: `Untuk mencari bagian yang hilang dipakai operasi kebalikannya: ${sum} - ${a} = ${ans}.`,
      difficulty: 2,
    };
  },
  22: () => {
    const U = pick([['km', 'm', 1000], ['m', 'cm', 100], ['kg', 'g', 1000], ['jam', 'menit', 60]]);
    const a = ri(2, 12);
    const f = U[2];
    return {
      lines: [`${a} ${U[0]} = ${a * f / 10} ${U[1]}`, `${a} ${U[0]} = ${a * f} ${U[1]}`, `1 ${U[0]} = ${f} ${U[1]}`],
      wrongIndex: 0,
      why: `Salah menghitung angka nol. 1 ${U[0]} = ${f} ${U[1]}, jadi ${a} ${U[0]} = ${a * f} ${U[1]}.`,
      difficulty: 3,
    };
  },
  23: () => {
    const x = ri(2, 9);
    return {
      lines: [`3x + 2 = 3 + ${x} + 2 = ${3 + x + 2}`, `3x + 2 = 3 x ${x} + 2 = ${3 * x + 2}`, `3 x ${x} = ${3 * x}`],
      wrongIndex: 0,
      why: `x diganti angka lalu dikali, bukan ditambah. 3 x ${x} = ${3 * x}.`,
      difficulty: 3,
    };
  },
  24: () => {
    const p = ri(4, 15), l = ri(3, 12);
    return {
      lines: [`Luas = ${p} + ${l} = ${p + l}`, `Luas = ${p} x ${l} = ${p * l}`, `Luas persegi panjang = panjang x lebar`],
      wrongIndex: 0,
      why: `Luas persegi panjang adalah panjang x lebar = ${p * l}. Yang ${p + l} itu kalau menjumlah.`,
      difficulty: 2,
    };
  },
};

// ---------------------------------------------------------------- topic list

export const TOPICS = [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14,
  T15, T16, T17, T18, T19, T20, T21, T22, T23, T24];

for (const t of TOPICS) {
  t.variants = ['meaning'];
  if (firstStep[t.id]) t.variants.push('first_step');
  if (mistake[t.id]) t.variants.push('find_mistake');
}

export const topicById = (id) => TOPICS.find((t) => t.id === id);
export const TOPIC_NAMES = TOPICS.map((t) => t.name);

// ---------------------------------------------------------------- question builder

function uniqueOptions(answer, distractors) {
  const seen = new Set([valueKey(answer)]);
  const out = [];
  for (const dd of distractors) {
    const key = valueKey(dd.value);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(dd);
  }
  return out.length >= 1 ? out.slice(0, 3) : null;   // never more than 4 options in total
}

function finalize(topic, type, text, distractors, answer, explanation, difficulty, extra) {
  const all = shuffle([{ value: String(answer), tag: null }, ...distractors]);
  const correctIndex = all.findIndex((o) => o.tag === null);
  return Object.assign({
    topicId: topic.id,
    topicName: topic.name,
    kind: topic.kind,
    type,
    text,
    options: all.map((o) => o.value),
    tags: all.map((o) => o.tag),
    correctIndex,
    answer: String(answer),
    explanation,
    difficulty: Math.min(3, Math.max(1, difficulty || 2)),
  }, extra || {});
}

function buildFromBase(topic, type, makeBase) {
  for (let i = 0; i < 80; i++) {
    const b = makeBase();
    const distractors = uniqueOptions(b.answer, b.distractors);
    if (!distractors || distractors.length < 1) continue;
    return finalize(topic, type, b.text, distractors, b.answer, b.explanation, b.difficulty);
  }
  throw new Error(`topic ${topic.id} could not build a question with unique options`);
}

export function buildDirect(topic) { return buildFromBase(topic, 'direct', () => topic.gen()); }

export function buildMeaning(topic) {
  const m = MEANING[topic.id];
  if (!m) throw new Error(`no meaning question for topic ${topic.id}`);
  return buildFromBase(topic, 'meaning', () => base(m.text, m.correct, m.wrong.map((w) => d(w[0], w[1])), m.why, 2));
}

export function buildFirstStep(topic) {
  return buildFromBase(topic, 'first_step', () => firstStep[topic.id]());
}

export function buildMistake(topic) {
  const mk = mistake[topic.id];
  if (!mk) throw new Error(`no mistake question for topic ${topic.id}`);
  const m = mk();
  const order = shuffle([0, 1, 2]);
  const lines = order.map((i) => m.lines[i]);
  const wrongPos = order.indexOf(m.wrongIndex);
  const options = lines.map((_, i) => (i === wrongPos ? { value: `Baris ${i + 1}`, tag: null } : { value: `Baris ${i + 1}`, tag: 'wrong_line_pick' }));
  const all = shuffle(options);
  const correctIndex = all.findIndex((o) => o.tag === null);
  return {
    topicId: topic.id,
    topicName: topic.name,
    kind: topic.kind,
    type: 'find_mistake',
    text: 'Perhatikan tiga baris pengerjaan berikut. Baris mana yang salah?',
    lines,
    options: all.map((o) => o.value),
    tags: all.map((o) => o.tag),
    correctIndex,
    answer: `Baris ${wrongPos + 1}`,
    explanation: `Baris ${wrongPos + 1} salah. ${m.why}`,
    difficulty: m.difficulty,
  };
}

// type: 'direct' | 'meaning' | 'first_step' | 'find_mistake' | undefined (random safe pick)
export function makeQuestion(topicOrId, type) {
  const topic = typeof topicOrId === 'object' ? topicOrId : topicById(topicOrId);
  if (!topic) throw new Error(`unknown topic ${topicOrId}`);
  if (type === 'meaning') return buildMeaning(topic);
  if (type === 'first_step') return buildFirstStep(topic);
  if (type === 'find_mistake') return buildMistake(topic);
  if (type) return buildDirect(topic);
  return buildDirect(topic);
}
