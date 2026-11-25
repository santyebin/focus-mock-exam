#!/usr/bin/env node
/*
 * Quality gate for every question in data/. Fails (exit 1) on any problem, so a bad question cannot deploy.
 *  1. Structure: ids, answer keys, option counts, difficulty, explanations, math delimiters
 *  2. Answers: every numeric Problem Solving answer is recomputed independently (tools/answer-checks.js)
 *  3. Real-exam conventions:
 *     - the correct answer must not give itself away by length (verbal-style choices)
 *     - CR arguments and RC passages within real-exam word ranges
 *     - numeric answer choices in ascending order
 *     - answer positions balanced within each question type
 *     - no duplicate or near-duplicate questions
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { console };
ctx.globalThis = ctx;
vm.createContext(ctx);
const load = (rel) => vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), ctx, { filename: rel });
['src/irt.js', 'src/scoring.js', 'src/cat.js'].forEach(load);
fs.readdirSync(path.join(root, 'data')).filter((f) => f.endsWith('.js')).sort().forEach((f) => load('data/' + f));

const GM = ctx.GM;
const errors = [];
const err = (id, msg) => errors.push(`${id}: ${msg}`);
const inRange = (i, n) => Number.isInteger(i) && i >= 0 && i < n;
const strip = (s) => String(s).replace(/<[^>]+>/g, ' ').replace(/\\\(|\\\)/g, '').replace(/\s+/g, ' ').trim();
const words = (s) => strip(s).split(' ').filter(Boolean).length;

let bank;
try { bank = GM.CAT.buildBank(GM.BANK); } catch (e) { console.error(e.message); process.exit(1); }
const items = Object.values(bank.items);

/* ---------------- 1. structure ---------------- */
items.forEach((it) => {
  const id = it.id;
  if (!(it.d >= 1 && it.d <= 6)) err(id, 'difficulty d must be 1..6');
  if (!it.sub) err(id, 'missing sub-topic');
  if (!it.ex) err(id, 'missing explanation');
  const texts = [];
  switch (it.type) {
    case 'PS': case 'CR': case 'RC':
      if (!Array.isArray(it.ch) || it.ch.length !== 5) err(id, 'needs exactly 5 choices');
      if (!inRange(it.ans, 5)) err(id, 'answer index out of range');
      texts.push(it.stem || it.stim || '', it.q || '', ...(it.ch || []));
      if (new Set(it.ch).size !== it.ch.length) err(id, 'duplicate choices');
      break;
    case 'DS':
      if (!it.s1 || !it.s2) err(id, 'needs s1 and s2');
      if (!inRange(it.ans, 5)) err(id, 'DS answer must be 0..4');
      texts.push(it.stem, it.s1, it.s2);
      break;
    case 'TPA':
      if (!Array.isArray(it.cols) || it.cols.length !== 2) err(id, 'needs 2 columns');
      if (!Array.isArray(it.ans) || it.ans.length !== 2 || !it.ans.every((a) => inRange(a, it.opts.length))) err(id, 'bad answer pair');
      texts.push(it.stem, ...it.opts);
      break;
    case 'TA':
      if (!it.rows.every((r) => r.length === it.cols.length)) err(id, 'row length differs from column count');
      if (it.st.length !== 3) err(id, 'needs 3 statements');
      if (!it.st.every((s) => inRange(s.a, it.labels.length))) err(id, 'bad statement answer');
      texts.push(...it.st.map((s) => s.t));
      break;
    case 'GI':
      it.st.forEach((s, i) => {
        if ((s.t.match(/\[\[\]\]/g) || []).length !== 1) err(id, `statement ${i + 1} needs exactly one [[]]`);
        if (!inRange(s.a, s.opts.length)) err(id, `statement ${i + 1} answer out of range`);
      });
      if (!it.chart || !it.chart.kind) err(id, 'missing chart');
      break;
    case 'MSR':
      if (it.kind === 'YN') {
        if (!it.st.every((s) => inRange(s.a, it.labels.length))) err(id, 'bad YN answer');
        texts.push(...it.st.map((s) => s.t));
      } else {
        if (it.ch.length !== 5 || !inRange(it.ans, 5)) err(id, 'MC needs 5 choices and a valid answer');
        texts.push(it.q, ...it.ch);
      }
      break;
    default:
      err(id, 'unknown type ' + it.type);
  }
  texts.forEach((t) => {
    if ((t.match(/\\\(/g) || []).length !== (t.match(/\\\)/g) || []).length) err(id, 'unbalanced \\( \\) math delimiters');
  });
});

