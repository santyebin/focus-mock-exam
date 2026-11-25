/* Progress dashboard: score trend against the target, topic mastery, pacing trend, and practice activity. */
(function (root) {
  'use strict';
  const GM = (root.GM = root.GM || {});
  const { esc, $$, mmss, dateLabel, ICON } = GM.UI;
  const Store = GM.Store;
  const KEYS = ['quant', 'verbal', 'di'];
  const DAY = 86400000;

  function lineChart(series, opts) {
    const w = 680, h = 260, m = { l: 46, r: 16, t: 14, b: 34 };
    const pw = w - m.l - m.r, ph = h - m.t - m.b;
    const n = Math.max(...series.map((s) => s.values.length), 1);
    const sx = (i) => m.l + (n === 1 ? pw / 2 : (pw * i) / (n - 1));
    const sy = (v) => m.t + ph - ((v - opts.min) / (opts.max - opts.min)) * ph;
    let g = '';
    for (let v = opts.min; v <= opts.max; v += opts.step) g += '<line class="ch-grid" x1="' + m.l + '" x2="' + (w - m.r) + '" y1="' + sy(v) + '" y2="' + sy(v) + '"/><text class="ch-tick" x="' + (m.l - 6) + '" y="' + (sy(v) + 4) + '" text-anchor="end">' + v + '</text>';
    if (opts.target) g += '<line class="ch-target" x1="' + m.l + '" x2="' + (w - m.r) + '" y1="' + sy(opts.target) + '" y2="' + sy(opts.target) + '"/><text class="ch-tick" x="' + (w - m.r) + '" y="' + (sy(opts.target) - 5) + '" text-anchor="end">Target ' + opts.target + '</text>';
    let lines = '';
    series.forEach((s, si) => {
      const pts = s.values.map((v, i) => (v == null ? null : [sx(i), sy(v)])).filter(Boolean);
      if (pts.length > 1) lines += '<polyline class="ln s' + (si + 1) + '" points="' + pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ') + '"/>';
      s.values.forEach((v, i) => { if (v != null) lines += '<circle class="ch-dot s' + (si + 1) + '" cx="' + sx(i).toFixed(1) + '" cy="' + sy(v).toFixed(1) + '" r="4.5"><title>' + esc(s.name) + ': ' + v + (opts.labels ? ' · ' + opts.labels[i] : '') + '</title></circle>'; });
    });
    let xt = '';
    if (opts.labels) opts.labels.forEach((l, i) => { if (n <= 10 || i % Math.ceil(n / 10) === 0) xt += '<text class="ch-tick" x="' + sx(i) + '" y="' + (h - 12) + '" text-anchor="middle">' + esc(l) + '</text>'; });
    const legend = series.length > 1 ? '<div class="legend">' + series.map((s, i) => '<span><i style="background:var(--c' + (i + 1) + ')"></i>' + esc(s.name) + '</span>').join('') + '</div>' : '';
    return '<div class="chart-box"><svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(opts.title) + '">' + g + lines + xt + '</svg></div>' + legend;
  }

  function barChart(values, labels, title) {
    const w = 680, h = 160, m = { l: 34, r: 10, t: 10, b: 26 };
    const pw = w - m.l - m.r, ph = h - m.t - m.b;
    const max = Math.max(5, ...values);
    const bw = pw / values.length;
    let s = '';
    values.forEach((v, i) => {
      const bh = (v / max) * ph;
      s += '<rect class="s1" x="' + (m.l + i * bw + 1).toFixed(1) + '" y="' + (m.t + ph - bh).toFixed(1) + '" width="' + Math.max(1, bw - 2).toFixed(1) + '" height="' + bh.toFixed(1) + '"><title>' + labels[i] + ': ' + v + ' questions</title></rect>';
      if (i % 7 === 0) s += '<text class="ch-tick" x="' + (m.l + i * bw + bw / 2).toFixed(1) + '" y="' + (h - 8) + '" text-anchor="middle">' + labels[i] + '</text>';
    });
    s += '<text class="ch-tick" x="' + (m.l - 6) + '" y="' + (m.t + 8) + '" text-anchor="end">' + max + '</text><line class="ch-axis" x1="' + m.l + '" x2="' + (w - m.r) + '" y1="' + (m.t + ph) + '" y2="' + (m.t + ph) + '"/>';
    return '<div class="chart-box"><svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(title) + '">' + s + '</svg></div>';
  }

  function render(host, opts) {
    const bank = opts.bank;
    const hist = Store.attempts().slice().reverse(); // oldest first
    const full = hist.filter((a) => a.total != null);
    const target = Store.target();
    const events = Store.itemEvents().filter((e) => bank.items[e.id]);
    const now = Date.now();

    // topic mastery across everything answered
    const topics = {};
    events.forEach((e) => {
      const it = bank.items[e.id];
      const k = it.section + '|' + it.sub;
      const t = topics[k] || (topics[k] = { section: it.section, sub: it.sub, n: 0, c: 0, time: 0, recent: [] });
      t.n++; t.c += e.correct ? 1 : 0; t.time += e.time; t.recent.push(e.correct ? 1 : 0);
    });
    const topicList = Object.values(topics).filter((t) => t.n >= 2).sort((a, b) => a.c / a.n - b.c / b.n);

    // activity: questions per day, last 28 days
    const days = [], labels = [];
    for (let i = 27; i >= 0; i--) {
      const d0 = new Date(now - i * DAY); d0.setHours(0, 0, 0, 0);
      const d1 = d0.getTime() + DAY;
      days.push(events.filter((e) => e.date >= d0.getTime() && e.date < d1).length);
      labels.push(d0.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    }
    let streak = 0;
    for (let i = days.length - 1; i >= 0 && days[i] > 0; i--) streak++;
    const last30 = events.filter((e) => e.date > now - 30 * DAY);
    const acc30 = last30.length ? Math.round((100 * last30.filter((e) => e.correct).length) / last30.length) : null;
    const lastFull = full[full.length - 1];

    host.innerHTML = '<div class="screen-inner"><header><div class="eyebrow">Progress</div><h1 style="font-size:1.8em;margin-top:6px">Your progress</h1></header>' +
      '<section class="stat-row">' +
      '<div class="stat"><div class="v">' + (lastFull ? lastFull.total : '—') + '</div><div class="k">Latest total' + (lastFull && lastFull.totalLo ? ' (' + lastFull.totalLo + '–' + lastFull.totalHi + ')' : '') + '</div></div>' +
      '<div class="stat"><div class="v">' + (target ? target.total : '—') + '</div><div class="k">Target' + (target && target.date ? ' · ' + dateLabel(target.date) : '') + '</div></div>' +
      '<div class="stat"><div class="v">' + hist.length + '</div><div class="k">Mocks and section tests</div></div>' +
      '<div class="stat"><div class="v">' + events.length + '</div><div class="k">Questions answered</div></div>' +
      '<div class="stat"><div class="v">' + (acc30 != null ? acc30 + '%' : '—') + '</div><div class="k">Accuracy, last 30 days</div></div>' +
      '<div class="stat"><div class="v">' + streak + '</div><div class="k">Day streak</div></div></section>' +
      (full.length ? '<section class="panel"><h2 style="font-size:1.08em">Total score</h2>' + lineChart([{ name: 'Total', values: full.map((a) => a.total) }], { min: 205, max: 805, step: 100, target: target && target.total, labels: full.map((a) => new Date(a.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })), title: 'Total score by mock' }) + '</section>' : '<section class="panel"><p class="empty">Take a full mock to start your score trend. <a href="#home">Start a mock</a></p></section>') +
      (hist.length ? '<section class="panel"><h2 style="font-size:1.08em">Section scores</h2>' + lineChart(KEYS.map((k) => ({ name: GM.SECTIONS[k].name, values: hist.map((a) => (a.results[k] ? a.results[k].display : null)) })), { min: 60, max: 90, step: 5, labels: hist.map((a) => new Date(a.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })), title: 'Section scores by attempt' }) + '</section>' : '') +
      '<section class="panel"><h2 style="font-size:1.08em">Weakest topics</h2>' + (topicList.length ? '<p class="note">Across every mock, section test and practice set. Topics with at least 2 answers.</p><div class="table-wrap"><table class="gap-table heat"><thead><tr><th>Topic</th><th>Section</th><th>Accuracy</th><th>Answered</th><th>Avg time</th><th></th></tr></thead><tbody>' +
        topicList.slice(0, 12).map((t) => { const acc = Math.round((100 * t.c) / t.n); return '<tr><td>' + esc(t.sub) + '</td><td>' + GM.SECTIONS[t.section].short + '</td><td class="acc"><span class="bar" style="width:' + Math.max(4, acc * 0.8) + 'px"></span> ' + acc + '%</td><td class="n">' + t.n + '</td><td class="n">' + mmss(t.time / t.n) + '</td><td><button class="btn" type="button" data-topic="' + esc(t.section + '|' + t.sub) + '">Practice</button></td></tr>'; }).join('') +
        '</tbody></table></div>' : '<p class="empty">Answer a few questions to see which topics need work.</p>') + '</section>' +
      (hist.length ? '<section class="panel"><h2 style="font-size:1.08em">Pacing</h2><p class="note">Average time per question; the target is 2:09 in Quant, 1:57 in Verbal and 2:15 in Data Insights.</p><div class="table-wrap"><table class="gap-table"><thead><tr><th>Date</th>' + KEYS.map((k) => '<th>' + GM.SECTIONS[k].short + '</th>').join('') + '<th>Unanswered</th></tr></thead><tbody>' +
        hist.slice(-10).reverse().map((a) => '<tr><td>' + dateLabel(a.date) + '</td>' + KEYS.map((k) => { const sc = a.sections[k]; if (!sc) return '<td class="muted">—</td>'; const recs = sc.st.records; const avg = recs.reduce((s, r) => s + r.time, 0) / Math.max(1, recs.length); const T = isFinite(sc.timeLimitMs) ? sc.timeLimitMs / sc.st.nTotal : null; return '<td class="n' + (T && avg > T * 1.1 ? ' warn-t' : '') + '">' + mmss(avg) + '</td>'; }).join('') + '<td class="n">' + KEYS.reduce((s, k) => s + (a.results[k] ? a.results[k].unanswered : 0), 0) + '</td></tr>').join('') +
        '</tbody></table></div></section>' : '') +
      '<section class="panel"><h2 style="font-size:1.08em">Activity, last 4 weeks</h2>' + barChart(days, labels, 'Questions answered per day') + '</section></div>';
    $$('[data-topic]', host).forEach((b) => b.addEventListener('click', () => { const [sec, sub] = b.dataset.topic.split('|'); opts.practiceTopic(sec, sub); }));
  }

  GM.Progress = { render };
})(typeof window !== 'undefined' ? window : globalThis);
