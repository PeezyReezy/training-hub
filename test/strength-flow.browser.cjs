// Requires Playwright and Chromium. Run: node --test test/strength-flow.browser.cjs
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const KEY = 'strength-training-tracker-v2';
const first = 'A|Band-assisted pull-up|0';
let server, browser, base;
before(async () => {
  server = http.createServer(async (req, res) => {
    const file = new URL(req.url, 'http://localhost').pathname;
    if (!['/', '/index.html', '/strength.html', '/strava-api.js', '/strength-plans.js', '/insights.html', '/insights.js', '/insights-data.js'].includes(file)) {
      res.writeHead(404); return res.end();
    }
    res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : 'text/html');
    res.end(await fs.readFile(path.join(__dirname, '..', file === '/' ? 'index.html' : file.slice(1))));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ['--no-sandbox']
  });
});
after(async () => { await browser?.close(); await new Promise(resolve => server?.close(resolve)); });
async function pageWith(t, sessions = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  t.after(() => page.context().close());
  page.on('pageerror', error => assert.fail(error.message));
  await page.goto(base);
  await page.evaluate(({ KEY, sessions }) => localStorage.setItem(KEY, JSON.stringify({ version: 2, sessions })), { KEY, sessions });
  return page;
}
const session = (weight, reps) => ({ started: 1, finished: 2, notes: 'Old notes', sets: { [first]: { weight, reps, done: true } } });
const weight = page => page.locator('[data-id="' + first + '"][data-prop="weight"]');
const reps = page => page.locator('[data-id="' + first + '"][data-prop="reps"]');

test('Strength A and B carry the chosen date from the dashboard without creating manual logs', async t => {
  for (const day of ['tuesday', 'sunday']) {
    const page = await pageWith(t);
    await page.selectOption('#kind', 'strength');
    assert.equal(await page.locator('#manualDetails').isVisible(), false);
    await page.fill('#logDate', '2026-11-08');
    await page.selectOption('#workoutDay', day);
    await page.getByRole('button', { name: 'Start workout' }).click();
    await page.waitForURL('**/strength.html?**');
    assert.equal(await page.locator('#date').inputValue(), '2026-11-08');
    assert.equal(await page.locator('[data-day].active').getAttribute('data-day'), day);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('training-hub-v1') || '{"logs":[]}').logs.length), 0);
  }
});

test('new sessions prefill earlier same-day values, persist edits, and clear completion and notes', async t => {
  const page = await pageWith(t, {
    'tuesday|2026-11-03': session('blue band', '6'),
    'tuesday|2026-11-06': { sets: { [first]: { weight: '', reps: '', done: false } } },
    'tuesday|2026-11-17': session('future', '99'),
    'sunday|2026-11-08': session('other workout', '20')
  });
  await page.goto(base + '/strength.html?day=tuesday&date=2026-11-10');
  assert.equal(await weight(page).inputValue(), 'blue band');
  assert.equal(await reps(page).inputValue(), '6');
  assert.equal(await page.locator('.check.done').count(), 0);
  assert.equal(await page.locator('#notes').inputValue(), '');
  assert.match(await page.locator('#progressText').innerText(), /^0 of/);
  assert.equal(await page.evaluate(KEY => JSON.parse(localStorage.getItem(KEY)).sessions['tuesday|2026-11-10'], KEY), undefined);
  await weight(page).fill('green band');
  await page.locator('[data-check="' + first + '"]').click();
  await page.reload();
  assert.equal(await weight(page).inputValue(), 'green band');
  assert.equal(await reps(page).inputValue(), '6');
  assert.equal(await page.locator('.check.done').count(), 1);
  const saved = await page.evaluate(KEY => JSON.parse(localStorage.getItem(KEY)).sessions, KEY);
  assert.equal(saved['tuesday|2026-11-10'].finished, null);
  assert.equal(saved['tuesday|2026-11-03'].sets[first].weight, 'blue band');
});

test('opening an existing session preserves intentional blanks and saved completion', async t => {
  const existing = session('', '4');
  const page = await pageWith(t, { 'tuesday|2026-11-03': session('old', '6'), 'tuesday|2026-11-10': existing });
  await page.goto(base + '/strength.html?day=tuesday&date=2026-11-10');
  assert.equal(await weight(page).inputValue(), '');
  assert.equal(await reps(page).inputValue(), '4');
  assert.equal(await page.locator('.check.done').count(), 1);
  assert.equal(await page.locator('#notes').inputValue(), 'Old notes');
});

test('no history stays empty, invalid links fall back safely, and date changes survive reload', async t => {
  const page = await pageWith(t);
  await page.goto(base + '/strength.html?day=invalid&date=2026-02-30');
  assert.equal(await page.locator('[data-day].active').getAttribute('data-day'), 'tuesday');
  assert.notEqual(await page.locator('#date').inputValue(), '2026-02-30');
  assert.equal(await weight(page).inputValue(), '');
  await page.fill('#date', '2026-11-08');
  await page.locator('#date').dispatchEvent('change');
  await page.locator('[data-day="sunday"]').click();
  await page.reload();
  assert.equal(await page.locator('#date').inputValue(), '2026-11-08');
  assert.equal(await page.locator('[data-day].active').getAttribute('data-day'), 'sunday');
});

