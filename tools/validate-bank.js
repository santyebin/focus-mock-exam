#!/usr/bin/env node
/* Structural checks for every question in data/: ids, answer keys, option counts, difficulty, math delimiters. */
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

let bank;
try { bank = GM.CAT.buildBank(GM.BANK); } catch (e) { console.error(e.message); process.exit(1); }

Object.values(bank.items).forEach((it) => {
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
    const open = (t.match(/\\\(/g) || []).length;
    const close = (t.match(/\\\)/g) || []).length;
    if (open !== close) err(id, 'unbalanced \\( \\) math delimiters');
  });
});

// answer-position balance per type (a heavily skewed key is a giveaway)
const pos = {};
Object.values(bank.items).forEach((it) => {
  if (typeof it.ans === 'number') {
    pos[it.type] = pos[it.type] || [0, 0, 0, 0, 0];
    pos[it.type][it.ans]++;
  }
});
console.log('Answer-position counts (A..E):', JSON.stringify(pos));
console.log(`Checked ${Object.keys(bank.items).length} questions in ${bank.units.length} units.`);
if (errors.length) {
  console.error(`\n${errors.length} problem(s):\n` + errors.join('\n'));
  process.exit(1);
}
console.log('No problems found.');