/* ---------------- 2. recomputed Problem Solving answers ---------------- */
function group(t, i) {
  let depth = 0;
  for (let j = i; j < t.length; j++) {
    if (t[j] === '{') depth++;
    else if (t[j] === '}') { depth--; if (depth === 0) return [t.slice(i + 1, j), j + 1]; }
  }
  return null;
}
function term(t) {
  for (const cmd of ['\\frac', '\\sqrt']) {
    if (!t.startsWith(cmd + '{')) continue;
    const g1 = group(t, cmd.length);
    if (!g1) return null;
    if (cmd === '\\sqrt') { if (g1[1] !== t.length) return null; const a = expr(g1[0]); return a == null ? null : Math.sqrt(a); }
    const g2 = t[g1[1]] === '{' ? group(t, g1[1]) : null;
    if (!g2 || g2[1] !== t.length) return null;
    const a = expr(g1[0]), b = expr(g2[0]);
    return a == null || b == null ? null : a / b;
  }
  return null;
}
function expr(t) {
  if (/^-?\d+(\.\d+)?$/.test(t)) return parseFloat(t);
  let sign = 1;
  if (t.startsWith('-')) { sign = -1; t = t.slice(1); }
  const m = /^(\d+)(\\.+)$/.exec(t);
  if (m) {
    const rest = term(m[2]);
    if (rest == null) return null;
    return sign * (m[2].startsWith('\\frac') ? +m[1] + rest : +m[1] * rest); // mixed number or coefficient
  }
  const v = term(t);
  return v == null ? null : sign * v;
}
function choiceValue(s) {
  let t = String(s).replace(/<[^>]+>/g, '').replace(/\\\(|\\\)/g, '').replace(/\\[dt]frac/g, '\\frac').replace(/[\s$,]/g, '').replace(/−/g, '-');
  if (t.endsWith('%')) t = t.slice(0, -1);
  return expr(t);
}
const base = require('./answer-checks.js');
// answer checks for questions in data/ext-*.js live in their own file so two people can add questions at once
const ext = fs.existsSync(path.join(__dirname, 'answer-checks-ext.js')) ? require('./answer-checks-ext.js') : { CHECKS: {}, NOT_NUMERIC: [] };
const CHECKS = Object.assign({}, base.CHECKS, ext.CHECKS);
const NOT_NUMERIC = base.NOT_NUMERIC.concat(ext.NOT_NUMERIC || []);
const helpers = {
  C: (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return Math.round(r); },
  fact: (n) => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; },
  modpow: (b, e, m) => { let r = 1, x = b % m; for (let i = 0; i < e; i++) r = (r * x) % m; return r; },
  range: (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i),
};
const close = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));
let verified = 0;
items.filter((it) => it.type === 'PS').forEach((it) => {
  if (NOT_NUMERIC.includes(it.id)) return;
  const values = it.ch.map(choiceValue);
  if (values.every((v) => v != null) && values.some((v, j) => j > 0 && v < values[j - 1])) err(it.id, 'numeric answer choices are not in ascending order');
  const src = CHECKS[it.id];
  if (!src) { err(it.id, 'no independent answer check in tools/answer-checks.js (add one, or list it in NOT_NUMERIC)'); return; }
  let got;
  try { got = Function(...Object.keys(helpers), '"use strict"; return (' + src + ');')(...Object.values(helpers)); } catch (e) { err(it.id, 'answer check threw: ' + e.message); return; }
  if (typeof got === 'function') {
    const hits = values.map((v, j) => (v != null && got(v) ? j : -1)).filter((j) => j >= 0);
    if (hits.length !== 1 || hits[0] !== it.ans) err(it.id, `answer check selects choice(s) [${hits.join(', ')}], key is ${it.ans}`);
  } else if (values[it.ans] == null) {
    err(it.id, 'keyed choice is not a number the checker can read');
  } else if (typeof got !== 'number' || !close(values[it.ans], got)) {
    err(it.id, `answer check computes ${got}, keyed choice is ${values[it.ans]}`);
  } else if (values.some((v, j) => j !== it.ans && v != null && close(v, got))) {
    err(it.id, 'another choice has the same value as the correct answer');
  }
  verified++;
});