test('switching away from Strength preserves manual run logging and mobile layout', async t => {
  const page = await pageWith(t);
  await page.selectOption('#kind', 'strength');
  await page.selectOption('#kind', 'run');
  assert.equal(await page.locator('#strengthFields').isVisible(), false);
  assert.equal(await page.locator('#runFields').isVisible(), true);
  await page.fill('#distance', '3');
  await page.fill('#minutes', '30');
  await page.getByRole('button', { name: 'Save session' }).click();
  assert.match(await page.locator('#history').innerText(), /3.00 mi/);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
});

test('New session respects the selected date and finished workouts appear on the dashboard', async t => {
  const page = await pageWith(t, { 'tuesday|2026-11-03': session('blue band', '6') });
  await page.goto(base + '/strength.html?day=tuesday&date=2026-11-10');
  await page.getByRole('button', { name: 'New session', exact: true }).click();
  assert.equal(await page.locator('#date').inputValue(), '2026-11-10');
  assert.equal(await weight(page).inputValue(), 'blue band');
  assert.equal(await page.locator('.check.done').count(), 0);
  await page.locator('[data-check="' + first + '"]').click();
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Finish & save' }).click();
  await page.goto(base);
  assert.match(await page.locator('#history').innerText(), /Strength A/);
  assert.match(await page.locator('#history').innerText(), /2026-11-10/);
  assert.match(await page.locator('#history').innerText(), /1 sets completed/);
});

test('Insights defaults band exercises to average reps, charts points, and opens the selected session', async t => {
  const page = await pageWith(t, {
    'tuesday|2026-11-03': { sets: { [first]: { weight: 'blue band', reps: '6', done: true } } },
    'tuesday|2026-11-10': { sets: {
      [first]: { weight: 'BW', reps: '8', done: true },
      'A|Band-assisted pull-up|1': { weight: 'BW', reps: '12', done: true },
      'A|Band-assisted pull-up|2': { weight: 'BW', reps: '50', done: false }
    } }
  });
  await page.getByRole('link', { name: 'Insights', exact: true }).click();
  assert.equal(await page.locator('#measure').inputValue(), 'averageReps');
  assert.equal(await page.locator('.point').count(), 2);
  assert.match(await page.locator('#stats').innerText(), /10 reps/);
  assert.match(await page.locator('#sessionHistory').innerText(), /blue band/);
  await page.locator('.point').first().focus();
  await page.keyboard.press('Enter');
  assert.match(await page.locator('#pointDetail').innerText(), /2026-11-03.*6 reps/);
  await page.getByRole('link', { name: '2026-11-10', exact: true }).click();
  assert.equal(await page.locator('#date').inputValue(), '2026-11-10');
});

test('Insights weights, date filters, metric switching, and workout isolation work on mobile', async t => {
  const page = await pageWith(t, {
    'tuesday|2026-11-03': { sets: { 'A|Zercher squat|0': { weight: '25', reps: '6', done: true } } },
    'tuesday|2026-11-10': { sets: { 'A|Zercher squat|0': { weight: '35', reps: '8', done: true } } },
    'sunday|2026-11-08': { sets: { [first]: { weight: 'blue band', reps: '10', done: true } } }
  });
  await page.goto(base + '/insights.html');
  assert.equal(await page.locator('#exercise option').count(), 18);
  await page.selectOption('#exercise', { label: 'Zercher squat' });
  assert.equal(await page.locator('#measure').inputValue(), 'weight');
  assert.match(await page.locator('#stats').innerText(), /35 lb/);
  await page.fill('#from', '2026-11-10'); await page.locator('#from').dispatchEvent('change');
  assert.equal(await page.locator('.point').count(), 1);
  await page.fill('#to', '2026-11-01'); await page.locator('#to').dispatchEvent('change');
  assert.match(await page.locator('#filterError').innerText(), /end date/);
  assert.equal(await page.locator('.point').count(), 0);
  await page.locator('#allTime').click();
  assert.equal(await page.locator('.point').count(), 2);
  await page.selectOption('#measure', 'averageReps');
  assert.match(await page.locator('#stats').innerText(), /8 reps/);
  await page.selectOption('#exercise', '7'); // First exercise in Strength B.
  assert.equal(await page.locator('.point').count(), 1);
  assert.match(await page.locator('#sessionHistory').innerText(), /2026-11-08/);
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
});

test('Insights empty and timed-only histories explain missing numeric data without errors', async t => {
  const page = await pageWith(t);
  await page.goto(base + '/insights.html');
  assert.match(await page.locator('#chart').innerText(), /No completed sets/);
  await page.evaluate(KEY => localStorage.setItem(KEY, JSON.stringify({ sessions: {
    'sunday|2026-11-08': { sets: { 'E|Suitcase carry|0': { weight: 'BW', reps: '30 sec', done: true } } }
  } })), KEY);
  await page.reload();
  await page.selectOption('#exercise', { label: 'Suitcase carry' });
  assert.equal(await page.locator('.point').count(), 0);
  assert.match(await page.locator('#chart').innerText(), /No numeric reps/);
  assert.match(await page.locator('#sessionHistory').innerText(), /30 sec/);
});
