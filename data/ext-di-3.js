/* Data Insights — Multi-Source Reasoning, extension sets (original). */
(function (root, R) {
  const GM = (root.GM = root.GM || {});
  const B = (GM.BANK = GM.BANK || {});
  const YN_PROMPT = R`For each of the following statements, select <i>Yes</i> if the statement is supported by the information provided. Otherwise select <i>No</i>.`;
  const PRICES = [R`$8`, R`$10`, R`$12`, R`None of the three prices`, R`The results do not determine the price`];
  B.msr = (B.msr || []).concat([
    { id: 'XMS01', title: 'Warehouse site',
      tabs: [
        { title: 'Criteria', html: R`<p><b>Selecting a new distribution warehouse</b></p>
<p>The retailer will lease one warehouse. A site qualifies only if it meets all three conditions:</p>
<ol><li>it is no more than 40 kilometers from the retailer's main port;</li><li>it offers at least 25,000 square meters (m²) of floor space; and</li><li>its annual lease is no more than $90 per m².</li></ol>
<p>Among qualifying sites, the retailer will choose the one with the lowest total annual cost: the lease for the site's entire floor space plus the estimated trucking cost.</p>` },
        { title: 'Sites', html: R`<p>Candidate sites</p>
<table class="data"><thead><tr><th>Site</th><th>Distance to port (km)</th><th>Floor space (m²)</th><th>Annual lease ($ per m²)</th><th>Trucking cost ($ millions per year)</th></tr></thead>
<tbody><tr><td>Ashgrove</td><td>32</td><td>28,000</td><td>85</td><td>1.10</td></tr><tr><td>Birchley</td><td>45</td><td>40,000</td><td>70</td><td>1.45</td></tr><tr><td>Coventry Park</td><td>22</td><td>24,000</td><td>95</td><td>0.80</td></tr><tr><td>Dunmore Flats</td><td>38</td><td>30,000</td><td>88</td><td>1.20</td></tr><tr><td>Elm Junction</td><td>18</td><td>26,000</td><td>92</td><td>0.70</td></tr><tr><td>Fairhaven</td><td>27</td><td>35,000</td><td>80</td><td>0.95</td></tr></tbody></table>` },
        { title: 'Update', html: R`<p><b>From:</b> Real estate team</p><p>Two updates. First, Elm Junction's owner has offered to lower its lease to $86 per m² if we sign this month, and we intend to accept. Second, distances must be measured by road: the new access road puts Birchley 38 km from the port, not 45 km. The other distances in the table are already road distances.</p>` },
      ],
      qs: [
        { id: 'XMS01-1', kind: 'MC', sub: 'Conditions', d: 3,
          q: R`Before the update, how many of the six sites qualified?`,
          ch: [R`1`, R`2`, R`3`, R`4`, R`5`], ans: 2,
          ex: R`Birchley is too far (45 km), Coventry Park is too small (24,000 m²) and too expensive ($95), and Elm Junction's lease ($92) is too high. Ashgrove, Dunmore Flats, and Fairhaven qualify.` },
        { id: 'XMS01-2', kind: 'YN', sub: 'Inference', d: 4, q: YN_PROMPT, labels: [R`Yes`, R`No`],
          st: [{ t: R`After the update, Birchley qualifies.`, a: 0 },
            { t: R`After the update, Elm Junction qualifies.`, a: 0 },
            { t: R`Before the update, Fairhaven had the lowest annual lease cost (floor space × lease rate) of the qualifying sites.`, a: 1 }],
          ex: R`(1) Birchley: 38 km, 40,000 m², $70. Yes. (2) Elm Junction: 18 km, 26,000 m², $86. Yes. (3) Lease costs: Ashgrove 28,000 × $85 = $2.38 million, Dunmore Flats $2.64 million, Fairhaven 35,000 × $80 = $2.80 million. Ashgrove's is lowest. No.` },
        { id: 'XMS01-3', kind: 'MC', sub: 'Scenario', d: 5,
          q: R`Taking the update into account, which site will the retailer choose?`,
          ch: [R`Ashgrove`, R`Birchley`, R`Dunmore Flats`, R`Elm Junction`, R`Fairhaven`], ans: 3,
          ex: R`Total annual costs: Elm Junction 26,000 × $86 = $2.236 million plus $0.70 million, about $2.94 million; Ashgrove $3.48 million; Fairhaven $3.75 million; Dunmore Flats $3.84 million; Birchley $2.80 million plus $1.45 million, $4.25 million.` },
        { id: 'XMS01-4', kind: 'MC', sub: 'Calculation', d: 4,
          q: R`Before the update, what would the total annual cost of the site the retailer chose have been?`,
          ch: [R`$3.48 million`, R`$3.75 million`, R`$3.84 million`, R`$4.06 million`, R`$4.25 million`], ans: 0,
          ex: R`Of the three qualifying sites, Ashgrove costs least: $2.38 million in lease plus $1.10 million in trucking, $3.48 million.` },
      ] },
    { id: 'XMS02', title: 'Conference venue',
      tabs: [
        { title: "Planner's notes", html: R`<p>We expect 320 attendees for the two-day conference. Requirements for the venue:</p>
<ul><li>The main hall must seat every attendee for the keynote sessions.</li><li>Each afternoon, attendees split evenly among 4 workshops held at the same time, each in its own room, so the venue needs at least 4 workshop rooms, each seating at least one-quarter of the attendees.</li></ul>
<p>Catering costs $45 per attendee per day at every venue.</p>` },
        { title: 'Venues', html: R`<p>Venue options</p>
<table class="data"><thead><tr><th>Venue</th><th>Main hall seats</th><th>Workshop rooms</th><th>Seats per workshop room</th><th>Rental for both days ($)</th></tr></thead>
<tbody><tr><td>Harbor Center</td><td>400</td><td>4</td><td>90</td><td>18,000</td></tr><tr><td>Lakeview Hotel</td><td>300</td><td>5</td><td>80</td><td>14,500</td></tr><tr><td>Meridian Hall</td><td>350</td><td>3</td><td>120</td><td>15,000</td></tr><tr><td>Northgate Inn</td><td>340</td><td>4</td><td>75</td><td>13,000</td></tr><tr><td>Oakridge Campus</td><td>500</td><td>6</td><td>60</td><td>12,000</td></tr></tbody></table>` },
        { title: 'Budget e-mail', html: R`<p><b>From:</b> Finance</p><p>The total budget for venue rental plus catering is $45,000. No other costs will be charged to this budget.</p>` },
      ],
      qs: [
        { id: 'XMS02-1', kind: 'MC', sub: 'Conditions', d: 3,
          q: R`How many of the venues meet the seating requirements for 320 attendees?`,
          ch: [R`1`, R`2`, R`3`, R`4`, R`5`], ans: 0,
          ex: R`Each workshop room must seat 80. Lakeview's main hall is too small, Meridian has only 3 workshop rooms, and Northgate's (75) and Oakridge's (60) rooms are too small. Only Harbor Center qualifies.` },
        { id: 'XMS02-2', kind: 'YN', sub: 'Inference', d: 4, q: YN_PROMPT, labels: [R`Yes`, R`No`],
          st: [{ t: R`Catering for 320 attendees for the whole conference would cost more than $28,000.`, a: 0 },
            { t: R`Harbor Center could host 320 attendees without exceeding the budget.`, a: 1 },
            { t: R`If each of Northgate Inn's workshop rooms seated 5 more people, Northgate Inn would meet the seating requirements for 320 attendees.`, a: 0 }],
          ex: R`(1) 320 × $45 × 2 = $28,800. Yes. (2) $18,000 + $28,800 = $46,800, over $45,000. No. (3) Rooms of 80 seats would each hold one-quarter of 320, and the 340-seat hall and 4 rooms already suffice. Yes.` },
        { id: 'XMS02-3', kind: 'MC', sub: 'Optimization', d: 5,
          q: R`What is the greatest number of attendees for which Harbor Center would meet the seating requirements and keep total costs within the budget?`,
          ch: [R`250`, R`275`, R`300`, R`320`, R`360`], ans: 2,
          ex: R`Cost is $18,000 plus $90 per attendee (two days of catering), which stays within $45,000 for at most 300 attendees. The rooms would allow up to 360 (4 rooms of 90), so the budget is the binding limit: 300.` },
        { id: 'XMS02-4', kind: 'MC', sub: 'Scenario', d: 5,
          q: R`If attendance were expected to be 280 instead of 320, which venue meeting the seating requirements would have the lowest total cost?`,
          ch: [R`Harbor Center`, R`Lakeview Hotel`, R`Meridian Hall`, R`Northgate Inn`, R`Oakridge Campus`], ans: 3,
          ex: R`For 280 attendees, workshop rooms must seat 70. Harbor Center, Lakeview Hotel (300-seat hall), and Northgate Inn (75-seat rooms) now qualify; Meridian still has only 3 rooms and Oakridge's rooms seat 60. Catering is the same everywhere, so the lowest rental wins: Northgate Inn at $13,000.` },
      ] },
    { id: 'XMS03', title: 'Scholarships',
      tabs: [
        { title: 'Criteria', html: R`<p>The foundation awards scholarships of $8,000 each. An applicant is eligible only if the applicant</p>
<ol type="a"><li>has a grade point average (GPA) of at least 3.5,</li><li>has completed at least 40 hours of community service, and</li><li>has a family income below $60,000.</li></ol>
<p>Eligible applicants are ranked by score = 10 × GPA + (service hours ÷ 10), and scholarships go to the highest scores until the budget is spent.</p>` },
        { title: 'Applicants', html: R`<p>This year's applicants</p>
<table class="data"><thead><tr><th>Applicant</th><th>GPA</th><th>Service hours</th><th>Family income ($)</th></tr></thead>
<tbody><tr><td>Avery</td><td>3.8</td><td>60</td><td>52,000</td></tr><tr><td>Blake</td><td>3.6</td><td>120</td><td>58,000</td></tr><tr><td>Casey</td><td>3.9</td><td>35</td><td>41,000</td></tr><tr><td>Devon</td><td>3.5</td><td>90</td><td>61,000</td></tr><tr><td>Emery</td><td>3.7</td><td>80</td><td>47,000</td></tr><tr><td>Finley</td><td>3.4</td><td>150</td><td>39,000</td></tr><tr><td>Gray</td><td>3.95</td><td>50</td><td>55,000</td></tr></tbody></table>` },
        { title: 'Committee note', html: R`<p>This year's scholarship budget is $24,000. The board has also voted to count community service completed during the summer, which adds 10 hours to Casey's total and 15 hours to Devon's. No other applicant reported summer service.</p>` },
      ],
      qs: [
        { id: 'XMS03-1', kind: 'MC', sub: 'Conditions', d: 3,
          q: R`Before the committee note, how many of the applicants were eligible?`,
          ch: [R`2`, R`3`, R`4`, R`5`, R`6`], ans: 2,
          ex: R`Casey lacks service hours (35), Devon's family income is too high ($61,000), and Finley's GPA is too low (3.4). Avery, Blake, Emery, and Gray are eligible.` },
        { id: 'XMS03-2', kind: 'YN', sub: 'Inference', d: 4, q: YN_PROMPT, labels: [R`Yes`, R`No`],
          st: [{ t: R`After the committee note, Casey is eligible.`, a: 0 },
            { t: R`After the committee note, Devon is eligible.`, a: 1 },
            { t: R`Finley would be eligible if Finley's GPA were 0.1 higher.`, a: 0 }],
          ex: R`(1) Casey now has 45 hours. Yes. (2) Devon's family income still exceeds the limit. No. (3) A 3.5 GPA meets condition (a), and Finley already meets (b) and (c). Yes.` },
        { id: 'XMS03-3', kind: 'MC', sub: 'Scenario', d: 5,
          q: R`Taking the committee note into account, which applicant has the lowest score among those who receive scholarships?`,
          ch: [R`Avery`, R`Blake`, R`Casey`, R`Emery`, R`Gray`], ans: 4,
          ex: R`The budget pays for 3 scholarships. Scores: Blake 48, Emery 45, Gray 44.5, Avery 44, Casey 43.5. Gray is third.` },
        { id: 'XMS03-4', kind: 'MC', sub: 'Scenario', d: 5,
          q: R`Taking the committee note into account, if the budget were raised to $32,000, which additional applicant would receive a scholarship?`,
          ch: [R`Casey`, R`Devon`, R`Finley`, R`Avery`, R`No additional applicant`], ans: 3,
          ex: R`$32,000 pays for 4 scholarships, and Avery (44) ranks fourth, just ahead of Casey (43.5). Devon and Finley remain ineligible.` },
      ] },
    { id: 'XMS04', title: 'Pricing test',
      tabs: [
        { title: 'Experiment design', html: R`<p>An online store tested three monthly prices for a new subscription. Over four weeks, each visitor to the sign-up page was randomly shown one of the three prices.</p>
<p>The store will adopt the price with the highest revenue per visitor (price × subscriptions ÷ visitors), provided that no more than 10 percent of that price's subscribers canceled in their first month.</p>` },
        { title: 'Results', html: R`<p>Results by price</p>
<table class="data"><thead><tr><th>Monthly price</th><th>Visitors</th><th>Subscriptions</th><th>First-month cancellations</th></tr></thead>
<tbody><tr><td>$8</td><td>12,000</td><td>960</td><td>72</td></tr><tr><td>$10</td><td>12,000</td><td>840</td><td>92</td></tr><tr><td>$12</td><td>12,000</td><td>690</td><td>76</td></tr></tbody></table>` },
        { title: "Analyst's note", html: R`<p><b>From:</b> Analytics</p><p>Two corrections. First, revenue per visitor should count only subscriptions that were not canceled in the first month. Second, 15 of the cancellations in the $12 group were caused by a billing error; those subscribers have been reinstated, so they should count as neither canceled nor lost.</p>` },
      ],
      qs: [
        { id: 'XMS04-1', kind: 'MC', sub: 'Conditions', d: 4,
          q: R`Before the analyst's note is taken into account, which price would the store adopt?`,
          ch: PRICES, ans: 0,
          ex: R`$10 has the highest revenue per visitor ($0.70), but 92 ÷ 840 ≈ 11.0% canceled; $12 ($0.69) also exceeds the limit at 76 ÷ 690 ≈ 11.0%. $8 ($0.64) had 72 ÷ 960 = 7.5% cancellations, so it is adopted.` },
        { id: 'XMS04-2', kind: 'YN', sub: 'Inference', d: 5, q: YN_PROMPT, labels: [R`Yes`, R`No`],
          st: [{ t: R`Before the analyst's note is taken into account, the $10 price produced the highest revenue per visitor.`, a: 0 },
            { t: R`Taking the analyst's note into account, the $12 price meets the cancellation condition.`, a: 0 },
            { t: R`Taking the analyst's note into account, the $8 price produces the highest revenue per visitor.`, a: 1 }],
          ex: R`(1) $0.70 against $0.69 and $0.64. Yes. (2) 61 ÷ 690 ≈ 8.8%. Yes. (3) Counting only retained subscriptions: $12 gives 629 × $12 ÷ 12,000 ≈ $0.63, $10 gives 748 × $10 ÷ 12,000 ≈ $0.62, and $8 gives 888 × $8 ÷ 12,000 ≈ $0.59. No.` },
        { id: 'XMS04-3', kind: 'MC', sub: 'Scenario', d: 6,
          q: R`Taking the analyst's note into account, which price would the store adopt?`,
          ch: PRICES, ans: 2,
          ex: R`$12 now has the highest revenue per visitor (about $0.63) and an 8.8% cancellation rate, within the limit. $10 still exceeds the limit at about 11%.` },
        { id: 'XMS04-4', kind: 'MC', sub: 'Calculation', d: 5,
          q: R`Taking the analyst's note into account, the revenue per visitor of the adopted price is closest to`,
          ch: [R`$0.55`, R`$0.59`, R`$0.62`, R`$0.63`, R`$0.69`], ans: 3,
          ex: R`629 retained subscriptions × $12 ÷ 12,000 visitors ≈ $0.629.` },
      ] },
  ]);
})(typeof window !== 'undefined' ? window : globalThis, String.raw);
