# Focus Mock Exam

A full-length adaptive mock exam in the current GMAT format (formerly "GMAT Focus Edition"): Quantitative Reasoning, Verbal Reasoning, and Data Insights, scored on the real 205–805 scale with 60–90 section scores and official percentiles.

Read [SPEC.md](SPEC.md) for what the mock reproduces from the real exam and exactly how question selection and scoring work.

> Unofficial practice tool. All questions are original. GMAT™ is a trademark of GMAC, which does not endorse this project.

**Live site:** https://santyebin.github.io/focus-mock-exam/

## Features

**Exam mode** looks and behaves like the real test-delivery screens: navy title bar with a hideable Time Remaining clock and question counter, Calculator (Data Insights only) and Whiteboard buttons, Bookmark for Review and Next in the bottom bar, the Response Confirmation, Answer Required, five-minute warning, and Time Expired dialogs, Select Section Order, the Question Review & Edit screen (up to 3 answer changes per section), the optional 10-minute break, and an unofficial score preview before the full report. It stays in a light, Arial-based layout whatever the device theme.

* **Full mock** (64 questions, 2 hours 15 minutes), with an optional extended-time setting and unscored pretest questions like the real exam.
* **Section tests** score one section on its own; **fixed forms** (Mock 1–5) give everyone the same questions, so friends or a class can compare results. The five forms share no questions with one another.
* **Score report:** total and section scores with a likely range (±1 standard error), percentiles, the gap to your target score, ability path, accuracy by question type and topic, a pacing chart with coaching (rushed or stalled questions, front-loaded timing), and every question with its explanation. A shareable score card can be downloaded as an image.
* **Practice mode:** build a set by section, question type, topic, difficulty, and source (all, unseen, missed, or your own questions), in study mode (explanation after each answer) or timed mode.
* **Mistake log** with spaced repetition: every missed question, and every correct one that took over twice the target time, is due right away and then returns after 3, 7, 14, and 30 days until answered correctly five times in a row.
* **Progress dashboard:** score trend against your target, section trends, weakest topics with one-click practice, pacing history, and activity over the last 28 days.
* **Whiteboard** with pen, line, rectangle, ellipse, text, eraser, colors, zoom, undo/redo, and a resizable panel; an on-screen calculator in Data Insights.
* **Accessibility:** larger text sizes, a high-contrast theme, reduced motion, keyboard shortcuts in exam mode (Alt+N next, Alt+P previous, Alt+B bookmark, Alt+R review, Alt+C calculator, Alt+W whiteboard), and screen-reader labels and announcements.
* **Works offline and installs like an app** (progressive web app) after the first visit.
* **Question editor** (`editor.html`): draft a question in any of the eight formats, preview it in the exam layout, run the same checks as the quality gate, save it to your own practice pool, or copy ready-to-paste code for `data/`.
* **Your data stays in your browser.** Settings let you export, import, or erase it.

## Hosting

The site is static (HTML, CSS, JavaScript; about 730 KB) and needs no server or database. Each visitor's progress and history stay in their own browser.

* **GitHub Pages (current setup):** every push to `main` runs `.github/workflows/pages.yml`, which runs the quality gate and unit tests, builds `dist/`, runs the end-to-end browser tests against the build, and deploys only if everything passes. Pull requests run the same checks without deploying. To change questions, edit `data/`, commit, and push; the site updates in a few minutes.
* **Custom domain:** in the repository's Settings → Pages, enter the domain, then add a `CNAME` DNS record pointing to `santyebin.github.io`. HTTPS is issued automatically.
* **Any other static host** (Netlify, Vercel, Cloudflare Pages, S3, nginx): run `node tools/build.js` and upload the `dist/` folder.

`tools/build.js` wraps the page in a complete HTML document, adds cache-busting hashes to every script and stylesheet so returning visitors get updates at once, writes the offline cache list into the service worker, and adds a favicon, app icons, and link-preview tags. The source `index.html` stays in the fragment form that the claude.ai artifact version needs.

Everything, including answer keys, ships to the browser. That is fine for self-practice; a version where scores must be trustworthy (for example, a graded course) would need the questions and scoring on a server.

## Run it locally

Running the site needs no build step and no dependencies. Serve the folder and open it:

```bash
python3 -m http.server 8765 --directory gmat-mock
```

Then open http://localhost:8765. Opening `index.html` directly from disk also works, without the offline mode. Math is typeset with MathJax from a CDN; without internet it falls back to readable plain text.

Test helpers are available in the browser console while a section is running:

```js
GM.App.debug.autoAnswer(0.7)      // answer the rest of the section, 70% correct
GM.App.debug.skipTime(40 * 60000) // jump the section clock forward 40 minutes
```

## Check the engine

```bash
node tools/validate-bank.js   # quality gate (below); exits 1 on any problem
node tools/simulate.js        # simulated candidates: score recovery, blueprint, exposure, totals vs GMAC percentiles
node tools/make-forms.js      # rebuild the five fixed mock forms after changing the bank
```

