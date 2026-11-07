'use strict';

async function api(path, body) {
  let response;
  try {
    response = await fetch('/.netlify/functions/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch {
    throw Error('Could not reach the Strava service. Check your connection and try again.');
  }

  let data;
  try {
    // Netlify errors can be HTML or empty, including when functions are missing.
    // Do not expose the browser's JSON parser error (especially on Safari).
    data = JSON.parse(await response.text());
  } catch {
    data = null;
  }

  if (response.status === 401)
    throw Error('Strava authorization has expired or was revoked. Disconnect Strava, then connect again. Your saved runs will remain.');
  if (response.status === 404)
    throw Error('The Strava service is missing from this deployment. Deploy the site with Netlify Functions enabled, then try again.');
  if (response.status === 429)
    throw Error('Strava is rate limiting requests. Wait a few minutes before syncing again.');
  if (!response.ok) {
    if (data && typeof data.error === 'string') throw Error(data.error);
    throw Error('The Strava service is temporarily unavailable (HTTP ' + response.status + '). Please try again shortly.');
  }

  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw Error('The Strava service returned an invalid response. Check that this site was deployed with Netlify Functions enabled.');
  if (path === 'strava-activities' && !Array.isArray(data.activities))
    throw Error('Strava returned an invalid activity list. Please try syncing again.');
  if (path === 'strava-token' &&
      (typeof data.access_token !== 'string' || !data.access_token ||
       typeof data.refresh_token !== 'string' || !data.refresh_token ||
       !Number.isFinite(data.expires_at)))
    throw Error('Strava returned an invalid authorization response. Please connect Strava again.');
  return data;
}
