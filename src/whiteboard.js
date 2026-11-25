/*
 * Whiteboard modeled on the online exam's: pen, line, rectangle, ellipse, text, eraser, pan and zoom on a large
 * canvas, colors, undo/redo, clear. Drawn as objects so it can be panned, zoomed, undone and erased shape by shape.
 */
(function (root) {
  'use strict';
  const GM = (root.GM = root.GM || {});
  const COLORS = ['#111111', '#1f5fbf', '#c0392b', '#1e8449'];
  const TOOLS = [
    ['pen', 'Pen', '<path d="M4 20l4-1 11-11-3-3L5 16l-1 4z"/>'],
    ['line', 'Line', '<path d="M5 19L19 5"/>'],
    ['rect', 'Rectangle', '<rect x="4" y="6" width="16" height="12"/>'],
    ['ellipse', 'Ellipse', '<ellipse cx="12" cy="12" rx="8" ry="6"/>'],
    ['text', 'Text', '<path d="M5 6h14M12 6v13"/>'],
    ['eraser', 'Eraser', '<path d="M8 20h12M4 15l9-9 6 6-7 7H8z"/>'],
    ['pan', 'Pan', '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>'],
  ];
  const ic = (p) => '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';

  const WB = {
    el: null, cv: null, ctx: null,
    tool: 'pen', color: COLORS[0], shapes: [], undoStack: [], redoStack: [], view: { x: 0, y: 0, z: 1 },
    draft: null, drag: null,

    toggle(force) {
      const open = force != null ? force : !this.el;
      if (!open) { if (this.el) { this.el.remove(); this.el = null; this.ro && this.ro.disconnect(); } GM.Tools.syncButton('gx-t-wb', false); return false; }
      if (this.el) return true;
      this.el = GM.Tools.panel('Whiteboard', 'wb', () => this.toggle(false));
      this.el.style.left = 'max(24px, env(safe-area-inset-left, 0px))';
      this.el.style.top = 'calc(96px + env(safe-area-inset-top, 0px))';
      const bar = document.createElement('div');
      bar.className = 'tools';
      bar.setAttribute('role', 'toolbar');
      bar.setAttribute('aria-label', 'Whiteboard tools');
      bar.innerHTML = TOOLS.map(([k, label, p]) => '<button type="button" data-tool="' + k + '" title="' + label + '" aria-label="' + label + '" aria-pressed="' + (k === this.tool) + '">' + ic(p) + '</button>').join('') +
        '<span class="sep"></span>' + COLORS.map((c, i) => '<button type="button" class="swatch" data-color="' + c + '" aria-label="Color ' + ['black', 'blue', 'red', 'green'][i] + '" aria-pressed="' + (c === this.color) + '" style="--sw:' + c + '"></button>').join('') +
        '<span class="sep"></span><button type="button" data-act="zin" title="Zoom in" aria-label="Zoom in">+</button><button type="button" data-act="zout" title="Zoom out" aria-label="Zoom out">−</button>' +
        '<button type="button" data-act="undo" title="Undo" aria-label="Undo">' + ic('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>') + '</button>' +
        '<button type="button" data-act="redo" title="Redo" aria-label="Redo">' + ic('<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>') + '</button>' +
        '<button type="button" data-act="clear" title="Clear" aria-label="Clear whiteboard">Clear</button>';
      const wrap = document.createElement('div');
      wrap.className = 'wb-canvas';
      const cv = document.createElement('canvas');
      cv.setAttribute('aria-label', 'Whiteboard drawing area');
      wrap.appendChild(cv);
      this.el.appendChild(bar);
      this.el.appendChild(wrap);
      this.cv = cv;
      this.ctx = cv.getContext('2d');
      bar.addEventListener('click', (e) => this.onBar(e));
      this.wire(cv);
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(wrap);
      GM.Tools.syncButton('gx-t-wb', true);
      return true;
    },

    onBar(e) {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.tool) { this.tool = b.dataset.tool; this.cv.style.cursor = this.tool === 'pan' ? 'grab' : this.tool === 'text' ? 'text' : 'crosshair'; }
      if (b.dataset.color) this.color = b.dataset.color;
      const act = b.dataset.act;
      if (act === 'zin') this.zoom(1.25);
      if (act === 'zout') this.zoom(0.8);
      if (act === 'undo' && this.undoStack.length) { this.redoStack.push(this.shapes); this.shapes = this.undoStack.pop(); }
      if (act === 'redo' && this.redoStack.length) { this.undoStack.push(this.shapes); this.shapes = this.redoStack.pop(); }
      if (act === 'clear' && this.shapes.length) { this.commit([]); }
      this.el.querySelectorAll('[data-tool]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.tool === this.tool)));
      this.el.querySelectorAll('[data-color]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.color === this.color)));
      this.draw();
    },

    commit(next) { this.undoStack.push(this.shapes); if (this.undoStack.length > 100) this.undoStack.shift(); this.redoStack = []; this.shapes = next; },

    zoom(f, cx, cy) {
      const v = this.view;
      const r = this.cv.getBoundingClientRect();
      const px = cx != null ? cx : r.width / 2, py = cy != null ? cy : r.height / 2;
      const z = Math.min(4, Math.max(0.25, v.z * f));
      v.x = px - ((px - v.x) * z) / v.z;
      v.y = py - ((py - v.y) * z) / v.z;
      v.z = z;
      this.draw();
    },

    resize() {
      if (!this.cv) return;
      const r = this.cv.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.cv.width = Math.max(1, Math.round(r.width * dpr));
      this.cv.height = Math.max(1, Math.round(r.height * dpr));
      this.cv.style.width = r.width + 'px';
      this.cv.style.height = r.height + 'px';
      this.draw();
    },

    toWorld(e) {
      const r = this.cv.getBoundingClientRect();
      return [(e.clientX - r.left - this.view.x) / this.view.z, (e.clientY - r.top - this.view.y) / this.view.z];
    },

    wire(cv) {
      cv.addEventListener('pointerdown', (e) => {
        cv.setPointerCapture(e.pointerId);
        const p = this.toWorld(e);
        if (this.tool === 'pan') { this.drag = { sx: e.clientX, sy: e.clientY, vx: this.view.x, vy: this.view.y }; cv.style.cursor = 'grabbing'; return; }
        if (this.tool === 'text') { this.placeText(e, p); return; }
        if (this.tool === 'eraser') { this.drag = { erasing: true, before: this.shapes }; this.eraseAt(p); return; }
        const w = this.tool === 'pen' ? 2.2 : 2;
        this.draft = this.tool === 'pen' ? { t: 'pen', c: this.color, w: w, pts: [p] } : { t: this.tool, c: this.color, w: w, a: p, b: p };
      });
      cv.addEventListener('pointermove', (e) => {
        if (this.drag && this.drag.sx != null) { this.view.x = this.drag.vx + e.clientX - this.drag.sx; this.view.y = this.drag.vy + e.clientY - this.drag.sy; this.draw(); return; }
        const p = this.toWorld(e);
        if (this.drag && this.drag.erasing) { this.eraseAt(p); return; }
        if (!this.draft) return;
        if (this.draft.t === 'pen') this.draft.pts.push(p); else this.draft.b = p;
        this.draw();
      });
      const end = () => {
        if (this.drag) {
          if (this.drag.erasing && this.drag.before !== this.shapes) { const after = this.shapes; this.shapes = this.drag.before; this.commit(after); }
          this.drag = null;
          cv.style.cursor = this.tool === 'pan' ? 'grab' : 'crosshair';
          this.draw();
          return;
        }
        if (this.draft) { this.commit(this.shapes.concat([this.draft])); this.draft = null; this.draw(); }
      };
      cv.addEventListener('pointerup', end);
      cv.addEventListener('pointercancel', end);
      cv.addEventListener('wheel', (e) => {
        e.preventDefault();
        const r = cv.getBoundingClientRect();
        if (e.ctrlKey || e.metaKey) this.zoom(e.deltaY < 0 ? 1.1 : 0.9, e.clientX - r.left, e.clientY - r.top);
        else { this.view.x -= e.deltaX; this.view.y -= e.deltaY; this.draw(); }
      }, { passive: false });
    },

    placeText(e, p) {
      const r = this.cv.getBoundingClientRect();
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'wb-text';
      input.setAttribute('aria-label', 'Text to add to the whiteboard');
      input.style.left = e.clientX - r.left + 'px';
      input.style.top = e.clientY - r.top - 12 + 'px';
      input.style.color = this.color;
      this.cv.parentElement.appendChild(input);
      setTimeout(() => input.focus(), 0);
      const done = (keep) => {
        if (!input.isConnected) return;
        const v = input.value.trim();
        input.remove();
        if (keep && v) { this.commit(this.shapes.concat([{ t: 'text', c: this.color, a: p, s: 18, text: v }])); this.draw(); }
      };
      input.addEventListener('keydown', (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') done(true); if (ev.key === 'Escape') done(false); });
      input.addEventListener('blur', () => done(true));
    },

    eraseAt(p) {
      const r = 10 / this.view.z;
      const keep = this.shapes.filter((s) => !this.hit(s, p, r));
      if (keep.length !== this.shapes.length) { this.shapes = keep; this.draw(); }
    },

    hit(s, p, r) {
      const d2seg = (a, b) => {
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const L = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L));
        const x = a[0] + t * dx - p[0], y = a[1] + t * dy - p[1];
        return Math.sqrt(x * x + y * y);
      };
      if (s.t === 'pen') { for (let i = 1; i < s.pts.length; i++) if (d2seg(s.pts[i - 1], s.pts[i]) < r) return true; return s.pts.length === 1 && d2seg(s.pts[0], s.pts[0]) < r; }
      if (s.t === 'line') return d2seg(s.a, s.b) < r;
      if (s.t === 'rect') { const [x1, y1] = s.a, [x2, y2] = s.b; return [[[x1, y1], [x2, y1]], [[x2, y1], [x2, y2]], [[x2, y2], [x1, y2]], [[x1, y2], [x1, y1]]].some(([a, b]) => d2seg(a, b) < r); }
      if (s.t === 'ellipse') {
        const cx = (s.a[0] + s.b[0]) / 2, cy = (s.a[1] + s.b[1]) / 2, rx = Math.abs(s.b[0] - s.a[0]) / 2, ry = Math.abs(s.b[1] - s.a[1]) / 2;
        for (let k = 0; k < 48; k++) { const t = (k / 48) * Math.PI * 2, x = cx + rx * Math.cos(t) - p[0], y = cy + ry * Math.sin(t) - p[1]; if (Math.sqrt(x * x + y * y) < r) return true; }
        return false;
      }
      if (s.t === 'text') { const w = s.text.length * s.s * 0.55; return p[0] >= s.a[0] - r && p[0] <= s.a[0] + w + r && p[1] >= s.a[1] - s.s - r && p[1] <= s.a[1] + r; }
      return false;
    },

    draw() {
      if (!this.ctx) return;
      const c = this.ctx, dpr = window.devicePixelRatio || 1, v = this.view;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, this.cv.width, this.cv.height);
      c.setTransform(dpr * v.z, 0, 0, dpr * v.z, dpr * v.x, dpr * v.y);
      c.lineCap = 'round';
      c.lineJoin = 'round';
      const all = this.draft ? this.shapes.concat([this.draft]) : this.shapes;
      all.forEach((s) => {
        c.strokeStyle = s.c; c.fillStyle = s.c; c.lineWidth = s.w || 2;
        c.beginPath();
        if (s.t === 'pen') { s.pts.forEach((pt, i) => (i ? c.lineTo(pt[0], pt[1]) : c.moveTo(pt[0], pt[1]))); if (s.pts.length === 1) c.lineTo(s.pts[0][0] + 0.1, s.pts[0][1]); c.stroke(); }
        else if (s.t === 'line') { c.moveTo(s.a[0], s.a[1]); c.lineTo(s.b[0], s.b[1]); c.stroke(); }
        else if (s.t === 'rect') { c.strokeRect(Math.min(s.a[0], s.b[0]), Math.min(s.a[1], s.b[1]), Math.abs(s.b[0] - s.a[0]), Math.abs(s.b[1] - s.a[1])); }
        else if (s.t === 'ellipse') { c.ellipse((s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2, Math.abs(s.b[0] - s.a[0]) / 2 || 0.1, Math.abs(s.b[1] - s.a[1]) / 2 || 0.1, 0, 0, Math.PI * 2); c.stroke(); }
        else if (s.t === 'text') { c.font = s.s + 'px Arial, Helvetica, sans-serif'; c.fillText(s.text, s.a[0], s.a[1]); }
      });
    },

    reset() { this.shapes = []; this.undoStack = []; this.redoStack = []; this.view = { x: 0, y: 0, z: 1 }; this.toggle(false); },
  };

  GM.Whiteboard = WB;
})(typeof window !== 'undefined' ? window : globalThis);
