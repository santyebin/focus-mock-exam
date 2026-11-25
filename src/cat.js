/* Question bank normalisation, section blueprints, adaptive selection (CAT) and section scoring. */
(function (root) {
  'use strict';
  const GM = (root.GM = root.GM || {});

  const SECTIONS = {
    quant: { key: 'quant', name: 'Quantitative Reasoning', short: 'Quant', n: 21, minutes: 45, calculator: false },
    verbal: { key: 'verbal', name: 'Verbal Reasoning', short: 'Verbal', n: 23, minutes: 45, calculator: false },
    di: { key: 'di', name: 'Data Insights', short: 'Data Insights', n: 20, minutes: 45, calculator: true },
  };

  const TYPE_NAMES = {
    PS: 'Problem Solving', CR: 'Critical Reasoning', RC: 'Reading Comprehension', DS: 'Data Sufficiency',
    TPA: 'Two-Part Analysis', TA: 'Table Analysis', GI: 'Graphics Interpretation', MSR: 'Multi-Source Reasoning',
  };

  const SUBTOPIC_CAP = 3;

  /*
   * Question selection runs slightly ahead of the score estimate (SPEC.md §4). With the score prior alone, the
   * estimate trails strong candidates for most of a 21-23 question section, so they were served questions below
   * their level and answered ~80% correctly instead of the intended 55-65%.
   */
  const SEL_PRIOR_SD = 2; // wider prior for the selection estimate, so it moves faster than the score estimate
  const TARGET_SHIFT = 0.25; // aim each question a little above the selection estimate (tuned with tools/simulate.js)
  const PRETEST_BAND = 0.9; // unscored questions come from about one difficulty level either side of the target

  /* ---------- deterministic helpers ---------- */
  function hash01(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967295;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  function maxRun(arr) {
    let best = arr.length ? 1 : 0, run = 1;
    for (let i = 1; i < arr.length; i++) {
      run = arr[i] === arr[i - 1] ? run + 1 : 1;
      if (run > best) best = run;
    }
    return best;
  }

  function shuffleLimited(arr, rng, limit) {
    for (let t = 0; t < 400; t++) {
      shuffle(arr, rng);
      if (maxRun(arr) <= limit) return arr;
    }
    return arr;
  }

  /* ---------- item parameters ---------- */
  function guessFloor(item) {
    switch (item.type) {
      case 'TPA': return 1 / (item.opts.length * item.opts.length);
      case 'TA': return Math.pow(0.5, item.st.length);
      case 'GI': return item.st.reduce((acc, s) => acc / s.opts.length, 1);
      case 'MSR': return item.kind === 'YN' ? Math.pow(0.5, item.st.length) : 0.2;
      default: return 0.2;
    }
  }

  function irtParams(item) {
    const d = item.d != null ? item.d : 3;
    const b = item.b != null ? item.b : 0.75 * (d - 3) + (hash01(item.id + '|b') - 0.5) * 0.4;
    const a = item.a != null ? item.a : 0.9 + hash01(item.id + '|a') * 0.5;
    const c = item.c != null ? item.c : guessFloor(item);
    return { a: a, b: b, c: c };
  }

  /* ---------- bank ---------- */
  function buildBank(raw) {
    const units = [];
    const items = {};
    const unitsById = {};
    function addUnit(u) {
      units.push(u);
      unitsById[u.uid] = u;
      u.items.forEach((it) => {
        it.unitId = u.uid;
        it.section = u.section;
        it.irt = irtParams(it);
        if (items[it.id]) throw new Error('Duplicate question id ' + it.id);
        items[it.id] = it;
      });
    }
    (raw.quant || []).forEach((q) => addUnit({ uid: q.id, section: 'quant', kind: 'single', cat: q.cat, items: [Object.assign({ type: 'PS' }, q)] }));
    (raw.cr || []).forEach((q) => addUnit({ uid: q.id, section: 'verbal', kind: 'single', cat: 'CR', items: [Object.assign({ type: 'CR', cat: 'CR' }, q)] }));
    (raw.rc || []).forEach((p) =>
      addUnit({
        uid: p.id, section: 'verbal', kind: 'set', cat: 'RC', length: p.length || 'short', passage: p,
        items: p.qs.map((q) => Object.assign({ type: 'RC', cat: 'RC', passageId: p.id }, q)),
      })
    );
    (raw.ds || []).forEach((q) => addUnit({ uid: q.id, section: 'di', kind: 'single', cat: 'DS', items: [Object.assign({ type: 'DS', cat: 'DS' }, q)] }));
    (raw.tpa || []).forEach((q) => addUnit({ uid: q.id, section: 'di', kind: 'single', cat: 'TPA', items: [Object.assign({ type: 'TPA', cat: 'TPA' }, q)] }));
    (raw.ta || []).forEach((q) => addUnit({ uid: q.id, section: 'di', kind: 'single', cat: 'TA', items: [Object.assign({ type: 'TA', cat: 'TA' }, q)] }));
    (raw.gi || []).forEach((q) => addUnit({ uid: q.id, section: 'di', kind: 'single', cat: 'GI', items: [Object.assign({ type: 'GI', cat: 'GI' }, q)] }));
    (raw.msr || []).forEach((s) =>
      addUnit({
        uid: s.id, section: 'di', kind: 'set', cat: 'MSR', set: s,
        items: s.qs.map((q) => Object.assign({ type: 'MSR', cat: 'MSR', setId: s.id }, q)),
      })
    );
    return { units: units, items: items, unitsById: unitsById };
  }

  /* ---------- grading ---------- */
  function isAnswered(item, resp) {
    if (resp == null) return false;
    if (Array.isArray(resp)) return resp.every((x) => x != null) && resp.length === expectedParts(item);
    return true;
  }

  function expectedParts(item) {
    switch (item.type) {
      case 'TPA': return 2;
      case 'TA': case 'GI': return item.st.length;
      case 'MSR': return item.kind === 'YN' ? item.st.length : 1;
      default: return 1;
    }
  }

  function correctAnswer(item) {
    switch (item.type) {
      case 'TPA': return item.ans.slice();
      case 'TA': case 'GI': return item.st.map((s) => s.a);
      case 'MSR': return item.kind === 'YN' ? item.st.map((s) => s.a) : item.ans;
      default: return item.ans;
    }
  }

  function grade(item, resp) {
    if (!isAnswered(item, resp)) return false;
    const key = correctAnswer(item);
    if (Array.isArray(key)) return key.every((k, i) => k === resp[i]); // all parts must be right
    return resp === key;
  }

  /* ---------- blueprint / plan ---------- */
  const DI_VARIANTS = [
    { DS: 7, TPA: 4, GI: 3, TA: 3 },
    { DS: 7, TPA: 3, GI: 4, TA: 3 },
    { DS: 6, TPA: 4, GI: 4, TA: 3 },
    { DS: 7, TPA: 4, GI: 4, TA: 2 },
  ];

  function buildPlan(section, rng, pretestCount) {
    const slots = [];
    if (section === 'quant') {
      const nA = rng() < 0.5 ? 10 : 11;
      const cats = [];
      for (let i = 0; i < 21; i++) cats.push(i < nA ? 'Arithmetic' : 'Algebra');
      shuffleLimited(cats, rng, 3).forEach((c) => slots.push({ kind: 'single', cat: c }));
    } else if (section === 'verbal') {
      const sizes = shuffle(rng() < 0.5 ? [4, 3, 3, 3] : [4, 4, 3, 3], rng);
      const nCR = 23 - sizes.reduce((s, x) => s + x, 0);
      const gaps = shuffle(Array.from({ length: nCR + 1 }, (_, i) => i), rng).slice(0, sizes.length).sort((a, b) => a - b);
      let gi = 0;
      for (let g = 0; g <= nCR; g++) {
        if (gi < gaps.length && gaps[gi] === g) slots.push({ kind: 'set', cat: 'RC', size: sizes[gi++] });
        if (g < nCR) slots.push({ kind: 'single', cat: 'CR' });
      }
    } else {
      const v = DI_VARIANTS[Math.floor(rng() * DI_VARIANTS.length)];
      const singles = [];
      Object.keys(v).forEach((k) => { for (let i = 0; i < v[k]; i++) singles.push(k); });
      shuffleLimited(singles, rng, 2);
      const pos = 1 + Math.floor(rng() * singles.length);
      singles.forEach((c, i) => {
        if (i === pos) slots.push({ kind: 'set', cat: 'MSR', size: 3 });
        slots.push({ kind: 'single', cat: c });
      });
      if (pos >= singles.length) slots.push({ kind: 'set', cat: 'MSR', size: 3 });
    }
    // mark unscored pretest slots: single slots from the 3rd question on, never the last question
    const n = SECTIONS[section].n;
    let q = 0;
    const eligible = [];
    slots.forEach((s, i) => {
      s.pretest = false;
      if (s.kind === 'single' && q >= 2 && q <= n - 2) eligible.push(i);
      q += s.kind === 'set' ? s.size : 1;
    });
    shuffle(eligible, rng).slice(0, pretestCount || 0).forEach((i) => (slots[i].pretest = true));
    return slots;
  }

  /* ---------- section state ---------- */
  function createSection(section, opts) {
    const o = opts || {};
    const seed = o.seed != null ? o.seed : Math.floor(Math.random() * 2147483647);
    const rng = mulberry32(seed);
    const fixed = Array.isArray(o.fixed) ? o.fixed.slice() : null; // fixed form: the same questions, in order, for everyone
    return {
      section: section,
      seed: seed,
      fixed: fixed,
      nTotal: fixed ? fixed.length : SECTIONS[section].n,
      plan: fixed ? [] : buildPlan(section, rng, o.pretest == null ? 2 : o.pretest),
      slot: 0,
      set: null,
      usedUnits: [],
      subCount: {},
      records: [],
      theta: 0,
      se: 1,
      priorSd: o.priorSd || 1,
      thetaSel: 0,
      selPriorSd: o.selPriorSd || SEL_PRIOR_SD,
      targetShift: o.targetShift != null ? o.targetShift : TARGET_SHIFT,
    };
  }

  /** Ability the next question is aimed at. Sections saved before thetaSel existed fall back to theta. */
  function target(st) {
    const sel = st.thetaSel != null ? st.thetaSel : st.theta;
    return sel + (st.targetShift != null ? st.targetShift : TARGET_SHIFT);
  }

  function scoredResponses(st, bank, useFirst) {
    const out = [];
    st.records.forEach((r) => {
      if (r.pretest) return;
      const resp = useFirst ? r.firstResponse : r.response;
      if (resp == null) return;
      const it = bank.items[r.id];
      out.push({ a: it.irt.a, b: it.irt.b, c: it.irt.c, u: grade(it, resp) ? 1 : 0 });
    });
    return out;
  }

  function rankByInfo(units, theta, scoreFn) {
    return units.map((u) => ({ u: u, s: scoreFn(u, theta) })).sort((x, y) => y.s - x.s);
  }

  function pickTop(ranked, k, rng) {
    if (!ranked.length) return null;
    const top = ranked.slice(0, Math.min(k, ranked.length));
    return top[Math.floor(rng() * top.length)].u;
  }

  function unitSeen(u, seen) {
    return u.items.some((it) => seen.has(it.id));
  }

  function candidates(st, bank, kind, cat, seen) {
    const used = new Set(st.usedUnits);
    let all = bank.units.filter((u) => u.section === st.section && u.kind === kind && u.cat === cat && !used.has(u.uid));
    if (kind === 'set') all = all.filter((u) => u.items.length >= 1);
    const fresh = all.filter((u) => !unitSeen(u, seen));
    const minFresh = kind === 'set' ? 2 : 3;
    return fresh.length >= minFresh ? fresh : all;
  }

  function singleScore(u, theta) {
    return GM.IRT.info(theta, u.items[0].irt);
  }

  function pickSingle(st, bank, slot, ctx) {
    let pool = candidates(st, bank, 'single', slot.cat, ctx.seen);
    if (!pool.length) {
      // bank exhausted for this type: fall back to any single item of the section
      const used = new Set(st.usedUnits);
      pool = bank.units.filter((u) => u.section === st.section && u.kind === 'single' && !used.has(u.uid));
    }
    if (!pool.length) return null;
    const capped = pool.filter((u) => (st.subCount[u.items[0].sub] || 0) < SUBTOPIC_CAP);
    if (capped.length) pool = capped;
    const t = target(st);
    if (slot.pretest) {
      // Random, not adaptive, but near the candidate's level so an unscored question never stands out.
      const near = pool.filter((u) => Math.abs(u.items[0].irt.b - t) <= PRETEST_BAND);
      const from = near.length >= 3 ? near : pool;
      return from[Math.floor(ctx.rng() * from.length)];
    }
    // Wider random choice for the first questions, when the ability estimate is still rough
    // and everyone starts from the same point (keeps opening questions from being over-exposed).
    const k = st.records.length < 3 ? 6 : ctx.topK || 3;
    return pickTop(rankByInfo(pool, t, singleScore), k, ctx.rng);
  }

  function pickSet(st, bank, slot, ctx) {
    const pool = candidates(st, bank, 'set', slot.cat, ctx.seen);
    if (!pool.length) return null;
    const scoreFn = function (u, theta) {
      const infos = u.items.map((it) => GM.IRT.info(theta, it.irt)).sort((a, b) => b - a).slice(0, slot.size);
      let s = infos.reduce((acc, x) => acc + x, 0) / infos.length;
      if (u.cat === 'RC') {
        const wantLong = slot.size >= 4;
        if ((u.length === 'long') === wantLong) s *= 1.15;
      }
      return s;
    };
    return pickTop(rankByInfo(pool, target(st), scoreFn), 3, ctx.rng);
  }

  function pickInSet(st, bank) {
    const u = bank.unitsById[st.set.uid];
    const left = u.items.filter((it) => st.set.given.indexOf(it.id) < 0);
    if (!left.length) return null;
    const t = target(st);
    let best = left[0], bestI = -1;
    left.forEach((it) => {
      const I = GM.IRT.info(t, it.irt);
      if (I > bestI) { bestI = I; best = it; }
    });
    return best;
  }

  /** Select and register the next question. Returns the new record, or null if the section is complete. */
  function nextQuestion(st, bank, context) {
    const ctx = Object.assign({ rng: Math.random, seen: new Set(), topK: 3 }, context || {});
    if (st.records.length >= st.nTotal) return null;
    if (st.fixed) return registerRecord(st, bank.items[st.fixed[st.records.length]], false);
    let item = null;
    let pretest = false;
    let guard = 0;
    while (!item && guard++ < 50) {
      if (st.set) {
        item = pickInSet(st, bank);
        if (!item) { st.set = null; st.slot++; continue; }
        break;
      }
      const slot = st.plan[st.slot];
      if (!slot) return null;
      if (slot.kind === 'set') {
        const unit = pickSet(st, bank, slot, ctx);
        if (!unit) {
          // no passage/set left: replace this slot with single questions of the section's other type
          const fallback = slot.cat === 'RC' ? 'CR' : 'DS';
          const repl = [];
          for (let i = 0; i < slot.size; i++) repl.push({ kind: 'single', cat: fallback, pretest: false });
          st.plan.splice.apply(st.plan, [st.slot, 1].concat(repl));
          continue;
        }
        st.usedUnits.push(unit.uid);
        st.set = { uid: unit.uid, size: Math.min(slot.size, unit.items.length), given: [] };
        continue;
      }
      const unit = pickSingle(st, bank, slot, ctx);
      if (!unit) return null;
      st.usedUnits.push(unit.uid);
      item = unit.items[0];
      pretest = !!slot.pretest;
      st.slot++;
    }
    if (!item) return null;
    if (st.set) {
      st.set.given.push(item.id);
      if (st.set.given.length >= st.set.size) {
        st.set = null;
        st.slot++;
      }
    }
    return registerRecord(st, item, pretest);
  }

  function registerRecord(st, item, pretest) {
    if (!item) return null;
    st.subCount[item.sub] = (st.subCount[item.sub] || 0) + 1;
    const rec = {
      n: st.records.length + 1,
      id: item.id,
      unitId: item.unitId,
      type: item.type,
      pretest: pretest,
      thetaBefore: st.theta,
      firstResponse: null,
      response: null,
      correct: null,
      thetaAfter: null,
      seAfter: null,
      time: 0,
      reviewTime: 0,
      bookmarked: false,
      edits: 0,
    };
    st.records.push(rec);
    return rec;
  }

  /** Section score with a ±1 standard-error band, on the 60-90 scale. */
  function scoreBand(section, theta, se) {
    return {
      lo: Math.round(GM.Scoring.thetaToScore(section, theta - se)),
      hi: Math.round(GM.Scoring.thetaToScore(section, theta + se)),
    };
  }

  /** Record the first (confirmed) answer to a question and update the ability estimate. */
  function submitAnswer(st, bank, rec, response) {
    const it = bank.items[rec.id];
    rec.firstResponse = clone(response);
    rec.response = clone(response);
    rec.correct = grade(it, response);
    if (!rec.pretest) {
      const responses = scoredResponses(st, bank, true);
      const est = GM.IRT.eap(responses, st.priorSd);
      st.theta = est.theta;
      st.se = est.se;
      st.thetaSel = GM.IRT.eap(responses, st.selPriorSd || SEL_PRIOR_SD).theta;
    }
    rec.thetaAfter = st.theta;
    rec.seAfter = st.se;
  }

  /** Change an answer during Review & Edit (adaptivity has already happened; only scoring changes). */
  function editAnswer(st, bank, rec, response) {
    const it = bank.items[rec.id];
    rec.response = clone(response);
    rec.correct = grade(it, response);
    rec.edits += 1;
  }

  /** Final section result from the final answers (after edits), including the unanswered penalty. */
  function finalize(st, bank) {
    const est = GM.IRT.eap(scoredResponses(st, bank, false), st.priorSd);
    const answered = st.records.filter((r) => r.response != null).length;
    const unanswered = st.nTotal - answered;
    const base = GM.Scoring.thetaToScore(st.section, est.theta);
    const penalty = GM.Scoring.unansweredPenalty(unanswered, st.nTotal);
    const score = Math.max(60, base - penalty);
    const display = Math.round(score);
    const scored = st.records.filter((r) => !r.pretest && r.response != null);
    const band = scoreBand(st.section, est.theta, est.se);
    return {
      section: st.section,
      theta: est.theta,
      se: est.se,
      base: base,
      penalty: penalty,
      unanswered: unanswered,
      score: score,
      display: display,
      lo: Math.max(60, Math.round(band.lo - penalty)),
      hi: Math.max(60, Math.round(band.hi - penalty)),
      percentile: GM.Scoring.percentile(st.section, display),
      scoredCount: scored.length,
      scoredCorrect: scored.filter((r) => r.correct).length,
    };
  }

  function clone(x) {
    return Array.isArray(x) ? x.slice() : x;
  }

  GM.SECTIONS = SECTIONS;
  GM.TYPE_NAMES = TYPE_NAMES;
  GM.CAT = {
    buildBank, irtParams, grade, isAnswered, correctAnswer, expectedParts,
    buildPlan, createSection, nextQuestion, submitAnswer, editAnswer, finalize, scoreBand,
    mulberry32, hash01,
  };
})(typeof window !== 'undefined' ? window : globalThis);
