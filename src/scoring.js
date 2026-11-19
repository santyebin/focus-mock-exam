/* Score scales, percentile tables, theta -> scaled score, unanswered penalty, total score. */
(function (root) {
  'use strict';
  const GM = (root.GM = root.GM || {});

  /*
   * Percentile = share of test takers who scored AT OR BELOW the score.
   * Quant, Verbal, Total: GMAC score concordance tables, published Aug 2026,
   *   data period July 1, 2021 - June 30, 2026.
   * Data Insights: GMAC publishes no DI concordance PDF; values are the third-party
   *   compilation of GMAC's 2026 DI percentiles (integers). Refresh when GMAC updates.
   */
  const TABLES = {
    quant: { 90: 100.0, 89: 96.6, 88: 95.4, 87: 93.4, 86: 90.9, 85: 87.8, 84: 84.6, 83: 80.1, 82: 75.3, 81: 69.8, 80: 63.9, 79: 57.3, 78: 50.2, 77: 43.4, 76: 37.7, 75: 32.6, 74: 27.6, 73: 23.4, 72: 19.9, 71: 16.6, 70: 13.8, 69: 11.4, 68: 9.1, 67: 7.2, 66: 5.4, 65: 4.1, 64: 3.1, 63: 2.4, 62: 1.8, 61: 1.4, 60: 1.0 },
    verbal: { 90: 100.0, 89: 99.0, 88: 98.4, 87: 97.4, 86: 95.7, 85: 92.6, 84: 87.3, 83: 81.1, 82: 72.9, 81: 64.3, 80: 54.4, 79: 46.0, 78: 37.7, 77: 29.9, 76: 23.0, 75: 18.2, 74: 14.0, 73: 10.5, 72: 7.8, 71: 5.8, 70: 4.3, 69: 3.4, 68: 2.8, 67: 2.2, 66: 1.8, 65: 1.5, 64: 1.3, 63: 1.1, 62: 0.9, 61: 0.8, 60: 0.7 },
    di: { 90: 100, 89: 100, 88: 99, 87: 99, 86: 99, 85: 98, 84: 97, 83: 95, 82: 93, 81: 88, 80: 83, 79: 76, 78: 69, 77: 61, 76: 52, 75: 46, 74: 40, 73: 34, 72: 29, 71: 24, 70: 20, 69: 17, 68: 14, 67: 11, 66: 10, 65: 8, 64: 7, 63: 5, 62: 5, 61: 4, 60: 3 },
    total: { 805: 100.0, 795: 100.0, 785: 100.0, 775: 100.0, 765: 99.9, 755: 99.8, 745: 99.6, 735: 99.4, 725: 98.9, 715: 98.6, 705: 97.5, 695: 96.9, 685: 95.1, 675: 94.0, 665: 91.2, 655: 89.6, 645: 85.6, 635: 80.9, 625: 78.2, 615: 75.4, 605: 69.4, 595: 66.3, 585: 59.9, 575: 56.7, 565: 50.4, 555: 47.4, 545: 41.7, 535: 39.1, 525: 34.0, 515: 31.6, 505: 27.3, 495: 25.4, 485: 21.7, 475: 20.1, 465: 17.1, 455: 15.7, 445: 13.2, 435: 12.1, 425: 10.2, 415: 9.3, 405: 7.7, 395: 7.0, 385: 5.8, 375: 5.2, 365: 4.3, 355: 3.9, 345: 3.1, 335: 2.8, 325: 2.2, 315: 2.0, 305: 1.5, 295: 1.3, 285: 1.0, 275: 0.9, 265: 0.7, 255: 0.6, 245: 0.4, 235: 0.4, 225: 0.3, 215: 0.3, 205: 0.2 },
  };

  const SOURCES = {
    quant: 'GMAC concordance table, Aug 2026 (data Jul 2021 - Jun 2026)',
    verbal: 'GMAC concordance table, Aug 2026 (data Jul 2021 - Jun 2026)',
    total: 'GMAC concordance table, Aug 2026 (data Jul 2021 - Jun 2026)',
    di: 'Third-party compilation of GMAC 2026 Data Insights percentiles',
  };

  // Strictly increasing CDF (percent) for scores 60..90: equal published values are spread
  // evenly inside their rounding interval so theta -> score is one-to-one.
  function buildCdf(tbl) {
    const v = [];
    for (let s = 60; s <= 90; s++) v.push(tbl[s]);
    const integerTable = v.every((x) => Math.round(x) === x);
    const h = integerTable ? 0.5 : 0.05;
    const out = v.slice();
    const last = v.length - 1;
    let i = 0;
    while (i <= last) {
      let j = i;
      while (j < last && v[j + 1] === v[i]) j++;
      if (j > i) {
        const len = j - i + 1;
        const lower = i > 0 ? v[i - 1] : 0;
        const lo = Math.max(lower, v[i] - h);
        if (j === last) {
          const hi = 100;
          for (let k = 0; k < len; k++) out[i + k] = lo + ((hi - lo) * (k + 1)) / len;
        } else {
          const hi = Math.min(v[j + 1], v[i] + h);
          for (let k = 0; k < len; k++) out[i + k] = lo + ((hi - lo) * (k + 1)) / (len + 1);
        }
      }
      i = j + 1;
    }
    out[last] = 100;
    return out;
  }

  const CDF = { quant: buildCdf(TABLES.quant), verbal: buildCdf(TABLES.verbal), di: buildCdf(TABLES.di) };

  /** Unrounded section score (59.5 .. 90.5 before clamping) for an ability theta. */
  function thetaToScore(section, theta) {
    const F = CDF[section];
    const q = 100 * GM.IRT.normCdf(theta);
    let prev = 0;
    for (let k = 0; k < F.length; k++) {
      if (q <= F[k]) {
        const r = (q - prev) / (F[k] - prev);
        return clamp(60 + k - 0.5 + r, 60, 90);
      }
      prev = F[k];
    }
    return 90;
  }

  /** Ability at the middle of a score band (used to place score labels on charts). */
  function scoreToTheta(section, score) {
    const F = CDF[section];
    const k = clamp(Math.round(score), 60, 90) - 60;
    const lo = k > 0 ? F[k - 1] : 0;
    const mid = (lo + F[k]) / 2 / 100;
    return GM.IRT.normInv(Math.min(Math.max(mid, 1e-6), 1 - 1e-6));
  }

  /** GMAC-style proportional penalty for questions left unanswered. */
  function unansweredPenalty(unanswered, nQuestions) {
    return (30 * unanswered) / nQuestions;
  }

  /** Total 205-805 from the three unrounded section scores (equal weights). */
  function totalScore(q, v, d) {
    const raw = 205 + ((q + v + d - 180) * 600) / 90;
    const t = 10 * Math.round((raw - 5) / 10) + 5;
    return clamp(t, 205, 805);
  }

  function percentile(section, score) {
    const tbl = TABLES[section];
    const s = section === 'total' ? score : Math.round(score);
    return tbl[s] != null ? tbl[s] : null;
  }

  function difficultyBand(b) {
    if (b < -1.1) return { key: 'easy', label: 'Easy' };
    if (b < -0.35) return { key: 'below', label: 'Below medium' };
    if (b < 0.4) return { key: 'medium', label: 'Medium' };
    if (b < 1.15) return { key: 'hard', label: 'Hard' };
    return { key: 'vhard', label: 'Very hard' };
  }

  function clamp(x, lo, hi) {
    return Math.min(hi, Math.max(lo, x));
  }

  GM.Scoring = { TABLES, SOURCES, CDF, thetaToScore, scoreToTheta, unansweredPenalty, totalScore, percentile, difficultyBand };
})(typeof window !== 'undefined' ? window : globalThis);
