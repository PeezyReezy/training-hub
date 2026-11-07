const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require('node:path').join(__dirname, '../strava-api.js'), 'utf8');
function client(status, body) {
  const requests = [];
  const context = vm.createContext({ fetch: async (url, options) => {
    requests.push({ url, options });
    return { status, ok: status >= 200 && status < 300, text: async () => body };
  } });
  vm.runInContext(source, context);
  return { api: context.api, requests };
}

test('sends the activity token and accepts a successful sync', async () => {
  const { api, requests } = client(200, '{"activities":[{"id":123}]}');
  const result = await api('strava-activities', { access_token: 'test-token' });
  assert.equal(result.activities[0].id, 123);
  assert.equal(requests[0].url, '/.netlify/functions/strava-activities');
  assert.equal(requests[0].options.method, 'POST');
  assert.equal(JSON.parse(requests[0].options.body).access_token, 'test-token');
});

for (const body of ['<html>Site fallback</html>', '', 'null', '[]', '{broken']) {
  test('rejects non-object or non-JSON success: ' + JSON.stringify(body), async () => {
    await assert.rejects(client(200, body).api('strava-activities', {}), /invalid response.*Netlify Functions/);
  });
}
for (const [status, pattern] of [
  [401, /authorization.*Disconnect Strava/],
  [404, /missing.*Netlify Functions/],
  [429, /rate limiting/],
  [502, /temporarily unavailable.*502/],
  [503, /temporarily unavailable.*503/],
  [504, /temporarily unavailable.*504/]
]) {
  test('explains HTTP ' + status + ' even with an HTML error page', async () => {
    await assert.rejects(client(status, '<html>error</html>').api('strava-activities', {}), pattern);
  });
}
test('preserves a JSON error from the function', async () => {
  await assert.rejects(client(400, '{"error":"Invalid grant type"}').api('strava-token', {}), /Invalid grant type/);
});
test('accepts no activities while rejecting a missing activity list', async () => {
  assert.equal((await client(200, '{"activities":[]}').api('strava-activities', {})).activities.length, 0);
  await assert.rejects(client(200, '{}').api('strava-activities', {}), /invalid activity list/);
});
test('validates refreshed tokens before they can replace saved authorization', async () => {
  const valid = { access_token: 'new-test', refresh_token: 'refresh-test', expires_at: 1900000000 };
  assert.equal((await client(200, JSON.stringify(valid)).api('strava-token', {})).access_token, 'new-test');
  for (const body of [{}, { ...valid, access_token: '' }, { ...valid, expires_at: null }]) {
    await assert.rejects(client(200, JSON.stringify(body)).api('strava-token', {}), /invalid authorization response/);
  }
});
test('reports a connection failure without leaking the browser error', async () => {
  const context = vm.createContext({ fetch: async () => { throw Error('Load failed'); } });
  vm.runInContext(source, context);
  await assert.rejects(context.api('strava-activities', {}), /Check your connection/);
});
