
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST')
    return { statusCode: 405, body: 'Method not allowed' };

  try {
    const { access_token } = JSON.parse(event.body || '{}');

    if (!access_token)
      throw Error('Missing token');

    const r = await fetch(
      'https://www.strava.com/api/v3/athlete/activities?per_page=100&page=1',
      {
        headers: {
          Authorization: 'Bearer ' + access_token
        }
      }
    );

    const data = await r.json();

    if (!r.ok)
      return {
        statusCode: r.status,
        body: JSON.stringify({
          error: data.message || 'Strava activity request failed'
        })
      };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
      body: JSON.stringify({ activities: data })
    };
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: e.message })
    };
  }
};
