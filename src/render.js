/* Question renderers for every GMAT question format. Responses: index | [i, j] | [per-statement index]. */
(function (root) {
  'use strict';
  const GM = (root.GM = root.GM || {});
  const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
  const DS_CHOICES = [
    'Statement (1) ALONE is sufficient, but statement (2) alone is not sufficient.',
    'Statement (2) ALONE is sufficient, but statement (1) alone is not sufficient.',
    'BOTH statements TOGETHER are sufficient, but NEITHER statement ALONE is sufficient.',
    'EACH statement ALONE is sufficient.',
    'Statements (1) and (2) TOGETHER are NOT sufficient.',
  ];
  let uid = 0;

  const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  function fmtCell(v) {
    if (typeof v !== 'number') return v;
    const neg = v < 0;
    const a = Math.abs(v);
    const t = Number.isInteger(a) ? a.toLocaleString('en-US') : a.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    return (neg ? '−' : '') + t;
  }

  function mcList(choices, resp, o) {
    const name = 'mc' + ++uid;
    return '<ul class="choices" role="radiogroup">' + choices.map((c, i) => {
      let cls = 'choice';
      if (resp === i) cls += ' sel';
      if (o.locked) cls += ' locked';
      if (o.reveal) { if (i === o.key) cls += ' key'; else if (resp === i) cls += ' wrong'; }
      const letter = o.reveal ? '<b class="num">' + LETTERS[i] + '.</b> ' : '';
      return '<li><label class="' + cls + '"><input type="radio" name="' + name + '" value="' + i + '"' + (resp === i ? ' checked' : '') + (o.locked ? ' disabled' : '') + '><span>' + letter + c + '</span></label></li>';
    }).join('') + '</ul>';
  }

  function wireMc(el, o) {
    el.querySelectorAll('.choices input[type=radio]').forEach((inp) => {
      inp.addEventListener('change', () => {
        el.querySelectorAll('.choice').forEach((c) => c.classList.remove('sel'));
        inp.closest('.choice').classList.add('sel');
        o.onChange(Number(inp.value));
      });
    });
  }

  function statementTable(labels, statements, resp, o) {
    const name = 'st' + ++uid;
    let h = '<div class="table-wrap"><table class="grid-table"><thead><tr>' + labels.map((l) => '<th class="c">' + l + '</th>').join('') + '<th>Statement</th></tr></thead><tbody>';
    statements.forEach((s, si) => {
      h += '<tr>';
      labels.forEach((l, li) => {
        const checked = resp && resp[si] === li;
        let mark = '';
        if (o.reveal && s.a === li) mark = ' <span class="pill good">✓</span>';
        h += '<td class="c"><input type="radio" aria-label="' + escAttr(l + ': statement ' + (si + 1)) + '" name="' + name + '_' + si + '" value="' + li + '" data-s="' + si + '"' + (checked ? ' checked' : '') + (o.locked ? ' disabled' : '') + '>' + mark + '</td>';
      });
      h += '<td>' + s.t + '</td></tr>';
    });
    return h + '</tbody></table></div>';
  }

  function wireParts(el, o, n) {
    const resp = Array.isArray(o.response) ? o.response.slice() : new Array(n).fill(null);
    el.querySelectorAll('input[data-s]').forEach((inp) => {
      inp.addEventListener('change', () => {
        resp[Number(inp.dataset.s)] = Number(inp.value);
        o.onChange(resp.slice());
      });
    });
  }

  /* ----- single-column formats ----- */
  function ps(it, o) {
    return '<div class="q-text stem">' + it.stem + '</div>' + mcList(it.ch, o.response, Object.assign({ key: it.ans }, o));
  }

  function cr(it, o) {
    return '<div class="q-text stem">' + it.stim + '</div><div class="q-text"><p><b>' + it.q + '</b></p></div>' + mcList(it.ch, o.response, Object.assign({ key: it.ans }, o));
  }

  function ds(it, o) {
    return '<div class="q-text stem">' + it.stem + '</div>' +
      '<div class="q-text statements"><div><span>(1)</span><span>' + it.s1 + '</span></div><div><span>(2)</span><span>' + it.s2 + '</span></div></div>' +
      '<div class="ds-key">' + mcList(DS_CHOICES, o.response, Object.assign({ key: it.ans }, o)) + '</div>';
  }

  function tpa(it, o) {
    const r = Array.isArray(o.response) ? o.response : [null, null];
    const name = 'tpa' + ++uid;
    let h = '<div class="q-text stem">' + it.stem + '</div><div class="table-wrap"><table class="grid-table"><thead><tr><th class="c">' + it.cols[0] + '</th><th class="c">' + it.cols[1] + '</th><th></th></tr></thead><tbody>';
    it.opts.forEach((opt, i) => {
      h += '<tr>';
      [0, 1].forEach((c) => {
        const mark = o.reveal && it.ans[c] === i ? ' <span class="pill good">✓</span>' : '';
        h += '<td class="c"><input type="radio" aria-label="' + escAttr(it.cols[c] + ': ' + String(opt).replace(/<[^>]+>/g, '')) + '" name="' + name + '_' + c + '" value="' + i + '" data-s="' + c + '"' + (r[c] === i ? ' checked' : '') + (o.locked ? ' disabled' : '') + '>' + mark + '</td>';
      });
      h += '<td>' + opt + '</td></tr>';
    });
    return h + '</tbody></table></div>';
  }

  function ta(it, o) {
    const sortId = 'sort' + ++uid;
    const opts = it.cols.map((c, i) => '<option value="' + i + '">' + c + '</option>').join('');
    return '<div class="q-text stem">' + it.intro + '</div>' +
      '<div class="sortbar"><label for="' + sortId + '"><b>Sort by:</b></label><select id="' + sortId + '" class="ta-sort"><option value="">Select…</option>' + opts + '</select></div>' +
      '<div class="table-wrap ta-table">' + taTable(it, null) + '</div>' +
      '<div class="q-text"><p>' + it.prompt + '</p></div>' + statementTable(it.labels, it.st, o.response, o);
  }

  function taTable(it, sortCol) {
    let rows = it.rows.slice();
    if (sortCol != null) {
      rows.sort((a, b) => {
        const x = a[sortCol], y = b[sortCol];
        if (typeof x === 'number' && typeof y === 'number') return x - y;
        return String(x).localeCompare(String(y));
      });
    }
    const numeric = it.cols.map((_, i) => it.rows.every((r) => typeof r[i] === 'number'));
    return '<table class="data"><thead><tr>' + it.cols.map((c, i) => '<th' + (numeric[i] ? ' class="n"' : '') + '>' + c + '</th>').join('') + '</tr></thead><tbody>' +
      rows.map((r) => '<tr>' + r.map((v, i) => '<td' + (numeric[i] ? ' class="n"' : '') + '>' + fmtCell(v) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
  }

  function gi(it, o) {
    const r = Array.isArray(o.response) ? o.response : [];
    let h = '<div class="q-text stem">' + it.intro + '</div><div class="chart">' + GM.Charts.render(it.chart) + '</div><div class="q-text"><p>' + it.prompt + '</p></div>';
    it.st.forEach((s, si) => {
      const sel = '<select class="gi-select' + (r[si] != null ? ' filled' : '') + '" data-s="' + si + '" aria-label="Statement ' + (si + 1) + ' answer"' + (o.locked ? ' disabled' : '') + '><option value="">Select…</option>' +
        s.opts.map((op, oi) => '<option value="' + oi + '"' + (r[si] === oi ? ' selected' : '') + '>' + String(op).replace(/<[^>]+>/g, '') + (o.reveal && oi === s.a ? '  ✓' : '') + '</option>').join('') + '</select>';
      h += '<p class="gi-statement">' + s.t.replace('[[]]', sel) + '</p>';
    });
    return h;
  }

  function wireGi(el, o, n) {
    const resp = Array.isArray(o.response) ? o.response.slice() : new Array(n).fill(null);
    el.querySelectorAll('select.gi-select').forEach((s) => {
      s.addEventListener('change', () => {
        resp[Number(s.dataset.s)] = s.value === '' ? null : Number(s.value);
        s.classList.toggle('filled', s.value !== '');
        o.onChange(resp.slice());
      });
    });
  }

  function msrQuestion(it, o) {
    if (it.kind === 'YN') return '<div class="q-text"><p>' + it.q + '</p></div>' + statementTable(it.labels, it.st, o.response, o);
    return '<div class="q-text stem">' + it.q + '</div>' + mcList(it.ch, o.response, Object.assign({ key: it.ans }, o));
  }

  /**
   * Render a question into `host`.
   * opts: { response, onChange, locked, reveal, unit, label }
   */
  function question(host, it, opts) {
    const o = Object.assign({ onChange: function () {}, locked: false, reveal: false }, opts || {});
    let html;
    const label = o.label ? '<div class="q-label">' + o.label + '</div>' : '';
    if (it.type === 'RC') {
      const p = o.unit.passage;
      html = '<div class="split"><div class="pane"><div class="passage">' + p.passage + '</div></div><div class="pane">' + label +
        '<div class="q-text stem">' + it.q + '</div>' + mcList(it.ch, o.response, Object.assign({ key: it.ans }, o)) + '</div></div>';
    } else if (it.type === 'MSR') {
      const s = o.unit.set;
      html = '<div class="split"><div class="pane"><div class="tabs" role="tablist">' +
        s.tabs.map((t, i) => '<button type="button" role="tab" class="tab' + (i === 0 ? ' on' : '') + '" data-tab="' + i + '">' + t.title + '</button>').join('') +
        '</div>' + s.tabs.map((t, i) => '<div class="tab-body"' + (i === 0 ? '' : ' hidden') + ' data-body="' + i + '">' + t.html + '</div>').join('') +
        '</div><div class="pane">' + label + msrQuestion(it, o) + '</div></div>';
    } else {
      let body;
      switch (it.type) {
        case 'PS': body = ps(it, o); break;
        case 'CR': body = cr(it, o); break;
        case 'DS': body = ds(it, o); break;
        case 'TPA': body = tpa(it, o); break;
        case 'TA': body = ta(it, o); break;
        case 'GI': body = gi(it, o); break;
        default: body = '<p>Unknown question type</p>';
      }
      html = '<div class="content-inner">' + label + body + '</div>';
    }
    host.innerHTML = html;

    if (!o.locked) {
      if (['PS', 'CR', 'DS', 'RC'].includes(it.type) || (it.type === 'MSR' && it.kind !== 'YN')) wireMc(host, o);
      else if (it.type === 'GI') wireGi(host, o, it.st.length);
      else if (it.type === 'TPA') wireParts(host, o, 2);
      else wireParts(host, o, it.st.length);
    }
    if (it.type === 'TA') {
      const sel = host.querySelector('.ta-sort');
      sel.addEventListener('change', () => {
        host.querySelector('.ta-table').innerHTML = taTable(it, sel.value === '' ? null : Number(sel.value));
      });
    }
    if (it.type === 'MSR') {
      host.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
        host.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === t));
        host.querySelectorAll('.tab-body').forEach((b) => { b.hidden = b.dataset.body !== t.dataset.tab; });
      }));
    }
    GM.Math.typeset(host);
  }

  /** Short human-readable form of a response, for the report. */
  function describe(it, resp) {
    if (resp == null) return '—';
    switch (it.type) {
      case 'TPA': return it.cols.map((c, i) => (resp[i] == null ? '—' : String(it.opts[resp[i]]).replace(/<[^>]+>/g, ''))).join(' / ');
      case 'TA': return resp.map((r) => (r == null ? '—' : it.labels[r])).join(', ');
      case 'GI': return resp.map((r, i) => (r == null ? '—' : String(it.st[i].opts[r]).replace(/<[^>]+>/g, ''))).join('; ');
      case 'MSR': return it.kind === 'YN' ? resp.map((r) => (r == null ? '—' : it.labels[r])).join(', ') : LETTERS[resp];
      default: return LETTERS[resp];
    }
  }

  GM.Render = { question, describe, DS_CHOICES, LETTERS };
})(typeof window !== 'undefined' ? window : globalThis);
