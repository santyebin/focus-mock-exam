# GMAT Focus-format Mock Exam: Specification

This document defines what the mock exam must reproduce from the real GMAT exam (the "Focus Edition", renamed simply "GMAT" in July 2024) and how each part is implemented. Where GMAC does not publish the exact mechanism, the choice made here is marked **[model]** with the reasoning.

> Unofficial practice tool. GMAT™ is a trademark of GMAC, which does not endorse this project. All questions are original.

---

## 1. Exam structure (matches the real exam)

| Section | Questions | Time | Question types | Calculator |
|---|---|---|---|---|
| Quantitative Reasoning | 21 | 45 min | Problem Solving (arithmetic, algebra; no geometry) | No |
| Verbal Reasoning | 23 | 45 min | Reading Comprehension, Critical Reasoning | No |
| Data Insights | 20 | 45 min | Data Sufficiency, Two-Part Analysis, Table Analysis, Graphics Interpretation, Multi-Source Reasoning | Yes (on-screen) |

* Total testing time **2 h 15 min** (64 questions).
* **Section order**: the candidate chooses any of the 6 orders before the exam (1-minute selection screen; default Q → V → DI).
* **Optional 10-minute break**, once, after section 1 *or* section 2. Overrunning the break deducts the excess from the next section's clock.
* **No going back during a section.** Every question must be answered before moving on (Next → confirm dialog).
* **Bookmark** any question while working.
* **Question Review & Edit**: after the last question of a section, if time remains, the candidate sees all questions of the section, can open any of them and **change up to 3 answers per section**. Review time comes out of the same 45 minutes.
* **5-minute warning** when 5:00 remain in a section.
* Section intro screens with instructions; timer can be hidden.
* No partial credit on multi-part DI questions (every part must be right).

## 2. Content blueprint per section

The real exam's content specification is not published question-by-question. The blueprint below follows GMAC's published content areas and the distributions consistently observed in the official practice exams **[model]**. The exact composition is drawn at random from the allowed variants at the start of each section.

**Quant (21):** Arithmetic 10–11, Algebra 10–11 (word problems spread across both). Max 3 questions from any one sub-topic.

**Verbal (23):** RC 13–14 in 4 passages, CR 9–10.
* Variant A: passages of 4+3+3+3 (13 RC) + 10 CR
* Variant B: passages of 4+4+3+3 (14 RC) + 9 CR
* Long passages preferred for 4-question slots, short for 3-question slots. Passages are spread through the section; two passages are never adjacent.

**Data Insights (20):** one MSR set of 3, plus

| Variant | DS | TPA | GI | TA | MSR |
|---|---|---|---|---|---|
| A | 7 | 4 | 3 | 3 | 3 |
| B | 7 | 3 | 4 | 3 | 3 |
| C | 6 | 4 | 4 | 3 | 3 |
| D | 7 | 4 | 4 | 2 | 3 |

**Unscored (pretest) questions:** the real exam mixes in unscored trial questions that look identical to scored ones. The mock does the same by default: 2 per section, placed on single-question slots, chosen at random (not adaptively) from questions within about one difficulty level of the candidate's current level, so they never stand out as unusually easy or hard, and excluded from scoring. They are revealed only in the post-exam report. Can be switched off in settings.

## 3. Item model (IRT, three-parameter logistic)

Each question *i* has parameters:

* **a** discrimination (0.8–1.5)
* **b** difficulty on the ability scale θ (≈ −2.5 … +2.5)
* **c** guessing floor, set by format:
  * 5-option multiple choice (PS, CR, RC, DS, MSR-MC): **0.20**
  * 3 yes/no statements all correct (TA, MSR-YN): **1/8 = 0.125**
  * Two-Part Analysis with *n* options: **1/n²**
  * Graphics Interpretation with two drop-downs of *k₁*, *k₂* options: **1/(k₁·k₂)**

Probability of a correct response:

    P(θ) = c + (1 − c) / (1 + exp(−1.702 · a · (θ − b)))

Fisher information (used for item selection):

    I(θ) = (1.702·a)² · (Q/P) · ((P − c)/(1 − c))²,   Q = 1 − P