The automated tests need Node 22 or later. Install the test browser once, then run them:

```bash
npm ci && npx playwright install chromium
```

```bash
npm test                                  # quality gate plus unit tests for scoring, the adaptive engine, and the mistake log
```

```bash
node tools/build.js && npm run test:e2e   # end-to-end tests in a real browser, desktop and phone
```

The quality gate holds every question to real-exam conventions, so a flawed question cannot reach the live site:

* **Answer keys recomputed:** every numeric Problem Solving answer is computed independently in `tools/answer-checks.js` or `tools/answer-checks-ext.js` and must equal the keyed choice, with no other choice of the same value. The 9 non-numeric ones (Roman-numeral, interval, list, expression) need human review.
* **No length giveaways:** in Critical Reasoning and Reading Comprehension, the correct answer must be the longest choice in 10–30% of questions (the real exam is about 20%), the shortest in no more than 35%, and never more than 1.5× the average wrong answer.
* **Real-exam lengths:** CR arguments 45–140 words; RC passages 200–320 words (short) or 300–460 (long).
* **Conventions:** numeric choices in ascending order, answer positions A–E each between 8% and 35% within a type, and no near-duplicate questions.
* **Wiring:** every data file is loaded by both the app and the editor, every reading passage has at least 4 questions and every multi-source set at least 3 (so sections always reach their real length), and the fixed forms use existing questions in the right sections without repeats.

The latest simulation of 2,000 candidates reproduces GMAC's total-score percentiles within about 3 points at every checkpoint (for example 655 → 88.7 simulated vs 89.6 official, 705 → 97.2 vs 97.5), every section meets its content blueprint, and 570 of the 572 questions get used (the other 2 are the least informative questions in their passages). Candidates from the median to the 98th percentile answer 58–67% of Quant questions correctly, so strong candidates keep meeting questions that stretch them. In Verbal and Data Insights, candidates near the 98th percentile answer 73–77% correctly, and only the top fraction of a percent reach about 85% (SPEC.md §3–4).

## Project layout

| Path | What it does |
|---|---|
| `index.html` | Page shell; loads the scripts in order |
| `editor.html` | Question editor page |
| `assets/app.css` | Base styles and question renderers (light and dark) |
| `assets/exam.css` | Exam-mode screens modeled on the real test-delivery interface |
| `assets/features.css` | Home, practice, mistake log, progress, settings, and accessibility themes |
| `src/irt.js` | 3PL item response model, Fisher information, EAP ability estimate |
| `src/scoring.js` | GMAC percentile tables, ability → 60–90 section score, unanswered penalty, 205–805 total |
| `src/cat.js` | Question bank loader, section blueprints, adaptive selection, fixed forms, grading, section finalisation, score ranges |
| `src/exam.js` | Exam flow: section order, timer, confirmations, bookmarks, Review & Edit, break, score preview, resume after reload |
| `src/main.js` | App shell: home page, navigation, settings, offline registration |
| `src/practice.js`, `src/mistakes.js`, `src/progress.js` | Practice sets, mistake log with spaced repetition, progress dashboard |
| `src/report.js` | Score report: ranges, target gap, pacing coach, ability path, explanations, score card |
| `src/store.js`, `src/ui.js` | Saved data (attempts, settings, mistake log, your questions) and shared interface helpers |
| `src/render.js`, `src/charts.js` | Renderers for PS, CR, RC, DS, TPA, TA, GI, MSR; SVG charts |
| `src/tools.js`, `src/whiteboard.js` | Calculator and whiteboard |
| `src/editor.js` | Question editor logic |
| `src/mathtext.js` | MathJax loader with plain-text fallback |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline support and app install |
| `data/*.js` | The question bank (572 original questions) and the fixed forms (`forms.js`) |
| `tools/*.js` | Quality gate, answer checks, simulation, build, form and icon generators |
| `tests/` | Unit tests (`node --test`) and end-to-end tests (Playwright) |

## Question bank

| Section | Questions in bank | Delivered per exam |
|---|---|---|
| Quant | 203 Problem Solving (94 arithmetic, 109 algebra) | 21 |
| Verbal | 91 Critical Reasoning + 24 passages × 4 questions (11 long, 13 short) | 23 (9–10 CR, 13–14 RC in 4 passages) |
| Data Insights | 80 DS, 25 TPA, 18 TA, 23 GI, 9 MSR sets × 4 questions | 20 |

That is at least 6× what any single exam delivers for every question type (about 10× for Quant and Data Sufficiency). Each section has 55–60 questions at the two hardest levels (d5–d6), so 645+ candidates keep meeting questions near their ability.

Each question carries a difficulty level `d` from 1 (easy) to 6 (extreme). The engine turns it into IRT parameters; see SPEC.md §3. Rate a new question against the anchors there (who gets it right), not by how many steps it takes: an over-rated question makes strong candidates' tests feel easy and inflates their scores. Questions already seen in this browser are avoided in later attempts while enough unseen ones remain.

