
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST')
    return { statusCode: 405, body: 'Method not allowed' };

  try {
    const b = JSON.parse(event.body || '{}');

    if (!['authorization_code', 'refresh_token'].includes(b.grant_type))
      throw Error('Invalid grant type');

    const params = new URLSearchParams({
      client_id: process.env.STRAVA_CLIENT_ID || '',
      client_secret: process.env.STRAVA_CLIENT_SECRET || '',
      grant_type: b.grant_type
    });

    if (b.grant_type === 'authorization_code')
      params.set('code', b.code || '');
    else
      params.set('refresh_token', b.refresh_token || '');

    const r = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    const data = await r.json();

    if (!r.ok)
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: data.message || 'Strava authorization failed'
        })
      };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
      body: JSON.stringify({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at
      })
    };
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: e.message })
    };
  }
};
