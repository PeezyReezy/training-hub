
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST')
    return { statusCode: 405, body: 'Method not allowed' };

  try {
    const { access_token } = JSON.parse(event.body || '{}');

    if (!access_token)
      throw Error('Missing token');

    const before = Math.floor(Date.now() / 1000);
    const after = before - 30 * 24 * 60 * 60;
    const activities = [];
    for (let page = 1; ; page++) {
      const params = new URLSearchParams({
        after: String(after), before: String(before),
        per_page: '100', page: String(page)
      });
      const r = await fetch(
        'https://www.strava.com/api/v3/athlete/activities?' + params,
        { headers: { Authorization: 'Bearer ' + access_token } }
      );
      const data = await r.json();
      if (!r.ok)
        return {
          statusCode: r.status,
          body: JSON.stringify({
            error: data.message || 'Strava activity request failed'
          })
        };
      if (!Array.isArray(data)) throw Error('Invalid Strava activity response');
      activities.push(...data);
      if (data.length < 100) break;
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
      body: JSON.stringify({ activities })
    };
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: e.message })
    };
  }
};
