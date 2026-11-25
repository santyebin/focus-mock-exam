// @ts-check
const { test, expect } = require('@playwright/test');

const debug = (page, fn, arg) => page.evaluate(fn, arg);
const title = (page) => page.locator('.gx-title');

async function finishSectionByButtons(page) {
  await page.getByRole('button', { name: 'End Section Review' }).click();
  await page.locator('.gx-dialog').getByRole('button', { name: 'Yes' }).click();
}

test('full mock follows the real exam: order, confirmation, review & edit, break, score preview, report', async ({ page }) => {
  await page.goto('/');
  await page.locator('#h-mock').click();
  await expect(title(page)).toContainText('Select Section Order');
  await page.locator('input[name=ord][value="0"]').check(); // Quant, Verbal, Data Insights
  await page.locator('#gx-go').click();
  await expect(title(page)).toContainText('Quantitative Reasoning — Instructions');
  await page.getByRole('button', { name: 'Begin Section' }).click();

  // first question answered with the mouse, as a candidate would
  await expect(page.locator('#gx-count .val')).toHaveText('1 of 21');
  await expect(page.locator('#gx-time .val')).toHaveText(/^4[45]:\d\d$/);
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('.gx-dialog header')).toHaveText('Answer Required');
  await page.locator('.gx-dialog').getByRole('button', { name: 'OK' }).click();
  await page.locator('.choices input').first().check();
  await page.locator('#gx-bm').click();
  await expect(page.locator('#gx-bm')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('.gx-dialog header')).toHaveText('Response Confirmation');
  await page.locator('.gx-dialog').getByRole('button', { name: 'Yes' }).click();
  await expect(page.locator('#gx-count .val')).toHaveText('2 of 21');

  // the timer can be hidden and shown
  await page.locator('#gx-time').click();
  await expect(page.locator('#gx-time')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#gx-time').click();

  await debug(page, () => GM.App.debug.autoAnswer(0.7));
  await expect(title(page)).toContainText('Question Review & Edit');
  await expect(page.locator('.gx-review tbody tr')).toHaveCount(21);
  await expect(page.locator('.gx-review tbody tr').first().locator('svg')).toHaveCount(1); // bookmarked

  // change one answer: uses one of three edits
  await page.locator('.gx-review tbody tr').nth(0).click();
  const choices = page.locator('.choices input');
  const checked = await choices.evaluateAll((els) => els.findIndex((e) => e.checked));
  await choices.nth(checked === 0 ? 1 : 0).check();
  await page.getByRole('button', { name: 'Review Screen' }).click();
  await expect(page.locator('.gx-dialog header')).toHaveText('Answer Edit');
  await page.locator('.gx-dialog').getByRole('button', { name: 'Save Change' }).click();
  await expect(page.locator('.gx-review-meta')).toContainText('Answer edits remaining: 2 of 3');

  await finishSectionByButtons(page);
  await expect(title(page)).toContainText('Optional Break');
  await page.getByRole('button', { name: 'Take Break' }).click();
  await expect(page.locator('#gx-bigclock')).toHaveText(/^(10:00|09:5\d)$/);
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(title(page)).toContainText('Verbal Reasoning — Instructions');
  await page.getByRole('button', { name: 'Begin Section' }).click();
  await debug(page, () => GM.App.debug.autoAnswer(0.6));
  await finishSectionByButtons(page);

  // break already taken: straight to the third section
  await expect(title(page)).toContainText('Data Insights — Instructions');
  await page.getByRole('button', { name: 'Begin Section' }).click();
  await expect(page.locator('#gx-t-calc')).toBeVisible(); // calculator only in Data Insights
  await debug(page, () => GM.App.debug.autoAnswer(0.6));
  await finishSectionByButtons(page);

  await expect(title(page)).toContainText('Score Preview');
  await expect(page.locator('.gx-scores tr.total')).toContainText('Total Score');
  await page.getByRole('button', { name: 'View Full Report' }).click();
  await expect(page.locator('.total-card .big')).toHaveText(/^\d{3}$/);
  await expect(page.locator('.total-card .range')).toContainText('likely');
  await expect(page.locator('.coach').first()).toBeVisible();
  await page.locator('tr.qrow').first().click();
  await expect(page.locator('.explain').first()).toContainText('Correct answer');
});

