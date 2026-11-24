const { configuration, setupError, headers } = require('../lib/strava-config');
exports.handler = async () => {
  const config = configuration();
  if (config.missing.length) return setupError(config.missing);
  return { statusCode: 200, headers, body: JSON.stringify({ client_id: config.client_id }) };
};
