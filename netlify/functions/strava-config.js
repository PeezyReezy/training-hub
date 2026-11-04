
exports.handler = async () => {
  const id = process.env.STRAVA_CLIENT_ID;

  return id
    ? {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: id })
      }
    : {
        statusCode: 503,
        body: JSON.stringify({
          error: 'Configure STRAVA_CLIENT_ID in Netlify'
        })
      };
};
