const { configuration, setupError, headers } = require('../lib/strava-config');
const reply = (statusCode, error) => ({ statusCode, headers, body: JSON.stringify({ error }) });
exports.handler = async event => {
  if (event.httpMethod !== 'POST') return reply(405, 'Method not allowed');
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return reply(400, 'Invalid JSON request'); }
  if (!body || !['authorization_code', 'refresh_token'].includes(body.grant_type)) return reply(400, 'Invalid grant type');
  const field = body.grant_type === 'authorization_code' ? 'code' : 'refresh_token';
  if (typeof body[field] !== 'string' || !body[field].trim()) return reply(400, 'Missing ' + field);
  const config = configuration();
  if (config.missing.length) return setupError(config.missing);
  const params = new URLSearchParams({ client_id: config.client_id, client_secret: config.client_secret, grant_type: body.grant_type, [field]: body[field] });
  try {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params
    });
    let data;
    try { data = await response.json(); }
    catch { return reply(502, 'Strava returned an unreadable authorization response. Please try again shortly.'); }
    if (!response.ok) {
      const errors = Array.isArray(data?.errors) ? data.errors : [];
      if (errors.some(error => ['client_id', 'client_secret'].includes(error.field)))
        return reply(503, 'Strava rejected this app’s client credentials. Verify STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in Netlify Production Functions, then redeploy.');
      if (errors.some(error => error.field === 'refresh_token' || error.resource === 'RefreshToken') || response.status === 401)
        return reply(401, 'Strava authorization has expired or was revoked. Please reconnect Strava.');
      if (response.status === 429) return reply(429, 'Strava is rate limiting requests. Please try again later.');
      return reply(response.status >= 500 ? 502 : 400, body.grant_type === 'authorization_code'
        ? 'Strava could not exchange the authorization code. Start Connect Strava again; authorization codes can only be used once.'
        : 'Strava could not refresh your authorization. Disconnect and reconnect Strava; your saved runs will remain.');
    }
    if (!data || typeof data.access_token !== 'string' || !data.access_token ||
        typeof data.refresh_token !== 'string' || !data.refresh_token || !Number.isFinite(data.expires_at))
      return reply(502, 'Strava returned an incomplete authorization response. Please connect again.');
    return { statusCode: 200, headers, body: JSON.stringify({ access_token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at }) };
  } catch {
    return reply(502, 'Could not reach Strava to authorize this account. Please try again shortly.');
  }
};
