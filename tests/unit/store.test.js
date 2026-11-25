'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGM } = require('./helpers');

const DAY = 86400000;

test('mistakes move through the 3-7-14-30 day boxes and are mastered after five right in a row', () => {
  const GM = loadGM();
  const S = GM.Store;
  const t0 = Date.UTC(2026, 0, 1);
  S.addMistake('QA01', 'wrong', t0);
  assert.deepEqual(Array.from(S.dueMistakes(t0)), ['QA01']);
  const expect = [3, 7, 14, 30];
  let t = t0;
  expect.forEach((days, i) => {
    const e = S.reviewMistake('QA01', true, t);
    assert.equal(e.box, i + 2);
    assert.equal(e.due, t + days * DAY);
    assert.deepEqual(Array.from(S.dueMistakes(t + days * DAY - 1)), []);
    t = e.due;
  });
  const done = S.reviewMistake('QA01', true, t);
  assert.ok(done.mastered);
  assert.deepEqual(Array.from(S.dueMistakes(t + 1000 * DAY)), []);
});

test('a miss sends a question back to box 1, due tomorrow', () => {
  const GM = loadGM();
  const S = GM.Store;
  S.addMistake('CR01', 'wrong', 0);
  S.reviewMistake('CR01', true, 0);
  const e = S.reviewMistake('CR01', false, 5 * DAY);
  assert.equal(e.box, 1);
  assert.equal(e.due, 6 * DAY);
});

test('finished mocks log missed and very slow questions', () => {
  const GM = loadGM();
  const rec = (id, correct, time) => ({ id: id, response: 0, correct: correct, time: time, reviewTime: 0 });
  GM.Store.logAttemptMistakes({ date: 1, sections: { quant: { timeLimitMs: 45 * 60000, st: { nTotal: 21, records: [rec('QA01', false, 60000), rec('QA02', true, 400000), rec('QA03', true, 60000)] } } } });
  const m = GM.Store.srs();
  assert.equal(m.QA01.reason, 'wrong');
  assert.equal(m.QA02.reason, 'slow');
  assert.equal(m.QA03, undefined);
});
