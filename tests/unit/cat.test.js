'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGM, runSection } = require('./helpers');

const GM = loadGM();
const bank = GM.CAT.buildBank(GM.BANK);
const ALLOWED = {
  quant: { Arithmetic: [10, 11], Algebra: [10, 11] },
  verbal: { CR: [9, 10], RC: [13, 14] },
  di: { DS: [6, 7], TPA: [3, 4], GI: [3, 4], TA: [2, 3], MSR: [3] },
};

test('every adaptive section follows the real exam blueprint', () => {
  for (const sec of Object.keys(ALLOWED)) {
    for (let seed = 1; seed <= 40; seed++) {
      const st = runSection(GM, bank, sec, (seed % 7) - 3, { seed });
      assert.equal(st.records.length, GM.SECTIONS[sec].n, sec + ' length');
      const counts = {};
      st.records.forEach((r) => { const it = bank.items[r.id]; const k = sec === 'quant' ? it.cat : it.type; counts[k] = (counts[k] || 0) + 1; });
      Object.entries(ALLOWED[sec]).forEach(([k, ok]) => assert.ok(ok.includes(counts[k] || 0), `${sec} seed ${seed}: ${k}=${counts[k]}`));
      assert.equal(new Set(st.records.map((r) => r.id)).size, st.records.length, 'no repeats');
    }
  }
});

test('reading passages and multi-source sets are delivered together', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const st = runSection(GM, bank, 'verbal', 0.5, { seed });
    const units = st.records.map((r) => r.unitId);
    const seen = new Set();
    units.forEach((u, i) => {
      if (bank.unitsById[u].kind !== 'set') return;
      if (seen.has(u)) assert.equal(units[i - 1], u, 'set questions are consecutive');
      seen.add(u);
    });
  }
});

test('unscored questions are excluded from scoring', () => {
  const st = runSection(GM, bank, 'quant', 1, { seed: 3, pretest: 2 });
  assert.equal(st.records.filter((r) => r.pretest).length, 2);
  const res = GM.CAT.finalize(st, bank);
  assert.equal(res.scoredCount, 19);
});

test('fixed forms deliver the same questions in order', () => {
  const form = GM.FORMS[0];
  const st = runSection(GM, bank, 'di', 0, { fixed: form.sections.di });
  assert.deepEqual(st.records.map((r) => r.id), form.sections.di);
  assert.ok(st.records.every((r) => !r.pretest));
});

test('score band brackets the score and higher ability scores higher', () => {
  const lo = GM.CAT.finalize(runSection(GM, bank, 'quant', -1.5, { seed: 5 }), bank);
  const hi = GM.CAT.finalize(runSection(GM, bank, 'quant', 2, { seed: 5 }), bank);
  for (const r of [lo, hi]) assert.ok(r.lo <= r.display && r.display <= r.hi, 'band contains the score');
  assert.ok(hi.score > lo.score);
});

test('editing an answer changes scoring, not the questions already given', () => {
  const st = runSection(GM, bank, 'quant', 0, { seed: 11 });
  const before = GM.CAT.finalize(st, bank).score;
  const rec = st.records.find((r) => !r.pretest && !r.correct);
  if (!rec) return;
  GM.CAT.editAnswer(st, bank, rec, GM.CAT.correctAnswer(bank.items[rec.id]));
  assert.equal(rec.edits, 1);
  assert.ok(GM.CAT.finalize(st, bank).score > before);
});

test('blank questions cost the published penalty', () => {
  const st = runSection(GM, bank, 'quant', 0.5, { seed: 2 });
  const full = GM.CAT.finalize(st, bank);
  st.records.slice(-3).forEach((r) => { r.response = null; });
  const short = GM.CAT.finalize(st, bank);
  assert.equal(short.unanswered, 3);
  assert.ok(Math.abs(short.penalty - (30 * 3) / 21) < 1e-9);
  assert.ok(short.score < full.score);
});
