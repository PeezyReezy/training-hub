
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST')
    return { statusCode: 405, body: 'Method not allowed' };

  try {
    const { access_token } = JSON.parse(event.body || '{}');

    const r = await fetch(
      'https://www.strava.com/oauth/deauthorize',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + access_token
        }
      }
    );

    return {
      statusCode: r.ok ? 200 : 400,
      body: JSON.stringify({ ok: r.ok })
    };
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: e.message })
    };
  }
};