**θ scale anchoring.** θ is defined against the real test-taker population: θ = 0 is the median candidate in that section and θ ~ N(0, 1) across candidates. A question with b = 0 is answered correctly about 60% of the time by a median candidate (because c = 0.2).

**Authored difficulty → b** **[model]**. The items are not calibrated on live data, so each carries an expert difficulty level *d* (1–6) mapped to b = 0.75·(d − 3) plus a small deterministic jitter (±0.2):

| d | label | b ≈ | roughly answered right 60% of the time by a candidate scoring |
|---|---|---|---|
| 1 | easy | −1.5 | ~ 405 total |
| 2 | below medium | −0.75 | ~ 485 |
| 3 | medium | 0 | ~ 565 |
| 4 | hard | +0.75 | ~ 625 |
| 5 | very hard | +1.5 | ~ 675 |
| 6 | extreme | +2.25 | ~ 725+ |

Rate a question by who gets it right, not by how many steps its solution takes: a d5 question should defeat most candidates below the 90th percentile, and a d6 question most candidates below the 98th. Over-rated questions do double damage: strong candidates are served them as "hard" and find them easy, and every right answer earns too much credit, inflating the score. In Nov 2026 every label was re-rated against this table after a tester reported exactly that. 55 of the 106 Quant labels and 105 of the 194 Verbal and Data Insights labels moved down, most by one level; several Reading Comprehension questions moved two or three levels, because they only paraphrase one sentence of the passage. 44 harder questions were added: 22 in Quant, and 8 Critical Reasoning, 2 passages, and 6 Data Sufficiency in the other sections. The hardest tier in Verbal and Data Insights is still thin (§4).

Once real response data exists, the parameters should be re-estimated (marginal maximum likelihood) and these values replaced.

## 4. Adaptive algorithm (question selection)

The real exam is adaptive **question by question**, and the first question of each section is of medium difficulty. The mock implements a standard CAT:

1. **Start** each section at θ̂ = 0 (medium).
2. **Plan the section skeleton** from the blueprint variant: a random order of slots (e.g. `CR, RC×3, CR, CR, RC×4, …` or `DS, GI, TPA, DS, MSR×3, …`). No more than two identical single-question types in a row; sets are separated.
3. **Fill each slot adaptively**:
   * Candidate pool = unused questions of the slot's type/topic, preferring questions this browser has never seen in earlier attempts, honouring the sub-topic cap.
   * Score each candidate by Fisher information at the **target ability** θ̂_sel + 0.25 (step 5): slightly above the current estimate, so each question is a stretch rather than a comfortable one.
   * **Exposure control (randomesque)**: pick at random among the 3 most informative candidates (6 for the first three questions of a section, when every candidate starts from the same estimate; 3 for passages and MSR sets), so two candidates at the same ability still see different questions.
4. **Sets (RC passages, MSR)**: a passage is chosen by the mean information of its best *k* questions at the target ability. Inside an RC passage the next question is chosen adaptively from that passage's questions (4 authored, 3 or 4 delivered); MSR questions are delivered in authored order.
5. **Update θ̂ after every scored response** using EAP (expected a posteriori) with an N(0, 1) prior, numerical quadrature from −4 to +4 in 0.05 steps. EAP is stable from the very first answer, unlike maximum likelihood which is undefined until the candidate has both a right and a wrong answer. A second estimate, **θ̂_sel**, is computed the same way with a wider N(0, 2²) prior. It reacts faster to early answers and is used only to choose questions; scores and the report's ability path use θ̂. **[model]**
6. Pretest slots get a random unused question of the right type whose b is within 0.9 of the target ability (about one difficulty level), or any unused question of that type if fewer than 3 qualify. They do not update either estimate.

Net effect, from `tools/simulate.js`: the share of scored questions answered correctly stays fairly flat across ability, as on a well-targeted adaptive test.

| Candidate (percentile) | Quant | Verbal | Data Insights |
|---|---|---|---|
| 50th | 59% | 59% | 49% |
| 84th | 62% | 69% | 59% |
| 93rd | 66% | 75% | 71% |
| 98th | 68% | 83% | 82% |

