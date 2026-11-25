/* Floating tool panels (draggable) and the on-screen calculator (Data Insights only). */
(function (root) {
  'use strict';
  const GM = (root.GM = root.GM || {});

  function makeDraggable(panel, handle) {
    let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;
    handle.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      dragging = true;
      sx = e.clientX; sy = e.clientY;
      const r = panel.getBoundingClientRect();
      ox = r.left; oy = r.top;
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      panel.style.left = Math.min(Math.max(0, ox + e.clientX - sx), window.innerWidth - 80) + 'px';
      panel.style.top = Math.min(Math.max(0, oy + e.clientY - sy), window.innerHeight - 40) + 'px';
      panel.style.right = 'auto';
    });
    handle.addEventListener('pointerup', () => { dragging = false; });
  }

  /** A floating, draggable panel with a title bar and close button. */
  function panel(title, cls, onClose) {
    const el = document.createElement('div');
    el.className = 'float ' + cls;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', title);
    el.innerHTML = '<div class="handle"><span>' + title + '</span><button type="button" aria-label="Close ' + title + '">×</button></div>';
    el.querySelector('.handle button').addEventListener('click', onClose);
    makeDraggable(el, el.querySelector('.handle'));
    document.body.appendChild(el);
    return el;
  }

  function syncButton(id, on) {
    const b = document.getElementById(id);
    if (b) b.setAttribute('aria-pressed', String(!!on));
  }

  const Calculator = {
    el: null,
    s: { acc: null, op: null, entry: '0', fresh: true, mem: 0, hist: '' },
    toggle(force) {
      const open = force != null ? force : !this.el;
      if (!open) { if (this.el) { this.el.remove(); this.el = null; } syncButton('gx-t-calc', false); return false; }
      if (this.el) return true;
      this.el = panel('Calculator', 'calc', () => this.toggle(false));
      this.el.style.right = 'max(24px, env(safe-area-inset-right, 0px))';
      this.el.style.top = 'calc(96px + env(safe-area-inset-top, 0px))';
      const keys = ['MC', 'MR', 'M+', 'C', '7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', '±', '+', '√', '%', '←', '='];
      const labels = { '÷': 'divide', '×': 'multiply', '−': 'subtract', '+': 'add', '=': 'equals', '√': 'square root', '%': 'percent', '←': 'backspace', '±': 'change sign', C: 'clear', MC: 'memory clear', MR: 'memory recall', 'M+': 'memory add' };
      const body = document.createElement('div');
      body.innerHTML = '<div class="display" aria-live="polite"><small></small><span>0</span></div><div class="keys">' +
        keys.map((k) => '<button type="button" data-k="' + k + '"' + (labels[k] ? ' aria-label="' + labels[k] + '"' : '') + ' class="' + ('÷×−+'.includes(k) ? 'op' : k === '=' ? 'eq' : '') + '">' + k + '</button>').join('') + '</div>';
      this.el.appendChild(body);
      body.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) this.press(b.dataset.k); });
      this.show();
      syncButton('gx-t-calc', true);
      return true;
    },
    num() { return parseFloat(this.s.entry); },
    apply(a, op, b) {
      switch (op) {
        case '+': return a + b;
        case '−': return a - b;
        case '×': return a * b;
        case '÷': return b === 0 ? NaN : a / b;
        default: return b;
      }
    },
    fmt(v) {
      if (!isFinite(v)) return 'Error';
      const r = Math.round(v * 1e10) / 1e10;
      let t = String(r);
      if (t.length > 14) t = r.toPrecision(10).replace(/\.?0+$/, '');
      return t;
    },
    press(k) {
      const s = this.s;
      if (/^[0-9]$/.test(k)) { s.entry = s.fresh || s.entry === '0' ? k : s.entry.length < 14 ? s.entry + k : s.entry; s.fresh = false; }
      else if (k === '.') { if (s.fresh) { s.entry = '0.'; s.fresh = false; } else if (!s.entry.includes('.')) s.entry += '.'; }
      else if ('+−×÷'.includes(k)) {
        if (s.op && !s.fresh) s.acc = this.apply(s.acc, s.op, this.num());
        else if (s.op == null || s.acc == null) s.acc = this.num();
        s.op = k; s.fresh = true; s.hist = this.fmt(s.acc) + ' ' + k; s.entry = this.fmt(s.acc);
      } else if (k === '=') {
        if (s.op != null) { const b = this.num(); s.hist = this.fmt(s.acc) + ' ' + s.op + ' ' + this.fmt(b) + ' ='; s.acc = this.apply(s.acc, s.op, b); s.entry = this.fmt(s.acc); s.op = null; s.fresh = true; }
      } else if (k === 'C') Object.assign(s, { acc: null, op: null, entry: '0', fresh: true, hist: '' });
      else if (k === '←') { if (!s.fresh) s.entry = s.entry.length > 1 ? s.entry.slice(0, -1) : '0'; }
      else if (k === '±') s.entry = this.fmt(-this.num());
      else if (k === '√') { s.hist = '√(' + s.entry + ')'; s.entry = this.fmt(Math.sqrt(this.num())); s.fresh = true; }
      else if (k === '%') { const b = this.num(); s.entry = this.fmt(s.op === '+' || s.op === '−' ? (s.acc * b) / 100 : b / 100); s.fresh = true; }
      else if (k === 'MC') s.mem = 0;
      else if (k === 'MR') { s.entry = this.fmt(s.mem); s.fresh = true; }
      else if (k === 'M+') { s.mem += this.num(); s.fresh = true; }
      this.show();
    },
    show() {
      if (!this.el) return;
      this.el.querySelector('.display span').textContent = this.s.entry;
      this.el.querySelector('.display small').textContent = (this.s.mem ? 'M  ' : '') + this.s.hist;
    },
    key(e) {
      if (!this.el) return false;
      const map = { '*': '×', '/': '÷', '-': '−', '+': '+', Enter: '=', '=': '=', Backspace: '←', Escape: 'C', '.': '.', '%': '%' };
      const k = /^[0-9]$/.test(e.key) ? e.key : map[e.key];
      if (!k) return false;
      this.press(k);
      return true;
    },
    reset() { this.s = { acc: null, op: null, entry: '0', fresh: true, mem: 0, hist: '' }; this.toggle(false); },
  };

  GM.Tools = { Calculator, panel, makeDraggable, syncButton };
})(typeof window !== 'undefined' ? window : globalThis);
