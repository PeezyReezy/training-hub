'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = value => Number(value.toFixed(1)).toLocaleString();
  const workoutLabel = day => day === 'tuesday' ? 'Strength A · Tuesday' : 'Strength B · Sunday';
  const choices = [];
  for (const [day, plan] of Object.entries(plans)) {
    const group = document.createElement('optgroup');
    group.label = workoutLabel(day);
    for (const block of plan.blocks) for (const [name] of block.items) {
      const option = document.createElement('option');
      option.value = String(choices.length); option.textContent = name;
      choices.push({ day, name }); group.append(option);
    }
    $('exercise').append(group);
  }
  let lastExercise = null;
  function render() {
    const { day, name } = choices[Number($('exercise').value)];
    const from = $('from').value, to = $('to').value;
    $('chartTitle').textContent = name + ' · ' + workoutLabel(day);
    $('filterError').textContent = from && to && from > to ? 'Choose an end date on or after the start date.' : '';
    let sessions = {}, storageError = false;
    try { sessions = JSON.parse(localStorage.getItem('strength-training-tracker-v2') || '{}').sessions || {}; }
    catch { storageError = true; }
    const rows = $('filterError').textContent ? [] : InsightsData.history(sessions, plans[day], day, name, from, to);
    if (lastExercise !== $('exercise').value) {
      const allRows = InsightsData.history(sessions, plans[day], day, name);
      $('measure').value = allRows.some(row => row.weight !== null) ? 'weight' : 'averageReps';
      lastExercise = $('exercise').value;
    }
    const metric = $('measure').value, unit = metric === 'weight' ? 'lb' : 'reps';
    $('measureHelp').textContent = metric === 'weight'
      ? 'Heaviest completed set per session. Unlabeled weights are treated as lb; explicit kg values are converted. Bands and BW are not plotted as weights.'
      : 'Average reps per completed set in each session. Sets without numeric reps and timed entries are excluded; entries such as 8 / side count as 8 reps per side.';
    const points = rows.filter(row => row[metric] !== null).map(row => ({ ...row, value: row[metric] }));
    $('stats').innerHTML = points.length ? [
      ['First', number(points[0].value) + ' ' + unit],
      ['Latest', number(points.at(-1).value) + ' ' + unit],
      ['Change', points.length > 1 ? (points.at(-1).value - points[0].value > 0 ? '+' : '') + number(points.at(-1).value - points[0].value) + ' ' + unit : '—']
    ].map(([label, value]) => `<div><span class="muted">${label}</span><strong>${value}</strong></div>`).join('') : '';
    $('pointDetail').textContent = '';
    if (!points.length) {
      $('chart').innerHTML = '<p class="muted">' + (storageError ? 'Saved strength history could not be read. Try importing a strength backup in the tracker.' : rows.length ? 'No numeric ' + (metric === 'weight' ? 'weights' : 'reps') + ' to chart for this period. Your completed sets are listed below.' : 'No completed sets in this period. Log sets in the strength tracker, or choose another exercise or date range.') + '</p>';
    } else {
      const width = 360, height = 240, left = 48, right = 344, top = 18, bottom = 190;
      const times = points.map(row => Date.parse(row.date + 'T12:00:00Z'));
      const max = Math.max(...points.map(row => row.value));
      const ceiling = max > 0 ? max * 1.1 : 1;
      const x = i => times.length === 1 ? (left + right) / 2 : left + (times[i] - times[0]) / (times.at(-1) - times[0]) * (right - left);
      const y = weight => bottom - weight / ceiling * (bottom - top);
      const ticks = [0, ceiling / 2, ceiling].map(value => `<line x1="${left}" y1="${y(value)}" x2="${right}" y2="${y(value)}" stroke="#34455e"/><text x="${left-8}" y="${y(value)+4}" text-anchor="end">${number(value)}</text>`).join('');
      $('chart').innerHTML = `<svg class="chart" viewBox="0 0 ${width} ${height}" role="group" aria-label="${esc(name)} ${unit === 'lb' ? 'weight trend in pounds' : 'average reps trend'}. Select a point for its date and value.">${ticks}<polyline fill="none" stroke="#85b6ff" stroke-width="3" points="${points.map((row,i) => `${x(i)},${y(row.value)}`).join(' ')}"/>${points.map((row,i) => `<circle class="point" cx="${x(i)}" cy="${y(row.value)}" r="6" tabindex="0" role="button" data-point="${i}" aria-label="${row.date}: ${number(row.value)} ${unit}"><title>${row.date}: ${number(row.value)} ${unit}</title></circle>`).join('')}<text x="${left}" y="224">${points[0].date}</text>${points.length > 1 ? `<text x="${right}" y="224" text-anchor="end">${points.at(-1).date}</text>` : ''}</svg>`;
      const detail = index => { const row = points[index]; $('pointDetail').textContent = row.date + ' · ' + number(row.value) + ' ' + unit + ' · ' + row.sets.length + ' completed sets'; };
      $('chart').querySelectorAll('[data-point]').forEach(point => {
        point.onclick = () => detail(Number(point.dataset.point));
        point.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); detail(Number(point.dataset.point)); } };
      });
      detail(points.length - 1);
    }
    $('sessionHistory').innerHTML = rows.length ? [...rows].reverse().map(row => {
      const query = new URLSearchParams({day, date:row.date});
      return `<article class="history-row"><a href="/strength.html?${query}">${row.date}</a><p><strong>${row.weight === null ? 'Band / bodyweight / unweighted entry' : number(row.weight) + ' lb heaviest'}</strong>${row.averageReps === null ? '' : ' · ' + number(row.averageReps) + ' reps/set'}</p><p class="muted">${row.sets.map(set => `Set ${set.index}: ${esc(set.weight || 'No weight entered')} × ${esc(set.reps || 'No reps entered')}`).join(' · ')}</p></article>`;
    }).join('') : '<p class="muted">No completed sets to show.</p>';
  }
  for (const id of ['exercise', 'measure', 'from', 'to']) $(id).addEventListener('change', render);
  $('allTime').onclick = () => { $('from').value = ''; $('to').value = ''; render(); };
  window.addEventListener('pageshow', render);
  window.addEventListener('storage', render);
  render();
})();
