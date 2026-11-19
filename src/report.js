/* Post-exam performance report: scores, percentiles, ability path, accuracy, pacing, every question with explanations. */
(function (root) {
  'use strict';
  const GM = (root.GM = root.GM || {});
  const KEYS = ['quant', 'verbal', 'di'];

  const pct = (p) => (p == null ? '—' : (Number.isInteger(p) ? p : p.toFixed(1)) + suffix(p) + ' percentile');
  function suffix(p) {
    const n = Math.floor(p) % 100;
    if (!Number.isInteger(p)) return 'th';
    if (n >= 11 && n <= 13) return 'th';
    return { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th';
  }
  const mmss = (ms) => { const s = Math.round(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  function render(host, attempt, bank, handlers) {
    const r = attempt.results;
    const factor = attempt.settings.timeFactor || 1;
    let active = attempt.order[0];

    function header() {
      return '<header class="row" style="justify-content:space-between;align-items:flex-end"><div><div class="eyebrow">Score report</div><h1 style="font-size:30px;margin-top:6px">Mock exam results</h1>' +
        '<p class="lede">' + new Date(attempt.date).toLocaleString() + ' · Order: ' + attempt.order.map((k) => GM.SECTIONS[k].short).join(' → ') +
        (factor !== 1 ? ' · ' + (factor ? '×' + factor + ' time' : 'untimed') : '') + (attempt.settings.pretest ? ' · with unscored questions' : '') + '</p></div>' +
        '<div class="row"><button class="btn" id="r-home" type="button">Back to home</button><button class="btn btn-primary" id="r-new" type="button">Start a new mock</button></div></header>';
    }

    function hero() {
      return '<section class="score-hero"><div class="total-card"><div class="sub">Total score</div><div class="big">' + attempt.total + '</div><div>' + pct(attempt.totalPct) + '</div><div class="sub" style="margin-top:8px">Scale 205–805</div></div>' +
        '<div class="sec-cards">' + KEYS.map((k) => {
          const x = r[k];
          return '<div class="sec-card"><div class="eyebrow">' + GM.SECTIONS[k].name + '</div><div class="big">' + x.display + '</div><div class="meta">' + pct(x.percentile) + '</div>' +
            '<div class="meta">' + x.scoredCorrect + ' of ' + x.scoredCount + ' scored questions correct</div>' +
            (x.unanswered ? '<div><span class="pill bad">' + x.unanswered + ' unanswered · −' + x.penalty.toFixed(1) + ' pts</span></div>' : '') + '</div>';
        }).join('') + '</div></section>';
    }

    function groupBars(recs, keyFn) {
      const g = {};
      recs.forEach((rec) => {
        const k = keyFn(rec);
        g[k] = g[k] || { n: 0, c: 0, t: 0 };
        g[k].n++; g[k].c += rec.correct ? 1 : 0; g[k].t += rec.time;
      });
      return '<div class="bars">' + Object.entries(g).sort((a, b) => b[1].n - a[1].n).map(([k, v]) =>
        '<div class="barrow"><span>' + k + ' <span class="note">(' + v.n + ')</span></span><span class="track"><span class="fill" style="display:block;width:' + Math.round((100 * v.c) / v.n) + '%"></span></span><span class="num">' + v.c + '/' + v.n + ' · ' + mmss(v.t / v.n) + '</span></div>').join('') + '</div>';
    }

    function sectionDetail(k) {
      const sc = attempt.sections[k];
      const recs = sc.st.records;
      const res = r[k];
      const cfg = GM.SECTIONS[k];
      const scored = recs.filter((x) => !x.pretest && x.response != null);
      const target = factor ? (cfg.minutes * factor * 60000) / cfg.n : null;
      const avg = recs.length ? recs.reduce((a, x) => a + x.time, 0) / recs.length : 0;
      const typeName = (rec) => GM.TYPE_NAMES[bank.items[rec.id].type];
      const topic = (rec) => { const it = bank.items[rec.id]; return it.type === 'PS' ? it.cat + ': ' + it.sub : it.type === 'RC' ? 'RC: ' + it.sub : it.type + ': ' + it.sub; };
      const timeNote = target ? 'Average ' + mmss(avg) + ' per question (target ' + mmss(target) + ')' : 'Average ' + mmss(avg) + ' per question';
      let h = '<div class="row" style="justify-content:space-between"><div><h2 style="font-size:20px">' + cfg.name + ': <span class="num">' + res.display + '</span></h2>' +
        '<p class="note">' + timeNote + ' · Time used ' + mmss(sc.timeUsedMs || 0) + ' · Edits used ' + sc.editsUsed + ' of 3' + (sc.deductedMs ? ' · ' + mmss(sc.deductedMs) + ' deducted for break overrun' : '') + '</p></div></div>';
      h += '<div style="margin-top:12px"><h3 style="font-size:15px">Ability estimate after each question</h3><p class="note">Shown on the section scale. The shaded band is ±1 standard error; it narrows as the test learns more about you. Final score is computed from your final answers' + (res.penalty ? ' minus the unanswered penalty' : '') + '.</p>' +
        '<div class="chart" style="max-width:760px">' + GM.Charts.abilityPath(k, recs) + '</div>' +
        '<div class="legend"><span><i style="background:var(--good)"></i>Correct</span><span><i style="background:var(--bad)"></i>Incorrect</span><span><i style="border:2px solid var(--muted)"></i>Unscored</span></div></div>';
      h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:22px;margin-top:22px">' +
        '<div><h3 style="font-size:15px;margin-bottom:10px">Accuracy and time by question type</h3>' + (scored.length ? groupBars(scored, typeName) : '<p class="note">No scored answers.</p>') + '</div>' +
        '<div><h3 style="font-size:15px;margin-bottom:10px">Accuracy by topic</h3>' + (scored.length ? groupBars(scored, topic) : '<p class="note">No scored answers.</p>') + '</div></div>';
      h += '<h3 style="font-size:15px;margin:24px 0 8px">Questions</h3><p class="note">Select a row to see the question, the correct answer, and the explanation.</p><div class="table-wrap"><table class="qtable"><thead><tr><th>#</th><th>Type</th><th>Difficulty</th><th>Result</th><th>Your answer</th><th>Time</th><th></th></tr></thead><tbody>' +
        recs.map((rec, i) => {
          const it = bank.items[rec.id];
          const band = GM.Scoring.difficultyBand(it.irt.b);
          const result = rec.response == null ? '<span class="pill bad">Unanswered</span>' : rec.correct ? '<span class="pill good">Correct</span>' : '<span class="pill bad">Incorrect</span>';
          const tags = (rec.pretest ? '<span class="pill">Unscored</span> ' : '') + (rec.bookmarked ? '<span class="pill warn">Bookmarked</span> ' : '') + (rec.edits ? '<span class="pill acc">Edited</span>' : '');
          const slow = target && rec.time > target * 1.6 ? ' style="color:var(--warn);font-weight:600"' : '';
          return '<tr class="qrow" data-i="' + i + '" tabindex="0"><td class="n">' + rec.n + '</td><td>' + GM.TYPE_NAMES[it.type] + '</td><td>' + band.label + '</td><td>' + result + '</td><td>' + GM.Render.describe(it, rec.response) + (rec.edits && rec.firstResponse != null ? ' <span class="note">(was ' + GM.Render.describe(it, rec.firstResponse) + ')</span>' : '') + '</td><td class="n"' + slow + '>' + mmss(rec.time + (rec.reviewTime || 0)) + '</td><td>' + tags + '</td></tr>' +
            '<tr class="qdetail" data-d="' + i + '" hidden><td colspan="7"><div class="qd-host"></div></td></tr>';
        }).join('') + (res.unanswered && recs.length < sc.st.nTotal ? '<tr><td colspan="7" class="note">' + (sc.st.nTotal - recs.length) + ' question(s) not reached before time expired.</td></tr>' : '') + '</tbody></table></div>';
      return h;
    }

    function draw() {
      host.innerHTML = '<div class="screen"><div class="screen-inner">' + header() + hero() +
        '<section class="panel"><div class="seg" role="tablist">' + attempt.order.map((k) => '<button type="button" role="tab" data-k="' + k + '" class="' + (k === active ? 'on' : '') + '">' + GM.SECTIONS[k].name + '</button>').join('') + '</div>' +
        '<div id="sec-detail" style="margin-top:18px">' + sectionDetail(active) + '</div></section>' +
        '<section class="panel"><h2 style="font-size:17px">About these scores</h2><p class="note" style="max-width:75ch">Section scores come from an IRT ability estimate on your final answers, mapped to GMAC\'s percentile tables (Quant, Verbal, Total: August 2026, data July 2021 – June 2026; Data Insights: third-party compilation of 2026 data). The total is the equal-weight sum of the unrounded section scores, rounded to a score ending in 5. Question difficulty in this mock is expert-rated rather than calibrated on live data, so treat the result as an estimate within about ±30 points.</p>' +
        '<p class="disclaimer">GMAT™ is a trademark of GMAC, which does not endorse this practice tool.</p></section></div></div>';
      host.querySelector('#r-home').addEventListener('click', handlers.onHome);
      host.querySelector('#r-new').addEventListener('click', handlers.onRetake);
      host.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => { active = b.dataset.k; draw(); }));
      wireRows();
    }

    function wireRows() {
      const recs = attempt.sections[active].st.records;
      host.querySelectorAll('tr.qrow').forEach((tr) => {
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
            q.className = 'report-q';
            box.appendChild(q);
            GM.Render.question(q, it, { response: rec.response, unit: bank.unitsById[rec.unitId], locked: true, reveal: true });
            q.querySelectorAll('.split').forEach((s) => { s.style.height = 'auto'; });
            const ex = document.createElement('div');
            ex.className = 'explain';
            const key = GM.Render.describe(it, GM.CAT.correctAnswer(it));
            ex.innerHTML = '<b>Correct answer: ' + key + '.</b> ' + it.ex + '<div class="note" style="margin-top:6px">' + it.id + ' · ' + (it.sub || '') + ' · difficulty parameter b = ' + it.irt.b.toFixed(2) + (rec.pretest ? ' · unscored on this attempt' : '') + '</div>';
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

  GM.Report = { render };
})(typeof window !== 'undefined' ? window : globalThis);