test('section test scores one section on its own', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-sec="verbal"]').click();
  await expect(title(page)).toContainText('Verbal Reasoning — Instructions');
  await page.getByRole('button', { name: 'Begin Section' }).click();
  await expect(page.locator('#gx-count .val')).toHaveText('1 of 23');
  await expect(page.locator('#gx-t-calc')).toHaveCount(0);
  await debug(page, () => GM.App.debug.autoAnswer(0.7));
  await finishSectionByButtons(page);
  await expect(title(page)).toContainText('Score Preview');
  await expect(page.locator('.gx-scores tbody tr')).toHaveCount(1);
});

test('fixed form gives everyone the same questions', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-form="F1"]').click();
  await page.locator('#gx-go').click();
  await page.getByRole('button', { name: 'Begin Section' }).click();
  const ok = await debug(page, () => { const s = GM.App.debug.state(); const k = s.order[0]; return s.sections[k].st.records[0].id === GM.FORMS[0].sections[k][0]; });
  expect(ok).toBe(true);
});

test('timer expiry ends the section and penalizes blanks', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-sec="quant"]').click();
  await page.getByRole('button', { name: 'Begin Section' }).click();
  await debug(page, () => GM.App.debug.autoAnswer(0.7, 10));
  await debug(page, () => GM.App.debug.skipTime(60 * 60000));
  await expect(title(page)).toContainText('Score Preview');
  await expect(page.locator('.gx-dialog header')).toHaveText('Time Expired');
});

test('practice study mode shows the explanation after each answer', async ({ page }) => {
  await page.goto('/#practice');
  await page.locator('input[name=p-sec][value="quant"]').check();
  await page.locator('#p-count').selectOption('5');
  await page.locator('#p-start').click();
  await expect(page.locator('#p-check')).toBeDisabled();
  await page.locator('.choices input').first().check();
  await page.locator('#p-check').click();
  await expect(page.locator('.feedback')).toContainText('Correct answer');
  await page.locator('#p-next').click();
  await page.locator('#p-end').click();
  await page.getByRole('button', { name: 'End set' }).last().click();
  await expect(page.locator('h1')).toContainText(/of 1 correct/);
});

test('mistake log brings questions back for review', async ({ page }) => {
  await page.goto('/');
  await debug(page, () => { GM.Store.addMistake('QA01', 'wrong'); GM.Store.addMistake('QG02', 'wrong'); });
  await page.goto('/#mistakes');
  await expect(page.locator('.stat').first()).toContainText('2');
  await page.locator('#m-review').click();
  await expect(page.locator('.px-top .title')).toHaveText('Mistake review');
  await page.locator('.choices input').first().check();
  await page.locator('#p-check').click();
  await expect(page.locator('.feedback')).toBeVisible();
});

test('progress, settings and accessibility options', async ({ page }) => {
  await page.goto('/#settings');
  await page.locator('#s-size').selectOption('1.3');
  await page.locator('#s-contrast').selectOption('high');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ts').trim())).toBe('1.3');
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high');
  await page.locator('#s-target').fill('685');
  await page.locator('#s-save-target').click();
  await page.goto('/#progress');
  await expect(page.locator('.stat').nth(1)).toContainText('685');
});

test('question editor previews and checks a question', async ({ page }) => {
  await page.goto('/editor.html');
  await expect(page.locator('#ed-checks')).toContainText('Passes');
  await page.locator('#f-ch2').fill('A choice that is far, far longer than every other choice in this question set');
  await page.locator('#ed-type').selectOption('CR');
  await expect(page.locator('#ed-checks')).toContainText('45-140');
  await expect(page.locator('#ed-q .choices input')).toHaveCount(5);
});

test('works offline after the first visit', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('h1')).toHaveText('Focus Mock Exam');
  await page.locator('[data-sec="quant"]').click();
  await expect(title(page)).toContainText('Instructions');
  await context.setOffline(false);
});

test('phone layout never scrolls sideways @mobile', async ({ page }) => {
  for (const url of ['/', '/#practice', '/#progress', '/#settings', '/editor.html']) {
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(over, url).toBeLessThanOrEqual(1);
  }
  await page.goto('/');
  await page.locator('[data-sec="verbal"]').click();
  await page.getByRole('button', { name: 'Begin Section' }).click();
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(over).toBeLessThanOrEqual(1);
});