Data Insights runs lower for average candidates because multi-part questions give almost no credit for guessing. In Verbal and Data Insights the top few percent still answer 75–83% correctly, because after the re-rating few questions in those sections are hard enough for them, and their scores come out about a point low (θ bias about −0.2). More d5–d6 Verbal and Data Insights questions would fix both. Before θ̂_sel and the target shift existed, the estimate trailed strong candidates for most of the section and the 98th percentile answered 79–84% correctly, so the test felt as if it was not adapting. The score depends on how hard the questions you got right were, not on the count of right answers.

## 5. Scoring

### 5.1 Section score (60–90)

At the end of the section (after Review & Edit), θ is re-estimated from the **final** answers to all scored questions (edits count). θ is converted to a population quantile *q* = Φ(θ), and *q* is mapped to the section scale through GMAC's own percentile table for that section: the score is the lowest *s* whose "at or below" share reaches *q*, with linear interpolation inside the band so the unrounded score is kept for the total. Percentile tables used:

* **Quant, Verbal, Total**: GMAC score concordance tables published Aug 2026 (data July 2021 – June 2026).
* **Data Insights**: GMAC publishes no DI concordance PDF. The table used is the third-party compilation of GMAC's 2026 DI percentiles and should be refreshed when GMAC publishes an update.

Ties in a published table (e.g. DI 86–88 all at 99%) are spread evenly inside the rounding interval so the mapping stays strictly increasing.

### 5.2 Unanswered questions

GMAC states that the score is penalized according to the number of questions left unanswered, without publishing the formula. The mock uses the widely cited proportional rule **[model]**:

    penalty = 30 × (unanswered ÷ questions in section)      (e.g. 2 blanks in Quant → −2.9 points)

applied to the unrounded section score (floor 60). It is always better to guess than to leave a question blank, which matches GMAC's guidance.

### 5.3 Total score (205–805)

The three sections are weighted equally. The total is the linear map of the sum of the unrounded section scores, rounded to the nearest score ending in 5:

    raw   = 205 + (Q + V + DI − 180) × 600 / 90
    total = 10 × round((raw − 5) / 10) + 5,  clamped to 205…805

Checks: 60/60/60 → 205, 90/90/90 → 805, 85/85/85 → 705. Because unrounded section scores are used, the same three displayed section scores can produce totals 10 points apart, as on the real exam.

### 5.4 Percentiles

Shown for the total and each section from the tables above.

## 6. Interface features

* Section order selection screen with countdown.
* Section intro/instructions screen (DS answer-choice key shown before DI).
* Top bar: section name, question *n* of *N*, time remaining (hideable), calculator (DI only), whiteboard.
* Bottom bar: Bookmark for Review, Next. Next asks for confirmation (can be turned off).
* Split-screen layout for RC passages and MSR tabs; sortable table for Table Analysis; inline drop-downs for Graphics Interpretation; two-column grid for Two-Part Analysis.
* Review & Edit screen with bookmark flags, edited marks, and "Edits remaining: n of 3". An edit is used each time you leave a question with an answer different from the one it had when you opened it (the conservative reading of the official rule).
* Break screen with its own 10:00 countdown.
* Time accommodations: standard, +50%, +100%.
* Progress is saved in the browser after every action; a reload resumes the exam where it stopped.

## 7. Post-exam report

* Total and section scores with percentiles and the unanswered-question penalty, if any.
* Ability path per section (θ̂ after each question, shown in section-score units) — makes the adaptivity visible.
* Every question: type, topic, difficulty band, your answer, correct answer, time spent, bookmarked/edited, scored or pretest. Full explanations.
* Accuracy and average time by question type and topic; pacing against the target time per question (Q 2:09, V 1:57, DI 2:15).
* Attempt history in the browser; questions already seen are avoided in later attempts while the bank allows.

## 8. Question bank format

Questions live in `data/*.js` as plain objects. Minimal fields: `id`, `cat` (topic or type), `sub` (sub-topic), `d` (difficulty 1–6), the content fields for the type, the answer, and `ex` (explanation). Optional `a`, `b`, `c` override the defaults. See `README.md` for the exact shape of each question type.

Bank size guidance for a stable adaptive test: at least 2.5× the questions delivered per section, spread across difficulty, with extra depth at d ≥ 4 because most candidates using a mock aim for 645+.
