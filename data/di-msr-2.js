/* Data Insights — Multi-Source Reasoning sets 4-5 (original). */
(function (root, R) {
  const GM = (root.GM = root.GM || {});
  const B = (GM.BANK = GM.BANK || {});
  const YN_PROMPT = R`For each of the following statements, select <i>Yes</i> if the statement is supported by the information provided. Otherwise select <i>No</i>.`;
  B.msr = (B.msr || []).concat([
    { id: 'MSR04', title: 'Trial sites',
      tabs: [
        { title: 'Protocol', html: R`<p><b>Site selection criteria for a 12-month clinical study</b></p>
<p>A site qualifies only if it meets all three conditions:</p>
<ol><li>it can enroll at least 40 eligible patients within 3 months;</li><li>its patient dropout rate in previous trials was <b>below</b> 15 percent; and</li><li>its cost per enrolled patient is no more than $9,000.</li></ol>
<p>The study needs at least 150 enrolled patients in total. Each selected site enrolls its full 3-month capacity.</p>` },
        { title: 'Sites', html: R`<p>Candidate sites</p>
<table class="data"><thead><tr><th>Site</th><th>Patients enrollable in 3 months</th><th>Past dropout rate (%)</th><th>Cost per enrolled patient ($)</th></tr></thead>
<tbody><tr><td>Arden</td><td>55</td><td>12</td><td>8,400</td></tr><tr><td>Bexley</td><td>38</td><td>9</td><td>7,900</td></tr><tr><td>Corwin</td><td>62</td><td>16</td><td>8,800</td></tr><tr><td>Dalton</td><td>47</td><td>11</td><td>9,200</td></tr><tr><td>Easton</td><td>41</td><td>14</td><td>8,950</td></tr><tr><td>Fenwick</td><td>70</td><td>13</td><td>9,000</td></tr></tbody></table>` },
        { title: 'Finance update', html: R`<p><b>From:</b> Finance</p><p>Two updates. First, Dalton has agreed to lower its cost per enrolled patient by 5 percent if it is selected. Second, total site costs (patients enrolled × cost per patient, summed over the selected sites) may not exceed $1.3 million.</p>` },
      ],
      qs: [
        { id: 'MSR04-1', kind: 'MC', sub: 'Conditions', d: 3,
          q: R`Before the finance update, how many of the candidate sites met all three conditions?`,
          ch: [R`2`, R`3`, R`4`, R`5`, R`6`], ans: 1,
          ex: R`Bexley fails condition 1 (38), Corwin fails condition 2 (16%), Dalton fails condition 3 ($9,200). Arden, Easton, and Fenwick qualify; Fenwick's $9,000 is "no more than" $9,000.` },
        { id: 'MSR04-2', kind: 'YN', sub: 'Inference', d: 4, q: YN_PROMPT, labels: [R`Yes`, R`No`],
          st: [{ t: R`With its reduced cost, Dalton meets all three conditions.`, a: 0 },
            { t: R`The sites that met all three conditions before the finance update could together enroll at least 150 patients.`, a: 0 },
            { t: R`Corwin would meet all three conditions if its past dropout rate were 1 percentage point lower.`, a: 1 }],
          ex: R`(1) $9,200 × 0.95 = $8,740, with 47 patients and 11% dropout. Yes. (2) 55 + 41 + 70 = 166. Yes. (3) 15% is not below 15%. No.` },
        { id: 'MSR04-3', kind: 'MC', sub: 'Calculation', d: 3,
          q: R`What would the total site cost be if Arden, Easton, and Fenwick were selected?`,
          ch: [R`$1,296,950`, R`$1,350,000`, R`$1,458,950`, R`$1,512,400`, R`$1,620,000`], ans: 2,
          ex: R`55 × $8,400 = $462,000; 41 × $8,950 = $366,950; 70 × $9,000 = $630,000. Total $1,458,950, which is over the $1.3 million cap.` },
        { id: 'MSR04-4', kind: 'MC', sub: 'Scenario', d: 5,
          q: R`Taking the finance update into account, which selection of qualifying sites enrolls at least 150 patients while keeping total site costs within the cap?`,
          ch: [R`Arden, Dalton, and Easton`,
        R`Dalton, Easton, and Fenwick`,
        R`Arden, Easton, and Fenwick`,
        R`Arden, Dalton, and Fenwick`,
        R`No such selection exists`], ans: 4,
          ex: R`Qualifying: Arden (55, $462,000), Dalton (47, $410,780), Easton (41, $366,950), Fenwick (70, $630,000). Arden + Dalton + Easton enrolls only 143. Every combination reaching 150 costs at least $1,407,730 (Dalton + Easton + Fenwick), above $1.3 million.` },
      ] },
    { id: 'MSR05', title: 'Bike lanes',
      tabs: [
        { title: 'Council memo', html: R`<p>The council will fund protected bike lanes on up to two of four candidate streets this year. A street can be funded only if:</p>
<ol type="a"><li>average daily cyclist counts exceed 400;</li><li>at least 60 percent of surveyed businesses on the street support the project; and</li><li>the cost per kilometer is under $1.5 million.</li></ol>
<p>The project budget is $6 million. A funded street receives a lane along its full length.</p>` },
        { title: 'Street data', html: R`<table class="data"><thead><tr><th>Street</th><th>Length (km)</th><th>Average daily cyclists</th><th>Business support (%)</th><th>Cost per km ($ millions)</th></tr></thead>
<tbody><tr><td>Elm Street</td><td>2.0</td><td>520</td><td>64</td><td>1.40</td></tr><tr><td>Harbor Road</td><td>3.5</td><td>610</td><td>58</td><td>1.20</td></tr><tr><td>Kings Avenue</td><td>1.5</td><td>430</td><td>71</td><td>1.60</td></tr><tr><td>Mill Lane</td><td>2.5</td><td>390</td><td>80</td><td>1.10</td></tr></tbody></table>` },
        { title: "Director's e-mail", html: R`<p><b>From:</b> Transportation Director</p><p>New automated sensors show that the manual counts in the street data understated cycling by 20 percent on every street; actual daily counts are 1.2 times the figures shown. Also, the Kings Avenue contractor has revised its estimate to $1.45 million per kilometer.</p>` },
      ],
      qs: [
        { id: 'MSR05-1', kind: 'MC', sub: 'Conditions', d: 3,
          q: R`Based only on the council memo and the street data, how many streets meet all three conditions?`,
          ch: [R`0`, R`1`, R`2`, R`3`, R`4`], ans: 1,
          ex: R`Only Elm Street qualifies. Harbor fails (b) at 58%, Kings fails (c) at $1.6 million, and Mill fails (a) at 390 cyclists.` },
        { id: 'MSR05-2', kind: 'YN', sub: 'Inference', d: 4, q: R`Taking the director's e-mail into account, for each of the following statements select <i>Yes</i> if the statement is supported by the information provided. Otherwise select <i>No</i>.`, labels: [R`Yes`, R`No`],
          st: [{ t: R`Harbor Road meets all three conditions.`, a: 1 },
            { t: R`Mill Lane meets condition (a).`, a: 0 },
            { t: R`Kings Avenue meets all three conditions.`, a: 0 }],
          ex: R`(1) Business support is still 58%. No. (2) 390 × 1.2 = 468 > 400. Yes. (3) 430 × 1.2 = 516, support 71%, and $1.45 million is under $1.5 million. Yes.` },
        { id: 'MSR05-3', kind: 'MC', sub: 'Optimization', d: 4,
          q: R`Taking the director's e-mail into account, which two eligible streets could be funded together within the budget while adding the greatest total length of bike lanes?`,
          ch: [R`Elm Street and Kings Avenue`, R`Elm Street and Mill Lane`, R`Kings Avenue and Mill Lane`, R`Harbor Road and Elm Street`, R`Harbor Road and Mill Lane`], ans: 1,
          ex: R`Eligible: Elm (2.0 km, $2.8 million), Kings (1.5 km, $2.175 million), Mill (2.5 km, $2.75 million). Elm + Mill gives 4.5 km for $5.55 million, within $6 million and longer than the other pairs.` },
        { id: 'MSR05-4', kind: 'MC', sub: 'Scenario', d: 4,
          q: R`Using the sensor counts and the revised cost, if the council funded the two eligible streets with the greatest combined number of daily cyclists, how much of the $6 million budget would remain unspent?`,
          ch: [R`$0.45 million`, R`$0.975 million`, R`$1.025 million`, R`$1.075 million`, R`$1.25 million`], ans: 2,
          ex: R`Sensor counts: Elm 624, Kings 516, Mill 468. Elm + Kings cost 2.0 × 1.40 + 1.5 × 1.45 = 2.8 + 2.175 = $4.975 million, leaving $1.025 million.` },
      ] },
  ]);
})(typeof window !== 'undefined' ? window : globalThis, String.raw);
