/*
 * Question editor: write or load a question, see it in the exam's own layout, run the bank's quality checks,
 * then copy the code into a data file or save it to "My questions" for practice in this browser.
 */
(function (root) {
  'use strict';
  const GM = (root.GM = root.GM || {});
  const { esc, $, $$, toast } = GM.UI;
  const Store = GM.Store;
  const BANK_KEY = { PS: 'quant', CR: 'cr', RC: 'rc', DS: 'ds', TPA: 'tpa', TA: 'ta', GI: 'gi', MSR: 'msr' };
  const TYPE_LABEL = { PS: 'Problem Solving', CR: 'Critical Reasoning', RC: 'Reading Comprehension passage', DS: 'Data Sufficiency', TPA: 'Two-Part Analysis', TA: 'Table Analysis', GI: 'Graphics Interpretation', MSR: 'Multi-Source Reasoning set' };
  const SIMPLE = ['PS', 'CR', 'DS', 'TPA'];
  const TEMPLATES = {
    PS: { id: 'MY-PS1', cat: 'Arithmetic', sub: 'Percents', d: 3, stem: 'If 20 percent of x is 30, what is x?', ch: ['60', '120', '150', '180', '600'], ans: 2, ex: '0.2x = 30, so x = 150.' },
    CR: { id: 'MY-CR1', sub: 'Weaken', d: 3, stim: 'Write the argument here (45-140 words).', q: 'Which of the following, if true, most seriously weakens the argument?', ch: ['Choice A', 'Choice B', 'Choice C', 'Choice D', 'Choice E'], ans: 0, ex: 'Explain why the answer is right and the others are not.' },
    DS: { id: 'MY-DS1', sub: 'Algebra', d: 3, stem: 'What is the value of x?', s1: '\\(2x + 1 = 7\\)', s2: '\\(x^2 = 9\\)', ans: 0, ex: '(1) gives x = 3. (2) allows 3 or -3. Answer A.' },
    TPA: { id: 'MY-TPA1', sub: 'Quant', d: 3, stem: 'Describe the situation, then: Select for <i>x</i> and for <i>y</i> the values consistent with it. Make only two selections, one in each column.', cols: ['x', 'y'], opts: ['1', '2', '3', '4', '5'], ans: [2, 0], ex: 'Explain both selections.' },
    RC: { id: 'MY-RC1', length: 'short', topic: 'Science', passage: '<p>Write the passage here, 200-320 words for a short passage or 300-460 for a long one.</p>', qs: [{ id: 'MY-RC1-1', sub: 'Main Idea', d: 3, q: 'The primary purpose of the passage is to', ch: ['A', 'B', 'C', 'D', 'E'], ans: 0, ex: 'Explanation.' }] },
    TA: { id: 'MY-TA1', sub: 'Sales', d: 3, intro: 'The table shows…', cols: ['Region', 'Sales'], rows: [['North', 120], ['South', 95]], prompt: 'For each of the following statements, select <i>Yes</i> if the statement is true based on the information in the table. Otherwise select <i>No</i>.', labels: ['Yes', 'No'], st: [{ t: 'Statement 1', a: 0 }, { t: 'Statement 2', a: 1 }, { t: 'Statement 3', a: 0 }], ex: 'Explanation.' },
    GI: { id: 'MY-GI1', sub: 'Bar chart', d: 3, intro: 'The graph shows…', prompt: 'Use the drop-down menus to complete each statement according to the information presented in the graph.', chart: { kind: 'bar', title: 'Title', yLabel: 'Units', categories: ['A', 'B', 'C'], series: [{ name: 'Units', values: [10, 20, 15] }], yMin: 0, yMax: 25, yStep: 5 }, st: [{ t: 'The tallest bar is [[]].', opts: ['A', 'B', 'C'], a: 1 }, { t: 'B is [[]] times A.', opts: ['1.5', '2', '3'], a: 1 }], ex: 'Explanation.' },
    MSR: { id: 'MY-MSR1', title: 'Set title', tabs: [{ title: 'Tab 1', html: '<p>Source 1</p>' }, { title: 'Tab 2', html: '<p>Source 2</p>' }], qs: [{ id: 'MY-MSR1-1', kind: 'MC', sub: 'Inference', d: 3, q: 'Question?', ch: ['A', 'B', 'C', 'D', 'E'], ans: 0, ex: 'Explanation.' }] },
  };

  let host, type = 'PS', obj = null, sub = 0;
  const strip = (s) => String(s).replace(/<[^>]+>/g, ' ').replace(/\\\(|\\\)/g, '').replace(/\s+/g, ' ').trim();
  const words = (s) => strip(s).split(' ').filter(Boolean).length;
  const typeOf = (o) => (o.qs ? (o.passage != null ? 'RC' : 'MSR') : o.s1 != null ? 'DS' : o.cols && o.opts ? 'TPA' : o.rows ? 'TA' : o.chart ? 'GI' : o.stim != null ? 'CR' : 'PS');

  /* ---------- quality checks (same rules as tools/validate-bank.js) ---------- */
  function checks(o) {
    const out = [];
    const add = (lvl, msg) => out.push([lvl, msg]);
    const items = o.qs ? o.qs : [o];
    if (!/^[A-Za-z0-9-]+$/.test(o.id || '')) add('bad', 'Give the question an id made of letters, digits and hyphens.');
    items.forEach((q, i) => {
      const tag = o.qs ? 'Question ' + (i + 1) + ': ' : '';
      if (!(q.d >= 1 && q.d <= 6)) add('bad', tag + 'difficulty d must be 1-6 (d5 should defeat most candidates below the 90th percentile, d6 most below the 98th).');
      if (!q.ex || q.ex.length < 20) add('bad', tag + 'write an explanation.');
      if (q.ch) {
        if (q.ch.length !== 5) add('bad', tag + 'needs exactly 5 choices.');
        if (!(q.ans >= 0 && q.ans < q.ch.length)) add('bad', tag + 'the answer index must point at a choice.');
        if (new Set(q.ch).size !== q.ch.length) add('bad', tag + 'two choices are identical.');
        const L = q.ch.map((c) => strip(c).length);
        const k = L[q.ans];
        const others = L.filter((_, j) => j !== q.ans);
        const mean = others.reduce((a, b) => a + b, 0) / Math.max(1, others.length);
        if (q.ch.every((c) => words(c) >= 4)) {
          if (k > 1.5 * mean) add('bad', tag + 'the correct answer is ' + (k / mean).toFixed(1) + '× the average wrong answer. Trim it or make the wrong answers as specific.');
          else if (others.every((x) => x < k)) add('warn', tag + 'the correct answer is the longest choice. Fine now and then (about 1 question in 5 on the real exam), but not every time.');
        }
        const nums = q.ch.map((c) => parseFloat(strip(c).replace(/[$,%]/g, '').replace('−', '-')));
        if (type === 'PS' && nums.every((x) => !isNaN(x)) && nums.some((x, j) => j && x < nums[j - 1])) add('bad', tag + 'list numeric choices in ascending order.');
      }
      [q.stem, q.stim, q.q, q.s1, q.s2].concat(q.ch || []).filter(Boolean).forEach((t) => { if ((t.match(/\\\(/g) || []).length !== (t.match(/\\\)/g) || []).length) add('bad', tag + 'unbalanced \\( \\) math delimiters.'); });
    });
    if (o.stim != null) { const w = words(o.stim); if (w < 45 || w > 140) add('bad', 'The argument is ' + w + ' words; real Critical Reasoning arguments run 45-140.'); }
    if (o.passage != null) { const w = words(o.passage); const [lo, hi] = o.length === 'long' ? [300, 460] : [200, 320]; if (w < lo || w > hi) add('bad', 'The ' + (o.length || 'short') + ' passage is ' + w + ' words (expected ' + lo + '-' + hi + ').'); }
    if (o.st && o.rows && o.st.length !== 3) add('bad', 'Table Analysis needs exactly 3 statements.');
    if (o.chart && o.st) o.st.forEach((s, i) => { if ((s.t.match(/\[\[\]\]/g) || []).length !== 1) add('bad', 'Statement ' + (i + 1) + ' needs exactly one [[]] drop-down.'); });
    if (o.cols && o.opts && !(Array.isArray(o.ans) && o.ans.length === 2)) add('bad', 'Two-Part Analysis needs ans: [row for column 1, row for column 2].');
    if (GM.BANK && Object.values(GM.BANK).some((list) => list.some((x) => x.id === o.id))) add('warn', 'This id already exists in the bank; saving the code would replace that question.');
    if (!out.length) add('ok', 'Passes the bank\'s automatic checks. Have someone solve it without seeing the answer before adding it.');
    return out;
  }

  /* ---------- code output ---------- */
  function lit(v, ind) {
    const pad = '  '.repeat(ind);
    if (typeof v === 'string') return v.includes('`') || v.includes('${') ? JSON.stringify(v) : 'R`' + v + '`';
    if (typeof v === 'number' || typeof v === 'boolean' || v == null) return String(v);
    if (Array.isArray(v)) {
      const simple = v.every((x) => typeof x !== 'object' || x == null);
      return simple ? '[' + v.map((x) => lit(x, ind)).join(', ') + ']' : '[\n' + v.map((x) => pad + '  ' + lit(x, ind + 1)).join(',\n') + ',\n' + pad + ']';
    }
    return '{ ' + Object.keys(v).map((k) => (/^[A-Za-z_]\w*$/.test(k) ? k : JSON.stringify(k)) + ': ' + lit(v[k], ind + 1)).join(',\n' + pad + '  ') + ' }';
  }
  const code = (o) => '// add to data/' + { PS: 'quant-*.js (B.quant)', CR: 'verbal-cr-*.js (B.cr)', RC: 'verbal-rc-*.js (B.rc)', DS: 'di-ds*.js (B.ds)', TPA: 'di-tpa-ta*.js (B.tpa)', TA: 'di-tpa-ta*.js (B.ta)', GI: 'di-gi*.js (B.gi)', MSR: 'di-msr*.js (B.msr)' }[typeOf(o)] + '\n' + lit(o, 2) + ',';

  /* ---------- preview ---------- */
  function preview() {
    const box = $('#ed-preview');
    let b;
    try { b = GM.CAT.buildBank({ [BANK_KEY[type]]: [JSON.parse(JSON.stringify(obj))] }); } catch (e) { box.innerHTML = '<p class="bad-t">Cannot preview: ' + esc(e.message) + '</p>'; return; }
    const unit = b.units[0];
    const it = unit.items[Math.min(sub, unit.items.length - 1)];
    box.innerHTML = (unit.items.length > 1 ? '<label class="field" style="margin-bottom:8px"><span>Preview question</span><select id="ed-sub">' + unit.items.map((x, i) => '<option value="' + i + '"' + (i === sub ? ' selected' : '') + '>' + (i + 1) + '. ' + esc(strip(x.q).slice(0, 60)) + '</option>').join('') + '</select></label>' : '') +
      '<div class="gx"><header class="gx-top"><div class="gx-gutter"><div class="gx-title">Preview — ' + TYPE_LABEL[type] + '</div></div></header><div class="gx-tools"><div class="gx-gutter"><span class="gx-note" id="ed-result"></span></div></div><main class="gx-main" id="ed-q"></main></div>';
    const s = $('#ed-sub');
    if (s) s.addEventListener('change', () => { sub = Number(s.value); preview(); });
    GM.Render.question($('#ed-q'), it, {
      response: null, unit: unit,
      onChange: (r) => { const done = GM.CAT.isAnswered(it, r); $('#ed-result').textContent = done ? (GM.CAT.grade(it, r) ? 'Your selection matches the key.' : 'Your selection does not match the key.') : ''; },
    });
  }

  function refresh() {
    $('#ed-checks').innerHTML = checks(obj).map(([lvl, m]) => '<li class="' + lvl + '">' + (lvl === 'ok' ? '✓ ' : lvl === 'warn' ? '! ' : '✗ ') + esc(m) + '</li>').join('');
    $('#ed-code').value = code(obj);
    preview();
  }

  /* ---------- form ---------- */
  function simpleForm() {
    const o = obj;
    const ta = (id, label, v, rows) => '<label class="field"><span>' + label + '</span><textarea id="' + id + '" rows="' + (rows || 3) + '">' + esc(v || '') + '</textarea></label>';
    let h = '<div class="form-grid"><label class="field"><span>Id</span><input type="text" id="f-id" value="' + esc(o.id) + '"></label>' +
      '<label class="field"><span>Difficulty</span><select id="f-d">' + [1, 2, 3, 4, 5, 6].map((d) => '<option' + (o.d === d ? ' selected' : '') + ' value="' + d + '">d' + d + ' · ' + ['', 'easy', 'below medium', 'medium', 'hard', 'very hard', 'extreme'][d] + '</option>').join('') + '</select></label>' +
      (type === 'PS' ? '<label class="field"><span>Category</span><select id="f-cat"><option' + (o.cat === 'Arithmetic' ? ' selected' : '') + '>Arithmetic</option><option' + (o.cat === 'Algebra' ? ' selected' : '') + '>Algebra</option></select></label>' : '') +
      '<label class="field"><span>Sub-topic</span><input type="text" id="f-sub" value="' + esc(o.sub) + '"></label></div>';
    if (type === 'CR') h += ta('f-stim', 'Argument', o.stim, 5) + ta('f-q', 'Question', o.q, 2);
    else h += ta('f-stem', 'Question', o.stem, 4);
    if (type === 'DS') h += ta('f-s1', 'Statement (1)', o.s1, 2) + ta('f-s2', 'Statement (2)', o.s2, 2) + '<label class="field"><span>Answer</span><select id="f-dsans">' + ['A', 'B', 'C', 'D', 'E'].map((l, i) => '<option value="' + i + '"' + (o.ans === i ? ' selected' : '') + '>' + l + ': ' + GM.Render.DS_CHOICES[i] + '</option>').join('') + '</select></label>';
    if (type === 'PS' || type === 'CR') h += '<fieldset class="field"><legend>Choices (select the correct one)</legend>' + o.ch.map((c, i) => '<div class="choice-row"><input type="radio" name="f-ans" value="' + i + '"' + (o.ans === i ? ' checked' : '') + ' aria-label="Choice ' + 'ABCDE'[i] + ' is correct"><textarea id="f-ch' + i + '" rows="2" aria-label="Choice ' + 'ABCDE'[i] + '">' + esc(c) + '</textarea></div>').join('') + '</fieldset>';
    if (type === 'TPA') h += '<div class="form-grid"><label class="field"><span>Column 1</span><input type="text" id="f-c0" value="' + esc(o.cols[0]) + '"></label><label class="field"><span>Column 2</span><input type="text" id="f-c1" value="' + esc(o.cols[1]) + '"></label></div>' +
      ta('f-opts', 'Options, one per line', o.opts.join('\n'), 5) + '<div class="form-grid"><label class="field"><span>Column 1 answer (option number, from 1)</span><input type="number" id="f-a0" min="1" value="' + (o.ans[0] + 1) + '"></label><label class="field"><span>Column 2 answer (option number, from 1)</span><input type="number" id="f-a1" min="1" value="' + (o.ans[1] + 1) + '"></label></div>';
    h += ta('f-ex', 'Explanation', o.ex, 3);
    return h;
  }

  function readSimple() {
    const v = (id) => { const e = $('#' + id); return e ? e.value : undefined; };
    const o = obj;
    o.id = v('f-id').trim(); o.d = Number(v('f-d')); o.sub = v('f-sub'); o.ex = v('f-ex');
    if (type === 'PS') o.cat = v('f-cat');
    if (type === 'CR') { o.stim = v('f-stim'); o.q = v('f-q'); } else o.stem = v('f-stem');
    if (type === 'DS') { o.s1 = v('f-s1'); o.s2 = v('f-s2'); o.ans = Number(v('f-dsans')); }
    if (type === 'PS' || type === 'CR') { o.ch = [0, 1, 2, 3, 4].map((i) => v('f-ch' + i)); const a = $('input[name=f-ans]:checked'); o.ans = a ? Number(a.value) : 0; }
    if (type === 'TPA') { o.cols = [v('f-c0'), v('f-c1')]; o.opts = v('f-opts').split('\n').map((s) => s.trim()).filter(Boolean); o.ans = [Number(v('f-a0')) - 1, Number(v('f-a1')) - 1]; }
  }

  function draw() {
    host.innerHTML = '<header><div class="eyebrow">Question editor</div><h1 style="font-size:1.8em;margin-top:6px">Write a question</h1>' +
      '<p class="lede">See it in the exam layout as you type, check it against the bank\'s quality rules, then copy the code into a data file (run <code>node tools/validate-bank.js</code> after) or save it to <b>My questions</b> to practice with in this browser.</p></header>' +
      '<div class="ed"><section class="panel"><div class="form-grid"><label class="field"><span>Question type</span><select id="ed-type">' + Object.keys(TYPE_LABEL).map((t) => '<option value="' + t + '"' + (t === type ? ' selected' : '') + '>' + TYPE_LABEL[t] + '</option>').join('') + '</select></label>' +
      '<label class="field"><span>Load from the bank or My questions (id)</span><input type="text" id="ed-load" placeholder="e.g. QA12, CR07, RC03" list="ed-ids"></label></div><datalist id="ed-ids">' + allIds().map((i) => '<option value="' + esc(i) + '">').join('') + '</datalist>' +
      '<div id="ed-form">' + (SIMPLE.indexOf(type) >= 0 ? simpleForm() : '') + '</div>' +
      '<label class="field"><span>' + (SIMPLE.indexOf(type) >= 0 ? 'Advanced: edit as JSON' : 'Question data (JSON). Edit and the preview updates.') + '</span><textarea id="ed-json" rows="' + (SIMPLE.indexOf(type) >= 0 ? 6 : 18) + '" spellcheck="false">' + esc(JSON.stringify(obj, null, 2)) + '</textarea></label>' +
      '<div><h2 style="font-size:1em;margin-bottom:6px">Checks</h2><ul class="checks" id="ed-checks"></ul></div>' +
      '<label class="field"><span>Code for the data file</span><textarea class="code" id="ed-code" readonly></textarea></label>' +
      '<div class="row"><button class="btn btn-primary" type="button" id="ed-copy">Copy code</button><button class="btn" type="button" id="ed-save">Save to My questions</button><button class="btn" type="button" id="ed-new">Start over</button></div>' +
      '<div id="ed-mine"></div></section>' +
      '<section class="ed-preview" id="ed-preview" aria-label="Live preview"></section></div>';
    $('#ed-type').addEventListener('change', (e) => { type = e.target.value; obj = JSON.parse(JSON.stringify(TEMPLATES[type])); sub = 0; draw(); });
    $('#ed-load').addEventListener('change', (e) => load(e.target.value.trim()));
    $$('#ed-form input, #ed-form textarea, #ed-form select').forEach((el) => el.addEventListener('input', () => { readSimple(); $('#ed-json').value = JSON.stringify(obj, null, 2); refresh(); }));
    $('#ed-json').addEventListener('input', (e) => { try { obj = JSON.parse(e.target.value); e.target.style.borderColor = ''; if (SIMPLE.indexOf(type) < 0) refresh(); } catch (err) { e.target.style.borderColor = 'var(--bad)'; } });
    $('#ed-json').addEventListener('change', () => { if (SIMPLE.indexOf(type) >= 0) draw(); });
    $('#ed-copy').addEventListener('click', () => {
      const t = $('#ed-code');
      (navigator.clipboard ? navigator.clipboard.writeText(t.value) : Promise.reject()).then(() => toast('Copied')).catch(() => { t.select(); toast('Selected; press Ctrl+C or Cmd+C to copy'); });
    });
    $('#ed-save').addEventListener('click', save);
    $('#ed-new').addEventListener('click', () => { obj = JSON.parse(JSON.stringify(TEMPLATES[type])); draw(); });
    drawMine();
    refresh();
  }

  function allIds() {
    const ids = [];
    Object.values(GM.BANK).forEach((list) => list.forEach((x) => ids.push(x.id)));
    Store.myQuestions().forEach((m) => ids.push(m.q.id));
    return ids;
  }

  function load(id) {
    if (!id) return;
    const mine = Store.myQuestions().find((m) => m.q.id === id);
    let found = mine ? mine.q : null;
    if (!found) Object.values(GM.BANK).forEach((list) => list.forEach((x) => { if (x.id === id) found = x; }));
    if (!found) { toast('No question with id ' + id); return; }
    obj = JSON.parse(JSON.stringify(found));
    delete obj.irt; delete obj.unitId; delete obj.section;
    type = typeOf(obj);
    sub = 0;
    draw();
  }

  function save() {
    const bad = checks(obj).filter((c) => c[0] === 'bad');
    if (bad.length) { toast('Fix the problems under Checks first.'); return; }
    const q = JSON.parse(JSON.stringify(obj));
    if (!/^MY-/.test(q.id)) q.id = 'MY-' + q.id;
    if (q.qs) q.qs.forEach((x, i) => { if (!/^MY-/.test(x.id)) x.id = 'MY-' + x.id; if (!x.id) x.id = q.id + '-' + (i + 1); });
    const list = Store.myQuestions().filter((m) => m.q.id !== q.id);
    list.push({ bank: BANK_KEY[type], q: q, saved: Date.now() });
    Store.saveMyQuestions(list);
    toast('Saved as ' + q.id + '. Practice it under Practice → Only my own.');
    drawMine();
  }

  function drawMine() {
    const list = Store.myQuestions();
    $('#ed-mine').innerHTML = list.length ? '<h2 style="font-size:1em;margin:6px 0">My questions (' + list.length + ')</h2>' + list.map((m) => '<div class="list-row"><span><b>' + esc(m.q.id) + '</b> <span class="muted">' + TYPE_LABEL[typeOf(m.q)] + '</span></span><span class="row"><button class="btn" type="button" data-load="' + esc(m.q.id) + '">Edit</button><button class="btn btn-ghost" type="button" data-del="' + esc(m.q.id) + '">Delete</button></span></div>').join('') : '';
    $$('[data-load]').forEach((b) => b.addEventListener('click', () => load(b.dataset.load)));
    $$('[data-del]').forEach((b) => b.addEventListener('click', () => { Store.saveMyQuestions(Store.myQuestions().filter((m) => m.q.id !== b.dataset.del)); drawMine(); }));
  }

  function init(el) {
    host = el;
    GM.Math.init();
    const s = Store.settings();
    document.documentElement.style.setProperty('--ts', String(s.textSize || 1));
    if (s.contrast === 'high') document.documentElement.setAttribute('data-contrast', 'high');
    obj = JSON.parse(JSON.stringify(TEMPLATES.PS));
    draw();
  }

  GM.Editor = { init, checks, code };
})(typeof window !== 'undefined' ? window : globalThis);
