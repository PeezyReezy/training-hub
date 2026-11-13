'use strict';
// Pure helpers shared by the Insights page and its regression tests.
const InsightsData = (() => {
  function numericWeight(value) {
    const match = String(value ?? '').trim().match(/^(\d+(?:\.\d+)?|\.\d+)\s*(lb|lbs|kg)?$/i);
    if (!match) return null;
    const amount = Number(match[1]);
    if (!Number.isFinite(amount)) return null;
    return match[2]?.toLowerCase() === 'kg' ? amount * 2.2046226218 : amount;
  }
  function numericReps(value) {
    const match = String(value ?? '').trim().match(/^(\d+(?:\.\d+)?|\.\d+)\s*(?:\/\s*side|per side)?$/i);
    return match && Number.isFinite(Number(match[1])) ? Number(match[1]) : null;
  }
  function validDate(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return false;
    const parsed = new Date(date + 'T12:00:00Z');
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
  }
  function history(sessions, plan, day, name, from = '', to = '') {
    const exercise = plan.blocks.flatMap(block => block.items.map(item => ({ block: block.id, item })))
      .find(entry => entry.item[0] === name);
    if (!exercise || !sessions || typeof sessions !== 'object') return [];
    const rows = [];
    for (const [key, session] of Object.entries(sessions)) {
      const [workout, date, extra] = key.split('|');
      if (workout !== day || extra !== undefined || !validDate(date) || (from && date < from) || (to && date > to)) continue;
      const sets = [];
      for (let i = 0; i < exercise.item[1]; i++) {
        const value = session?.sets?.[`${exercise.block}|${name}|${i}`];
        if (value?.done !== true) continue; // Do not graph unchecked prefilled suggestions.
        sets.push({ index: i + 1, weight: String(value.weight ?? ''), reps: String(value.reps ?? ''), numeric: numericWeight(value.weight) });
      }
      if (!sets.length) continue;
      const numbers = sets.map(set => set.numeric).filter(value => value !== null);
      const reps = sets.map(set => numericReps(set.reps)).filter(value => value !== null);
      rows.push({ date, sets, weight: numbers.length ? Math.max(...numbers) : null,
        averageReps: reps.length ? reps.reduce((sum, value) => sum + value, 0) / reps.length : null });
    }
    return rows.sort((a, b) => a.date.localeCompare(b.date));
  }
  return { numericWeight, numericReps, validDate, history };
})();
if (typeof module !== 'undefined') module.exports = InsightsData;