### Adding questions

The easiest way to draft a question is the editor (`editor.html`): it previews the question in the exam layout, runs the gate's checks, and produces code to paste into `data/`. To add questions by hand, append objects to the arrays in `data/` (new files go in both `index.html` and `editor.html`; the gate checks). Text fields use `String.raw` templates (`R\`...\``), so TeX needs single backslashes: `\(x^2\)`, `\(\frac{a}{b}\)`. Do not use `$...$` for math; a bare `$` is a dollar sign.

```js
// Problem Solving (data/quant-*.js)
{ id: 'QA33', cat: 'Arithmetic', sub: 'Percents', d: 4,
  stem: R`...`, ch: [R`...`, R`...`, R`...`, R`...`, R`...`], ans: 2, ex: R`...` }

// Critical Reasoning (data/verbal-cr-*.js)
{ id: 'CR31', sub: 'Weaken', d: 5, stim: R`argument`, q: R`question stem`, ch: [/* 5 */], ans: 0, ex: R`...` }

// Reading Comprehension passage with 4 questions (data/verbal-rc-*.js)
{ id: 'RC09', length: 'long' /* or 'short' */, passage: R`<p>...</p>`,
  qs: [{ id: 'RC09-1', sub: 'Main Idea', d: 3, q: R`...`, ch: [/* 5 */], ans: 1, ex: R`...` } /* × 4 */] }

// Data Sufficiency: ans 0..4 = A..E
{ id: 'DS28', sub: 'Algebra', d: 4, stem: R`...`, s1: R`...`, s2: R`...`, ans: 2, ex: R`...` }

// Two-Part Analysis: ans = [row for column 1, row for column 2]
{ id: 'TPA09', sub: 'Quant', d: 4, stem: R`...`, cols: [R`x`, R`y`], opts: [R`1`, R`2`, R`3`, R`4`, R`5`], ans: [3, 0], ex: R`...` }

// Table Analysis: three statements; a = index into labels
{ id: 'TA07', sub: 'Sales', d: 4, intro: R`...`, cols: [...], rows: [[R`North`, 420, 8.4], ...],
  prompt: R`...`, labels: [R`Yes`, R`No`], st: [{ t: R`...`, a: 0 }, { t: R`...`, a: 1 }, { t: R`...`, a: 0 }], ex: R`...` }

// Graphics Interpretation: each statement has one [[]] drop-down
{ id: 'GI08', sub: 'Bar chart', d: 3, intro: R`...`, prompt: R`...`,
  chart: { kind: 'bar' /* bar | groupbar | line | scatter | pie */, title: '...', yLabel: '...', categories: [...], series: [{ name: '...', values: [...] }], yMin: 0, yMax: 100, yStep: 20 },
  st: [{ t: R`... [[]] ...`, opts: [R`...`, R`...`], a: 1 }, { t: R`... [[]] ...`, opts: [...], a: 0 }], ex: R`...` }

// Multi-Source Reasoning set: tabs + 4 questions (MC or YN)
{ id: 'MSR04', tabs: [{ title: 'E-mail', html: R`<p>...</p>` }, ...],
  qs: [{ id: 'MSR04-1', kind: 'MC', sub: '...', d: 3, q: R`...`, ch: [/* 5 */], ans: 0, ex: R`...` },
       { id: 'MSR04-2', kind: 'YN', sub: '...', d: 4, q: R`...`, labels: [R`Yes`, R`No`], st: [{ t: R`...`, a: 0 }, /* 3 */], ex: R`...` }] }
```

For every new numeric Problem Solving question, add an independent computation of its answer to `tools/answer-checks.js` (or `tools/answer-checks-ext.js` for questions in `data/ext-*.js`); work it out from the question's numbers, not by typing the answer. Write wrong answers that are as long and specific as the right one, each built on a real error (out of scope, reversed, too strong, half right). Before writing a question, check that the bank does not already test the same idea with different numbers. Run `node tools/validate-bank.js` after editing, `node tools/make-forms.js` to rebuild the fixed forms, and `node tools/simulate.js` after adding many questions.

## Known limits

* Item difficulties are expert-rated, not calibrated on real responses. Once you have response data from users, re-estimate `a`, `b`, `c` for each item (marginal maximum likelihood) and store them on the items; the engine uses explicit `a`/`b`/`c` when present.
* GMAC does not publish its selection algorithm, its unanswered-question formula, or a Data Insights concordance table. Those parts follow the best public evidence and are marked **[model]** in SPEC.md.
* With 572 questions, about 5–6 adaptive mocks per browser stay mostly fresh before questions start repeating; repeats are chosen only when no unseen question of the right type is left. In a population of first-time candidates, the most-used questions still reach roughly half of test takers, so a classroom will see some overlap; the fixed forms avoid that for a shared session.
