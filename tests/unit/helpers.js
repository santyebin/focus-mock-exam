/* Loads the app's engine, data and storage modules into a sandbox with an in-memory localStorage. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', '..');

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  };
}

function loadGM(extra) {
  const ctx = { console, localStorage: memoryStorage(), performance: { now: () => Date.now() }, setTimeout, clearTimeout };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  const load = (rel) => vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), ctx, { filename: rel });
  ['src/irt.js', 'src/scoring.js', 'src/cat.js'].forEach(load);
  fs.readdirSync(path.join(root, 'data')).filter((f) => f.endsWith('.js')).sort().forEach((f) => load('data/' + f));
  ['src/ui.js', 'src/store.js'].concat(extra || []).forEach(load);
  return ctx.GM;
}

/** Run one section end to end with a simulated candidate of ability theta. */
function runSection(GM, bank, section, theta, opts) {
  const rng = GM.CAT.mulberry32((opts && opts.seed) || 7);
  const st = GM.CAT.createSection(section, Object.assign({ seed: (opts && opts.seed) || 7 }, opts || {}));
  let rec;
  while ((rec = GM.CAT.nextQuestion(st, bank, { rng, seen: new Set() }))) {
    const it = bank.items[rec.id];
    const ok = rng() < GM.IRT.prob(theta, it.irt);
    const key = GM.CAT.correctAnswer(it);
    const wrong = Array.isArray(key) ? key.map((x, i) => (i === 0 ? (x === 0 ? 1 : 0) : x)) : key === 0 ? 1 : 0;
    GM.CAT.submitAnswer(st, bank, rec, ok ? key : wrong);
  }
  return st;
}

module.exports = { loadGM, runSection, root };
