/* Browser storage: attempts, practice history, spaced-repetition mistake log, target score, settings. */
(function (root) {
  'use strict';
  const GM = (root.GM = root.GM || {});
  const DAY = 86400000;

  const K = {
    exam: 'gfm.exam.v1',        // exam in progress
    hist: 'gfm.history.v1',     // completed mocks and section tests (newest first)
    seen: 'gfm.seen.v1',        // question ids already delivered in this browser
    prefs: 'gfm.prefs.v1',      // exam settings last used
    practice: 'gfm.practice.v1',// practice sessions (newest first)
    srs: 'gfm.srs.v1',          // mistake log: id -> { box, due, added, reason, last }
    target: 'gfm.target.v1',    // { total, date }
    settings: 'gfm.settings.v1',// accessibility and display
    myq: 'gfm.myq.v1',          // questions written in the editor
  };

  function get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function del(k) { try { localStorage.removeItem(k); } catch (e) { /* storage unavailable */ } }

  /* ---------- attempts (mocks, section tests) ---------- */
  function attempts() { return get(K.hist, []); }
  function addAttempt(a) {
    const h = attempts();
    h.unshift(a);
    // keep the newest 40; if storage is full, drop older ones until it fits
    let keep = h.slice(0, 40);
    while (!set(K.hist, keep) && keep.length > 1) keep = keep.slice(0, keep.length - 1);
  }
  function removeAttempt(id) { set(K.hist, attempts().filter((a) => a.id !== id)); }
  function findAttempt(id) { return attempts().find((a) => a.id === id) || null; }

  /* ---------- practice ---------- */
  function practiceSessions() { return get(K.practice, []); }
  function addPractice(s) {
    let list = practiceSessions();
    list.unshift(s);
    list = list.slice(0, 200);
    while (!set(K.practice, list) && list.length > 1) list = list.slice(0, list.length - 1);
  }

  /** Every answered question, oldest first: { id, correct, time, date, source, target }. */
  function itemEvents() {
    const ev = [];
    attempts().forEach((a) => {
      Object.keys(a.sections || {}).forEach((key) => {
        const sc = a.sections[key];
        const target = sc.timeLimitMs && isFinite(sc.timeLimitMs) ? sc.timeLimitMs / sc.st.nTotal : null;
        (sc.st.records || []).forEach((r) => {
          if (r.response == null) return;
          ev.push({ id: r.id, correct: !!r.correct, time: r.time + (r.reviewTime || 0), date: a.date, source: a.kind || 'mock', target: target, pretest: !!r.pretest });
        });
      });
    });
    practiceSessions().forEach((s) => {
      (s.items || []).forEach((r) => {
        if (r.response == null) return;
        ev.push({ id: r.id, correct: !!r.correct, time: r.time, date: s.date, source: 'practice', target: s.targetMs || null });
      });
    });
    return ev.sort((x, y) => x.date - y.date);
  }

  /* ---------- spaced repetition (Leitner boxes) ---------- */
  const INTERVALS = [0, 1, 3, 7, 14, 30]; // days until next review for boxes 1..5
  function srs() { return get(K.srs, {}); }
  function srsSave(m) { set(K.srs, m); }
  /** Put a question in the mistake log (or back to box 1 if it is already there). */
  function addMistake(id, reason, now) {
    const t = now || Date.now();
    const m = srs();
    const cur = m[id];
    if (cur && !cur.mastered && reason === 'slow' && cur.reason === 'wrong') return; // keep the stronger reason
    m[id] = { box: 1, due: t, added: cur && !cur.mastered ? cur.added : t, reason: reason, last: t, reviews: cur ? cur.reviews || 0 : 0 };
    srsSave(m);
  }
  /** Record a review of a logged question; correct answers move it up a box, wrong ones send it back to box 1. */
  function reviewMistake(id, correct, now) {
    const t = now || Date.now();
    const m = srs();
    const cur = m[id];
    if (!cur) return null;
    cur.reviews = (cur.reviews || 0) + 1;
    cur.last = t;
    if (correct) {
      cur.box = Math.min(cur.box + 1, 6);
      if (cur.box > 5) { cur.mastered = true; cur.due = Number.MAX_SAFE_INTEGER; } else cur.due = t + INTERVALS[cur.box] * DAY;
    } else {
      cur.box = 1;
      cur.mastered = false;
      cur.due = t + DAY;
    }
    m[id] = cur;
    srsSave(m);
    return cur;
  }
  function removeMistake(id) { const m = srs(); delete m[id]; srsSave(m); }
  function dueMistakes(now) {
    const t = now || Date.now();
    const m = srs();
    return Object.keys(m).filter((id) => !m[id].mastered && m[id].due <= t);
  }

  /** Log the mistakes from a finished mock or section test: wrong answers, and right answers that took over twice the target time. */
  function logAttemptMistakes(attempt) {
    Object.keys(attempt.sections || {}).forEach((key) => {
      const sc = attempt.sections[key];
      const target = isFinite(sc.timeLimitMs) ? sc.timeLimitMs / sc.st.nTotal : null;
      sc.st.records.forEach((r) => {
        if (r.response == null) return;
        if (!r.correct) addMistake(r.id, 'wrong', attempt.date);
        else if (target && r.time > 2 * target) addMistake(r.id, 'slow', attempt.date);
      });
    });
  }

  /* ---------- settings ---------- */
  const SETTING_DEFAULTS = { textSize: 1, contrast: 'standard', reduceMotion: false, confirmNext: true, timeWarning: true };
  function settings() { return Object.assign({}, SETTING_DEFAULTS, get(K.settings, {})); }
  function saveSettings(s) { set(K.settings, s); }

  GM.Store = {
    K, DAY, INTERVALS, get, set, del,
    attempts, addAttempt, removeAttempt, findAttempt,
    practiceSessions, addPractice, itemEvents,
    srs, addMistake, reviewMistake, removeMistake, dueMistakes, logAttemptMistakes,
    settings, saveSettings,
    target: () => get(K.target, null),
    setTarget: (t) => (t ? set(K.target, t) : del(K.target)),
    myQuestions: () => get(K.myq, []),
    saveMyQuestions: (list) => set(K.myq, list),
  };
})(typeof window !== 'undefined' ? window : globalThis);
