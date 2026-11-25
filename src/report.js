/*
 * Results: exam-style Score Preview, then the full report with score ranges, target gap, pacing coach,
 * ability path, accuracy by type and topic, every question with its explanation, and a shareable score card.
 */
(function (root) {
  'use strict';
  const GM = (root.GM = root.GM || {});
  const { esc, $, $$, mmss, pctLabel, dateLabel, ICON } = GM.UI;
  const KEYS = ['quant', 'verbal', 'di'];

  /* ---------- score preview (exam look) ---------- */
  function preview(host, a, bank, h) {
    const rows = a.order.map((k) => { const r = a.results[k]; return '<tr><td>' + GM.SECTIONS[k].name + '</td><td class="n">' + r.display + '</td><td>' + pctLabel(r.percentile) + '</td><td>' + r.lo + '–' + r.hi + '</td></tr>'; }).join('');
    const total = a.total != null ? '<tr class="total"><td><b>Total Score</b></td><td class="n">' + a.total + '</td><td>' + pctLabel(a.totalPct) + '</td><td>' + a.totalLo + '–' + a.totalHi + '</td></tr>' : '';
    host.innerHTML = '<div class="gx" aria-label="Score preview"><header class="gx-top"><div class="gx-gutter"><div class="gx-title">' + esc(a.title || 'Mock Exam') + ' — Score Preview</div></div></header>' +
      '<div class="gx-tools"><div class="gx-gutter"></div></div><main class="gx-main"><div class="gx-content gx-gutter"><h1>Your Unofficial Scores</h1>' +
      '<p>' + (a.total != null ? 'Section scores range from 60 to 90 and the Total Score from 205 to 805.' : 'Section scores range from 60 to 90.') + ' The range shows the likely spread of your score (one standard error either way).</p>' +
      '<table class="gx-scores"><thead><tr><th>Section</th><th>Score</th><th>Percentile</th><th>Likely range</th></tr></thead><tbody>' + rows + total + '</tbody></table>' +
      '<p>Your full report shows how the test adapted to you, your pacing, every question with its explanation, and what to practice next.</p></div></main>' +
      '<footer class="gx-bottom"><div class="gx-gutter"><div class="group"></div><div class="group"><button type="button" class="gx-nav primary" id="gx-report">View Full Report ' + ICON.next + '</button></div></div></footer></div>';
    $('#gx-report').addEventListener('click', h.onReport);
    $('#gx-report').focus();
  }

  /* ---------- pacing analysis ---------- */
  function pacing(sec, sc, res, bank) {
    const n = sc.st.nTotal;
    const T = isFinite(sc.timeLimitMs) ? sc.timeLimitMs / n : null;
    const recs = sc.st.records;
    const out = { T: T, stalls: [], rushes: [], stallMs: 0, rushCost: 0, unanswered: res.unanswered, penalty: res.penalty, firstHalfMs: 0, secondHalfMs: 0 };
    if (!T) return out;
    recs.forEach((r, i) => {
      if (r.time > 2 * T) { out.stalls.push(r); out.stallMs += r.time - 1.5 * T; }
      if (r.response != null && !r.correct && r.time < 0.4 * T) out.rushes.push(r);
      if (i < n / 2) out.firstHalfMs += r.time; else out.secondHalfMs += r.time;
    });
    const rushedScored = out.rushes.filter((r) => !r.pretest);
    if (rushedScored.length) {
      // expected score if the rushed questions had been answered at your ability level instead of rushed
      const resp = recs.filter((r) => !r.pretest && r.response != null).map((r) => {
        const it = bank.items[r.id].irt;
        const u = rushedScored.indexOf(r) >= 0 ? GM.IRT.prob(res.theta, it) : r.correct ? 1 : 0;
        return { a: it.a, b: it.b, c: it.c, u: u };
      });
      const alt = GM.IRT.eap(resp, sc.st.priorSd || 1);
      out.rushCost = Math.max(0, GM.Scoring.thetaToScore(sec, alt.theta) - res.base);
    }
    return out;
  }

  function pacingChart(sc, p) {
    const recs = sc.st.records, n = sc.st.nTotal;
    const limit = sc.timeLimitMs / 60000;
    const w = 640, h = 240, m = { l: 44, r: 14, t: 14, b: 32 };
    const pw = w - m.l - m.r, ph = h - m.t - m.b;
    const sx = (i) => m.l + (pw * i) / n;
    const sy = (min) => m.t + ph - (Math.min(min, limit * 1.05) / (limit * 1.05)) * ph;
    let g = '';
    for (let t = 0; t <= limit; t += limit > 50 ? 15 : 5) g += '<line class="ch-grid" x1="' + m.l + '" x2="' + (w - m.r) + '" y1="' + sy(t) + '" y2="' + sy(t) + '"/><text class="ch-tick" x="' + (m.l - 6) + '" y="' + (sy(t) + 4) + '" text-anchor="end">' + t + '</text>';
    let cum = 0;
    const pts = [[sx(0), sy(0)]];
    let marks = '';
    recs.forEach((r, i) => {
      cum += r.time / 60000;
      pts.push([sx(i + 1), sy(cum)]);
      const cls = p.stalls.indexOf(r) >= 0 ? 'mk-pre' : p.rushes.indexOf(r) >= 0 ? 'mk-bad' : 'mk-ok';
      marks += '<circle class="' + cls + '" cx="' + sx(i + 1).toFixed(1) + '" cy="' + sy(cum).toFixed(1) + '" r="4"><title>Q' + r.n + ': ' + mmss(r.time) + '</title></circle>';
    });
    const ideal = '<line class="ch-ideal" x1="' + sx(0) + '" y1="' + sy(0) + '" x2="' + sx(n) + '" y2="' + sy(limit) + '"/>';
    const path = '<polyline class="ln s1" points="' + pts.map((q) => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ') + '"/>';
    let xt = '';
    for (let i = 0; i <= n; i += n > 12 ? 5 : 2) xt += '<text class="ch-tick" x="' + sx(i) + '" y="' + (h - 10) + '" text-anchor="middle">' + i + '</text>';
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Minutes used after each question compared with an even pace">' + g + ideal + path + marks + xt +
      '<text class="ch-label" x="' + (m.l + pw / 2) + '" y="' + (h - 0) + '" text-anchor="middle">Question</text></svg>';
  }

  function coachHtml(sec, p) {
    if (!p.T) return '<p class="note">Untimed section: no pacing analysis.</p>';
    const items = [];
    if (!p.stalls.length && !p.rushes.length && !p.unanswered) items.push(['ok', 'Even pace', 'No question took more than twice the target of ' + mmss(p.T) + ', and you did not rush any question you missed.']);
    if (p.stalls.length) items.push(['', 'Stalled', p.stalls.length + ' question' + (p.stalls.length > 1 ? 's' : '') + ' (' + p.stalls.map((r) => 'Q' + r.n + ' ' + mmss(r.time)).join(', ') + ') took over twice the ' + mmss(p.T) + ' target, about ' + mmss(p.stallMs) + ' beyond a generous 1.5× budget.']);
    if (p.rushes.length) items.push(['bad', 'Rushed', p.rushes.length + ' question' + (p.rushes.length > 1 ? 's' : '') + ' answered in under ' + mmss(0.4 * p.T) + ' and missed (' + p.rushes.map((r) => 'Q' + r.n).join(', ') + '). Answered at your usual accuracy, they would have been worth about <b>' + p.rushCost.toFixed(1) + '</b> section point' + (Math.abs(p.rushCost - 1) < 0.05 ? '' : 's') + '.']);
    if (p.unanswered) items.push(['bad', 'Unfinished', p.unanswered + ' question' + (p.unanswered > 1 ? 's' : '') + ' left unanswered cost <b>' + p.penalty.toFixed(1) + '</b> section points. A guess costs far less than a blank.']);
    const ratio = p.secondHalfMs / Math.max(1, p.firstHalfMs);
    if (ratio < 0.6 && (p.rushes.length || p.unanswered)) items.push(['', 'Front-loaded', 'You spent ' + mmss(p.firstHalfMs) + ' on the first half and ' + mmss(p.secondHalfMs) + ' on the second. Time spent stalling early is what ran out at the end.']);
    return '<div class="coach">' + items.map((x) => '<div class="coach-item"><span class="tag ' + x[0] + '">' + x[1] + '</span><span>' + x[2] + '</span></div>').join('') + '</div>';
  }

  /* ---------- target gap ---------- */
  function targetHtml(a) {
    const t = GM.Store.target();
    if (!t) return '<section class="panel"><h2 style="font-size:1.08em">' + ICON.target + ' Set a target score</h2><p class="muted">Add your target total in <a href="#settings">Settings</a> to see what each section needs.</p></section>';
    if (a.total == null) return '';
    const need = 180 + ((t.total - 205) * 90) / 600; // section points needed for the target total
    const have = KEYS.reduce((s, k) => s + a.results[k].score, 0);
    const gap = need - have;
    const weakest = KEYS.slice().sort((x, y) => a.results[x].percentile - a.results[y].percentile)[0];
    const per = gap / 3;
    const rows = KEYS.map((k) => { const r = a.results[k]; const goal = Math.min(90, Math.ceil(r.score + Math.max(0, per))); return '<tr><td>' + GM.SECTIONS[k].name + '</td><td class="n">' + r.display + '</td><td class="n">' + (gap > 0 ? goal : '—') + '</td><td>' + pctLabel(r.percentile) + '</td></tr>'; }).join('');
    const days = t.date ? Math.ceil((new Date(t.date) - Date.now()) / 86400000) : null;
    const msg = gap <= 0
      ? '<p class="good-t"><b>You are at or above your target of ' + t.total + '.</b> Keep your timing steady; your range runs ' + a.totalLo + '–' + a.totalHi + '.</p>'
      : '<p>To reach <b>' + t.total + '</b> you need about <b>' + need.toFixed(0) + '</b> section points in total; you have ' + have.toFixed(0) + '. That is <b>+' + Math.ceil(gap) + '</b> points, about ' + (Math.ceil(gap) * 600 / 90).toFixed(0) + ' total points. Every section point is worth the same on the total; ' + GM.SECTIONS[weakest].name + ' is your lowest percentile, so it usually has the most room.</p>';
    return '<section class="panel"><h2 style="font-size:1.08em">' + ICON.target + ' Target ' + t.total + (days != null && days >= 0 ? ' <span class="muted">· ' + days + ' days to go</span>' : '') + '</h2>' + msg +
      (gap > 0 ? '<div class="table-wrap"><table class="gap-table"><thead><tr><th>Section</th><th>Now</th><th>Even split</th><th>Percentile now</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '') + '</section>';
  }

  /* ---------- share card ---------- */
  function scoreCard(a) {
    const c = document.createElement('canvas');
    c.width = 1200; c.height = 630;
    const x = c.getContext('2d');
    x.fillStyle = '#12385f'; x.fillRect(0, 0, 1200, 630);
    x.fillStyle = '#1d4c7c'; x.fillRect(0, 520, 1200, 110);
    x.fillStyle = '#ffffff';
    x.font = 'bold 34px Arial, Helvetica, sans-serif'; x.fillText('Focus Mock Exam', 64, 84);
    x.font = '24px Arial, Helvetica, sans-serif'; x.fillStyle = '#c9d6e4'; x.fillText((a.title || 'Mock Exam') + ' · ' + dateLabel(a.date), 64, 124);
    const big = a.total != null ? String(a.total) : String(a.results[a.order[0]].display);
    const sub = a.total != null ? 'Total score · ' + pctLabel(a.totalPct) + (a.totalLo ? ' · range ' + a.totalLo + '–' + a.totalHi : '') : GM.SECTIONS[a.order[0]].name + ' · ' + pctLabel(a.results[a.order[0]].percentile);
    x.fillStyle = '#ffffff'; x.font = 'bold 150px Arial, Helvetica, sans-serif'; x.fillText(big, 60, 300);
    x.font = '28px Arial, Helvetica, sans-serif'; x.fillStyle = '#e4ebf2'; x.fillText(sub, 64, 350);
    if (a.total != null) {
      KEYS.forEach((k, i) => {
        const r = a.results[k], X = 64 + i * 360;
        x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(X, 390, 330, 110);
        x.fillStyle = '#c9d6e4'; x.font = '22px Arial, Helvetica, sans-serif'; x.fillText(GM.SECTIONS[k].name, X + 18, 425);
        x.fillStyle = '#ffffff'; x.font = 'bold 46px Arial, Helvetica, sans-serif'; x.fillText(String(r.display), X + 18, 482);
        x.font = '22px Arial, Helvetica, sans-serif'; x.fillStyle = '#c9d6e4'; x.fillText(pctLabel(r.percentile), X + 100, 480);
      });
    }
    x.fillStyle = '#c9d6e4'; x.font = '20px Arial, Helvetica, sans-serif';
    x.fillText('Unofficial practice test in the GMAT™ exam format. GMAT™ is a trademark of GMAC.', 64, 582);
    return c;
  }

  function shareCard(a) {
    const c = scoreCard(a);
    c.toBlob((blob) => {
      const file = new File([blob], 'focus-mock-score.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: 'My Focus Mock Exam score' }).catch(() => {});
      } else {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'focus-mock-score-' + new Date(a.date).toISOString().slice(0, 10) + '.png';
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 2000);
      }
    }, 'image/png');
  }

  /* ---------- full report ---------- */
  function render(host, a, bank, handlers) {
    const r = a.results;
    const factor = a.settings.timeFactor || 1;
    let active = a.order[0];

    function hero() {
      const cards = a.order.map((k) => {
        const x = r[k];
        return '<div class="sec-card"><div class="eyebrow">' + GM.SECTIONS[k].name + '</div><div class="big">' + x.display + '</div><div class="range">' + (x.lo != null ? x.lo + '–' + x.hi : '') + '</div><div class="meta">' + pctLabel(x.percentile) + '</div>' +
          '<div class="meta">' + x.scoredCorrect + ' of ' + x.scoredCount + ' scored questions correct</div>' + (x.unanswered ? '<div><span class="pill bad">' + x.unanswered + ' unanswered · −' + x.penalty.toFixed(1) + '</span></div>' : '') + '</div>';
      }).join('');
      if (a.total == null) return '<section class="sec-cards" style="grid-template-columns:minmax(0,360px)">' + cards + '</section>';
      return '<section class="score-hero"><div class="total-card"><div class="sub">Total score</div><div class="big">' + a.total + '</div><div class="range">likely ' + a.totalLo + '–' + a.totalHi + '</div><div>' + pctLabel(a.totalPct) + '</div><div class="sub" style="margin-top:8px">Scale 205–805</div></div><div class="sec-cards">' + cards + '</div></section>';
    }

    function groupBars(recs, keyFn, practice) {
      const g = {};
      recs.forEach((rec) => { const k = keyFn(rec); g[k] = g[k] || { n: 0, c: 0, t: 0, sub: bank.items[rec.id].sub }; g[k].n++; g[k].c += rec.correct ? 1 : 0; g[k].t += rec.time; });
      return '<div class="bars">' + Object.entries(g).sort((x, y) => x[1].c / x[1].n - y[1].c / y[1].n).map(([k, v]) =>
        '<div class="barrow"><span>' + esc(k) + ' <span class="note">(' + v.n + ')</span>' + (practice && v.c < v.n ? ' <button class="btn btn-ghost" style="min-height:26px;padding:2px 8px" type="button" data-practice="' + esc(v.sub) + '">Practice</button>' : '') + '</span><span class="track"><span class="fill" style="display:block;width:' + Math.round((100 * v.c) / v.n) + '%"></span></span><span class="num">' + v.c + '/' + v.n + ' · ' + mmss(v.t / v.n) + '</span></div>').join('') + '</div>';
    }

    function sectionDetail(k) {
      const sc = a.sections[k];
      const recs = sc.st.records;
      const res = r[k];
      const cfg = GM.SECTIONS[k];
      const scored = recs.filter((x) => !x.pretest && x.response != null);
      const p = pacing(k, sc, res, bank);
      const target = factor ? (cfg.minutes * factor * 60000) / sc.st.nTotal : null;
      const typeName = (rec) => GM.TYPE_NAMES[bank.items[rec.id].type];
      const topic = (rec) => { const it = bank.items[rec.id]; return (it.type === 'PS' ? it.cat : it.type) + ': ' + it.sub; };
      let h = '<h2 style="font-size:1.2em">' + cfg.name + ': <span class="num">' + res.display + '</span> <span class="muted" style="font-size:.8em">likely ' + res.lo + '–' + res.hi + '</span></h2>' +
        '<p class="note">Time used ' + mmss(sc.timeUsedMs || 0) + (target ? ' · target ' + mmss(target) + ' per question' : '') + ' · Edits used ' + sc.editsUsed + ' of 3' + (sc.deductedMs ? ' · ' + mmss(sc.deductedMs) + ' deducted for break overrun' : '') + '</p>';
      h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:22px;margin-top:14px">' +
        '<div><h3 style="font-size:1em">Pacing coach</h3>' + coachHtml(k, p) + (p.T ? '<div class="chart" style="max-width:640px;margin-top:10px">' + pacingChart(sc, p) + '</div><div class="legend"><span><i style="background:var(--good)"></i>On pace</span><span><i style="border:2px solid var(--muted)"></i>Stalled</span><span><i style="background:var(--bad)"></i>Rushed and missed</span><span>Dashed line: even pace</span></div>' : '') + '</div>' +
        '<div><h3 style="font-size:1em">Ability estimate after each question</h3><p class="note">On the section scale; the band is ±1 standard error and narrows as the test learns about you.</p><div class="chart" style="max-width:640px">' + GM.Charts.abilityPath(k, recs) + '</div>' +
        '<div class="legend"><span><i style="background:var(--good)"></i>Correct</span><span><i style="background:var(--bad)"></i>Incorrect</span><span><i style="border:2px solid var(--muted)"></i>Unscored</span></div></div></div>';
      h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:22px;margin-top:22px">' +
        '<div><h3 style="font-size:1em;margin-bottom:10px">By question type</h3>' + (scored.length ? groupBars(scored, typeName) : '<p class="note">No scored answers.</p>') + '</div>' +
        '<div><h3 style="font-size:1em;margin-bottom:10px">By topic, weakest first</h3>' + (scored.length ? groupBars(scored, topic, true) : '<p class="note">No scored answers.</p>') + '</div></div>';
      h += '<h3 style="font-size:1em;margin:24px 0 8px">Questions</h3><p class="note">Select a row for the question, the correct answer and the explanation.</p><div class="table-wrap"><table class="qtable"><thead><tr><th>#</th><th>Type</th><th>Difficulty</th><th>Result</th><th>Your answer</th><th>Time</th><th></th></tr></thead><tbody>' +
        recs.map((rec, i) => {
          const it = bank.items[rec.id];
          const band = GM.Scoring.difficultyBand(it.irt.b);
          const result = rec.response == null ? '<span class="pill bad">Unanswered</span>' : rec.correct ? '<span class="pill good">Correct</span>' : '<span class="pill bad">Incorrect</span>';
          const tags = (rec.pretest ? '<span class="pill">Unscored</span> ' : '') + (rec.bookmarked ? '<span class="pill warn">Bookmarked</span> ' : '') + (rec.edits ? '<span class="pill acc">Edited</span>' : '');
          const slow = target && rec.time > target * 2 ? ' style="color:var(--warn);font-weight:600"' : '';
          return '<tr class="qrow" data-i="' + i + '" tabindex="0"><td class="n">' + rec.n + '</td><td>' + GM.TYPE_NAMES[it.type] + '</td><td>' + band.label + '</td><td>' + result + '</td><td>' + GM.Render.describe(it, rec.response) + (rec.edits && rec.firstResponse != null ? ' <span class="note">(was ' + GM.Render.describe(it, rec.firstResponse) + ')</span>' : '') + '</td><td class="n"' + slow + '>' + mmss(rec.time + (rec.reviewTime || 0)) + '</td><td>' + tags + '</td></tr>' +
            '<tr class="qdetail" data-d="' + i + '" hidden><td colspan="7"><div class="qd-host"></div></td></tr>';
        }).join('') + (res.unanswered && recs.length < sc.st.nTotal ? '<tr><td colspan="7" class="note">' + (sc.st.nTotal - recs.length) + ' question(s) not reached before time expired.</td></tr>' : '') + '</tbody></table></div>';
      return h;
    }

    function draw() {
      const mistakes = KEYS.filter((k) => a.sections[k]).reduce((n, k) => n + a.sections[k].st.records.filter((x) => x.response != null && !x.correct).length, 0);
      host.innerHTML = '<div class="screen-inner">' +
        '<header class="row" style="justify-content:space-between;align-items:flex-end"><div><div class="eyebrow">Score report</div><h1 style="font-size:1.9em;margin-top:6px">' + esc(a.title || 'Mock Exam') + '</h1>' +
        '<p class="lede">' + dateLabel(a.date) + ' · ' + a.order.map((k) => GM.SECTIONS[k].short).join(' → ') + (factor !== 1 ? ' · ' + (factor ? '×' + factor + ' time' : 'untimed') : '') + (a.formId ? ' · fixed form' : a.settings.pretest ? ' · with unscored questions' : '') + '</p></div>' +
        '<div class="row"><button class="btn" id="r-card" type="button">' + ICON.share + ' Share score card</button><button class="btn" id="r-home" type="button">Back to home</button></div></header>' +
        hero() + targetHtml(a) +
        (mistakes ? '<section class="panel row" style="justify-content:space-between"><div><b>' + mistakes + ' missed question' + (mistakes > 1 ? 's were' : ' was') + ' added to your mistake log.</b><div class="note">Review them now; each one comes back after 3, 7, 14 and 30 days until you get it right five times in a row.</div></div><button class="btn btn-primary" id="r-mistakes" type="button">Review mistakes</button></section>' : '') +
        '<section class="panel"><div class="seg" role="tablist">' + a.order.map((k) => '<button type="button" role="tab" aria-selected="' + (k === active) + '" data-k="' + k + '" class="' + (k === active ? 'on' : '') + '">' + GM.SECTIONS[k].name + '</button>').join('') + '</div>' +
        '<div id="sec-detail" style="margin-top:18px">' + sectionDetail(active) + '</div></section>' +
        '<section class="panel"><h2 style="font-size:1.05em">About these scores</h2><p class="note" style="max-width:75ch">Section scores come from an IRT ability estimate on your final answers, mapped to GMAC\'s percentile tables (Quant, Verbal, Total: August 2026; Data Insights: third-party compilation of 2026 data). The range is ±1 standard error. Question difficulty is expert-rated, not calibrated on live data, so treat results as estimates.</p>' +
        '<p class="disclaimer">GMAT™ is a trademark of GMAC, which does not endorse this practice tool.</p></section></div>';
      $('#r-home').addEventListener('click', handlers.onHome);
      $('#r-card').addEventListener('click', () => shareCard(a));
      const rm = $('#r-mistakes');
      if (rm) rm.addEventListener('click', handlers.reviewMistakes);
      $$('.seg button').forEach((b) => b.addEventListener('click', () => { active = b.dataset.k; draw(); }));
      $$('[data-practice]').forEach((b) => b.addEventListener('click', () => handlers.practiceTopic(active, b.dataset.practice)));
      wireRows();
    }

    function wireRows() {
      const recs = a.sections[active].st.records;
      $$('tr.qrow', host).forEach((tr) => {
        const open = () => {
          const i = Number(tr.dataset.i);
          const d = host.querySelector('tr[data-d="' + i + '"]');
          d.hidden = !d.hidden;
          if (!d.hidden && !d.dataset.done) {
            d.dataset.done = '1';
            const rec = recs[i];
            const it = bank.items[rec.id];
            const box = d.querySelector('.qd-host');
            const q = document.createElement('div');
            box.appendChild(q);
            GM.Render.question(q, it, { response: rec.response, unit: bank.unitsById[rec.unitId], locked: true, reveal: true });
            q.querySelectorAll('.split').forEach((s) => { s.style.height = 'auto'; });
            const ex = document.createElement('div');
            ex.className = 'explain';
            ex.innerHTML = '<b>Correct answer: ' + GM.Render.describe(it, GM.CAT.correctAnswer(it)) + '.</b> ' + it.ex + '<div class="note" style="margin-top:6px">' + it.id + ' · ' + esc(it.sub || '') + ' · difficulty b = ' + it.irt.b.toFixed(2) + (rec.pretest ? ' · unscored on this attempt' : '') + '</div>';
            box.appendChild(ex);
            GM.Math.typeset(ex);
          }
        };
        tr.addEventListener('click', open);
        tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      });
    }

    draw();
  }

  GM.Report = { preview, render, pacing, scoreCard, shareCard };
})(typeof window !== 'undefined' ? window : globalThis);
