/* Mistake log: every missed or very slow question, due at once and then after 3, 7, 14 and 30 days, until it is answered right five times in a row. */
(function (root) {
  'use strict';
  const GM = (root.GM = root.GM || {});
  const { esc, $, $$, dateLabel, modal } = GM.UI;
  const Store = GM.Store;

  function render(host, opts) {
    const bank = opts.bank;
    const m = Store.srs();
    const now = Date.now();
    const ids = Object.keys(m).filter((id) => bank.items[id] || /^MY-/.test(id));
    const active = ids.filter((id) => !m[id].mastered);
    const due = active.filter((id) => m[id].due <= now);
    const mastered = ids.filter((id) => m[id].mastered);
    let filter = { section: 'all', reason: 'all' };

    function rows() {
      return active.filter((id) => bank.items[id])
        .filter((id) => filter.section === 'all' || bank.items[id].section === filter.section)
        .filter((id) => filter.reason === 'all' || m[id].reason === filter.reason)
        .sort((a, b) => m[a].due - m[b].due);
    }

    function draw() {
      const list = rows();
      host.innerHTML = '<div class="screen-inner"><header><div class="eyebrow">Mistake log</div><h1 style="font-size:1.8em;margin-top:6px">Mistake log</h1>' +
        '<p class="lede">Every question you miss, and every correct one that took over twice the target time, lands here. It is due right away. Each correct review moves it up a box, and it comes back after 3, 7, 14 and then 30 days. A miss sends it back to box 1, due the next day. Five right in a row and it is mastered.</p></header>' +
        '<section class="stat-row"><div class="stat"><div class="v">' + due.length + '</div><div class="k">Due now</div></div><div class="stat"><div class="v">' + active.length + '</div><div class="k">In the log</div></div><div class="stat"><div class="v">' + mastered.length + '</div><div class="k">Mastered</div></div></section>' +
        '<section class="panel row" style="justify-content:space-between"><div><b>' + (due.length ? due.length + ' question' + (due.length > 1 ? 's are' : ' is') + ' due for review.' : 'Nothing is due right now.') + '</b><div class="note">' + (due.length ? 'Reviews run in study mode, with the explanation after each answer.' : active.length ? 'Next review: ' + dateLabel(Math.min.apply(null, active.map((id) => m[id].due))) + '.' : 'Take a mock or a practice set; missed questions appear here.') + '</div></div>' +
        '<button class="btn btn-primary" id="m-review" type="button"' + (due.length ? '' : ' disabled') + '>Review ' + Math.min(due.length, 20) + ' due</button></section>' +
        (active.length ? '<section class="panel"><div class="row" style="margin-bottom:10px"><label class="field" style="min-width:160px"><span>Section</span><select id="m-sec"><option value="all">All sections</option>' + ['quant', 'verbal', 'di'].map((k) => '<option value="' + k + '"' + (filter.section === k ? ' selected' : '') + '>' + GM.SECTIONS[k].name + '</option>').join('') + '</select></label>' +
          '<label class="field" style="min-width:160px"><span>Reason</span><select id="m-reason"><option value="all">Missed or slow</option><option value="wrong"' + (filter.reason === 'wrong' ? ' selected' : '') + '>Missed</option><option value="slow"' + (filter.reason === 'slow' ? ' selected' : '') + '>Slow but right</option></select></label></div>' +
          '<div class="table-wrap"><table class="qtable"><thead><tr><th>Question</th><th>Topic</th><th>Why</th><th>Box</th><th>Next review</th><th></th></tr></thead><tbody>' +
          list.map((id) => { const it = bank.items[id], e = m[id]; return '<tr><td>' + id + '<div class="note">' + GM.TYPE_NAMES[it.type] + '</div></td><td>' + esc(it.sub) + '</td><td>' + (e.reason === 'slow' ? '<span class="pill warn">Slow</span>' : '<span class="pill bad">Missed</span>') + '</td><td class="n">' + e.box + ' of 5</td><td>' + (e.due <= now ? '<b>Due now</b>' : dateLabel(e.due)) + '</td><td class="row"><button class="btn" type="button" data-one="' + id + '">Review</button><button class="btn btn-ghost" type="button" data-rm="' + id + '" aria-label="Remove ' + id + ' from the log">Remove</button></td></tr>'; }).join('') +
          '</tbody></table></div></section>' : '<p class="empty">Your mistake log is empty.</p>') + '</div>';
      $('#m-review').addEventListener('click', () => opts.startReview(due.slice(0, 20)));
      const s = $('#m-sec'); if (s) s.addEventListener('change', (e) => { filter.section = e.target.value; draw(); });
      const r = $('#m-reason'); if (r) r.addEventListener('change', (e) => { filter.reason = e.target.value; draw(); });
      $$('[data-one]').forEach((b) => b.addEventListener('click', () => opts.startReview([b.dataset.one])));
      $$('[data-rm]').forEach((b) => b.addEventListener('click', () => modal('Remove from the log?', '<p>' + b.dataset.rm + ' will no longer come back for review.</p>', [{ label: 'Cancel' }, { label: 'Remove', primary: true, onClick: () => { Store.removeMistake(b.dataset.rm); render(host, opts); } }])));
    }
    draw();
  }

  GM.Mistakes = { render };
})(typeof window !== 'undefined' ? window : globalThis);
