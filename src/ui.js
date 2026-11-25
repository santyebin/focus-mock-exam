/* Shared UI helpers: dialogs (exam and app styles), toasts, icons, formatting. */
(function (root) {
  'use strict';
  const GM = (root.GM = root.GM || {});

  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));

  function fmtClock(ms) {
    if (!isFinite(ms)) return '—:—';
    const neg = ms < 0;
    let s = Math.ceil(Math.abs(ms) / 1000);
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60); s -= m * 60;
    return (neg ? '+' : '') + (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(s).padStart(2, '0');
  }
  const mmss = (ms) => { const s = Math.round((ms || 0) / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  function ordinal(p) {
    if (p == null) return '—';
    if (!Number.isInteger(p)) return p.toFixed(1) + 'th';
    const n = p % 100;
    if (n >= 11 && n <= 13) return p + 'th';
    return p + ({ 1: 'st', 2: 'nd', 3: 'rd' }[p % 10] || 'th');
  }
  const pctLabel = (p) => (p == null ? '—' : ordinal(p) + ' percentile');
  const dateLabel = (t) => new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

  /* ---------- dialogs ---------- */
  let closeFn = null;
  let lastFocus = null;
  /**
   * modal(title, bodyHtml, buttons, opts)
   * buttons: [{ label, primary, onClick, keep }]   opts: { exam: true } for the exam-style dialog
   */
  function modal(title, body, buttons, opts) {
    closeModal();
    const o = opts || {};
    lastFocus = document.activeElement;
    const ov = document.createElement('div');
    ov.className = 'overlay' + (o.exam ? ' gx-overlay' : '');
    ov.innerHTML = '<div class="modal' + (o.exam ? ' gx-dialog' : '') + '" role="dialog" aria-modal="true" aria-labelledby="mdl-t" aria-describedby="mdl-b">' +
      '<header id="mdl-t">' + title + '</header><div class="body" id="mdl-b">' + body + '</div><footer></footer></div>';
    const foot = ov.querySelector('footer');
    buttons.forEach((b) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = o.exam ? 'gx-btn' + (b.primary ? ' gx-btn-primary' : '') : 'btn ' + (b.primary ? 'btn-primary' : '');
      el.textContent = b.label;
      el.addEventListener('click', () => { if (!b.keep) closeModal(); if (b.onClick) b.onClick(); });
      foot.appendChild(el);
    });
    ov.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') { // keep focus inside the dialog
        const f = $$('button, [href], input, select, textarea', ov).filter((x) => !x.disabled);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      } else if (e.key === 'Escape' && o.dismissable !== false && buttons.length) {
        const cancel = buttons.find((b) => !b.primary) || buttons[0];
        closeModal();
        if (cancel.onClick) cancel.onClick();
      }
    });
    document.body.appendChild(ov);
    const prim = foot.querySelector('.btn-primary, .gx-btn-primary') || foot.querySelector('button');
    if (prim) prim.focus();
    closeFn = () => { ov.remove(); if (lastFocus && lastFocus.isConnected) lastFocus.focus(); };
    return closeModal;
  }
  function closeModal() { if (closeFn) { const f = closeFn; closeFn = null; f(); } }
  const modalOpen = () => !!closeFn;

  function toast(text, ms) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.setAttribute('role', 'status');
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms || 5000);
  }

  /** Polite announcement for screen readers (timer warnings, answer feedback). */
  function announce(text) {
    let r = document.getElementById('sr-live');
    if (!r) {
      r = document.createElement('div');
      r.id = 'sr-live';
      r.className = 'sr-only';
      r.setAttribute('aria-live', 'polite');
      document.body.appendChild(r);
    }
    r.textContent = '';
    setTimeout(() => { r.textContent = text; }, 50);
  }

  /* ---------- icons (inline SVG, currentColor) ---------- */
  const svg = (p, extra) => '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" ' + (extra || 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"') + '>' + p + '</svg>';
  const ICON = {
    clock: svg('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>'),
    list: svg('<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 8h6M9 12h6M9 16h4"/>'),
    calc: svg('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11v6M8 15h2M12 15h2M8 18h2M12 18h2"/>'),
    pen: svg('<path d="M4 20l4-1 11-11-3-3L5 16l-1 4z"/><path d="M14 6l3 3"/>'),
    bookmark: svg('<path d="M7 3h10v18l-5-4-5 4z"/>'),
    bookmarkOn: svg('<path d="M7 3h10v18l-5-4-5 4z"/>', 'fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"'),
    next: svg('<path d="M9 5l7 7-7 7"/>'),
    prev: svg('<path d="M15 5l-7 7 7 7"/>'),
    grid: svg('<rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/>'),
    check: svg('<path d="M5 12l5 5 9-10"/>'),
    x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    flame: svg('<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-6 1 1 2 2 3 2 0-2-1-4 0-6z"/>'),
    target: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>'),
    share: svg('<path d="M12 15V3M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>'),
    download: svg('<path d="M12 3v12M8 11l4 4 4-4"/><path d="M5 19h14"/>'),
  };

  GM.UI = { esc, $, $$, fmtClock, mmss, ordinal, pctLabel, dateLabel, modal, closeModal, modalOpen, toast, announce, ICON };
})(typeof window !== 'undefined' ? window : globalThis);
