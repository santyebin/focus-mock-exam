/*
 * Exam runner with the real exam's screens and rules:
 * full adaptive mock (3 sections, order choice, optional break), single-section test, or fixed mock form.
 * Flow per section: instructions → questions (Next + confirmation, bookmarks) → Question Review & Edit (3 edits) → next.
 */
(function (root) {
  'use strict';
  const GM = (root.GM = root.GM || {});
  const { esc, $, $$, fmtClock, modal, closeModal, toast, announce, ICON } = GM.UI;
  const Store = GM.Store;
  const MIN = 60000;
  const MAX_EDITS = 3;
  const ORDERS = [['quant', 'verbal', 'di'], ['quant', 'di', 'verbal'], ['verbal', 'quant', 'di'], ['verbal', 'di', 'quant'], ['di', 'quant', 'verbal'], ['di', 'verbal', 'quant']];
  const KIND_TITLES = { mock: 'Mock Exam', section: 'Section Test', form: 'Mock Exam' };

  let bank = null, app = null, S = null, onExit = null;
  let tick = null, last = 0, sinceSave = 0, prevTheme;

  const sec = () => S.sections[S.order[S.secIdx]];
  const secKey = () => S.order[S.secIdx];
  const curRec = () => sec().st.records[S.cur];
  const item = (rec) => bank.items[rec.id];
  const clone = (x) => (Array.isArray(x) ? x.slice() : x);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const xm = (title, body, buttons) => modal(title, body, buttons, { exam: true });

  function save() { if (S) Store.set(Store.K.exam, S); }

  /* ---------------- lifecycle ---------------- */
  function init(opts) { bank = opts.bank; app = opts.app; onExit = opts.onExit; }

  /**
   * start({ kind: 'mock' | 'section' | 'form', section, formId, settings })
   * settings: { timeFactor, pretest }
   */
  function start(o) {
    const form = o.kind === 'form' ? (GM.FORMS || []).find((f) => f.id === o.formId) : null;
    S = {
      v: 2, id: 'm' + Date.now().toString(36), kind: o.kind, formId: form ? form.id : null,
      title: form ? form.name : KIND_TITLES[o.kind], startedAt: Date.now(),
      settings: { timeFactor: o.settings.timeFactor, pretest: o.kind === 'form' ? false : !!o.settings.pretest },
      phase: o.kind === 'section' ? 'intro' : 'order',
      orderChoice: 0, orderRemainingMs: MIN, order: o.kind === 'section' ? [o.section] : null,
      secIdx: 0, sections: {}, breakTaken: false, breakRemainingMs: 0, carryOverMs: 0,
      cur: null, draft: null, review: null, ui: { timeHidden: false, countHidden: false },
    };
    enter();
  }

  function resume(saved) { S = saved; S.ui = S.ui || { timeHidden: false, countHidden: false }; enter(); }
  function saved() { const s = Store.get(Store.K.exam, null); return s && s.phase ? s : null; }
  function discard() { Store.del(Store.K.exam); }

  function enter() {
    prevTheme = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', 'light'); // the real exam has no dark mode
    document.body.classList.add('in-exam');
    save();
    render();
    startTick();
  }

  function leave() {
    stopTick();
    GM.Tools.Calculator.reset();
    GM.Whiteboard.reset();
    closeModal();
    document.body.classList.remove('in-exam');
    if (prevTheme) document.documentElement.setAttribute('data-theme', prevTheme);
    else document.documentElement.removeAttribute('data-theme');
    S = null;
  }

  /* ---------------- timer ---------------- */
  function startTick() { stopTick(); last = performance.now(); tick = setInterval(onTick, 250); }
  function stopTick() { if (tick) clearInterval(tick); tick = null; }

  function onTick() {
    const now = performance.now();
    const dt = Math.min(now - last, 2000);
    last = now;
    if (!S) return;
    if (S.phase === 'order') {
      S.orderRemainingMs -= dt;
      setStat('time', S.orderRemainingMs);
      if (S.orderRemainingMs <= 0) confirmOrder();
    } else if (S.phase === 'break') {
      S.breakRemainingMs -= dt;
      const c = $('#gx-bigclock');
      if (c) { c.textContent = fmtClock(Math.max(0, S.breakRemainingMs)); c.classList.toggle('over', S.breakRemainingMs < 0); }
      setStat('time', Math.max(0, S.breakRemainingMs));
      const m = $('#gx-break-over'); if (m) m.hidden = S.breakRemainingMs >= 0;
    } else if (S.phase === 'question' || S.phase === 'review' || S.phase === 'reviewq') {
      const sc = sec();
      if (S.phase === 'question' && S.cur != null) curRec().time += dt;
      if (S.phase === 'reviewq' && S.review) sc.st.records[S.review.i].reviewTime += dt;
      if (isFinite(sc.remainingMs)) {
        const before = sc.remainingMs;
        sc.remainingMs -= dt;
        if (before > 5 * MIN && sc.remainingMs <= 5 * MIN && !sc.warned5) {
          sc.warned5 = true;
          announce('Five minutes remain in this section.');
          if (Store.settings().timeWarning) xm('Time Warning', '<p>You have 5 minutes remaining in this section.</p>', [{ label: 'OK', primary: true }]);
          else toast('5 minutes remain in this section.');
        }
        setStat('time', sc.remainingMs);
        if (sc.remainingMs <= 0) { sc.remainingMs = 0; timeUp(); return; }
      }
    }
    sinceSave += dt;
    if (sinceSave > 2000) { sinceSave = 0; save(); }
  }

  function setStat(which, ms) {
    const el = $('#gx-' + which + ' .val');
    if (!el) return;
    el.textContent = fmtClock(ms);
    $('#gx-' + which).classList.toggle('low', isFinite(ms) && ms <= 5 * MIN && S && S.phase !== 'order' && S.phase !== 'break');
  }

  function timeUp() {
    closeModal();
    GM.Tools.Calculator.toggle(false);
    GM.Whiteboard.toggle(false);
    S.draft = null;
    S.review = null;
    finishSection(true);
  }

  /* ---------------- shell ---------------- */
  /**
   * shell({ heading, time, count, tools, content, left, right }) renders the exam frame and returns the main element.
   * time: ms or null (no clock) · count: 'n of N' or null · left/right: HTML for the navigation bar
   */
  function shell(o) {
    const tools = (o.tools || []).map((t) => '<button type="button" class="gx-tool" id="gx-t-' + t + '" aria-pressed="' + (t === 'calc' ? !!GM.Tools.Calculator.el : !!GM.Whiteboard.el) + '">' +
      (t === 'calc' ? ICON.calc + ' Calculator' : ICON.pen + ' Whiteboard') + '</button>').join('');
    const timeStat = o.time != null ? '<button type="button" class="gx-stat" id="gx-time" aria-pressed="' + !S.ui.timeHidden + '" title="Hide or show the time remaining">' + ICON.clock + '<span class="lbl">Time Remaining</span><span class="val" role="timer">' + fmtClock(o.time) + '</span></button>' : '';
    const countStat = o.count ? '<button type="button" class="gx-stat" id="gx-count" aria-pressed="' + !S.ui.countHidden + '" title="Hide or show the question number">' + ICON.list + '<span class="val">' + o.count + '</span></button>' : '';
    app.innerHTML = '<div class="gx" role="application" aria-label="' + esc(S.title) + '">' +
      '<header class="gx-top"><div class="gx-gutter"><div class="gx-title">' + esc(o.heading) + '</div>' + timeStat + countStat + '</div></header>' +
      '<div class="gx-tools"><div class="gx-gutter">' + tools + (o.note ? '<span class="gx-note">' + o.note + '</span>' : '') + '</div></div>' +
      '<main class="gx-main" id="gx-main" tabindex="-1">' + (o.content || '') + '</main>' +
      '<footer class="gx-bottom"><div class="gx-gutter"><div class="group">' + (o.left || '') + '</div><div class="group">' + (o.right || '') + '</div></div></footer></div>';
    const tb = $('#gx-time');
    if (tb) tb.addEventListener('click', () => { S.ui.timeHidden = !S.ui.timeHidden; tb.setAttribute('aria-pressed', String(!S.ui.timeHidden)); save(); });
    const cb = $('#gx-count');
    if (cb) cb.addEventListener('click', () => { S.ui.countHidden = !S.ui.countHidden; cb.setAttribute('aria-pressed', String(!S.ui.countHidden)); save(); });
    const calc = $('#gx-t-calc');
    if (calc) calc.addEventListener('click', () => calc.setAttribute('aria-pressed', String(GM.Tools.Calculator.toggle())));
    const wb = $('#gx-t-wb');
    if (wb) wb.addEventListener('click', () => wb.setAttribute('aria-pressed', String(GM.Whiteboard.toggle())));
    return $('#gx-main');
  }

  function heading() {
    const cfg = GM.SECTIONS[secKey()];
    return S.title + ' — ' + cfg.name;
  }

  function sectionTools() { return GM.SECTIONS[secKey()].calculator ? ['calc', 'wb'] : ['wb']; }

  /* ---------------- flow ---------------- */
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
    const form = S.formId ? (GM.FORMS || []).find((f) => f.id === S.formId) : null;
    S.sections[key] = {
      st: GM.CAT.createSection(key, form ? { fixed: form.sections[key] } : { pretest: S.settings.pretest ? 2 : 0 }),
      timeLimitMs: limit, remainingMs: remaining, deductedMs: S.carryOverMs || 0,
      warned5: false, done: false, result: null, editsUsed: 0,
    };
    S.carryOverMs = 0;
    nextQuestion();
  }

  function nextQuestion() {
    const sc = sec();
    const seen = new Set(Store.get(Store.K.seen, []));
    const rec = GM.CAT.nextQuestion(sc.st, bank, { seen: seen });
    if (!rec) { endOfQuestions(); return; }
    S.cur = sc.st.records.length - 1;
    S.draft = null;
    seen.add(rec.id);
    Store.set(Store.K.seen, Array.from(seen));
    S.phase = 'question';
    save();
    render();
  }

  function onNext() {
    if (GM.UI.modalOpen()) return;
    const rec = curRec();
    if (!GM.CAT.isAnswered(item(rec), S.draft)) {
      xm('Answer Required', '<p>You cannot continue with this question unanswered. Select an answer, then click Next.</p>', [{ label: 'OK', primary: true }]);
      return;
    }
    if (Store.settings().confirmNext) {
      xm('Response Confirmation', '<p>Click <b>Yes</b> to confirm your response and continue to the next question.</p>', [
        { label: 'No' }, { label: 'Yes', primary: true, onClick: commit },
      ]);
    } else commit();
  }

  function commit() {
    const sc = sec();
    GM.CAT.submitAnswer(sc.st, bank, curRec(), S.draft);
    S.draft = null;
    if (sc.st.records.length >= sc.st.nTotal) endOfQuestions();
    else nextQuestion();
  }

  function endOfQuestions() {
    S.cur = null;
    if (sec().remainingMs > 0) { S.phase = 'review'; save(); render(); }
    else finishSection(true);
  }

  function openReviewQuestion(i) {
    const rec = sec().st.records[i];
    S.review = { i: i, start: clone(rec.response) };
    S.draft = clone(rec.response);
    S.phase = 'reviewq';
    save();
    render();
  }

  function leaveReviewQuestion(then) {
    const sc = sec();
    const rv = S.review;
    const rec = sc.st.records[rv.i];
    const changed = !same(S.draft, rv.start) && GM.CAT.isAnswered(item(rec), S.draft);
    const go = () => { S.review = null; S.draft = null; save(); then(); };
    if (!changed) { go(); return; }
    const left = MAX_EDITS - sc.editsUsed;
    xm('Answer Edit', '<p>You have changed your answer to question ' + rec.n + '. Saving this change uses 1 of your ' + left + ' remaining answer edit' + (left === 1 ? '' : 's') + ' for this section.</p>', [
      { label: 'Discard Change', onClick: go },
      { label: 'Save Change', primary: true, onClick: () => { GM.CAT.editAnswer(sc.st, bank, rec, S.draft); sc.editsUsed++; go(); } },
    ]);
  }

  function endReviewPrompt() {
    xm('End Section Review', '<p>Are you sure you want to end your review of this section? You will not be able to return to it.</p>', [
      { label: 'No' }, { label: 'Yes', primary: true, onClick: () => finishSection(false) },
    ]);
  }

  function finishSection(expired) {
    const sc = sec();
    GM.Tools.Calculator.reset();
    GM.Whiteboard.reset();
    sc.result = GM.CAT.finalize(sc.st, bank);
    sc.done = true;
    sc.timeUsedMs = isFinite(sc.timeLimitMs) ? sc.timeLimitMs - sc.deductedMs - Math.max(0, sc.remainingMs) : sc.st.records.reduce((a, r) => a + r.time + r.reviewTime, 0);
    S.cur = null; S.review = null; S.draft = null;
    const isLast = S.secIdx >= S.order.length - 1;
    if (isLast) { complete(expired); return; }
    S.phase = S.breakTaken ? 'intro' : 'breakOffer';
    if (S.phase === 'intro') S.secIdx++;
    save();
    render();
    if (expired) xm('Time Expired', '<p>The time for this section has expired. Unanswered questions are scored as unanswered.</p>', [{ label: 'OK', primary: true }]);
  }

  function takeBreak() { S.breakTaken = true; S.breakRemainingMs = 10 * MIN; S.phase = 'break'; save(); render(); }
  function endBreak() { S.carryOverMs = Math.max(0, -S.breakRemainingMs); S.secIdx++; S.phase = 'intro'; save(); render(); }
  function skipBreak() { S.secIdx++; S.phase = 'intro'; save(); render(); }

  function complete(expired) {
    const results = {};
    S.order.forEach((k) => { results[k] = S.sections[k].result; });
    const full = S.order.length === 3;
    let total = null, totalPct = null, totalLo = null, totalHi = null;
    if (full) {
      total = GM.Scoring.totalScore(results.quant.score, results.verbal.score, results.di.score);
      totalPct = GM.Scoring.percentile('total', total);
      // ±1 SE band on the total: section bands combine like independent errors (each section point is 600/90 total points)
      const spread = Math.sqrt(['quant', 'verbal', 'di'].reduce((s, k) => s + Math.pow((results[k].hi - results[k].lo) / 2, 2), 0)) * (600 / 90);
      totalLo = Math.max(205, 10 * Math.round((total - spread - 5) / 10) + 5);
      totalHi = Math.min(805, 10 * Math.round((total + spread - 5) / 10) + 5);
    }
    const attempt = {
      id: S.id, kind: S.kind, formId: S.formId, title: S.title, date: Date.now(), startedAt: S.startedAt,
      settings: S.settings, order: S.order, breakTaken: S.breakTaken,
      total: total, totalPct: totalPct, totalLo: totalLo, totalHi: totalHi,
      results: results, sections: S.sections,
    };
    Store.addAttempt(attempt);
    Store.logAttemptMistakes(attempt);
    Store.del(Store.K.exam);
    const showExpired = expired;
    leaveTo(() => {
      onExit({ type: 'preview', attempt: attempt });
      if (showExpired) xm('Time Expired', '<p>The time for this section has expired. Unanswered questions are scored as unanswered.</p>', [{ label: 'OK', primary: true }]);
    });
  }

  function leaveTo(fn) { leave(); fn(); }

  function quit() {
    xm('Exit Exam', '<p>Your progress is saved. You can resume this exam from the home screen; the clock stays paused while you are away.</p>', [
      { label: 'Cancel' }, { label: 'Exit', primary: true, onClick: () => { save(); leaveTo(() => onExit({ type: 'home' })); } },
    ]);
  }

  /* ---------------- screens ---------------- */
  function render() {
    closeModal();
    switch (S.phase) {
      case 'order': return renderOrder();
      case 'intro': return renderIntro();
      case 'question': return renderQuestion();
      case 'review': return renderReview();
      case 'reviewq': return renderReviewQuestion();
      case 'breakOffer': return renderBreakOffer();
      case 'break': return renderBreak();
    }
  }

  const exitBtn = '<button type="button" class="gx-nav" id="gx-exit">Save and Exit</button>';
  function wireExit() { const b = $('#gx-exit'); if (b) b.addEventListener('click', quit); }

  function renderOrder() {
    const names = (o) => o.map((k) => GM.SECTIONS[k].name).join(', ');
    shell({
      heading: S.title + ' — Select Section Order', time: S.orderRemainingMs,
      content: '<div class="gx-content gx-gutter"><h1>Select Section Order</h1>' +
        '<p>Select the order in which you will take the three sections of the exam. If you do not make a selection before the time expires, the first order listed will be used.</p>' +
        '<div class="gx-order" role="radiogroup" aria-label="Section order">' + ORDERS.map((o, i) => '<label><input type="radio" name="ord" value="' + i + '"' + (i === S.orderChoice ? ' checked' : '') + '> ' + names(o) + '</label>').join('') + '</div>' +
        (S.formId ? '<p class="gx-callout">This is a fixed form: everyone who takes ' + esc(S.title) + ' sees the same questions, so results can be compared across students.</p>' : '') + '</div>',
      left: exitBtn,
      right: '<button type="button" class="gx-nav primary" id="gx-go">Next ' + ICON.next + '</button>',
    });
    $$('input[name=ord]').forEach((r) => r.addEventListener('change', () => { S.orderChoice = Number(r.value); save(); }));
    $('#gx-go').addEventListener('click', confirmOrder);
    wireExit();
  }

  function renderIntro() {
    const key = secKey();
    const cfg = GM.SECTIONS[key];
    const mins = S.settings.timeFactor > 0 ? cfg.minutes * S.settings.timeFactor : null;
    const n = S.formId ? (GM.FORMS.find((f) => f.id === S.formId).sections[key] || []).length : cfg.n;
    const ded = S.carryOverMs > 0 ? '<p class="gx-warn">Your break exceeded 10 minutes by ' + fmtClock(S.carryOverMs) + '. That time has been deducted from this section.</p>' : '';
    const specific = {
      quant: '<p>Each Problem Solving question has five answer choices. Solve the problem and select the best answer. All numbers used are real numbers. A calculator is not available in this section.</p>',
      verbal: '<p>This section contains Reading Comprehension and Critical Reasoning questions. Reading Comprehension questions refer to a passage shown on the left side of the screen. Select the best answer to each question.</p>',
      di: '<p>This section contains Data Sufficiency, Multi-Source Reasoning, Table Analysis, Graphics Interpretation, and Two-Part Analysis questions. Questions with several parts are scored correct only if every part is answered correctly. An on-screen calculator is available.</p>' +
        '<div class="gx-callout"><b>Data Sufficiency directions.</b> Each question is followed by two statements. Decide whether the data in the statements are sufficient to answer the question, then select:<br>A: Statement (1) alone is sufficient, but statement (2) alone is not.<br>B: Statement (2) alone is sufficient, but statement (1) alone is not.<br>C: Both statements together are sufficient, but neither statement alone is.<br>D: Each statement alone is sufficient.<br>E: Statements (1) and (2) together are not sufficient.</div>',
    }[key];
    shell({
      heading: heading() + ' — Instructions', time: mins ? mins * MIN - (S.carryOverMs || 0) : null,
      content: '<div class="gx-content gx-gutter"><h1>' + cfg.name + ' Section Instructions</h1>' +
        '<p><b>' + n + ' questions · ' + (mins ? (Number.isInteger(mins) ? mins : mins.toFixed(1)) + ' minutes' : 'untimed') + '</b>' + (S.order.length === 3 ? ' · Section ' + (S.secIdx + 1) + ' of 3' : '') + '</p>' + ded + specific +
        '<p>You must answer each question before you can move to the next one, and you cannot return to a question until you reach the Question Review &amp; Edit screen. Select <b>Bookmark for Review</b> to mark any question you may want to revisit. When you finish the last question, if time remains, you may review any question in the section and change up to three answers.</p>' +
        '<p>The clock starts when you select <b>Begin Section</b>.</p></div>',
      left: exitBtn,
      right: '<button type="button" class="gx-nav primary" id="gx-go">Begin Section ' + ICON.next + '</button>',
    });
    $('#gx-go').addEventListener('click', beginSection);
    wireExit();
  }

  function questionShell(o) {
    const sc = sec();
    return shell({
      heading: heading() + (o.mode ? ' — ' + o.mode : ''), time: sc.remainingMs,
      count: o.count, tools: sectionTools(), note: o.note, left: o.left, right: o.right,
    });
  }

  function bookmarkBtn(rec) {
    return '<button type="button" class="gx-nav gx-bookmark" id="gx-bm" aria-pressed="' + !!rec.bookmarked + '">' + (rec.bookmarked ? ICON.bookmarkOn + ' Bookmarked' : ICON.bookmark + ' Bookmark for Review') + '</button>';
  }
  function wireBookmark(rec) {
    const b = $('#gx-bm');
    b.addEventListener('click', () => {
      rec.bookmarked = !rec.bookmarked;
      b.setAttribute('aria-pressed', String(rec.bookmarked));
      b.innerHTML = rec.bookmarked ? ICON.bookmarkOn + ' Bookmarked' : ICON.bookmark + ' Bookmark for Review';
      save();
    });
  }

  function renderQuestion() {
    const sc = sec();
    const rec = curRec();
    const host = questionShell({
      count: rec.n + ' of ' + sc.st.nTotal,
      left: bookmarkBtn(rec),
      right: '<button type="button" class="gx-nav primary" id="gx-next">Next ' + ICON.next + '</button>',
    });
    GM.Render.question(host, item(rec), { response: S.draft, unit: bank.unitsById[rec.unitId], onChange: (r) => { S.draft = r; save(); } });
    host.scrollTop = 0;
    host.setAttribute('aria-label', 'Question ' + rec.n + ' of ' + sc.st.nTotal);
    wireBookmark(rec);
    $('#gx-next').addEventListener('click', onNext);
  }

  function renderReview() {
    const sc = sec();
    const left = MAX_EDITS - sc.editsUsed;
    const recs = sc.st.records;
    const host = questionShell({
      mode: 'Question Review & Edit',
      left: '',
      right: '<button type="button" class="gx-nav primary" id="gx-end">End Section Review</button>',
    });
    host.innerHTML = '<div class="gx-content gx-gutter"><h1>Question Review &amp; Edit</h1>' +
      '<p>Select any question to review it. You may change your answers to up to three questions in this section. Questions you bookmarked are marked below. When you are finished, select <b>End Section Review</b>.</p>' +
      '<div class="gx-review-meta"><span>Answer edits remaining: <b>' + left + '</b> of ' + MAX_EDITS + '</span><span>Bookmarked: <b>' + recs.filter((r) => r.bookmarked).length + '</b></span></div>' +
      '<div class="gx-table-wrap"><table class="gx-review"><thead><tr><th>Question</th><th class="c">Bookmarked</th><th class="c">Answered</th><th class="c">Edited</th></tr></thead><tbody>' +
      recs.map((r, i) => '<tr tabindex="0" data-i="' + i + '"><td>Question ' + r.n + '</td><td class="c">' + (r.bookmarked ? ICON.bookmarkOn + '<span class="sr-only">Bookmarked</span>' : '') + '</td><td class="c">' + (r.response != null ? 'Yes' : 'No') + '</td><td class="c">' + (r.edits ? 'Yes' : '') + '</td></tr>').join('') +
      '</tbody></table></div></div>';
    $$('.gx-review tbody tr').forEach((tr) => {
      const open = () => openReviewQuestion(Number(tr.dataset.i));
      tr.addEventListener('click', open);
      tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
    $('#gx-end').addEventListener('click', endReviewPrompt);
  }

  function renderReviewQuestion() {
    const sc = sec();
    const i = S.review.i;
    const rec = sc.st.records[i];
    const locked = sc.editsUsed >= MAX_EDITS;
    const host = questionShell({
      mode: 'Question Review & Edit', count: rec.n + ' of ' + sc.st.nTotal,
      note: 'Answer edits remaining: ' + (MAX_EDITS - sc.editsUsed),
      left: bookmarkBtn(rec),
      right: '<button type="button" class="gx-nav" id="gx-prev"' + (i === 0 ? ' disabled' : '') + '>' + ICON.prev + ' Previous</button>' +
        '<button type="button" class="gx-nav" id="gx-list">' + ICON.grid + ' Review Screen</button>' +
        '<button type="button" class="gx-nav primary" id="gx-rnext"' + (i >= sc.st.records.length - 1 ? ' disabled' : '') + '>Next ' + ICON.next + '</button>',
    });
    GM.Render.question(host, item(rec), {
      response: S.draft, unit: bank.unitsById[rec.unitId], locked: locked,
      label: locked ? 'You have used all ' + MAX_EDITS + ' answer edits for this section. Answers can be viewed but not changed.' : '',
      onChange: (r) => { S.draft = r; save(); },
    });
    wireBookmark(rec);
    $('#gx-list').addEventListener('click', () => leaveReviewQuestion(() => { S.phase = 'review'; render(); }));
    $('#gx-prev').addEventListener('click', () => leaveReviewQuestion(() => openReviewQuestion(i - 1)));
    $('#gx-rnext').addEventListener('click', () => leaveReviewQuestion(() => openReviewQuestion(i + 1)));
  }

  function renderBreakOffer() {
    stopTick();
    const nextKey = S.order[S.secIdx + 1];
    shell({
      heading: S.title + ' — Optional Break',
      content: '<div class="gx-content gx-gutter"><h1>Optional Break</h1>' +
        '<p>You have completed the ' + GM.SECTIONS[S.order[S.secIdx]].name + ' section.</p>' +
        '<p>You may take one optional 10-minute break during the exam, either now or after the next section. If you exceed 10 minutes, the extra time will be deducted from the time available for the next section.</p>' +
        '<p>Next section: <b>' + GM.SECTIONS[nextKey].name + '</b></p></div>',
      left: '',
      right: '<button type="button" class="gx-nav" id="gx-skip">Continue Without Break</button><button type="button" class="gx-nav primary" id="gx-brk">Take Break</button>',
    });
    $('#gx-brk').addEventListener('click', () => { takeBreak(); startTick(); });
    $('#gx-skip').addEventListener('click', () => { skipBreak(); startTick(); });
  }

  function renderBreak() {
    shell({
      heading: S.title + ' — Optional Break', time: Math.max(0, S.breakRemainingMs),
      content: '<div class="gx-content gx-gutter"><h1>Optional Break</h1><p>Time remaining in your break:</p>' +
        '<div class="gx-bigclock' + (S.breakRemainingMs < 0 ? ' over' : '') + '" id="gx-bigclock">' + fmtClock(Math.max(0, S.breakRemainingMs)) + '</div>' +
        '<p class="gx-warn" id="gx-break-over"' + (S.breakRemainingMs < 0 ? '' : ' hidden') + '>Your break time is over. Additional time is being deducted from your next section.</p>' +
        '<p>Select <b>Continue</b> when you are ready to resume the exam.</p></div>',
      left: '',
      right: '<button type="button" class="gx-nav primary" id="gx-go">Continue ' + ICON.next + '</button>',
    });
    $('#gx-go').addEventListener('click', endBreak);
  }

  /* ---------------- keyboard ---------------- */
  function onKey(e) {
    if (!S) return;
    if (GM.Tools.Calculator.el && !e.altKey && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement && e.target.type === 'text') && !(e.target instanceof HTMLTextAreaElement)) {
      if (GM.Tools.Calculator.key(e)) { e.preventDefault(); return; }
    }
    if (!e.altKey) return;
    const k = e.key.toLowerCase();
    const click = (id) => { const b = $(id); if (b && !b.disabled) { e.preventDefault(); b.click(); } };
    if (k === 'n') click(S.phase === 'reviewq' ? '#gx-rnext' : S.phase === 'question' ? '#gx-next' : '#gx-go');
    else if (k === 'p') click('#gx-prev');
    else if (k === 'b') click('#gx-bm');
    else if (k === 'r') click('#gx-list');
    else if (k === 'c') click('#gx-t-calc');
    else if (k === 'w') click('#gx-t-wb');
  }
  document.addEventListener('keydown', onKey);
  window.addEventListener('pagehide', () => save());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });

  /* ---------------- test hooks ---------------- */
  const debug = {
    state: () => S,
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
    endReview() { if (S && S.phase === 'review') finishSection(false); },
    takeBreak: () => takeBreak(), skipBreak: () => skipBreak(), endBreak: () => endBreak(),
    begin: () => beginSection(), chooseOrder: (i) => { S.orderChoice = i || 0; confirmOrder(); },
  };

  GM.Exam = { init, start, resume, saved, discard, active: () => !!S, debug, ORDERS };
})(typeof window !== 'undefined' ? window : globalThis);
