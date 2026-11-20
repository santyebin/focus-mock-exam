# Focus Mock Exam

A full-length adaptive mock exam in the current GMAT format (formerly "GMAT Focus Edition"): Quantitative Reasoning, Verbal Reasoning, and Data Insights, scored on the real 205–805 scale with 60–90 section scores and official percentiles.

Read [SPEC.md](SPEC.md) for what the mock reproduces from the real exam and exactly how question selection and scoring work.

> Unofficial practice tool. All questions are original. GMAT™ is a trademark of GMAC, which does not endorse this project.

**Live site:** https://santyebin.github.io/focus-mock-exam/

## Hosting

The site is static (HTML, CSS, JavaScript; about 350 KB) and needs no server or database. Each visitor's progress and history stay in their own browser.

* **GitHub Pages (current setup):** every push to `main` runs `.github/workflows/pages.yml`, which validates the question bank, builds `dist/`, and deploys it. To change questions, edit `data/`, commit, and push; the site updates in about a minute.
* **Custom domain:** in the repository's Settings → Pages, enter the domain, then add a `CNAME` DNS record pointing to `santyebin.github.io`. HTTPS is issued automatically.
* **Any other static host** (Netlify, Vercel, Cloudflare Pages, S3, nginx): run `node tools/build.js` and upload the `dist/` folder.

`tools/build.js` wraps the page in a complete HTML document, adds cache-busting hashes to every script and stylesheet so returning visitors get updates at once, and adds a favicon and link-preview tags. The source `index.html` stays in the fragment form that the claude.ai artifact version needs.

Everything, including answer keys, ships to the browser. That is fine for self-practice; a version where scores must be trustworthy (for example, a graded course) would need the questions and scoring on a server.

## Run it locally

No build step and no dependencies. Serve the folder and open it:

```bash
python3 -m http.server 8765 --directory gmat-mock
```

Then open http://localhost:8765. Opening `index.html` directly from disk also works. Math is typeset with MathJax from a CDN; without internet it falls back to readable plain text.

Test helpers are available in the browser console while a section is running:

```js
GM.App.debug.autoAnswer(0.7)      // answer the rest of the section, 70% correct
GM.App.debug.skipTime(40 * 60000) // jump the section clock forward 40 minutes
```

## Check the engine

```bash
node tools/validate-bank.js   # quality gate (below); exits 1 on any problem, and the deploy runs it first
node tools/simulate.js        # simulated candidates: score recovery, blueprint, exposure, totals vs GMAC percentiles
```

The quality gate holds every question to real-exam conventions, so a flawed question cannot reach the live site:

* **Answer keys recomputed:** every numeric Problem Solving answer is computed independently in `tools/answer-checks.js` and must equal the keyed choice, with no other choice of the same value. The 8 non-numeric ones (Roman-numeral, interval, list) need human review.
* **No length giveaways:** in Critical Reasoning and Reading Comprehension, the correct answer must be the longest choice in 10–30% of questions (the real exam is about 20%), the shortest in no more than 35%, and never more than 1.5× the average wrong answer.
* **Real-exam lengths:** CR arguments 45–140 words; RC passages 200–320 words (short) or 300–460 (long).
* **Conventions:** numeric choices in ascending order, answer positions A–E each between 8% and 35% within a type, and no near-duplicate questions.

The latest simulation of 1,500 candidates reproduces GMAC's total-score percentiles within about 3.5 points at every checkpoint (for example 655 → 88.6 simulated vs 89.6 official, 705 → 97.5 vs 97.5), every section meets its content blueprint, and every one of the 300 questions gets used.

## Project layout

| Path | What it does |
|---|---|
| `index.html` | Page shell; loads the scripts in order |
| `assets/app.css` | Exam interface styles (light and dark) |
| `src/irt.js` | 3PL item response model, Fisher information, EAP ability estimate |
| `src/scoring.js` | GMAC percentile tables, ability → 60–90 section score, unanswered penalty, 205–805 total |
| `src/cat.js` | Question bank loader, section blueprints, adaptive selection, grading, section finalisation |
| `src/app.js` | Exam flow: section order, timer, Next/confirm, bookmarks, Review & Edit, break, resume after reload |
| `src/render.js` | Renderers for PS, CR, RC, DS, TPA, TA, GI, MSR |
| `src/report.js` | Score report: percentiles, ability path, accuracy and pacing, explanations |
| `src/charts.js` | SVG charts for Graphics Interpretation and the report |
| `src/tools.js` | On-screen calculator (Data Insights only) and whiteboard |
| `src/mathtext.js` | MathJax loader with plain-text fallback |
| `data/*.js` | The question bank (300 original questions) |
| `tools/*.js` | Bank validation and Monte-Carlo simulation |

## Question bank

| Section | Questions in bank | Delivered per exam |
|---|---|---|
| Quant | 106 Problem Solving (50 arithmetic, 56 algebra) | 21 |
| Verbal | 47 Critical Reasoning + 13 passages × 4 questions (6 long, 7 short) | 23 (9–10 CR, 13–14 RC in 4 passages) |
| Data Insights | 39 DS, 13 TPA, 10 TA, 13 GI, 5 MSR sets × 4 questions | 20 |

That is at least 3× what any single exam delivers for every question type (about 5× for Quant and Data Sufficiency), with extra depth at the hardest level so that 645+ candidates still meet questions near their ability.

Each question carries a difficulty level `d` from 1 (easy) to 6 (extreme). The engine turns it into IRT parameters; see SPEC.md §3. Questions already seen in this browser are avoided in later attempts while enough unseen ones remain.

### Adding questions

Append objects to the arrays in `data/`. Text fields use `String.raw` templates (`R\`...\``), so TeX needs single backslashes: `\(x^2\)`, `\(\frac{a}{b}\)`. Do not use `$...$` for math; a bare `$` is a dollar sign.

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

For every new numeric Problem Solving question, add an independent computation of its answer to `tools/answer-checks.js` (work it out from the question's numbers, not by typing the answer). Write wrong answers that are as long and specific as the right one, each built on a real error (out of scope, reversed, too strong, half right). Run `node tools/validate-bank.js` after editing, and `node tools/simulate.js` after adding many questions.

## Known limits

* Item difficulties are expert-rated, not calibrated on real responses. Once you have response data from users, re-estimate `a`, `b`, `c` for each item (marginal maximum likelihood) and store them on the items; the engine uses explicit `a`/`b`/`c` when present.
* GMAC does not publish its selection algorithm, its unanswered-question formula, or a Data Insights concordance table. Those parts follow the best public evidence and are marked **[model]** in SPEC.md.
* With 300 questions, about 3–4 attempts per browser stay mostly fresh before questions start repeating; repeats are chosen only when no unseen question of the right type is left. In a population of first-time candidates, the most-used passages still reach roughly 70% of test takers, so a classroom will see some overlap.
