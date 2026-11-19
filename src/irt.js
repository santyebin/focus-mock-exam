/* Item response theory: 3PL model, Fisher information, EAP ability estimation. */
(function (root) {
  'use strict';
  const GM = (root.GM = root.GM || {});

  const D = 1.702; // logistic scaling constant (makes the logistic curve match the normal ogive)

  // Quadrature grid for EAP: -4 .. +4 in steps of 0.05 (161 points)
  const GRID = [];
  for (let k = -80; k <= 80; k++) GRID.push(k / 20);

  function prob(theta, it) {
    return it.c + (1 - it.c) / (1 + Math.exp(-D * it.a * (theta - it.b)));
  }

  function info(theta, it) {
    const P = prob(theta, it);
    const Q = 1 - P;
    const r = (P - it.c) / (1 - it.c);
    return D * D * it.a * it.a * (Q / P) * r * r;
  }

  /**
   * Expected a posteriori estimate of ability.
   * @param {Array<{a:number,b:number,c:number,u:0|1}>} responses
   * @param {number} priorSd standard deviation of the N(0, sd) prior
   * @returns {{theta:number, se:number}}
   */
  function eap(responses, priorSd) {
    const sd = priorSd || 1;
    const logPost = new Array(GRID.length);
    let max = -Infinity;
    for (let g = 0; g < GRID.length; g++) {
      const t = GRID[g];
      let lp = -0.5 * (t / sd) * (t / sd);
      for (let i = 0; i < responses.length; i++) {
        const r = responses[i];
        const P = prob(t, r);
        lp += r.u ? Math.log(P) : Math.log(1 - P);
      }
      logPost[g] = lp;
      if (lp > max) max = lp;
    }
    let w = 0, m1 = 0, m2 = 0;
    for (let g = 0; g < GRID.length; g++) {
      const p = Math.exp(logPost[g] - max);
      w += p;
      m1 += p * GRID[g];
      m2 += p * GRID[g] * GRID[g];
    }
    const theta = m1 / w;
    const variance = Math.max(m2 / w - theta * theta, 1e-9);
    return { theta: theta, se: Math.sqrt(variance) };
  }

  // Standard normal CDF (Zelen & Severo 26.2.17, |error| < 7.5e-8)
  function normCdf(x) {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
    const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return x > 0 ? 1 - p : p;
  }

  // Inverse normal CDF (Acklam's rational approximation, |rel error| < 1.2e-9)
  function normInv(p) {
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
    const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
    const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    const pl = 0.02425;
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    let q, r;
    if (p < pl) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p > 1 - pl) {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    q = p - 0.5;
    r = q * q;
    return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }

  GM.IRT = { D, GRID, prob, info, eap, normCdf, normInv };
})(typeof window !== 'undefined' ? window : globalThis);