/* ---------------- 3. real-exam conventions ---------------- */
// 3a. Correct answer must not be identifiable by length (choices that are sentences or phrases).
// The real exam's correct answer is the longest choice about 20% of the time; "never longest" is as much a giveaway as "always longest".
const LONGEST_MIN = 0.1, LONGEST_MAX = 0.3, SHORTEST_MAX = 0.35, OUTLIER = 1.5;
const lengthStats = {};
['CR', 'RC', 'MSR'].forEach((type) => {
  const mc = items.filter((i) => i.type === type && Array.isArray(i.ch) && typeof i.ans === 'number' && i.ch.every((c) => words(c) >= 4));
  let longest = 0, shortest = 0;
  mc.forEach((i) => {
    const L = i.ch.map((c) => strip(c).length);
    const k = L[i.ans];
    const others = L.filter((_, j) => j !== i.ans);
    if (others.every((x) => x < k)) longest++;
    if (others.every((x) => x > k)) shortest++;
    const mean = others.reduce((a, b) => a + b, 0) / others.length;
    if (k > OUTLIER * mean) err(i.id, `correct answer is ${(k / mean).toFixed(2)}× the average wrong-answer length (limit ${OUTLIER}×)`);
  });
  lengthStats[type] = { n: mc.length, longest, shortest };
  if (mc.length >= 10) {
    if (longest / mc.length > LONGEST_MAX) err(type, `correct answer is the longest choice in ${longest}/${mc.length} questions (limit ${LONGEST_MAX * 100}%)`);
    if (mc.length >= 20 && longest / mc.length < LONGEST_MIN) err(type, `correct answer is the longest choice in only ${longest}/${mc.length} questions (at least ${LONGEST_MIN * 100}%; never-longest is itself a giveaway)`);
    if (shortest / mc.length > SHORTEST_MAX) err(type, `correct answer is the shortest choice in ${shortest}/${mc.length} questions (limit ${SHORTEST_MAX * 100}%)`);
  }
});

// 3b. Word ranges observed on the real exam.
items.filter((i) => i.type === 'CR').forEach((i) => {
  const w = words(i.stim);
  if (w < 45 || w > 140) err(i.id, `argument is ${w} words (real CR arguments run about 45-140)`);
});
bank.units.filter((u) => u.cat === 'RC').forEach((u) => {
  const w = words(u.passage.passage);
  const [lo, hi] = u.length === 'long' ? [300, 460] : [200, 320];
  if (w < lo || w > hi) err(u.uid, `${u.length} passage is ${w} words (expected ${lo}-${hi})`);
});

// 3c. Answer positions balanced within each single-answer type.
const positions = {};
items.forEach((i) => {
  if (typeof i.ans !== 'number') return;
  (positions[i.type] = positions[i.type] || [0, 0, 0, 0, 0])[i.ans]++;
});
Object.entries(positions).forEach(([type, counts]) => {
  const n = counts.reduce((a, b) => a + b, 0);
  if (n < 20) return;
  counts.forEach((c, j) => {
    if (c / n < 0.08 || c / n > 0.35) err(type, `answer position ${'ABCDE'[j]} is used for ${c}/${n} questions (keep each between 8% and 35%)`);
  });
});

