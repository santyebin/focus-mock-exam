'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGM } = require('./helpers');

const GM = loadGM();
const S = GM.Scoring;

test('total score scale matches the real exam endpoints and equal weighting', () => {
  assert.equal(S.totalScore(60, 60, 60), 205);
  assert.equal(S.totalScore(90, 90, 90), 805);
  assert.equal(S.totalScore(85, 85, 85), 705);
  assert.equal(S.totalScore(80, 80, 80), 605);
  // equal weights: moving a point between sections does not change the total
  assert.equal(S.totalScore(84, 80, 80), S.totalScore(80, 84, 80));
  // totals always end in 5
  for (let q = 60; q <= 90; q += 3) assert.equal(S.totalScore(q, 75, 82) % 10, 5);
});

test('ability maps to section scores monotonically and within 60-90', () => {
  for (const sec of ['quant', 'verbal', 'di']) {
    let prev = 0;
    for (let t = -4; t <= 4; t += 0.1) {
      const s = S.thetaToScore(sec, t);
      assert.ok(s >= 60 && s <= 90, sec + ' score in range');
      assert.ok(s >= prev - 1e-9, sec + ' non-decreasing');
      prev = s;
    }
  }
});

test('median ability lands near the median of each published table', () => {
  assert.ok(Math.abs(S.thetaToScore('quant', 0) - 78.5) < 1);
  assert.ok(Math.abs(S.thetaToScore('verbal', 0) - 79.5) < 1);
});

test('percentile lookups use GMAC tables', () => {
  assert.equal(S.percentile('total', 655), 89.6);
  assert.equal(S.percentile('total', 705), 97.5);
  assert.equal(S.percentile('quant', 90), 100);
  assert.equal(S.percentile('verbal', 80), 54.4);
});

test('unanswered penalty is proportional and guessing beats blanks', () => {
  assert.ok(Math.abs(S.unansweredPenalty(2, 21) - 2.857) < 0.01);
  assert.equal(S.unansweredPenalty(0, 23), 0);
});

test('EAP accepts expected (fractional) responses for what-if estimates', () => {
  const it = { a: 1.2, b: 0.5, c: 0.2 };
  const right = GM.IRT.eap([Object.assign({ u: 1 }, it)]).theta;
  const wrong = GM.IRT.eap([Object.assign({ u: 0 }, it)]).theta;
  const half = GM.IRT.eap([Object.assign({ u: 0.5 }, it)]).theta;
  assert.ok(wrong < half && half < right);
});
