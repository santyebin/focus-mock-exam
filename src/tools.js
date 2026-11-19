/* On-screen calculator (Data Insights only) and whiteboard, as draggable floating panels. */
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
      const x = Math.min(Math.max(0, ox + e.clientX - sx), window.innerWidth - 80);
      const y = Math.min(Math.max(0, oy + e.clientY - sy), window.innerHeight - 40);
      panel.style.left = x + 'px';
      panel.style.top = y + 'px';
      panel.style.right = 'auto';
    });
    handle.addEventListener('pointerup', () => { dragging = false; });
  }

  function panel(title, cls, onClose) {
    const el = document.createElement('div');
    el.className = 'float ' + cls;
    el.innerHTML = '<div class="handle"><span>' + title + '</span><button type="button" aria-label="Close ' + title + '">×</button></div>';
    el.querySelector('.handle button').addEventListener('click', onClose);
    makeDraggable(el, el.querySelector('.handle'));
    document.body.appendChild(el);
    return el;
  }

  /* ---------------- calculator ---------------- */
  const Calculator = {
    el: null,
    s: { acc: null, op: null, entry: '0', fresh: true, mem: 0, hist: '' },
    toggle(force) {
      const open = force != null ? force : !this.el;
      if (!open) { if (this.el) { this.el.remove(); this.el = null; } return false; }
      if (this.el) return true;
      this.el = panel('Calculator', 'calc', () => { this.toggle(false); GM.App && GM.App.onToolClosed('calc'); });
      this.el.style.right = 'max(24px, env(safe-area-inset-right, 0px))';
      this.el.style.top = 'calc(76px + env(safe-area-inset-top, 0px))';
      const keys = ['MC', 'MR', 'M+', 'C', '7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', '±', '+', '√', '%', '←', '='];
      const body = document.createElement('div');
      body.innerHTML = '<div class="display" aria-live="polite"><small></small><span>0</span></div><div class="keys">' +
        keys.map((k) => '<button type="button" data-k="' + k + '" class="' + ('÷×−+'.includes(k) ? 'op' : k === '=' ? 'eq' : '') + '">' + k + '</button>').join('') + '</div>';
      this.el.appendChild(body);
      body.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) this.press(b.dataset.k); });
      this.show();
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
      if (/^[0-9]$/.test(k)) {
        s.entry = s.fresh || s.entry === '0' ? k : s.entry.length < 14 ? s.entry + k : s.entry;
        s.fresh = false;
      } else if (k === '.') {
        if (s.fresh) { s.entry = '0.'; s.fresh = false; } else if (!s.entry.includes('.')) s.entry += '.';
      } else if ('+−×÷'.includes(k)) {
        if (s.op && !s.fresh) s.acc = this.apply(s.acc, s.op, this.num());
        else if (s.op == null || s.acc == null) s.acc = this.num();
        s.op = k; s.fresh = true;
        s.hist = this.fmt(s.acc) + ' ' + k;
        s.entry = this.fmt(s.acc);
      } else if (k === '=') {
        if (s.op != null) {
          const b = this.num();
          s.hist = this.fmt(s.acc) + ' ' + s.op + ' ' + this.fmt(b) + ' =';
          s.acc = this.apply(s.acc, s.op, b);
          s.entry = this.fmt(s.acc); s.op = null; s.fresh = true;
        }
      } else if (k === 'C') {
        Object.assign(s, { acc: null, op: null, entry: '0', fresh: true, hist: '' });
      } else if (k === '←') {
        if (!s.fresh) s.entry = s.entry.length > 1 ? s.entry.slice(0, -1) : '0';
      } else if (k === '±') {
        s.entry = this.fmt(-this.num());
      } else if (k === '√') {
        s.hist = '√(' + s.entry + ')';
        s.entry = this.fmt(Math.sqrt(this.num())); s.fresh = true;
      } else if (k === '%') {
        const b = this.num();
        s.entry = this.fmt(s.op === '+' || s.op === '−' ? (s.acc * b) / 100 : b / 100); s.fresh = true;
      } else if (k === 'MC') { s.mem = 0; }
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

  /* ---------------- whiteboard ---------------- */
  const Whiteboard = {
    el: null, mode: 'pen', strokes: null,
    toggle(force) {
      const open = force != null ? force : !this.el;
      if (!open) {
        if (this.el) { this.strokes = this.el.querySelector('canvas').toDataURL(); this.el.remove(); this.el = null; }
        return false;
      }
      if (this.el) return true;
      this.el = panel('Whiteboard', 'wb', () => { this.toggle(false); GM.App && GM.App.onToolClosed('wb'); });
      this.el.style.left = 'max(24px, env(safe-area-inset-left, 0px))';
      this.el.style.top = 'calc(76px + env(safe-area-inset-top, 0px))';
      const tools = document.createElement('div');
      tools.className = 'tools';
      tools.innerHTML = '<button type="button" data-m="pen" class="on">Pen</button><button type="button" data-m="erase">Eraser</button><button type="button" data-m="clear">Clear</button>';
      const cv = document.createElement('canvas');
      this.el.appendChild(tools);
      this.el.appendChild(cv);
      tools.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.m === 'clear') { const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height); return; }
        this.mode = b.dataset.m;
        tools.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      });
      requestAnimationFrame(() => this.setup(cv));
      return true;
    },
    setup(cv) {
      const dpr = window.devicePixelRatio || 1;
      const r = cv.getBoundingClientRect();
      cv.width = Math.round(r.width * dpr);
      cv.height = Math.round(r.height * dpr);
      const c = cv.getContext('2d');
      c.scale(dpr, dpr);
      c.lineCap = 'round'; c.lineJoin = 'round';
      if (this.strokes) { const img = new Image(); img.onload = () => c.drawImage(img, 0, 0, r.width, r.height); img.src = this.strokes; }
      let drawing = false;
      const pos = (e) => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
      cv.addEventListener('pointerdown', (e) => {
        drawing = true; cv.setPointerCapture(e.pointerId);
        const [x, y] = pos(e);
        c.globalCompositeOperation = this.mode === 'erase' ? 'destination-out' : 'source-over';
        c.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--fg').trim() || '#000';
        c.lineWidth = this.mode === 'erase' ? 18 : 2.2;
        c.beginPath(); c.moveTo(x, y);
      });
      cv.addEventListener('pointermove', (e) => { if (!drawing) return; const [x, y] = pos(e); c.lineTo(x, y); c.stroke(); });
      cv.addEventListener('pointerup', () => { drawing = false; });
    },
    reset() { this.strokes = null; this.toggle(false); },
  };

  GM.Tools = { Calculator, Whiteboard };
})(typeof window !== 'undefined' ? window : globalThis);