// 3d. Duplicate or near-duplicate questions (word-trigram overlap within a type).
const grams = (s) => { const w = strip(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean); const g = new Set(); for (let k = 0; k + 2 < w.length; k++) g.add(w[k] + ' ' + w[k + 1] + ' ' + w[k + 2]); return g; };
const textOf = (i) => (i.stem || '') + ' ' + (i.stim || '') + ' ' + (i.q || '') + ' ' + (i.s1 || '') + ' ' + (i.s2 || '') + ' ' + (i.intro || '');
const byType = {};
items.forEach((i) => { if (i.type !== 'RC' && i.type !== 'MSR') (byType[i.type] = byType[i.type] || []).push([i.id, grams(textOf(i))]); });
Object.values(byType).forEach((list) => {
  for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
    const A = list[a][1], B = list[b][1];
    if (A.size < 6 || B.size < 6) continue;
    let inter = 0;
    A.forEach((g) => { if (B.has(g)) inter++; });
    const jac = inter / (A.size + B.size - inter);
    if (jac > 0.6) err(list[a][0], `near-duplicate of ${list[b][0]} (overlap ${(jac * 100).toFixed(0)}%)`);
  }
});

// 3e. Every data file is loaded by the app and the editor (a file that is not listed silently drops its questions).
['index.html', 'editor.html'].forEach((page) => {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  fs.readdirSync(path.join(root, 'data')).filter((f) => f.endsWith('.js')).forEach((f) => {
    if (page === 'editor.html' && f === 'forms.js') return;
    if (!html.includes('src="data/' + f + '"')) err(page, 'does not load data/' + f);
  });
});

// 3f. Fixed mock forms: every question exists, each section has the real exam's length, no repeats within a form.
(GM.FORMS || []).forEach((form) => {
  const all = [];
  ['quant', 'verbal', 'di'].forEach((key) => {
    const ids = (form.sections || {})[key] || [];
    if (ids.length !== GM.SECTIONS[key].n) err(form.id, `${key} has ${ids.length} questions (needs ${GM.SECTIONS[key].n}); run node tools/make-forms.js`);
    ids.forEach((id) => {
      if (!bank.items[id]) err(form.id, `uses ${id}, which is not in the bank; run node tools/make-forms.js`);
      else if (bank.items[id].section !== key) err(form.id, `puts ${id} in the ${key} section`);
      all.push(id);
    });
  });
  if (new Set(all).size !== all.length) err(form.id, 'repeats a question');
});

// 3g. Sets must be big enough for the engine's slots (reading slots take 3 or 4 questions, multi-source slots 3);
// a smaller set would leave the section short of its real-exam length.
bank.units.forEach((u) => {
  if (u.cat === 'RC' && u.items.length < 4) err(u.uid, `passage has ${u.items.length} questions (needs at least 4)`);
  if (u.cat === 'MSR' && u.items.length < 3) err(u.uid, `multi-source set has ${u.items.length} questions (needs at least 3)`);
});

/* ---------------- report ---------------- */
console.log('Answer positions (A..E):', JSON.stringify(positions));
console.log('Correct answer is longest / shortest choice:', Object.entries(lengthStats).map(([t, s]) => `${t} ${s.longest}/${s.n} longest, ${s.shortest}/${s.n} shortest`).join('; '));
const crw = items.filter((i) => i.type === 'CR').map((i) => words(i.stim)).sort((a, b) => a - b);
const rcw = bank.units.filter((u) => u.cat === 'RC').map((u) => words(u.passage.passage)).sort((a, b) => a - b);
console.log(`CR argument words: median ${crw[crw.length >> 1]} (min ${crw[0]}, max ${crw[crw.length - 1]}); RC passage words: median ${rcw[rcw.length >> 1]} (min ${rcw[0]}, max ${rcw[rcw.length - 1]})`);
console.log(`Problem Solving answers recomputed independently: ${verified}; non-numeric (human review only): ${NOT_NUMERIC.length}`);
console.log(`Checked ${items.length} questions in ${bank.units.length} units.`);
if (errors.length) {
  console.error(`\n${errors.length} problem(s):\n` + errors.join('\n'));
  process.exit(1);
}
console.log('Quality gate passed.');
