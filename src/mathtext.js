/* Math rendering: MathJax (SVG output, no web fonts needed) with a plain-text fallback when offline. */
(function (root) {
  'use strict';
  const GM = (root.GM = root.GM || {});
  const SOURCES = [
    'https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-svg.js',
    'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js',
  ];
  let state = 'loading'; // loading | ready | failed
  const queue = [];

  /* ---- fallback: turn TeX into readable HTML ---- */
  function readGroup(s, i) {
    // s[i] === '{' ; returns [content, nextIndex]
    let depth = 0, j = i;
    for (; j < s.length; j++) {
      if (s[j] === '{') depth++;
      else if (s[j] === '}') { depth--; if (depth === 0) break; }
    }
    return [s.slice(i + 1, j), j + 1];
  }
  function arg(s, i) {
    while (s[i] === ' ') i++;
    if (s[i] === '{') return readGroup(s, i);
    return [s[i] || '', i + 1];
  }
  const SYMBOLS = { cdot: '·', times: '×', div: '÷', le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', pm: '±', pi: 'π', lfloor: '⌊', rfloor: '⌋', infty: '∞', circ: '°', ldots: '…', dots: '…', quad: ' ', ',': ' ', '%': '%', '$': '$', '{': '{', '}': '}' };
  function texToHtml(s) {
    let out = '';
    let i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (ch === '\\') {
        const m = /^\\([a-zA-Z]+|.)/.exec(s.slice(i));
        const name = m[1];
        i += m[0].length;
        if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
          const [a, i1] = arg(s, i);
          const [b, i2] = arg(s, i1);
          i = i2;
          out += '<span class="frac-fb">(' + texToHtml(a) + ')/(' + texToHtml(b) + ')</span>';
        } else if (name === 'sqrt') {
          const [a, i1] = arg(s, i);
          i = i1;
          out += '√(' + texToHtml(a) + ')';
        } else if (name === 'binom') {
          const [a, i1] = arg(s, i);
          const [b, i2] = arg(s, i1);
          i = i2;
          out += 'C(' + texToHtml(a) + ', ' + texToHtml(b) + ')';
        } else if (name === 'left' || name === 'right' || name === 'displaystyle') {
          // drop sizing commands
        } else if (SYMBOLS[name] != null) {
          out += SYMBOLS[name];
        } else {
          out += name;
        }
      } else if (ch === '^' || ch === '_') {
        const [a, i1] = arg(s, i + 1);
        i = i1;
        const tag = ch === '^' ? 'sup' : 'sub';
        out += '<' + tag + '>' + texToHtml(a) + '</' + tag + '>';
      } else if (ch === '{' ) {
        const [a, i1] = readGroup(s, i);
        i = i1;
        out += texToHtml(a);
      } else {
        out += ch;
        i++;
      }
    }
    return out;
  }
  function fallbackHtml(html) {
    return html.replace(/\\\(([\s\S]*?)\\\)/g, (m, tex) => '<span class="math-fb">' + texToHtml(tex) + '</span>');
  }
  function applyFallback(el) {
    el.querySelectorAll('[data-math]').forEach((n) => { n.removeAttribute('data-math'); });
    el.innerHTML = fallbackHtml(el.innerHTML);
  }

  function typeset(el) {
    if (!el) return;
    if (state === 'ready') {
      try {
        root.MathJax.typesetClear && root.MathJax.typesetClear([el]);
        root.MathJax.typesetPromise([el]).catch(() => applyFallback(el));
      } catch (e) { applyFallback(el); }
    } else if (state === 'failed') {
      applyFallback(el);
    } else {
      queue.push(el);
    }
  }

  function flush() {
    const els = queue.splice(0);
    els.forEach((el) => { if (el.isConnected) typeset(el); });
  }

  function load(k) {
    if (k >= SOURCES.length) { state = 'failed'; flush(); return; }
    const sc = document.createElement('script');
    sc.src = SOURCES[k];
    sc.async = true;
    sc.onerror = () => load(k + 1);
    document.head.appendChild(sc);
  }

  function init() {
    if (typeof document === 'undefined') return;
    root.MathJax = {
      tex: { inlineMath: [['\\(', '\\)']], displayMath: [['\\[', '\\]']] },
      svg: { fontCache: 'global' },
      options: { enableMenu: false },
      startup: {
        typeset: false,
        ready: function () {
          root.MathJax.startup.defaultReady();
          state = 'ready';
          flush();
        },
      },
    };
    load(0);
    // Give up on MathJax after 8 s (offline or blocked) and show readable plain text instead.
    setTimeout(() => { if (state === 'loading') { state = 'failed'; flush(); } }, 8000);
  }

  GM.Math = { init, typeset, texToHtml, fallbackHtml };
})(typeof window !== 'undefined' ? window : globalThis);
