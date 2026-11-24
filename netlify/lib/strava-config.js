const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
function configuration() {
  const client_id = (process.env.STRAVA_CLIENT_ID || '').trim();
  const client_secret = (process.env.STRAVA_CLIENT_SECRET || '').trim();
  const missing = [];
  if (!client_id) missing.push('STRAVA_CLIENT_ID');
  if (!client_secret) missing.push('STRAVA_CLIENT_SECRET');
  return { client_id, client_secret, missing };
}
function setupError(missing) {
  return {
    statusCode: 503, headers,
    body: JSON.stringify({
      code: 'strava_not_configured', missing,
      error: 'Strava is not configured in the deployed Netlify Functions. Missing: ' + missing.join(', ') + '. Check the Production deploy context and Functions scope, then redeploy the site.'
    })
  };
}
module.exports = { configuration, setupError, headers };
