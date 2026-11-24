const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { handler: config } = require('../netlify/functions/strava-config');
const { handler: token } = require('../netlify/functions/strava-token');
const original = { id: process.env.STRAVA_CLIENT_ID, secret: process.env.STRAVA_CLIENT_SECRET, fetch: global.fetch };
after(() => {
  for (const [name, value] of [['STRAVA_CLIENT_ID', original.id], ['STRAVA_CLIENT_SECRET', original.secret]]) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
  global.fetch = original.fetch;
});
const request = { httpMethod: 'POST', body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: 'test-refresh' }) };
const parsed = response => JSON.parse(response.body);
function configure(id = '123', secret = 'test-client-secret') { process.env.STRAVA_CLIENT_ID = id; process.env.STRAVA_CLIENT_SECRET = secret; }
test('config identifies missing variable names without leaking the configured secret', async () => {
  configure('', 'test-private-value');
  let response = await config();
  assert.equal(response.statusCode, 503); assert.deepEqual(parsed(response).missing, ['STRAVA_CLIENT_ID']);
  assert.match(parsed(response).error, /Production.*Functions scope.*redeploy/);
  assert.ok(!response.body.includes('test-private-value'));
  configure('123', '  '); response = await config();
  assert.deepEqual(parsed(response).missing, ['STRAVA_CLIENT_SECRET']);
});
test('ready config trims values and returns only the public client ID with no caching', async () => {
  configure(' 123 ', ' test-client-secret ');
  const response = await config();
  assert.equal(response.statusCode, 200); assert.deepEqual(parsed(response), { client_id: '123' });
  assert.equal(response.headers['Cache-Control'], 'no-store');
});
test('token exchange refuses missing server setup before contacting Strava', async () => {
  configure('123', ''); let calls = 0; global.fetch = async () => { calls++; };
  const response = await token(request);
  assert.equal(response.statusCode, 503); assert.equal(calls, 0);
  assert.deepEqual(parsed(response).missing, ['STRAVA_CLIENT_SECRET']);
});
test('request validation rejects malformed input before contacting Strava', async () => {
  global.fetch = async () => { throw Error('Must not fetch'); };
  assert.equal((await token({ httpMethod: 'GET' })).statusCode, 405);
  for (const body of ['{bad', 'null', '{}', '{"grant_type":"refresh_token"}'])
    assert.equal((await token({ httpMethod: 'POST', body })).statusCode, 400);
});
test('refresh preserves the latest rotated token and sends the existing OAuth fields', async () => {
  configure(' 123 ', ' test-client-secret ');
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://www.strava.com/oauth/token');
    assert.equal(options.body.get('client_id'), '123');
    assert.equal(options.body.get('client_secret'), 'test-client-secret');
    assert.equal(options.body.get('refresh_token'), 'test-refresh');
    assert.equal(options.body.get('grant_type'), 'refresh_token');
    return { ok: true, json: async () => ({ access_token: 'new-access', refresh_token: 'rotated-refresh', expires_at: 1900000000 }) };
  };
  const response = await token(request);
  assert.equal(response.statusCode, 200); assert.equal(parsed(response).refresh_token, 'rotated-refresh');
  assert.ok(!response.body.includes('test-client-secret'));
});
test('rejected client credentials and revoked tokens have different recovery instructions', async () => {
  configure();
  global.fetch = async () => ({ ok: false, status: 400, json: async () => ({ errors: [{ field: 'client_secret', code: 'invalid' }] }) });
  let response = await token(request);
  assert.equal(response.statusCode, 503); assert.match(parsed(response).error, /client credentials.*Netlify Production/);
  global.fetch = async () => ({ ok: false, status: 400, json: async () => ({ errors: [{ resource: 'RefreshToken', field: 'refresh_token', code: 'invalid' }] }) });
  response = await token(request); assert.equal(response.statusCode, 401);
});
test('malformed upstream replies, outages, and rate limits preserve useful statuses', async () => {
  configure();
  for (const response of [
    { ok: true, json: async () => ({}) },
    { ok: false, status: 502, json: async () => { throw Error('bad JSON'); } }
  ]) { global.fetch = async () => response; assert.equal((await token(request)).statusCode, 502); }
  global.fetch = async () => { throw Error('Do not expose sensitive transport details'); };
  let response = await token(request); assert.equal(response.statusCode, 502); assert.ok(!response.body.includes('sensitive'));
  global.fetch = async () => ({ ok: false, status: 429, json: async () => ({}) });
  assert.equal((await token(request)).statusCode, 429);
});
