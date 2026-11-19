/* Exam flow: home → section order → [intro → questions → review & edit] × 3 with optional break → score report. */
(function (root) {
  'use strict';
  const GM = (root.GM = root.GM || {});
  const KEY = 'gfm.exam.v1', HIST = 'gfm.history.v1', SEEN = 'gfm.seen.v1', PREFS = 'gfm.prefs.v1';
  const MIN = 60000;
  const ORDERS = [['quant', 'verbal', 'di'], ['quant', 'di', 'verbal'], ['verbal', 'quant', 'di'], ['verbal', 'di', 'quant'], ['di', 'quant', 'verbal'], ['di', 'verbal', 'quant']];
  const MAX_EDITS = 3;
  const DEFAULTS = { timeFactor: 1, confirmNext: true, pretest: true };

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable: keep going in memory */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };

  let bank = null;
  let S = null;              // exam in progress
  let app = null;            // #app element
  let tick = null, last = 0, sinceSave = 0;
  let showTimer = true;
  let modalClose = null;

  const $ = (sel, el) => (el || document).querySelector(sel);
  const sec = () => S.sections[S.order[S.secIdx]];
  const secKey = () => S.order[S.secIdx];
  const curRec = () => sec().st.records[S.cur];
  const item = (rec) => bank.items[rec.id];
  const clone = (x) => (Array.isArray(x) ? x.slice() : x);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  function fmtClock(ms) {
    if (!isFinite(ms)) return '—:—';
    const neg = ms < 0;
    let s = Math.ceil(Math.abs(ms) / 1000);
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60); s -= m * 60;
    const t = (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(s).padStart(2, '0');
    return (neg ? '+' : '') + t;
  }

  function save() { if (S) store.set(KEY, S); }

  /* ---------------- modal & toast ---------------- */
  function modal(title, body, buttons) {
    closeModal();
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mdl-t"><header id="mdl-t">' + title + '</header><div class="body">' + body + '</div><footer></footer></div>';
    const foot = ov.querySelector('footer');
    buttons.forEach((b) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'btn ' + (b.primary ? 'btn-primary' : '');
      el.textContent = b.label;
      el.addEventListener('click', () => { closeModal(); b.onClick && b.onClick(); });
      foot.appendChild(el);
    });
    document.body.appendChild(ov);
    const prim = foot.querySelector('.btn-primary') || foot.querySelector('button');
    prim && prim.focus();
    modalClose = () => ov.remove();
  }
  function closeModal() { if (modalClose) { modalClose(); modalClose = null; } }

  function toast(text, ms) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.setAttribute('role', 'status');
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms || 6000);
  }

  /* ---------------- timer ---------------- */
  function startTick() {
    stopTick();
    last = performance.now();
    tick = setInterval(onTick, 250);
  }
  function stopTick() { if (tick) clearInterval(tick); tick = null; }

  function onTick() {
    const now = performance.now();
    const dt = Math.min(now - last, 2000); // a sleeping tab does not burn more than 2 s per tick
    last = now;
    if (!S) return;
    if (S.phase === 'order') {
      S.orderRemainingMs -= dt;
      const c = $('#order-clock'); if (c) c.textContent = fmtClock(S.orderRemainingMs);
      if (S.orderRemainingMs <= 0) confirmOrder();
    } else if (S.phase === 'break') {
      S.breakRemainingMs -= dt;
      const c = $('#break-clock');
      if (c) { c.textContent = fmtClock(S.breakRemainingMs); c.classList.toggle('over', S.breakRemainingMs < 0); }
      const m = $('#break-over'); if (m) m.hidden = S.breakRemainingMs >= 0;
    } else if (S.phase === 'question' || S.phase === 'review' || S.phase === 'reviewq') {
      const sc = sec();
      if (S.phase === 'question' && S.cur != null) curRec().time += dt;
      if (S.phase === 'reviewq' && S.review) sc.st.records[S.review.i].reviewTime += dt;
      if (isFinite(sc.remainingMs)) {
        const before = sc.remainingMs;
        sc.remainingMs -= dt;
        if (before > 5 * MIN && sc.remainingMs <= 5 * MIN && !sc.warned5) { sc.warned5 = true; toast('5 minutes remain in this section.'); }
        updateClock();
        if (sc.remainingMs <= 0) { sc.remainingMs = 0; timeUp(); return; }
      }
    }
    sinceSave += dt;
    if (sinceSave > 2000) { sinceSave = 0; save(); }
  }

  function updateClock() {
    const c = $('#clock');
    if (!c) return;
    const ms = sec().remainingMs;
    c.textContent = fmtClock(ms);
    c.parentElement.classList.toggle('low', isFinite(ms) && ms <= 5 * MIN);
  }

  function timeUp() {
    closeModal();
    GM.Tools.Calculator.toggle(false);
    GM.Tools.Whiteboard.toggle(false);
    S.draft = null;
    S.review = null;
    finishSection();
    modal('Time expired', '<p>Time for this section has expired. Questions you had not answered are scored as unanswered.</p>', [{ label: 'Continue', primary: true }]);
  }

  /* ---------------- flow ---------------- */
  function startExam(settings) {
    S = {
      v: 1, id: 'm' + Date.now().toString(36), startedAt: Date.now(), settings: settings,
      phase: 'order', orderChoice: 0, orderRemainingMs: 1 * MIN, order: null,
      secIdx: 0, sections: {}, breakTaken: false, breakRemainingMs: 0, carryOverMs: 0,
      cur: null, draft: null, review: null,
    };
    save();
    render();
  }

  function confirmOrder() {
    S.order = ORDERS[S.orderChoice || 0];
    S.secIdx = 0;
    S.phase = 'intro';
    save();
    render();
  }

  function beginSection() {
    const key = secKey();
    const limit = S.settings.timeFactor > 0 ? GM.SECTIONS[key].minutes * MIN * S.settings.timeFactor : Infinity;
    const remaining = isFinite(limit) ? Math.max(MIN, limit - (S.carryOverMs || 0)) : Infinity;
    S.sections[key] = {
      st: GM.CAT.createSection(key, { pretest: S.settings.pretest ? 2 : 0 }),
      timeLimitMs: limit, remainingMs: remaining, deductedMs: S.carryOverMs || 0,
      warned5: false, done: false, result: null, editsUsed: 0,
    };
    S.carryOverMs = 0;
    S.phase = 'question';
    nextQuestion();
  }

  function nextQuestion() {
    const sc = sec();
    const seen = new Set(store.get(SEEN, []));
    const rec = GM.CAT.nextQuestion(sc.st, bank, { seen: seen });
    if (!rec) { endOfQuestions(); return; }
    S.cur = sc.st.records.length - 1;
    S.draft = null;
    seen.add(rec.id);
    store.set(SEEN, Array.from(seen));
    S.phase = 'question';
    save();
    render();
  }

  function onNext() {
    const rec = curRec();
    if (!GM.CAT.isAnswered(item(rec), S.draft)) {
      modal('Answer required', '<p>You must answer this question before moving on.</p>', [{ label: 'OK', primary: true }]);
      return;
    }
    if (S.settings.confirmNext) {
      modal('Response confirmation', '<p>Click <b>Yes</b> to confirm your response and continue to the next question.</p>', [
        { label: 'No' },
        { label: 'Yes', primary: true, onClick: commit },
      ]);
    } else commit();
  }

  function commit() {
    const sc = sec();
    const rec = curRec();
    GM.CAT.submitAnswer(sc.st, bank, rec, S.draft);
    S.draft = null;
    if (sc.st.records.length >= sc.st.nTotal) endOfQuestions();
    else nextQuestion();
  }

  function endOfQuestions() {
    const sc = sec();
    S.cur = null;
    if (sc.remainingMs > 0) { S.phase = 'review'; save(); render(); }
    else finishSection();
  }

  function openReviewQuestion(i) {
    const rec = sec().st.records[i];
    S.review = { i: i, start: clone(rec.response) };
    S.draft = clone(rec.response);
    S.phase = 'reviewq';
    save();
    render();
  }

  /** Leave a question in review mode; an actual change of answer uses one edit (after confirmation). */
  function leaveReviewQuestion(then) {
    const sc = sec();
    const rv = S.review;
    const rec = sc.st.records[rv.i];
    const changed = !same(S.draft, rv.start) && GM.CAT.isAnswered(item(rec), S.draft);
    const go = () => { S.review = null; S.draft = null; save(); then(); };
    if (!changed) { go(); return; }
    const left = MAX_EDITS - sc.editsUsed;
    modal('Change answer?', '<p>You changed your answer to question ' + rec.n + '. Saving it uses 1 of your remaining <b>' + left + '</b> answer edit' + (left === 1 ? '' : 's') + ' for this section.</p>', [
      { label: 'Discard change', onClick: go },
      { label: 'Save change', primary: true, onClick: () => { GM.CAT.editAnswer(sc.st, bank, rec, S.draft); sc.editsUsed++; go(); } },
    ]);
  }

  function endSectionPrompt() {
    modal('End section?', '<p>You will not be able to return to this section. Your answers will be scored as they are now.</p>', [
      { label: 'Keep reviewing' },
      { label: 'End section', primary: true, onClick: finishSection },
    ]);
  }

  function finishSection() {
    const sc = sec();
    GM.Tools.Calculator.reset();
    GM.Tools.Whiteboard.reset();
    sc.result = GM.CAT.finalize(sc.st, bank);
    sc.done = true;
    sc.timeUsedMs = isFinite(sc.timeLimitMs) ? sc.timeLimitMs - sc.deductedMs - Math.max(0, sc.remainingMs) : sc.st.records.reduce((a, r) => a + r.time + r.reviewTime, 0);
    S.cur = null; S.review = null; S.draft = null;
    if (S.secIdx >= 2) { completeExam(); return; }
    S.phase = S.breakTaken ? 'intro' : 'breakOffer';
    if (S.phase === 'intro') S.secIdx++;
    save();
    render();
  }

  function takeBreak() {
    S.breakTaken = true;
    S.breakRemainingMs = 10 * MIN;
    S.phase = 'break';
    save();
    render();
  }

  function endBreak() {
    S.carryOverMs = Math.max(0, -S.breakRemainingMs);
    S.secIdx++;
    S.phase = 'intro';
    save();
    render();
  }

  function skipBreak() { S.secIdx++; S.phase = 'intro'; save(); render(); }

  function completeExam() {
    const r = {};
    ['quant', 'verbal', 'di'].forEach((k) => { r[k] = S.sections[k].result; });
    const total = GM.Scoring.totalScore(r.quant.score, r.verbal.score, r.di.score);
    const attempt = {
      id: S.id, date: Date.now(), startedAt: S.startedAt, settings: S.settings, order: S.order,
      breakTaken: S.breakTaken,
      total: total, totalPct: GM.Scoring.percentile('total', total),
      results: r, sections: S.sections,
    };
    const hist = store.get(HIST, []);
    hist.unshift(attempt);
    store.set(HIST, hist.slice(0, 30));
    store.del(KEY);
    S = null;
    stopTick();
    showReport(attempt);
  }

  /* ---------------- rendering ---------------- */
  function render() {
    closeModal();
    if (!S) { renderHome(); return; }
    switch (S.phase) {
      case 'order': renderOrder(); break;
      case 'intro': renderIntro(); break;
      case 'question': renderQuestion(); break;
      case 'review': renderReview(); break;
      case 'reviewq': renderReviewQuestion(); break;
      case 'breakOffer': renderBreakOffer(); break;
      case 'break': renderBreak(); break;
      default: renderHome();
    }
    if (!tick && S) startTick();
  }

  function screen(html) {
    app.innerHTML = '<div class="screen"><div class="screen-inner">' + html + '</div></div>';
    app.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  function renderHome() {
    stopTick();
    const prefs = Object.assign({}, DEFAULTS, store.get(PREFS, {}));
    const saved = store.get(KEY, null);
    const hist = store.get(HIST, []);
    let resume = '';
    if (saved && saved.phase) {
      const where = saved.order ? 'Section ' + (saved.secIdx + 1) + ' of 3 · ' + GM.SECTIONS[saved.order[saved.secIdx]].name : 'Section order selection';
      resume = '<div class="panel row" style="justify-content:space-between"><div><div class="eyebrow">Exam in progress</div><div>' + where + '</div><div class="note">Started ' + new Date(saved.startedAt).toLocaleString() + '. The clock was paused while the page was closed.</div></div><div class="row"><button class="btn" id="discard">Discard</button><button class="btn btn-primary" id="resume">Resume exam</button></div></div>';
    }
    const histHtml = hist.length ? hist.map((h, i) =>
      '<div class="hist-row"><div><b class="num">' + h.total + '</b> <span class="pill acc">' + (h.totalPct != null ? h.totalPct + 'th pct' : '') + '</span><div class="note">' + new Date(h.date).toLocaleString() + ' · Q ' + h.results.quant.display + ' · V ' + h.results.verbal.display + ' · DI ' + h.results.di.display + '</div></div>' +
      '<div class="row"><button class="btn" data-hdel="' + i + '">Remove</button><button class="btn" data-hview="' + i + '">View report</button></div></div>').join('') :
      '<p class="note">Completed attempts appear here with their full performance report.</p>';
    screen(
      '<header class="home-head"><div class="eyebrow">Adaptive practice test · GMAT™ exam format</div><h1>Focus Mock Exam</h1>' +
      '<p class="lede">Three adaptive 45-minute sections in any order you choose, an optional 10-minute break, bookmarks with Question Review &amp; Edit, and a score on the real 205–805 scale with section scores of 60–90.</p></header>' +
      resume +
      '<section class="fmt">' +
      '<div class="cell"><b>Quantitative Reasoning</b><span class="num">21 Q · 45 min</span><span>Problem Solving · arithmetic and algebra · no calculator</span></div>' +
      '<div class="cell"><b>Verbal Reasoning</b><span class="num">23 Q · 45 min</span><span>Reading Comprehension · Critical Reasoning</span></div>' +
      '<div class="cell"><b>Data Insights</b><span class="num">20 Q · 45 min</span><span>Data Sufficiency · Two-Part · Table · Graphics · Multi-Source · calculator</span></div>' +
      '</section>' +
      '<section class="panel settings"><h2 style="font-size:18px">Exam settings</h2>' +
      '<div class="setting"><label for="set-time">Time per section<small>The real exam gives 45 minutes. Extra time mirrors approved accommodations.</small></label><select id="set-time">' +
      [[1, 'Standard: 45 minutes'], [1.5, '+50%: 67.5 minutes'], [2, '+100%: 90 minutes'], [0, 'Untimed practice']].map((o) => '<option value="' + o[0] + '"' + (prefs.timeFactor === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></div>' +
      '<div class="setting"><label for="set-confirm">Confirm each answer<small>Ask "Are you sure?" after Next, as the exam does.</small></label><input type="checkbox" class="switch" id="set-confirm"' + (prefs.confirmNext ? ' checked' : '') + '></div>' +
      '<div class="setting"><label for="set-pretest">Include unscored questions<small>2 per section, as on the real exam. You will not know which ones until the report.</small></label><input type="checkbox" class="switch" id="set-pretest"' + (prefs.pretest ? ' checked' : '') + '></div>' +
      '<div class="row"><button class="btn btn-primary" id="start">Start a new mock exam</button><span class="note">About 2 h 25 min including the break. Progress saves in this browser after every answer.</span></div>' +
      '</section>' +
      '<section class="panel"><h2 style="font-size:18px">Your attempts</h2>' + histHtml + '</section>' +
      '<section class="panel"><h2 style="font-size:18px">How this mock is scored</h2><ul class="intro-list">' +
      '<li>Each section adapts after every answer. The first question is of medium difficulty; the next one is the most informative unused question for your current ability estimate, subject to the content mix of the real exam.</li>' +
      '<li>Ability is estimated with a three-parameter IRT model (EAP). Hard questions answered correctly count for more than easy ones; most test takers answer about 55–65% correctly.</li>' +
      '<li>Section scores (60–90) and the total (205–805) are mapped to GMAC\'s August 2026 percentile tables; the three sections are weighted equally.</li>' +
      '<li>Unanswered questions cost 30 × (unanswered ÷ section length) points, so guessing beats leaving a blank.</li></ul>' +
      '<p class="disclaimer">Unofficial practice tool with original questions. GMAT™ is a trademark of the Graduate Management Admission Council (GMAC), which does not endorse this product. Scores are estimates.</p></section>'
    );
    $('#start').addEventListener('click', () => {
      const settings = { timeFactor: Number($('#set-time').value), confirmNext: $('#set-confirm').checked, pretest: $('#set-pretest').checked };
      store.set(PREFS, settings);
      if (saved) {
        modal('Replace exam in progress?', '<p>Starting a new mock discards the exam you have in progress.</p>', [{ label: 'Cancel' }, { label: 'Start new exam', primary: true, onClick: () => { store.del(KEY); startExam(settings); } }]);
      } else startExam(settings);
    });
    if (saved) {
      $('#resume').addEventListener('click', () => { S = saved; render(); });
      $('#discard').addEventListener('click', () => modal('Discard exam?', '<p>The exam in progress will be deleted. This cannot be undone.</p>', [{ label: 'Cancel' }, { label: 'Discard', primary: true, onClick: () => { store.del(KEY); renderHome(); } }]));
    }
    app.querySelectorAll('[data-hview]').forEach((b) => b.addEventListener('click', () => showReport(hist[Number(b.dataset.hview)])));
    app.querySelectorAll('[data-hdel]').forEach((b) => b.addEventListener('click', () => modal('Remove attempt?', '<p>This attempt and its report will be removed from this browser.</p>', [{ label: 'Cancel' }, { label: 'Remove', primary: true, onClick: () => { const h = store.get(HIST, []); h.splice(Number(b.dataset.hdel), 1); store.set(HIST, h); renderHome(); } }])));
  }

  function renderOrder() {
    const names = (o) => o.map((k) => GM.SECTIONS[k].name).join(' → ');
    screen('<div class="panel"><div class="eyebrow">Before you begin</div><h1 style="font-size:26px;margin-top:6px">Select section order</h1>' +
      '<p class="lede">Choose the order in which you will take the three sections. If time runs out, the first order is used.</p>' +
      '<div class="row" style="margin-top:12px"><span class="note">Time remaining to select</span><b class="num" id="order-clock">' + fmtClock(S.orderRemainingMs) + '</b></div>' +
      '<div class="order-list" role="radiogroup">' + ORDERS.map((o, i) => '<label class="order-opt' + (i === S.orderChoice ? ' sel' : '') + '"><input type="radio" name="ord" value="' + i + '"' + (i === S.orderChoice ? ' checked' : '') + '><span>' + names(o) + '</span></label>').join('') + '</div>' +
      '<button class="btn btn-primary" id="ord-go">Continue</button></div>');
    app.querySelectorAll('input[name=ord]').forEach((r) => r.addEventListener('change', () => {
      S.orderChoice = Number(r.value);
      app.querySelectorAll('.order-opt').forEach((o) => o.classList.toggle('sel', o.contains(r)));
    }));
    $('#ord-go').addEventListener('click', confirmOrder);
  }

  function renderIntro() {
    const key = secKey();
    const cfg = GM.SECTIONS[key];
    const mins = S.settings.timeFactor > 0 ? cfg.minutes * S.settings.timeFactor : null;
    const ded = S.carryOverMs > 0 ? '<p class="pill warn">Your break ran ' + fmtClock(S.carryOverMs) + ' over. That time is deducted from this section.</p>' : '';
    const specific = {
      quant: '<li>Problem Solving: solve the problem and select the best of the five answer choices.</li><li>All numbers are real numbers. No calculator is available in this section.</li>',
      verbal: '<li>Reading Comprehension: answer questions about a passage shown on the left. Passages have 3 or 4 questions.</li><li>Critical Reasoning: evaluate a short argument and select the best answer.</li>',
      di: '<li>Data Sufficiency: decide whether the data in statements (1) and (2) are sufficient to answer the question. The answer choices are always the same five.</li><li>Two-Part Analysis, Table Analysis, Graphics Interpretation, and Multi-Source Reasoning questions have several parts. Every part must be correct to receive credit.</li><li>An on-screen calculator is available from the top bar.</li>',
    }[key];
    screen('<div class="panel"><div class="eyebrow">Section ' + (S.secIdx + 1) + ' of 3</div><h1 style="font-size:28px;margin-top:6px">' + cfg.name + '</h1>' +
      '<p class="lede num">' + cfg.n + ' questions · ' + (mins ? (Number.isInteger(mins) ? mins : mins.toFixed(1)) + ' minutes' : 'untimed') + '</p>' + ded +
      '<ul class="intro-list">' + specific +
      '<li>You must answer each question before moving to the next. You cannot return to a question until the end of the section.</li>' +
      '<li>Bookmark any question you may want to revisit. After the last question, if time remains, you can review every question and change up to 3 answers.</li></ul>' +
      '<div class="row" style="margin-top:18px"><button class="btn btn-primary" id="begin">Begin section</button></div></div>');
    $('#begin').addEventListener('click', beginSection);
  }

  function examFrame(opts) {
    const key = secKey();
    const cfg = GM.SECTIONS[key];
    const sc = sec();
    const tools = (cfg.calculator ? '<button class="btn btn-bar' + (GM.Tools.Calculator.el ? ' on' : '') + '" id="t-calc" type="button" aria-pressed="' + !!GM.Tools.Calculator.el + '">' + ICON.calc + ' Calculator</button>' : '') +
      '<button class="btn btn-bar' + (GM.Tools.Whiteboard.el ? ' on' : '') + '" id="t-wb" type="button" aria-pressed="' + !!GM.Tools.Whiteboard.el + '">' + ICON.pen + ' Whiteboard</button>';
    app.innerHTML = '<div class="exam">' +
      '<header class="bar topbar"><div class="bar-inner"><div class="title"><small>Section ' + (S.secIdx + 1) + ' of 3' + (opts.mode ? ' · ' + opts.mode : '') + '</small>' + cfg.name + '</div>' + tools +
      '<div class="timer' + (isFinite(sc.remainingMs) && sc.remainingMs <= 5 * MIN ? ' low' : '') + '"><span class="lbl">' + (isFinite(sc.remainingMs) ? 'Time left' : 'Untimed') + '</span><span id="clock"' + (showTimer ? '' : ' hidden') + '>' + fmtClock(sc.remainingMs) + '</span><button class="btn btn-bar" id="t-hide" type="button" style="min-height:30px;padding:2px 10px">' + (showTimer ? 'Hide' : 'Show') + '</button></div>' +
      (opts.counter ? '<div class="counter">' + opts.counter + '</div>' : '') +
      '</div></header><main class="content" id="qhost"></main><footer class="bar bottombar"><div class="bar-inner">' + opts.bottom + '</div></footer></div>';
    const calc = $('#t-calc');
    if (calc) calc.addEventListener('click', () => { const on = GM.Tools.Calculator.toggle(); calc.classList.toggle('on', on); calc.setAttribute('aria-pressed', on); });
    const wb = $('#t-wb');
    wb.addEventListener('click', () => { const on = GM.Tools.Whiteboard.toggle(); wb.classList.toggle('on', on); wb.setAttribute('aria-pressed', on); });
    $('#t-hide').addEventListener('click', () => { showTimer = !showTimer; $('#clock').hidden = !showTimer; $('#t-hide').textContent = showTimer ? 'Hide' : 'Show'; });
    return $('#qhost');
  }

  const ICON = {
    calc: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11v6M8 15h2M12 15h2M8 18h2M12 18h2"/></svg>',
    pen: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 20l4-1 11-11-3-3L5 16l-1 4z"/><path d="M14 6l3 3"/></svg>',
    flag: '<svg class="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 3v18h2v-7h9l-1.5-3.5L16 7H7V3z"/></svg>',
  };

  function renderQuestion() {
    const sc = sec();
    const rec = curRec();
    const it = item(rec);
    const host = examFrame({
      counter: '<span class="num">' + rec.n + '</span> of <span class="num">' + sc.st.nTotal + '</span>',
      bottom: '<label class="bookmark"><input type="checkbox" id="bm"' + (rec.bookmarked ? ' checked' : '') + '> ' + ICON.flag + ' Bookmark for review</label><button class="btn btn-next" id="next" type="button">Next ›</button>',
    });
    GM.Render.question(host, it, {
      response: S.draft,
      unit: bank.unitsById[rec.unitId],
      onChange: (r) => { S.draft = r; save(); },
    });
    host.scrollTop = 0;
    $('#bm').addEventListener('change', (e) => { rec.bookmarked = e.target.checked; save(); });
    $('#next').addEventListener('click', onNext);
  }

  function renderReview() {
    const sc = sec();
    const left = MAX_EDITS - sc.editsUsed;
    const host = examFrame({
      mode: 'Question Review & Edit',
      counter: '<span class="edits">Edits left: ' + left + ' of ' + MAX_EDITS + '</span>',
      bottom: '<span class="note" style="color:var(--bar-muted)">Select a question to review it.</span><button class="btn btn-next" id="endsec" type="button">End section</button>',
    });
    const recs = sc.st.records;
    const nb = recs.filter((r) => r.bookmarked).length;
    host.innerHTML = '<div class="content-inner"><h2 style="font-size:20px">Question Review &amp; Edit</h2>' +
      '<p class="lede">You can open any question in this section. You may change up to <b>' + MAX_EDITS + '</b> answers in total; you have <b>' + left + '</b> left. Bookmarked: ' + nb + '.</p>' +
      '<div class="review-grid" style="margin-top:16px">' + recs.map((r, i) =>
        '<button class="rv" type="button" data-i="' + i + '"><span class="num">Question ' + r.n + '</span><span class="tags">' +
        (r.edits ? '<span class="pill acc">Edited</span>' : '') + (r.bookmarked ? '<span class="flag" title="Bookmarked">' + ICON.flag + '</span>' : '') + '</span></button>').join('') + '</div></div>';
    host.querySelectorAll('.rv').forEach((b) => b.addEventListener('click', () => openReviewQuestion(Number(b.dataset.i))));
    $('#endsec').addEventListener('click', endSectionPrompt);
  }

  function renderReviewQuestion() {
    const sc = sec();
    const i = S.review.i;
    const rec = sc.st.records[i];
    const it = item(rec);
    const locked = sc.editsUsed >= MAX_EDITS;
    const host = examFrame({
      mode: 'Question Review & Edit',
      counter: '<span class="num">' + rec.n + '</span> of <span class="num">' + sc.st.nTotal + '</span> · <span class="edits">Edits left: ' + (MAX_EDITS - sc.editsUsed) + '</span>',
      bottom: '<label class="bookmark"><input type="checkbox" id="bm"' + (rec.bookmarked ? ' checked' : '') + '> ' + ICON.flag + ' Bookmark</label>' +
        '<div class="row"><button class="btn btn-bar" id="prev" type="button"' + (i === 0 ? ' disabled' : '') + '>‹ Previous</button><button class="btn btn-bar" id="tolist" type="button">Review list</button><button class="btn btn-next" id="rnext" type="button"' + (i >= sc.st.records.length - 1 ? ' disabled' : '') + '>Next ›</button></div>',
    });
    GM.Render.question(host, it, {
      response: S.draft,
      unit: bank.unitsById[rec.unitId],
      locked: locked,
      label: locked ? 'You have used all ' + MAX_EDITS + ' edits for this section. Answers are now view-only.' : '',
      onChange: (r) => { S.draft = r; save(); },
    });
    $('#bm').addEventListener('change', (e) => { rec.bookmarked = e.target.checked; save(); });
    $('#tolist').addEventListener('click', () => leaveReviewQuestion(() => { S.phase = 'review'; render(); }));
    $('#prev').addEventListener('click', () => leaveReviewQuestion(() => openReviewQuestion(i - 1)));
    $('#rnext').addEventListener('click', () => leaveReviewQuestion(() => openReviewQuestion(i + 1)));
  }

  function renderBreakOffer() {
    stopTick();
    const done = S.order[S.secIdx];
    const nextKey = S.order[S.secIdx + 1];
    screen('<div class="panel"><div class="eyebrow">' + GM.SECTIONS[done].name + ' complete</div><h1 style="font-size:26px;margin-top:6px">Optional 10-minute break</h1>' +
      '<p class="lede">You may take one 10-minute break, either now or after the next section. If your break runs past 10 minutes, the extra time is deducted from your next section.</p>' +
      '<p>Next section: <b>' + GM.SECTIONS[nextKey].name + '</b></p>' +
      '<div class="row" style="margin-top:14px"><button class="btn" id="skip">Continue without a break</button><button class="btn btn-primary" id="brk">Take a break</button></div></div>');
    $('#brk').addEventListener('click', takeBreak);
    $('#skip').addEventListener('click', skipBreak);
  }

  function renderBreak() {
    screen('<div class="panel" style="text-align:center"><div class="eyebrow">Break</div><div class="big-clock' + (S.breakRemainingMs < 0 ? ' over' : '') + '" id="break-clock">' + fmtClock(S.breakRemainingMs) + '</div>' +
      '<p class="pill warn" id="break-over"' + (S.breakRemainingMs < 0 ? '' : ' hidden') + '>Your break is over. Time beyond 10:00 is being deducted from your next section.</p>' +
      '<p class="lede" style="margin-inline:auto">Stretch, drink some water, and come back when you are ready.</p>' +
      '<div class="row" style="justify-content:center;margin-top:14px"><button class="btn btn-primary" id="resume-b">Resume the exam</button></div></div>');
    $('#resume-b').addEventListener('click', endBreak);
  }

  function showReport(attempt) {
    S = null;
    stopTick();
    GM.Report.render(app, attempt, bank, { onHome: () => renderHome(), onRetake: () => renderHome() });
    window.scrollTo(0, 0);
  }

  /* ---------------- keyboard ---------------- */
  function onKey(e) {
    if (GM.Tools.Calculator.el && !e.altKey && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement && e.target.type === 'text')) {
      if (GM.Tools.Calculator.key(e)) { e.preventDefault(); return; }
    }
    if (!S || !e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'n' && S.phase === 'question') { e.preventDefault(); onNext(); }
    if (k === 'b' && (S.phase === 'question' || S.phase === 'reviewq')) { const bm = $('#bm'); if (bm) { bm.checked = !bm.checked; bm.dispatchEvent(new Event('change')); } }
  }

  /* ---------------- debugging hooks (open the page with #debug) ---------------- */
  const debug = {
    state: () => S,
    /** Answer the rest of the current section; p = probability of answering correctly. */
    autoAnswer(p, stopAfter) {
      if (!S || S.phase !== 'question') return 'not in a question';
      let k = 0;
      while (S && S.phase === 'question' && (stopAfter == null || k < stopAfter)) {
        const it = item(curRec());
        const key = GM.CAT.correctAnswer(it);
        let r = key;
        if (Math.random() > (p == null ? 0.7 : p)) r = Array.isArray(key) ? key.map((x, i) => (i === 0 ? (x === 0 ? 1 : 0) : x)) : key === 0 ? 1 : 0;
        S.draft = clone(r);
        commit();
        k++;
      }
      return S ? S.phase : 'done';
    },
    skipTime(ms) { if (S && S.sections[secKey()]) sec().remainingMs -= ms; },
  };

  function init() {
    app = document.getElementById('app');
    bank = GM.CAT.buildBank(GM.BANK);
    GM.Math.init();
    document.addEventListener('keydown', onKey);
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
    renderHome();
  }

  GM.App = {
    init, debug,
    onToolClosed(which) { const b = $(which === 'calc' ? '#t-calc' : '#t-wb'); if (b) { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); } },
  };
})(typeof window !== 'undefined' ? window : globalThis);
