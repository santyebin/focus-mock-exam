/* Practice: build a set by section, type, topic, difficulty and source; study mode (explanation after each answer) or a timed set. */
(function (root) {
  'use strict';
  const GM = (root.GM = root.GM || {});
  const { esc, $, $$, mmss, modal, announce, ICON } = GM.UI;
  const Store = GM.Store;
  const PACE = { quant: (45 * 60000) / 21, verbal: (45 * 60000) / 23, di: (45 * 60000) / 20 };
  const BANDS = [['easy', 'Easy', [1, 2]], ['medium', 'Medium', [3]], ['hard', 'Hard', [4]], ['vhard', 'Very hard', [5, 6]]];
  const TYPES = { quant: [['Arithmetic', 'Arithmetic'], ['Algebra', 'Algebra']], verbal: [['CR', 'Critical Reasoning'], ['RC', 'Reading Comprehension']], di: [['DS', 'Data Sufficiency'], ['TPA', 'Two-Part Analysis'], ['TA', 'Table Analysis'], ['GI', 'Graphics Interpretation'], ['MSR', 'Multi-Source Reasoning']] };

  let bank = null;   // exam bank plus questions written in the editor
  let run = null;    // active practice set

  function fullBank(base) {
    const mine = Store.myQuestions();
    if (!mine.length) return base;
    const raw = {};
    Object.keys(GM.BANK).forEach((k) => { raw[k] = GM.BANK[k].slice(); });
    mine.forEach((m) => { if (raw[m.bank]) raw[m.bank].push(m.q); });
    try { return GM.CAT.buildBank(raw); } catch (e) { return base; }
  }

  const typeKey = (it) => (it.section === 'quant' ? it.cat : it.type);
  const band = (it) => (BANDS.find((b) => b[2].indexOf(it.d) >= 0) || BANDS[1])[0];
  const isMine = (it) => /^MY-/.test(it.id);

  function render(host, opts) {
    bank = fullBank(opts.bank);
    if (run) return renderRun(host);
    const pre = GM.Practice.preset || {};
    GM.Practice.preset = null;
    const last = Store.get('gfm.practice.prefs', {});
    const st = {
      section: pre.section || last.section || 'quant',
      types: null, subs: pre.subs || null,
      bands: last.bands || BANDS.map((b) => b[0]),
      source: pre.subs ? 'all' : last.source || 'all',
      count: last.count || 10, mode: last.mode || 'study',
    };
    const items = Object.values(bank.items);

    function pool() {
      const srs = Store.srs();
      const seen = new Set(Store.get(Store.K.seen, []));
      Store.itemEvents().forEach((e) => seen.add(e.id));
      return items.filter((it) => it.section === st.section &&
        (!st.types || st.types.indexOf(typeKey(it)) >= 0) &&
        (!st.subs || st.subs.indexOf(it.sub) >= 0) &&
        st.bands.indexOf(band(it)) >= 0 &&
        (st.source === 'all' || (st.source === 'unseen' && !seen.has(it.id)) || (st.source === 'missed' && srs[it.id]) || (st.source === 'mine' && isMine(it))));
    }

    function draw() {
      const secItems = items.filter((it) => it.section === st.section && (!st.types || st.types.indexOf(typeKey(it)) >= 0));
      const subs = {};
      secItems.forEach((it) => { subs[it.sub] = (subs[it.sub] || 0) + 1; });
      const n = pool().length;
      host.innerHTML = '<div class="screen-inner"><header><div class="eyebrow">Practice</div><h1 style="font-size:1.8em;margin-top:6px">Build a practice set</h1><p class="lede">Choose what to work on. In study mode you see the answer and explanation right after each question; a timed set saves them for the end.</p></header>' +
        '<section class="panel" style="display:grid;gap:18px">' +
        '<fieldset class="field"><legend>Section</legend><div class="chips">' + ['quant', 'verbal', 'di'].map((k) => '<label class="chip"><input type="radio" name="p-sec" value="' + k + '"' + (k === st.section ? ' checked' : '') + '> ' + GM.SECTIONS[k].name + '</label>').join('') + '</div></fieldset>' +
        '<fieldset class="field"><legend>Question types</legend><div class="chips">' + TYPES[st.section].map(([k, label]) => '<label class="chip"><input type="checkbox" name="p-type" value="' + k + '"' + (!st.types || st.types.indexOf(k) >= 0 ? ' checked' : '') + '> ' + label + '</label>').join('') + '</div></fieldset>' +
        '<fieldset class="field"><legend>Topics <button type="button" class="btn btn-ghost" style="min-height:24px;padding:0 8px;font-weight:400" id="p-alltopics">' + (st.subs ? 'All topics' : 'Clear') + '</button></legend><div class="chips">' + Object.keys(subs).sort().map((s) => '<label class="chip"><input type="checkbox" name="p-sub" value="' + esc(s) + '"' + (!st.subs || st.subs.indexOf(s) >= 0 ? ' checked' : '') + '> ' + esc(s) + ' <span class="muted">' + subs[s] + '</span></label>').join('') + '</div></fieldset>' +
        '<fieldset class="field"><legend>Difficulty</legend><div class="chips">' + BANDS.map(([k, label]) => '<label class="chip"><input type="checkbox" name="p-band" value="' + k + '"' + (st.bands.indexOf(k) >= 0 ? ' checked' : '') + '> ' + label + '</label>').join('') + '</div></fieldset>' +
        '<div class="form-grid"><label class="field"><span>Questions</span><select id="p-src"><option value="all">All questions</option><option value="unseen">Only ones I have not seen</option><option value="missed">Only ones I have missed</option><option value="mine">Only my own (from the editor)</option></select></label>' +
        '<label class="field"><span>Set size</span><select id="p-count">' + [5, 10, 15, 20].map((c) => '<option' + (c === st.count ? ' selected' : '') + '>' + c + '</option>').join('') + '</select></label>' +
        '<label class="field"><span>Mode</span><select id="p-mode"><option value="study">Study: explanation after each question</option><option value="timed">Timed set: explanations at the end</option></select></label></div>' +
        '<div class="row"><button class="btn btn-primary" id="p-start" type="button"' + (n ? '' : ' disabled') + '>Start ' + Math.min(n, st.count) + '-question set</button><span class="note">' + n + ' question' + (n === 1 ? '' : 's') + ' match.</span></div></section></div>';
      $('#p-src').value = st.source;
      $('#p-mode').value = st.mode;
      $$('input[name=p-sec]').forEach((i) => i.addEventListener('change', () => { st.section = i.value; st.types = null; st.subs = null; draw(); }));
      $$('input[name=p-type]').forEach((i) => i.addEventListener('change', () => { st.types = $$('input[name=p-type]:checked').map((x) => x.value); if (!st.types.length) st.types = []; st.subs = null; draw(); }));
      $$('input[name=p-sub]').forEach((i) => i.addEventListener('change', () => { st.subs = $$('input[name=p-sub]:checked').map((x) => x.value); draw(); }));
      $('#p-alltopics').addEventListener('click', () => { st.subs = st.subs ? null : []; draw(); });
      $$('input[name=p-band]').forEach((i) => i.addEventListener('change', () => { st.bands = $$('input[name=p-band]:checked').map((x) => x.value); draw(); }));
      $('#p-src').addEventListener('change', (e) => { st.source = e.target.value; draw(); });
      $('#p-count').addEventListener('change', (e) => { st.count = Number(e.target.value); draw(); });
      $('#p-mode').addEventListener('change', (e) => { st.mode = e.target.value; });
      $('#p-start').addEventListener('click', () => {
        Store.set('gfm.practice.prefs', { section: st.section, bands: st.bands, source: st.source, count: st.count, mode: st.mode });
        const chosen = shuffle(pool()).slice(0, st.count).map((it) => it.id);
        begin(host, { ids: chosen, section: st.section, mode: st.mode, review: false, title: 'Practice · ' + GM.SECTIONS[st.section].name });
      });
    }
    draw();
  }

  function shuffle(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

  /** Start a set: { ids, section, mode: 'study' | 'timed', review, title }. */
  function begin(host, o) {
    run = Object.assign({ i: 0, results: [], draft: null, checked: false, started: performance.now(), qStart: performance.now(), date: Date.now() }, o);
    renderRun(host);
  }

  function startReview(host, ids) {
    bank = fullBank(GM.Main.bank());
    const valid = ids.filter((id) => bank.items[id]);
    if (!valid.length) return;
    const sec = bank.items[valid[0]].section;
    begin(host, { ids: valid, section: sec, mode: 'study', review: true, title: 'Mistake review' });
  }

  let paceTimer = null;
  function renderRun(host) {
    clearInterval(paceTimer);
    if (run.i >= run.ids.length) return finish(host);
    const it = bank.items[run.ids[run.i]];
    const target = PACE[it.section];
    host.innerHTML = '<div class="px"><div class="px-top"><div class="g"><span class="title">' + esc(run.title) + '</span>' +
      '<span class="progress-dots" aria-label="Question ' + (run.i + 1) + ' of ' + run.ids.length + '">' + run.ids.map((id, k) => '<i class="' + (k < run.results.length ? (run.results[k].correct ? 'ok' : 'no') : k === run.i ? 'cur' : '') + '"></i>').join('') + '</span>' +
      '<span class="pace" id="p-pace" title="Time on this question (target ' + mmss(target) + ')">0:00</span><button class="btn" id="p-end" type="button">End set</button></div></div>' +
      '<main class="px-main" id="p-main"></main>' +
      '<div class="px-bottom"><div class="g"><span class="note">' + GM.TYPE_NAMES[it.type] + ' · ' + esc(it.sub) + ' · ' + ['', 'Easy', 'Easy', 'Medium', 'Hard', 'Very hard', 'Very hard'][it.d] + '</span><span class="row" id="p-actions"></span></div></div></div>';
    const mainEl = $('#p-main');
    const drawQ = (reveal) => {
      GM.Render.question(mainEl, it, { response: run.draft, unit: bank.unitsById[it.unitId], locked: reveal, reveal: reveal, onChange: (r) => { run.draft = r; actions(); } });
      if (reveal) {
        const res = run.results[run.i];
        const fb = document.createElement('div');
        fb.className = 'feedback ' + (res.correct ? 'ok' : 'no');
        fb.innerHTML = '<h3>' + (res.correct ? ICON.check + ' Correct' : ICON.x + ' Incorrect') + ' <span class="note">· ' + mmss(res.time) + (res.time > 2 * target ? ' (over twice the ' + mmss(target) + ' target)' : '') + '</span></h3><p><b>Correct answer: ' + GM.Render.describe(it, GM.CAT.correctAnswer(it)) + '.</b> ' + it.ex + '</p>';
        (mainEl.querySelector('.split .pane:last-child') || mainEl.querySelector('.content-inner') || mainEl).appendChild(fb);
        GM.Math.typeset(fb);
        announce(res.correct ? 'Correct.' : 'Incorrect. The correct answer is ' + GM.Render.describe(it, GM.CAT.correctAnswer(it)) + '.');
      }
    };
    const actions = () => {
      const a = $('#p-actions');
      const answered = GM.CAT.isAnswered(it, run.draft);
      const lastQ = run.i >= run.ids.length - 1;
      if (run.checked) a.innerHTML = '<button class="btn btn-primary" id="p-next" type="button">' + (lastQ ? 'See results' : 'Next question') + ' ' + ICON.next + '</button>';
      else a.innerHTML = '<button class="btn btn-primary" id="p-check" type="button"' + (answered ? '' : ' disabled') + '>' + (run.mode === 'study' ? 'Check answer' : lastQ ? 'Finish set' : 'Next') + '</button>';
      const c = $('#p-check');
      if (c) c.addEventListener('click', submit);
      const nx = $('#p-next');
      if (nx) nx.addEventListener('click', () => { run.i++; run.draft = null; run.checked = false; run.qStart = performance.now(); renderRun(host); });
    };
    const submit = () => {
      const correct = GM.CAT.grade(it, run.draft);
      const time = performance.now() - run.qStart;
      run.results.push({ id: it.id, response: run.draft, correct: correct, time: time });
      if (run.review) Store.reviewMistake(it.id, correct);
      else if (!correct) Store.addMistake(it.id, 'wrong');
      const seen = new Set(Store.get(Store.K.seen, []));
      seen.add(it.id);
      Store.set(Store.K.seen, Array.from(seen));
      if (run.mode === 'study') { run.checked = true; clearInterval(paceTimer); drawQ(true); actions(); }
      else { run.i++; run.draft = null; run.qStart = performance.now(); renderRun(host); }
    };
    drawQ(run.checked);
    actions();
    $('#p-end').addEventListener('click', () => {
      if (!run.results.length) { run = null; render(host, { bank: GM.Main.bank() }); return; }
      modal('End this set?', '<p>Your ' + run.results.length + ' answered question' + (run.results.length > 1 ? 's' : '') + ' will be saved and shown in the results.</p>', [{ label: 'Keep going' }, { label: 'End set', primary: true, onClick: () => finish(host) }]);
    });
    const pace = $('#p-pace');
    paceTimer = setInterval(() => {
      if (!pace.isConnected) { clearInterval(paceTimer); return; }
      const t = performance.now() - run.qStart;
      pace.textContent = mmss(t);
      pace.classList.toggle('over', t > target);
    }, 500);
    mainEl.focus && mainEl.setAttribute('tabindex', '-1');
  }

  function finish(host) {
    clearInterval(paceTimer);
    const r = run;
    run = null;
    if (!r.results.length) { render(host, { bank: GM.Main.bank() }); return; }
    const session = { id: 'p' + Date.now().toString(36), date: r.date, section: r.section, mode: r.mode, review: !!r.review, targetMs: PACE[r.section], items: r.results };
    Store.addPractice(session);
    const ok = r.results.filter((x) => x.correct).length;
    const avg = r.results.reduce((s, x) => s + x.time, 0) / r.results.length;
    host.innerHTML = '<div class="screen-inner"><header><div class="eyebrow">' + esc(r.title) + '</div><h1 style="font-size:1.8em;margin-top:6px">' + ok + ' of ' + r.results.length + ' correct</h1>' +
      '<p class="lede">Average ' + mmss(avg) + ' per question (target ' + mmss(PACE[r.section]) + ').' + (r.review ? ' Correct answers moved up a review box; missed ones come back tomorrow.' : ok < r.results.length ? ' Missed questions were added to your mistake log.' : '') + '</p></header>' +
      '<section class="panel"><div class="table-wrap"><table class="qtable"><thead><tr><th>#</th><th>Type</th><th>Topic</th><th>Result</th><th>Your answer</th><th>Time</th></tr></thead><tbody>' +
      r.results.map((x, i) => { const it = bank.items[x.id]; return '<tr class="qrow" data-i="' + i + '" tabindex="0"><td class="n">' + (i + 1) + '</td><td>' + GM.TYPE_NAMES[it.type] + '</td><td>' + esc(it.sub) + '</td><td>' + (x.correct ? '<span class="pill good">Correct</span>' : '<span class="pill bad">Incorrect</span>') + '</td><td>' + GM.Render.describe(it, x.response) + '</td><td class="n">' + mmss(x.time) + '</td></tr><tr class="qdetail" data-d="' + i + '" hidden><td colspan="6"><div class="qd-host"></div></td></tr>'; }).join('') +
      '</tbody></table></div></section>' +
      '<div class="row"><button class="btn btn-primary" id="p-again" type="button">New practice set</button><a class="btn" href="#mistakes">Mistake log</a><a class="btn" href="#progress">Progress</a></div></div>';
    $$('tr.qrow', host).forEach((tr) => {
      const open = () => {
        const d = host.querySelector('tr[data-d="' + tr.dataset.i + '"]');
        d.hidden = !d.hidden;
        if (!d.hidden && !d.dataset.done) {
          d.dataset.done = '1';
          const x = r.results[Number(tr.dataset.i)];
          const it = bank.items[x.id];
          const q = document.createElement('div');
          d.querySelector('.qd-host').appendChild(q);
          GM.Render.question(q, it, { response: x.response, unit: bank.unitsById[it.unitId], locked: true, reveal: true });
          q.querySelectorAll('.split').forEach((s) => { s.style.height = 'auto'; });
          const ex = document.createElement('div');
          ex.className = 'explain';
          ex.innerHTML = '<b>Correct answer: ' + GM.Render.describe(it, GM.CAT.correctAnswer(it)) + '.</b> ' + it.ex;
          d.querySelector('.qd-host').appendChild(ex);
          GM.Math.typeset(ex);
        }
      };
      tr.addEventListener('click', open);
      tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
    $('#p-again').addEventListener('click', () => render(host, { bank: GM.Main.bank() }));
  }

  GM.Practice = { render, begin, startReview, preset: null, active: () => !!run, PACE };
})(typeof window !== 'undefined' ? window : globalThis);
