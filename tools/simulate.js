#!/usr/bin/env node
/*
 * Monte-Carlo validation of the adaptive engine and the score scale.
 *   node tools/simulate.js              -> uses the real bank in data/
 *   node tools/simulate.js --synthetic  -> uses a generated bank with the same shape
 * Options: --n=2000 (population size)  --rho=0.55 (between-section ability correlation)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v]; }));
const root = path.join(__dirname, '..');
const ctx = { console, Math, Set, Map, JSON, Object, Array, Error };
ctx.globalThis = ctx;
vm.createContext(ctx);
function load(rel) { vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), ctx, { filename: rel }); }
['src/irt.js', 'src/scoring.js', 'src/cat.js'].forEach(load);
const GM = ctx.GM;

let raw;
if (args.synthetic) {
  raw = synthetic();
} else {
  fs.readdirSync(path.join(root, 'data')).filter((f) => f.endsWith('.js')).sort().forEach((f) => load('data/' + f));
  raw = GM.BANK;
}
const bank = GM.CAT.buildBank(raw);
const rng = GM.CAT.mulberry32(12345);
function randn() { let u = 0, v = 0; while (u === 0) u = rng(); v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

/* ---------- bank summary ---------- */
console.log('\n== Bank ==');
['quant', 'verbal', 'di'].forEach((s) => {
  const items = Object.values(bank.items).filter((i) => i.section === s);
  const byCat = {};
  items.forEach((i) => { byCat[i.cat] = (byCat[i.cat] || 0) + 1; });
  const byD = {};
  items.forEach((i) => { const k = 'd' + (i.d != null ? i.d : '?'); byD[k] = (byD[k] || 0) + 1; });
  console.log(`${s.padEnd(7)} ${String(items.length).padStart(3)} items  ${JSON.stringify(byCat)}  ${JSON.stringify(byD)}`);
});

/* ---------- one simulated section ---------- */
function runSection(section, trueTheta, opts) {
  const st = GM.CAT.createSection(section, { seed: Math.floor(rng() * 2147483647), pretest: opts.pretest, priorSd: opts.priorSd });
  const counts = {};
  let rec;
  while ((rec = GM.CAT.nextQuestion(st, bank, { rng, seen: new Set() }))) {
    const it = bank.items[rec.id];
    counts[it.cat] = (counts[it.cat] || 0) + 1;
    if (opts.stopAt && rec.n > opts.stopAt) break;
    const correct = rng() < GM.IRT.prob(trueTheta, it.irt);
    const resp = correct ? GM.CAT.correctAnswer(it) : wrongAnswer(it);
    GM.CAT.submitAnswer(st, bank, rec, resp);
  }
  return { st, res: GM.CAT.finalize(st, bank), counts };
}

function wrongAnswer(it) {
  const key = GM.CAT.correctAnswer(it);
  if (Array.isArray(key)) { const w = key.slice(); w[0] = key[0] === 0 ? 1 : 0; return w; }
  return key === 0 ? 1 : 0;
}

/* ---------- recovery by true ability ---------- */
const priorSd = Number(args.prior || 1);
console.log(`\n== Recovery (100 runs per ability, pretest=2, prior sd=${priorSd}) ==`);
console.log('section  true θ  true score   mean est  sd    bias(θ)  rmse(θ)  %correct');
['quant', 'verbal', 'di'].forEach((s) => {
  [-2, -1, 0, 1, 1.5, 2, 2.5].forEach((t) => {
    const runs = [];
    for (let k = 0; k < 100; k++) runs.push(runSection(s, t, { pretest: 2, priorSd }));
    const est = runs.map((r) => r.res.score);
    const th = runs.map((r) => r.res.theta);
    const pc = runs.map((r) => r.res.scoredCorrect / r.res.scoredCount);
    const mean = avg(est);
    const sd = Math.sqrt(avg(est.map((x) => (x - mean) ** 2)));
    const bias = avg(th) - t;
    const rmse = Math.sqrt(avg(th.map((x) => (x - t) ** 2)));
    const trueScore = GM.Scoring.thetaToScore(s, t);
    console.log(`${s.padEnd(8)} ${t.toFixed(1).padStart(5)}   ${trueScore.toFixed(1).padStart(6)}     ${mean.toFixed(1).padStart(6)}  ${sd.toFixed(2)}  ${bias.toFixed(2).padStart(6)}   ${rmse.toFixed(2)}     ${(100 * avg(pc)).toFixed(0)}%`);
  });
});

/* ---------- blueprint compliance ---------- */
console.log('\n== Blueprint (type counts over 300 sections each) ==');
['quant', 'verbal', 'di'].forEach((s) => {
  const seen = {};
  for (let k = 0; k < 300; k++) {
    const { counts } = runSection(s, randn(), { pretest: 2, priorSd });
    Object.keys(counts).forEach((c) => { (seen[c] = seen[c] || new Set()).add(counts[c]); });
  }
  console.log(s.padEnd(7), Object.entries(seen).map(([c, v]) => `${c}: ${[...v].sort((a, b) => a - b).join('/')}`).join('  '));
});

