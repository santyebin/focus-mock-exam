/* Data Insights — Multi-Source Reasoning sets (original). Each set has 4 questions; 3 are delivered adaptively. */
(function (root, R) {
  const GM = (root.GM = root.GM || {});
  const B = (GM.BANK = GM.BANK || {});
  const YN_PROMPT = R`For each of the following statements, select <i>Yes</i> if the statement is supported by the information provided. Otherwise select <i>No</i>.`;
  B.msr = (B.msr || []).concat([
    { id: 'MSR01', title: 'Product launch',
      tabs: [
        { title: 'E-mail', html: R`<p><b>From:</b> Dana Ruiz, Vice President of Marketing<br><b>To:</b> SmartBrew product team</p>
<p>We will launch the SmartBrew coffee maker next quarter in each of our four test regions that meets <b>both</b> of these conditions:</p>
<ol><li>projected first-year unit sales of at least 12,000, and</li><li>a launch budget that does not exceed 20 percent of projected first-year revenue in that region.</li></ol>
<p>The unit price will be $150 in every region.</p>` },
        { title: 'Projections', html: R`<p>Market research projections by region</p>
<table class="data"><thead><tr><th>Region</th><th>Projected first-year unit sales</th><th>Estimated launch marketing cost</th></tr></thead>
<tbody><tr><td>Northeast</td><td>14,000</td><td>$390,000</td></tr><tr><td>Southeast</td><td>11,500</td><td>$250,000</td></tr><tr><td>Midwest</td><td>16,000</td><td>$520,000</td></tr><tr><td>West</td><td>12,500</td><td>$360,000</td></tr></tbody></table>` },
        { title: 'Finance note', html: R`<p><b>From:</b> Finance</p><p>A region's launch budget equals its estimated launch marketing cost, except that any region with projected first-year unit sales <b>greater than 15,000</b> also requires an additional warehouse lease of $80,000, which must be included in that region's launch budget.</p>` },
      ],
      qs: [
        { id: 'MSR01-1', kind: 'MC', sub: 'Conditions', d: 3,
          q: R`Based on the information provided, in which two regions will SmartBrew be launched?`,
          ch: [R`Northeast and West`, R`Northeast and Southeast`, R`Northeast and Midwest`, R`Midwest and West`, R`Southeast and West`], ans: 0,
          ex: R`Southeast fails condition 1 (11,500). Midwest's budget is $520,000 + $80,000 = $600,000, above 20% of $2.4 million ($480,000). Northeast: $390,000 ≤ $420,000. West: $360,000 ≤ $375,000.` },
        { id: 'MSR01-2', kind: 'YN', sub: 'Conditions', d: 4, q: YN_PROMPT, labels: [R`Yes`, R`No`],
          st: [{ t: R`If the unit price in the Midwest were $175 instead of $150, with no change in projected unit sales, the Midwest would meet both conditions.`, a: 1 },
            { t: R`If the Southeast's projected first-year unit sales were 500 units higher, with no change in its estimated marketing cost, the Southeast would meet both conditions.`, a: 0 },
            { t: R`The West's launch budget is less than 20 percent of its projected first-year revenue.`, a: 0 }],
          ex: R`(1) 16,000 × $175 = $2.8 million; 20% is $560,000, still below $600,000. No. (2) 12,000 units meets condition 1, and $250,000 ≤ 20% of $1.8 million = $360,000. Yes. (3) $360,000 < $375,000. Yes.` },
        { id: 'MSR01-3', kind: 'MC', sub: 'Thresholds', d: 5,
          q: R`Which of the following is the least of the listed percent increases in the Northeast's estimated launch marketing cost that would cause the Northeast to fail the second condition?`,
          ch: [R`5%`, R`6%`, R`7%`, R`8%`, R`12%`], ans: 3,
          ex: R`The limit is 20% of $2.1 million = $420,000, which is $30,000 (about 7.7%) above $390,000. A 7% increase gives $417,300 (still passes); 8% gives $421,200 (fails).` },
        { id: 'MSR01-4', kind: 'MC', sub: 'Scenario', d: 6,
          q: R`If projected first-year unit sales in every region were 10 percent higher than shown, with estimated marketing costs unchanged, how many regions would meet both conditions?`,
          ch: [R`0`, R`1`, R`2`, R`3`, R`4`], ans: 2,
          ex: R`Northeast: 15,400 units now triggers the $80,000 lease; $470,000 > 20% of $2.31 million ($462,000), so it fails. Southeast: 12,650 units; $250,000 ≤ $379,500, passes. Midwest: $600,000 > $528,000, fails. West: $360,000 ≤ $412,500, passes. Two regions.` },
      ] },
    { id: 'MSR02', title: 'Textile exhibition',
      tabs: [
        { title: "Curator's plan", html: R`<p>The museum will display 40 textiles lent by the Ardent Collection from March 1 through May 31. The lender requires that:</p>
<ol type="a"><li>light in the display gallery not exceed 50 lux,</li><li>relative humidity be kept between 45 and 55 percent, and</li><li>no textile be displayed for more than 60 consecutive days.</li></ol>
<p>To satisfy (c), the curator plans to display one group of 20 textiles from March 1 through April 15 and the other 20 from April 16 through May 31.</p>` },
        { title: 'Galleries', html: R`<p>Facilities report</p>
<table class="data"><thead><tr><th>Gallery</th><th>Lowest achievable light level (lux)</th><th>Can hold humidity at 45–55%?</th><th>Capacity (textiles)</th></tr></thead>
<tbody><tr><td>Gallery 1</td><td>40</td><td>Yes</td><td>25</td></tr><tr><td>Gallery 2</td><td>60</td><td>Yes</td><td>30</td></tr><tr><td>Gallery 3</td><td>50</td><td>No</td><td>18</td></tr><tr><td>Gallery 4</td><td>35</td><td>Yes</td><td>22</td></tr></tbody></table>` },
        { title: "Registrar's e-mail", html: R`<p>The lender has agreed to one exception: textiles may be displayed in a gallery that cannot keep light at or below 50 lux, but for no more than 30 consecutive days.</p><p>Separately, our insurer requires that all of the lent textiles on display at any one time be in a single gallery.</p>` },
      ],
      qs: [
        { id: 'MSR02-1', kind: 'MC', sub: 'Conditions', d: 3,
          q: R`Under the curator's plan, which gallery or galleries could host the first group of 20 textiles from March 1 through April 15 in compliance with all of the requirements?`,
          ch: [R`Gallery 1 only`, R`Gallery 4 only`, R`Gallery 1, Gallery 2, and Gallery 4`, R`Gallery 1 and Gallery 4 only`, R`Gallery 1, Gallery 3, and Gallery 4`], ans: 3,
          ex: R`The period is 46 days. Gallery 2 exceeds 50 lux and could be used for only 30 days. Gallery 3 cannot hold the humidity and holds only 18. Galleries 1 and 4 meet every requirement.` },
        { id: 'MSR02-2', kind: 'YN', sub: 'Inference', d: 4, q: YN_PROMPT, labels: [R`Yes`, R`No`],
          st: [{ t: R`Gallery 2 could be used to display a group of 20 textiles for a period of 30 days or fewer.`, a: 0 },
            { t: R`If the exhibition were divided into three display periods of about 30 days each, each group could be shown in Gallery 3.`, a: 1 },
            { t: R`Under the curator's plan, no textile would be displayed for more than 46 consecutive days.`, a: 0 }],
          ex: R`(1) The exception allows up to 30 days above 50 lux; humidity and capacity are fine. Yes. (2) Gallery 3 cannot hold 45–55% humidity. No. (3) March 1–April 15 and April 16–May 31 are each 46 days. Yes.` },
        { id: 'MSR02-3', kind: 'MC', sub: 'Scenario', d: 4,
          q: R`If the curator instead displayed all 40 textiles at once from March 1 through April 29, which gallery could be used?`,
          ch: [R`Gallery 1`, R`Gallery 2`, R`Gallery 4`, R`Either Gallery 1 or Gallery 4`, R`None of the galleries`], ans: 4,
          ex: R`All 40 must be in a single gallery, and the largest capacity is 30.` },
        { id: 'MSR02-4', kind: 'MC', sub: 'Scenario', d: 6,
          q: R`Suppose Gallery 4's capacity were increased to 40 textiles. Which of the following schedules, keeping the exhibition open from March 1 through May 31, would comply with all of the requirements?`,
          ch: [R`All 40 textiles in Gallery 4 from March 1 through May 31`,
            R`One group of 20 in Gallery 4 from March 1 through April 15, then the other group of 20 in Gallery 4 from April 16 through May 31`,
            R`All 40 in Gallery 4 from March 1 through April 29, then all 40 in Gallery 1 from April 30 through May 31`,
            R`One group of 20 in Gallery 4 from March 1 through April 15, then the other group of 20 in Gallery 2 from April 16 through May 31`,
            R`All 40 in Gallery 4 from March 1 through April 29, then one group of 20 in Gallery 1 from April 30 through May 31`], ans: 1,
          ex: R`(A) shows each textile for 92 days. (C) exceeds Gallery 1's capacity. (D) uses Gallery 2 for 46 days. (E) keeps the second-period group on view for 92 consecutive days. (B) meets every requirement.` },
      ] },
    { id: 'MSR03', title: 'Sales compensation',
      tabs: [
        { title: 'Q3 policy', html: R`<p><b>Brightline Software — sales compensation, Q3</b></p>
<p>Each sales representative earns a base salary of $4,000 per month plus a commission of 5 percent of monthly sales up to $100,000 and 8 percent of monthly sales above $100,000.</p>
<p>Representatives whose total sales for a quarter <b>exceed</b> $360,000 receive a quarterly bonus of $3,000.</p>` },
        { title: 'Q3 sales', html: R`<p>Monthly sales, Q3 (thousands of dollars)</p>
<table class="data"><thead><tr><th>Representative</th><th>July</th><th>August</th><th>September</th></tr></thead>
<tbody><tr><td>Alvarez</td><td>95</td><td>130</td><td>120</td></tr><tr><td>Brooks</td><td>110</td><td>105</td><td>140</td></tr><tr><td>Chen</td><td>140</td><td>80</td><td>145</td></tr><tr><td>Diaz</td><td>90</td><td>100</td><td>115</td></tr></tbody></table>` },
        { title: 'Q4 change', html: R`<p><b>From:</b> Sales Director</p><p>Starting in Q4, the commission rate on monthly sales above $100,000 rises from 8 percent to 10 percent, and the quarterly bonus threshold rises from $360,000 to $375,000. The base salary and the 5 percent rate are unchanged.</p>` },
      ],
      qs: [
        { id: 'MSR03-1', kind: 'MC', sub: 'Calculation', d: 3,
          q: R`What was Brooks's total compensation (base salary plus commission) for August?`,
          ch: [R`$9,400`, R`$9,650`, R`$10,400`, R`$11,400`, R`$13,400`], ans: 0,
          ex: R`Commission: 5% of $100,000 = $5,000 plus 8% of $5,000 = $400. Total $4,000 + $5,400 = $9,400.` },
        { id: 'MSR03-2', kind: 'YN', sub: 'Inference', d: 4, q: YN_PROMPT, labels: [R`Yes`, R`No`],
          st: [{ t: R`Exactly one of the four representatives earned the quarterly bonus for Q3.`, a: 0 },
            { t: R`Under the Q4 policy, Chen's Q3 sales would have earned the quarterly bonus.`, a: 1 },
            { t: R`Diaz's commission for September was more than 25 percent greater than Diaz's commission for July.`, a: 0 }],
          ex: R`(1) Quarter totals: Alvarez 345, Brooks 355, Chen 365, Diaz 305 (thousand). Only Chen exceeds 360. Yes. (2) 365 does not exceed 375. No. (3) $6,200 vs $4,500 is about 38 percent more. Yes.` },
        { id: 'MSR03-3', kind: 'MC', sub: 'Calculation', d: 5,
          q: R`If Alvarez's monthly sales in Q4 equal Alvarez's monthly sales in Q3, by how much will Alvarez's total Q4 commission exceed Alvarez's total Q3 commission?`,
          ch: [R`$600`, R`$1,000`, R`$1,250`, R`$1,500`, R`$2,000`], ans: 1,
          ex: R`Only sales above $100,000 in a month are affected: $30,000 in August and $20,000 in September. The extra 2 percentage points on $50,000 is $1,000.` },
        { id: 'MSR03-4', kind: 'MC', sub: 'Calculation', d: 6,
          q: R`Under the Q4 policy, what would be the total Q4 compensation (base salary, commission, and any bonus) of a representative whose sales were exactly $125,000 in each month of Q4?`,
          ch: [R`$33,000`, R`$34,500`, R`$36,000`, R`$37,500`, R`$39,000`], ans: 1,
          ex: R`Monthly commission: $5,000 + 10% of $25,000 = $7,500, so $22,500 for the quarter, plus $12,000 base. Quarterly sales of $375,000 do not exceed the $375,000 threshold, so there is no bonus. Total $34,500.` },
      ] },
  ]);
})(typeof window !== 'undefined' ? window : globalThis, String.raw);
