const { test } = require('node:test');
const assert = require('node:assert/strict');
const { history, numericWeight, numericReps, validDate } = require('../insights-data.js');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const plans = vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../strength-plans.js'), 'utf8') + '\nplans;');
const name = 'Band-assisted pull-up';
const set = (weight, reps, done = true) => ({ weight, reps, done });
const session = (...sets) => ({ sets: Object.fromEntries(sets.map((value, i) => [`A|${name}|${i}`, value])) });
const rows = (sessions, from, to) => history(sessions, plans.tuesday, 'tuesday', name, from, to);

test('weight parser accepts numbers and units, converting kg without guessing band or assistance loads', () => {
  assert.equal(numericWeight(' 25 lbs '), 25);
  assert.equal(numericWeight('0'), 0);
  assert.equal(numericWeight('.5'), 0.5);
  assert.ok(Math.abs(numericWeight('10 kg') - 22.046226218) < 0.000001);
  for (const value of ['', 'BW', 'blue band', '50 lb assistance', '2 x 25', '-5', 'Infinity', '10–15']) assert.equal(numericWeight(value), null);
});
test('reps parser accepts numeric and per-side reps, excluding timed entries and ranges', () => {
  assert.equal(numericReps('8 / side'), 8);
  assert.equal(numericReps('9 per side'), 9);
  assert.equal(numericReps('0'), 0);
  for (const value of ['30 sec', '1:00', '8-10', '', 'BW']) assert.equal(numericReps(value), null);
});
test('chooses heaviest completed set and averages completed reps, excluding unchecked prefills', () => {
  const result = rows({ 'tuesday|2026-11-03': session(set('25', '5'), set('30', '9'), set('100', '30', false)) });
  assert.equal(result[0].weight, 30);
  assert.equal(result[0].averageReps, 7);
  assert.equal(result[0].sets.length, 2);
});
test('unweighted sessions retain labels and compute average reps', () => {
  const result = rows({ 'tuesday|2026-11-03': session(set('blue band', '6'), set('BW', '10')) });
  assert.equal(result[0].weight, null);
  assert.equal(result[0].averageReps, 8);
  assert.equal(result[0].sets[0].weight, 'blue band');
});
test('missing or timed reps do not become zero and all-timed sessions stay in history', () => {
  assert.equal(rows({ 'tuesday|2026-11-03': session(set('BW', '30 sec')) })[0].averageReps, null);
  assert.equal(rows({ 'tuesday|2026-11-03': session(set('BW', '8'), set('BW', '')) })[0].averageReps, 8);
});
test('isolates exercises and workouts, ignores unchecked and invalid sessions, and sorts chronologically', () => {
  const result = rows({
    'tuesday|2026-11-10': session(set('35', '8')),
    'tuesday|2026-11-03': session(set('25', '6')),
    'sunday|2026-11-08': session(set('99', '99')),
    'tuesday|2026-11-11': session(set('99', '99', false)),
    'tuesday|2026-02-30': session(set('99', '99')),
    'tuesday|2026-11-12': { sets: { 'A|Not in the plan|0': set('99', '99') } }
  });
  assert.deepEqual(result.map(row => row.date), ['2026-11-03', '2026-11-10']);
});
test('filters inclusively without mutating history and handles an empty log', () => {
  const sessions = { 'tuesday|2026-11-03': session(set('25', '6')), 'tuesday|2026-11-10': session(set('35', '8')) };
  const original = JSON.stringify(sessions);
  assert.equal(rows(sessions, '2026-11-10', '2026-11-10').length, 1);
  assert.equal(rows(sessions, '2026-11-11').length, 0);
  assert.equal(JSON.stringify(sessions), original);
  assert.deepEqual(rows({}), []);
  assert.equal(validDate('2026-02-30'), false);
  assert.equal(validDate('2026-11-03'), true);
});
