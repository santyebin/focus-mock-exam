/* SVG charts: Graphics Interpretation figures and the report's ability-path chart. Colors come from CSS tokens. */
(function (root) {
  'use strict';
  const GM = (root.GM = root.GM || {});
  const W = 640, H = 380;
  const M = { l: 62, r: 18, t: 40, b: 58 };

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const fmt = (v) => (Math.abs(v) >= 1000 ? v.toLocaleString('en-US') : String(Math.round(v * 100) / 100));

  function frame(spec, inner, legend) {
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(spec.title || 'Chart') + '">' +
      '<text class="ch-title" x="' + W / 2 + '" y="22" text-anchor="middle">' + esc(spec.title || '') + '</text>' +
      inner + (legend || '') + '</svg>';
  }

  function yAxis(spec, plotH) {
    const y0 = spec.yMin || 0, y1 = spec.yMax, step = spec.yStep;
    const sy = (v) => M.t + plotH - ((v - y0) / (y1 - y0)) * plotH;
    let g = '';
    for (let v = y0; v <= y1 + 1e-9; v += step) {
      const y = sy(v);
      g += '<line class="ch-grid" x1="' + M.l + '" x2="' + (W - M.r) + '" y1="' + y + '" y2="' + y + '"/>';
      g += '<text class="ch-tick" x="' + (M.l - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + fmt(v) + '</text>';
    }
    if (spec.yLabel) g += '<text class="ch-label" transform="translate(16 ' + (M.t + plotH / 2) + ') rotate(-90)" text-anchor="middle">' + esc(spec.yLabel) + '</text>';
    return { g, sy };
  }

  function legendFor(series) {
    if (!series || series.length < 2) return '';
    let x = M.l, out = '';
    series.forEach((s, i) => {
      out += '<rect class="s' + (i + 1) + '" x="' + x + '" y="' + (H - 18) + '" width="12" height="12" rx="2"/>' +
        '<text class="ch-tick" x="' + (x + 18) + '" y="' + (H - 8) + '">' + esc(s.name) + '</text>';
      x += 30 + s.name.length * 7.5;
    });
    return out;
  }

  function barLike(spec, grouped) {
    const plotW = W - M.l - M.r, plotH = H - M.t - M.b;
    const { g, sy } = yAxis(spec, plotH);
    const cats = spec.categories, ns = spec.series.length;
    const band = plotW / cats.length;
    const inner = band * 0.62;
    const bw = grouped ? inner / ns : inner;
    let bars = '';
    cats.forEach((c, ci) => {
      const x0 = M.l + ci * band + (band - inner) / 2;
      spec.series.forEach((s, si) => {
        const v = s.values[ci];
        const x = grouped ? x0 + si * bw : x0;
        const y = sy(v), base = sy(spec.yMin || 0);
        bars += '<rect class="s' + (si + 1) + '" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + (bw - 2).toFixed(1) + '" height="' + Math.max(0, base - y).toFixed(1) + '"><title>' + esc(s.name + ', ' + c + ': ' + fmt(v)) + '</title></rect>';
      });
      bars += '<text class="ch-tick" x="' + (M.l + ci * band + band / 2) + '" y="' + (M.t + plotH + 18) + '" text-anchor="middle">' + esc(c) + '</text>';
    });
    const axis = '<line class="ch-axis" x1="' + M.l + '" x2="' + (W - M.r) + '" y1="' + sy(spec.yMin || 0) + '" y2="' + sy(spec.yMin || 0) + '"/>';
    const xl = spec.xLabel ? '<text class="ch-label" x="' + (M.l + plotW / 2) + '" y="' + (H - 26) + '" text-anchor="middle">' + esc(spec.xLabel) + '</text>' : '';
    return frame(spec, g + bars + axis + xl, legendFor(spec.series));
  }

  function line(spec) {
    const plotW = W - M.l - M.r, plotH = H - M.t - M.b;
    const { g, sy } = yAxis(spec, plotH);
    const cats = spec.categories;
    const sx = (i) => M.l + (plotW * (i + 0.5)) / cats.length;
    let out = '';
    cats.forEach((c, i) => { out += '<text class="ch-tick" x="' + sx(i) + '" y="' + (M.t + plotH + 18) + '" text-anchor="middle">' + esc(c) + '</text>'; });
    spec.series.forEach((s, si) => {
      const pts = s.values.map((v, i) => sx(i).toFixed(1) + ',' + sy(v).toFixed(1)).join(' ');
      out += '<polyline class="ln s' + (si + 1) + '" points="' + pts + '"/>';
      s.values.forEach((v, i) => { out += '<circle class="s' + (si + 1) + '" cx="' + sx(i).toFixed(1) + '" cy="' + sy(v).toFixed(1) + '" r="4"><title>' + esc(s.name + ', ' + cats[i] + ': ' + fmt(v)) + '</title></circle>'; });
    });
    const axis = '<line class="ch-axis" x1="' + M.l + '" x2="' + (W - M.r) + '" y1="' + sy(spec.yMin || 0) + '" y2="' + sy(spec.yMin || 0) + '"/>';
    return frame(spec, g + axis + out, legendFor(spec.series));
  }

  function scatter(spec) {
    const plotW = W - M.l - M.r, plotH = H - M.t - M.b;
    const { g, sy } = yAxis(spec, plotH);
    const sx = (v) => M.l + ((v - spec.xMin) / (spec.xMax - spec.xMin)) * plotW;
    let gx = '';
    for (let v = spec.xMin; v <= spec.xMax + 1e-9; v += spec.xStep) {
      gx += '<line class="ch-grid" x1="' + sx(v) + '" x2="' + sx(v) + '" y1="' + M.t + '" y2="' + (M.t + plotH) + '"/>';
      gx += '<text class="ch-tick" x="' + sx(v) + '" y="' + (M.t + plotH + 18) + '" text-anchor="middle">' + fmt(v) + '</text>';
    }
    let pts = '';
    spec.points.forEach((p) => { pts += '<circle class="s1" cx="' + sx(p[0]).toFixed(1) + '" cy="' + sy(p[1]).toFixed(1) + '" r="5"><title>(' + fmt(p[0]) + ', ' + fmt(p[1]) + ')</title></circle>'; });
    const xl = spec.xLabel ? '<text class="ch-label" x="' + (M.l + plotW / 2) + '" y="' + (H - 14) + '" text-anchor="middle">' + esc(spec.xLabel) + '</text>' : '';
    const axis = '<line class="ch-axis" x1="' + M.l + '" x2="' + (W - M.r) + '" y1="' + (M.t + plotH) + '" y2="' + (M.t + plotH) + '"/><line class="ch-axis" x1="' + M.l + '" x2="' + M.l + '" y1="' + M.t + '" y2="' + (M.t + plotH) + '"/>';
    return frame(spec, g + gx + axis + pts + xl);
  }

  function pie(spec) {
    const cx = 210, cy = 210, r = 150;
    const total = spec.slices.reduce((s, x) => s + x.value, 0);
    let a0 = -Math.PI / 2, out = '', legend = '';
    spec.slices.forEach((sl, i) => {
      const a1 = a0 + (sl.value / total) * Math.PI * 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)];
      const p1 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
      out += '<path class="p' + ((i % 6) + 1) + ' slice" d="M' + cx + ',' + cy + ' L' + p0[0].toFixed(1) + ',' + p0[1].toFixed(1) + ' A' + r + ',' + r + ' 0 ' + large + ' 1 ' + p1[0].toFixed(1) + ',' + p1[1].toFixed(1) + ' Z"><title>' + esc(sl.label + ': ' + sl.value + '%') + '</title></path>';
      const am = (a0 + a1) / 2;
      out += '<text class="ch-pie" x="' + (cx + r * 0.66 * Math.cos(am)).toFixed(1) + '" y="' + (cy + r * 0.66 * Math.sin(am) + 4).toFixed(1) + '" text-anchor="middle">' + sl.value + '%</text>';
      legend += '<rect class="p' + ((i % 6) + 1) + '" x="400" y="' + (90 + i * 30) + '" width="14" height="14" rx="2"/><text class="ch-tick" x="422" y="' + (102 + i * 30) + '">' + esc(sl.label) + ' (' + sl.value + '%)</text>';
      a0 = a1;
    });
    return '<svg viewBox="0 0 ' + W + ' 420" role="img" aria-label="' + esc(spec.title) + '"><text class="ch-title" x="' + W / 2 + '" y="24" text-anchor="middle">' + esc(spec.title) + '</text><g transform="translate(0 10)">' + out + legend + '</g></svg>';
  }

  function render(spec) {
    switch (spec.kind) {
      case 'bar': return barLike(spec, false);
      case 'groupbar': return barLike(spec, true);
      case 'line': return line(spec);
      case 'scatter': return scatter(spec);
      case 'pie': return pie(spec);
      default: return '<p>Unsupported chart</p>';
    }
  }

  /** Ability path: score-equivalent of the ability estimate after each question, with a ±1 SE band. */
  function abilityPath(section, records) {
    const w = 640, h = 260, m = { l: 44, r: 14, t: 16, b: 34 };
    const pw = w - m.l - m.r, ph = h - m.t - m.b;
    const n = Math.max(records.length, 1);
    const sx = (i) => m.l + (pw * (i + 0.5)) / n;
    const sy = (s) => m.t + ph - ((s - 60) / 30) * ph;
    const toS = (t) => GM.Scoring.thetaToScore(section, t);
    let g = '';
    for (let s = 60; s <= 90; s += 5) {
      g += '<line class="ch-grid" x1="' + m.l + '" x2="' + (w - m.r) + '" y1="' + sy(s) + '" y2="' + sy(s) + '"/><text class="ch-tick" x="' + (m.l - 8) + '" y="' + (sy(s) + 4) + '" text-anchor="end">' + s + '</text>';
    }
    const pts = [], upper = [], lower = [];
    records.forEach((r, i) => {
      const th = r.thetaAfter != null ? r.thetaAfter : r.thetaBefore;
      const se = r.seAfter != null ? r.seAfter : 1;
      pts.push([sx(i), sy(toS(th))]);
      upper.push([sx(i), sy(toS(th + se))]);
      lower.push([sx(i), sy(toS(th - se))]);
    });
    let band = '';
    if (pts.length > 1) band = '<polygon class="band" points="' + upper.concat(lower.reverse()).map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ') + '"/>';
    const path = pts.length > 1 ? '<polyline class="ln s1" points="' + pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ') + '"/>' : '';
    let marks = '';
    records.forEach((r, i) => {
      const cls = r.response == null ? 'mk-blank' : r.pretest ? 'mk-pre' : r.correct ? 'mk-ok' : 'mk-bad';
      marks += '<circle class="' + cls + '" cx="' + pts[i][0].toFixed(1) + '" cy="' + pts[i][1].toFixed(1) + '" r="5"><title>Q' + r.n + (r.pretest ? ' (unscored)' : '') + (r.response == null ? ' unanswered' : r.correct ? ' correct' : ' incorrect') + '</title></circle>';
      if (n <= 23 && (i % (n > 12 ? 2 : 1) === 0)) marks += '<text class="ch-tick" x="' + pts[i][0].toFixed(1) + '" y="' + (h - 12) + '" text-anchor="middle">' + r.n + '</text>';
    });
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Ability estimate after each question">' + g + band + path + marks + '</svg>';
  }

  GM.Charts = { render, abilityPath };
})(typeof window !== 'undefined' ? window : globalThis);