/* ---------- population: totals vs official percentiles ---------- */
const N = Number(args.n || 2000);
const rho = Number(args.rho || 0.55);
console.log(`\n== Population of ${N} (section ability correlation ${rho}) ==`);
const totals = [];
const exposure = {};
for (let k = 0; k < N; k++) {
  const z0 = randn();
  const scores = ['quant', 'verbal', 'di'].map((s) => {
    const t = Math.sqrt(rho) * z0 + Math.sqrt(1 - rho) * randn();
    const r = runSection(s, t, { pretest: 2, priorSd });
    r.st.records.forEach((rec) => { exposure[rec.id] = (exposure[rec.id] || 0) + 1; });
    return r.res.score;
  });
  totals.push(GM.Scoring.totalScore(scores[0], scores[1], scores[2]));
}
console.log('total   official %ile   simulated %ile (at or below)');
[355, 405, 455, 505, 555, 605, 655, 705, 755, 805].forEach((t) => {
  const sim = (100 * totals.filter((x) => x <= t).length) / N;
  console.log(`${t}     ${String(GM.Scoring.TABLES.total[t]).padStart(5)}          ${sim.toFixed(1).padStart(5)}`);
});
const ex = Object.entries(exposure).map(([id, c]) => [id, c / N]).sort((a, b) => b[1] - a[1]);
const unused = Object.keys(bank.items).filter((id) => !exposure[id]);
console.log(`\nMost exposed: ${ex.slice(0, 6).map(([id, r]) => `${id} ${(100 * r).toFixed(0)}%`).join(', ')}`);
console.log(`Never delivered in ${N} candidates: ${unused.length} of ${Object.keys(bank.items).length}${unused.length ? ' (' + unused.slice(0, 15).join(', ') + (unused.length > 15 ? ', …' : '') + ')' : ''}`);

/* ---------- scale sanity ---------- */
console.log('\n== Scale checks ==');
console.log('60/60/60 ->', GM.Scoring.totalScore(60, 60, 60), ' 90/90/90 ->', GM.Scoring.totalScore(90, 90, 90), ' 85/85/85 ->', GM.Scoring.totalScore(85, 85, 85), ' 80/80/80 ->', GM.Scoring.totalScore(80, 80, 80));
console.log('Penalty for 2 blanks in Quant:', GM.Scoring.unansweredPenalty(2, 21).toFixed(2), 'points');

function avg(a) { return a.reduce((s, x) => s + x, 0) / a.length; }

/* ---------- synthetic bank with the production shape ---------- */
function synthetic() {
  let n = 0;
  const id = (p) => p + String(++n).padStart(3, '0');
  const dist = [1, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6];
  const d = (i) => dist[i % dist.length];
  const mc = (o) => Object.assign({ ch: ['A', 'B', 'C', 'D', 'E'], ans: 0 }, o);
  const out = { quant: [], cr: [], rc: [], ds: [], tpa: [], ta: [], gi: [], msr: [] };
  for (let i = 0; i < 70; i++) out.quant.push(mc({ id: id('Q'), cat: i % 2 ? 'Algebra' : 'Arithmetic', sub: 's' + (i % 9), d: d(i) }));
  for (let i = 0; i < 30; i++) out.cr.push(mc({ id: id('CR'), sub: 'c' + (i % 7), d: d(i) }));
  for (let p = 0; p < 9; p++) out.rc.push({ id: id('RC'), length: p < 4 ? 'long' : 'short', qs: [0, 1, 2, 3].map((k) => mc({ id: id('RCQ'), sub: 'r' + k, d: d(p + k * 3) })) });
  for (let i = 0; i < 26; i++) out.ds.push(mc({ id: id('DS'), sub: 'd' + (i % 6), d: d(i) }));
  for (let i = 0; i < 9; i++) out.tpa.push({ id: id('TPA'), sub: 't', d: d(i + 2), opts: [1, 2, 3, 4, 5], ans: [0, 1] });
  for (let i = 0; i < 7; i++) out.ta.push({ id: id('TA'), sub: 'ta', d: d(i + 4), st: [{ a: 0 }, { a: 1 }, { a: 0 }] });
  for (let i = 0; i < 8; i++) out.gi.push({ id: id('GI'), sub: 'gi', d: d(i + 5), st: [{ opts: [1, 2, 3, 4], a: 0 }, { opts: [1, 2, 3], a: 1 }] });
  for (let s = 0; s < 3; s++) out.msr.push({ id: id('MSR'), qs: [0, 1, 2].map((k) => (k === 1 ? { id: id('MSRQ'), kind: 'YN', sub: 'm', d: d(s + k + 3), st: [{ a: 0 }, { a: 1 }, { a: 1 }] } : mc({ id: id('MSRQ'), kind: 'MC', sub: 'm', d: d(s + k + 6) }))) });
  return out;
}
