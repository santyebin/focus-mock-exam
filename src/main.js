/* App shell: navigation, home, section tests, fixed forms, settings, offline support. */
(function (root) {
  'use strict';
  const GM = (root.GM = root.GM || {});
  const { esc, $, $$, modal, toast, dateLabel, ICON } = GM.UI;
  const Store = GM.Store;
  const ROUTES = ['home', 'practice', 'mistakes', 'progress', 'settings', 'report'];
  let bank, view, reportId = null;

  /* ---------- settings applied to the whole page ---------- */
  function applySettings() {
    const s = Store.settings();
    const r = document.documentElement;
    r.style.setProperty('--ts', String(s.textSize || 1));
    if (s.contrast === 'high') r.setAttribute('data-contrast', 'high'); else r.removeAttribute('data-contrast');
    r.setAttribute('data-reduce-motion', String(!!s.reduceMotion));
  }

  /* ---------- navigation ---------- */
  function route() {
    const h = (location.hash || '#home').slice(1);
    return ROUTES.includes(h) ? h : 'home';
  }
  function go(r) { if (location.hash === '#' + r) render(); else location.hash = r; }

  function renderNav() {
    const r = route();
    const due = Store.dueMistakes().length;
    const link = (id, label, extra) => '<a href="#' + id + '"' + (r === id ? ' aria-current="page"' : '') + '>' + label + (extra || '') + '</a>';
    $('#appbar').innerHTML = '<div class="inner"><a class="brand" href="#home"><span class="mark" aria-hidden="true">F</span>Focus Mock</a><nav class="nav" aria-label="Main">' +
      link('home', 'Home') + link('practice', 'Practice') + link('mistakes', 'Mistakes', due ? ' <span class="badge" aria-label="' + due + ' due">' + due + '</span>' : '') +
      link('progress', 'Progress') + link('settings', 'Settings') + '<a href="editor.html">Editor</a></nav></div>';
  }

  function render() {
    if (GM.Exam.active()) return;
    GM.UI.closeModal();
    $('#appbar').hidden = false;
    renderNav();
    const r = route();
    view.innerHTML = '';
    window.scrollTo(0, 0);
    if (r === 'practice') GM.Practice.render(view, { bank: bank });
    else if (r === 'mistakes') GM.Mistakes.render(view, { bank: bank, startReview: (ids) => GM.Practice.startReview(view, ids) });
    else if (r === 'progress') GM.Progress.render(view, { bank: bank, practiceTopic: practiceTopic });
    else if (r === 'settings') renderSettings();
    else if (r === 'report') renderReport();
    else renderHome();
    document.title = r === 'home' ? 'Focus Mock Exam' : r[0].toUpperCase() + r.slice(1) + ' · Focus Mock Exam';
  }

  function practiceTopic(section, sub) {
    GM.Practice.preset = { section: section, subs: [sub] };
    go('practice');
  }

  /* ---------- exam entry points ---------- */
  function startExam(o) {
    const saved = GM.Exam.saved();
    const begin = () => { GM.Exam.discard(); GM.Exam.start(o); };
    if (saved) modal('Replace the exam in progress?', '<p>Starting now discards the exam you have in progress.</p>', [{ label: 'Cancel' }, { label: 'Start new exam', primary: true, onClick: begin }]);
    else begin();
  }
  function examSettings() { return Object.assign({ timeFactor: 1, pretest: true }, Store.get(Store.K.prefs, {})); }

  function onExamExit(e) {
    if (e.type === 'preview') {
      reportId = e.attempt.id;
      GM.Report.preview(view, e.attempt, bank, { onReport: () => { history.replaceState(null, '', '#report'); render(); } });
      renderNav();
      $('#appbar').hidden = true;
      return;
    }
    $('#appbar').hidden = false;
    go('home');
    render();
  }

  /* ---------- home ---------- */
  function renderHome() {
    const p = examSettings();
    const saved = GM.Exam.saved();
    const hist = Store.attempts();
    const due = Store.dueMistakes().length;
    const target = Store.target();
    const forms = GM.FORMS || [];
    const taken = (fid) => hist.find((a) => a.formId === fid);
    let resume = '';
    if (saved) {
      const where = saved.order && saved.sections && saved.order[saved.secIdx] ? GM.SECTIONS[saved.order[saved.secIdx]].name : 'not started';
      resume = '<section class="card feature"><h2>Exam in progress</h2><p>' + esc(saved.title) + ' · ' + esc(where) + ' · started ' + dateLabel(saved.startedAt) + '. The clock was paused while you were away.</p>' +
        '<div class="actions"><button class="btn btn-primary" id="h-resume" type="button">Resume exam</button><button class="btn" id="h-discard" type="button">Discard</button></div></section>';
    }
    const last = hist.find((a) => a.kind !== 'section' && a.total != null);
    view.innerHTML = '<div class="screen-inner">' +
      '<header class="home-head"><div class="eyebrow">Adaptive practice in the GMAT™ exam format</div><h1>Focus Mock Exam</h1>' +
      '<p class="lede">Full adaptive mocks with the real exam\'s screens and rules, single-section tests, fixed forms for classes, targeted practice with explanations, and a mistake log that brings questions back until you get them right.</p></header>' +
      resume +
      '<section class="cards">' +
      '<div class="card feature"><h2>Full mock exam</h2><p>Three adaptive 45-minute sections in the order you choose, an optional break, Review &amp; Edit, and a 205–805 score.</p>' +
      '<div class="form-grid"><label class="field"><span>Time per section</span><select id="h-time">' + [[1, 'Standard (45 min)'], [1.5, '+50% (67.5 min)'], [2, '+100% (90 min)'], [0, 'Untimed']].map((o) => '<option value="' + o[0] + '"' + (p.timeFactor === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></label>' +
      '<label class="chip"><input type="checkbox" id="h-pre"' + (p.pretest ? ' checked' : '') + '> Unscored questions, as on the real exam</label></div>' +
      '<div class="actions"><button class="btn btn-primary" id="h-mock" type="button">Start full mock</button></div></div>' +
      '<div class="card"><h2>Section test</h2><p>One adaptive section with its own 60–90 score and percentile. Uses the time setting above.</p>' +
      '<div class="actions">' + ['quant', 'verbal', 'di'].map((k) => '<button class="btn" type="button" data-sec="' + k + '">' + GM.SECTIONS[k].short + '</button>').join('') + '</div></div>' +
      '<div class="card"><h2>Fixed mock forms</h2><p>The same questions for everyone, so a class can compare results.</p>' +
      (forms.length ? '<div>' + forms.map((f) => { const t = taken(f.id); return '<div class="list-row"><span><b>' + esc(f.name) + '</b><br><span class="muted">' + (t ? 'Taken ' + dateLabel(t.date) + ' · ' + t.total : 'Not taken yet') + '</span></span><button class="btn" type="button" data-form="' + f.id + '">' + (t ? 'Retake' : 'Start') + '</button></div>'; }).join('') + '</div>' : '<p class="muted">No forms available.</p>') + '</div>' +
      '<div class="card"><h2>Practice</h2><p>Pick a section, question types, topics and difficulty. See the explanation right after each answer, or at the end of a timed set.</p><div class="actions"><a class="btn" href="#practice">Build a practice set</a></div></div>' +
      '<div class="card"><h2>Mistake review</h2><p>' + (due ? '<b>' + due + '</b> question' + (due === 1 ? ' is' : 's are') + ' due for review today.' : 'Nothing is due today. Missed questions are due right away, then return after 3, 7, 14 and 30 days as you get them right.') + '</p><div class="actions"><a class="btn' + (due ? ' btn-primary' : '') + '" href="#mistakes">' + (due ? 'Review now' : 'Open mistake log') + '</a></div></div>' +
      '<div class="card"><h2>Progress</h2><p>' + (last ? 'Latest total: <b>' + last.total + '</b>' + (last.totalLo ? ' (' + last.totalLo + '–' + last.totalHi + ')' : '') : 'Take a mock to see your score trend.') + (target ? ' · Target: <b>' + target.total + '</b>' : '') + '</p><div class="actions"><a class="btn" href="#progress">Open dashboard</a></div></div>' +
      '</section>' +
      '<section class="panel"><h2 style="font-size:1.12em">Recent results</h2>' + (hist.length ? hist.slice(0, 8).map((h) =>
        '<div class="list-row"><span><b class="num">' + (h.total != null ? h.total : GM.SECTIONS[h.order[0]].short + ' ' + h.results[h.order[0]].display) + '</b> <span class="muted">' + esc(h.title || 'Mock Exam') + ' · ' + dateLabel(h.date) + (h.total != null ? ' · Q ' + h.results.quant.display + ' · V ' + h.results.verbal.display + ' · DI ' + h.results.di.display : '') + '</span></span>' +
        '<span class="actions"><button class="btn" type="button" data-view="' + h.id + '">View report</button><button class="btn btn-ghost" type="button" data-del="' + h.id + '" aria-label="Remove this result">Remove</button></span></div>').join('') : '<p class="empty">Your results will appear here.</p>') + '</section>' +
      '<section class="panel"><h2 style="font-size:1.12em">How this mock is scored</h2><ul class="intro-list">' +
      '<li>Each section adapts after every answer, aiming each question slightly above your current estimate within the real exam\'s content mix.</li>' +
      '<li>Ability is estimated with a three-parameter IRT model; scores map to GMAC\'s August 2026 percentile tables, and the three sections count equally.</li>' +
      '<li>Every score comes with a range (±1 standard error). Unanswered questions cost 30 × (unanswered ÷ section length) points.</li></ul>' +
      '<p class="disclaimer">Unofficial practice tool with original questions. GMAT™ is a trademark of GMAC, which does not endorse this product.</p></section></div>';
    const prefs = () => { const s = { timeFactor: Number($('#h-time').value), pretest: $('#h-pre').checked }; Store.set(Store.K.prefs, s); return s; };
    $('#h-mock').addEventListener('click', () => startExam({ kind: 'mock', settings: prefs() }));
    $$('[data-sec]').forEach((b) => b.addEventListener('click', () => startExam({ kind: 'section', section: b.dataset.sec, settings: prefs() })));
    $$('[data-form]').forEach((b) => b.addEventListener('click', () => startExam({ kind: 'form', formId: b.dataset.form, settings: prefs() })));
    if (saved) {
      $('#h-resume').addEventListener('click', () => GM.Exam.resume(saved));
      $('#h-discard').addEventListener('click', () => modal('Discard exam?', '<p>The exam in progress will be deleted. This cannot be undone.</p>', [{ label: 'Cancel' }, { label: 'Discard', primary: true, onClick: () => { GM.Exam.discard(); render(); } }]));
    }
    $$('[data-view]').forEach((b) => b.addEventListener('click', () => { reportId = b.dataset.view; go('report'); }));
    $$('[data-del]').forEach((b) => b.addEventListener('click', () => modal('Remove result?', '<p>This result and its report will be removed from this browser.</p>', [{ label: 'Cancel' }, { label: 'Remove', primary: true, onClick: () => { Store.removeAttempt(b.dataset.del); render(); } }])));
  }

  function renderReport() {
    const a = (reportId && Store.findAttempt(reportId)) || Store.attempts()[0];
    if (!a) { view.innerHTML = '<div class="screen-inner"><p class="empty">No results yet. <a href="#home">Take a mock</a>.</p></div>'; return; }
    reportId = a.id;
    GM.Report.render(view, a, bank, { onHome: () => go('home'), practiceTopic: practiceTopic, reviewMistakes: () => go('mistakes') });
  }

  /* ---------- settings ---------- */
  function renderSettings() {
    const s = Store.settings();
    const t = Store.target() || {};
    view.innerHTML = '<div class="screen-inner"><header><div class="eyebrow">Settings</div><h1 style="font-size:1.8em;margin-top:6px">Settings</h1></header>' +
      '<section class="panel settings"><h2 style="font-size:1.1em">Accessibility</h2>' +
      '<div class="setting"><label for="s-size">Text size<small>Applies to the exam, practice and reports.</small></label><select id="s-size">' + [[1, 'Standard'], [1.15, 'Large'], [1.3, 'Larger']].map((o) => '<option value="' + o[0] + '"' + (Number(s.textSize) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></div>' +
      '<div class="setting"><label for="s-contrast">Contrast<small>High contrast uses black text and borders on white.</small></label><select id="s-contrast"><option value="standard"' + (s.contrast !== 'high' ? ' selected' : '') + '>Standard</option><option value="high"' + (s.contrast === 'high' ? ' selected' : '') + '>High</option></select></div>' +
      '<div class="setting"><label for="s-motion">Reduce motion<small>Turns off transitions.</small></label><input type="checkbox" class="switch" id="s-motion"' + (s.reduceMotion ? ' checked' : '') + '></div>' +
      '<p class="note">Keyboard: Tab moves between controls; arrow keys change answers. In the exam, Alt+N is Next, Alt+B bookmarks, Alt+P is Previous and Alt+R opens the review screen during Review &amp; Edit, Alt+C opens the calculator and Alt+W the whiteboard.</p></section>' +
      '<section class="panel settings"><h2 style="font-size:1.1em">Exam behavior</h2>' +
      '<div class="setting"><label for="s-confirm">Confirm each answer<small>"Click Yes to confirm your response", as on the real exam.</small></label><input type="checkbox" class="switch" id="s-confirm"' + (s.confirmNext ? ' checked' : '') + '></div>' +
      '<div class="setting"><label for="s-warn">5-minute warning dialog<small>Otherwise a brief notice appears.</small></label><input type="checkbox" class="switch" id="s-warn"' + (s.timeWarning ? ' checked' : '') + '></div></section>' +
      '<section class="panel settings"><h2 style="font-size:1.1em">Target score</h2><div class="form-grid">' +
      '<label class="field"><span>Target total (205–805)</span><input type="number" id="s-target" min="205" max="805" step="10" value="' + (t.total || '') + '" placeholder="e.g. 685"></label>' +
      '<label class="field"><span>Exam date</span><input type="date" id="s-date" value="' + (t.date || '') + '"></label></div>' +
      '<div class="row"><button class="btn btn-primary" id="s-save-target" type="button">Save target</button>' + (t.total ? '<button class="btn" id="s-clear-target" type="button">Clear target</button>' : '') + '</div></section>' +
      '<section class="panel settings"><h2 style="font-size:1.1em">Your data</h2><p class="note">Everything stays in this browser. Export it to move to another device or keep a backup.</p>' +
      '<div class="row"><button class="btn" id="s-export" type="button">' + ICON.download + ' Export data</button><label class="btn" for="s-import">Import data</label><input type="file" id="s-import" accept="application/json" hidden><button class="btn" id="s-reset" type="button">Erase all data</button></div></section></div>';
    const save = () => {
      Store.saveSettings(Object.assign(Store.settings(), { textSize: Number($('#s-size').value), contrast: $('#s-contrast').value, reduceMotion: $('#s-motion').checked, confirmNext: $('#s-confirm').checked, timeWarning: $('#s-warn').checked }));
      applySettings();
    };
    ['#s-size', '#s-contrast', '#s-motion', '#s-confirm', '#s-warn'].forEach((id) => $(id).addEventListener('change', () => { save(); toast('Saved'); }));
    $('#s-save-target').addEventListener('click', () => {
      const v = Number($('#s-target').value);
      if (!(v >= 205 && v <= 805)) { toast('Enter a target between 205 and 805.'); return; }
      Store.setTarget({ total: 10 * Math.round((v - 5) / 10) + 5, date: $('#s-date').value || null });
      toast('Target saved');
      render();
    });
    const ct = $('#s-clear-target');
    if (ct) ct.addEventListener('click', () => { Store.setTarget(null); render(); });
    $('#s-export').addEventListener('click', () => {
      const data = {};
      Object.values(Store.K).forEach((k) => { data[k] = Store.get(k, null); });
      const blob = new Blob([JSON.stringify({ app: 'focus-mock', exported: new Date().toISOString(), data: data })], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'focus-mock-data-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
    $('#s-import').addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (!f) return;
      f.text().then((txt) => {
        const j = JSON.parse(txt);
        if (!j || j.app !== 'focus-mock' || !j.data) throw new Error('not an export file');
        modal('Import data?', '<p>This replaces the results, practice history and mistake log in this browser with the ones in the file.</p>', [{ label: 'Cancel' }, { label: 'Import', primary: true, onClick: () => { Object.keys(j.data).forEach((k) => { if (j.data[k] != null) Store.set(k, j.data[k]); }); applySettings(); toast('Data imported'); render(); } }]);
      }).catch(() => toast('That file is not a Focus Mock export.'));
    });
    $('#s-reset').addEventListener('click', () => modal('Erase all data?', '<p>Every result, practice session, mistake, setting and saved question in this browser will be deleted. This cannot be undone.</p>', [{ label: 'Cancel' }, { label: 'Erase everything', primary: true, onClick: () => { Object.values(Store.K).forEach((k) => Store.del(k)); applySettings(); toast('All data erased'); go('home'); } }]));
  }

  /* ---------- offline support ---------- */
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol) || /claude\.(ai|site)|claudeusercontent/.test(location.hostname)) return;
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline mode is optional */ });
  }

  function init() {
    const app = document.getElementById('app');
    app.innerHTML = '<a class="skip" href="#view">Skip to content</a><header class="appbar" id="appbar"></header><main id="view" tabindex="-1"></main>';
    view = document.getElementById('view');
    bank = GM.CAT.buildBank(GM.BANK);
    GM.Math.init();
    applySettings();
    GM.Exam.init({ bank: bank, app: view, onExit: onExamExit });
    const origStart = GM.Exam.start, origResume = GM.Exam.resume;
    GM.Exam.start = (o) => { $('#appbar').hidden = true; history.replaceState(null, '', '#home'); origStart(o); };
    GM.Exam.resume = (s) => { $('#appbar').hidden = true; origResume(s); };
    window.addEventListener('hashchange', render);
    render();
    registerServiceWorker();
  }

  GM.Main = { init, go, render, bank: () => bank };
  GM.App = { debug: GM.Exam.debug }; // test hook kept at its old address
})(typeof window !== 'undefined' ? window : globalThis);
