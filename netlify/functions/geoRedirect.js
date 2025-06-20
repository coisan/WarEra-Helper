exports.handler = async (event) => {
  const country = event.headers['x-nf-geo-country'];

  if (!country) {
    return {
      statusCode: 403,
      body: 'Geo data not available. Are you running locally or is your plan limited?',
    };
  }

  if (country !== 'RO') {
    return {
      statusCode: 403,
      body: `Access denied. Your country is ${country}, only Romania (RO) is allowed.`,
    };
  }

  return {
    statusCode: 302,
    headers: {
      Location: '/index.html',
    },
  };
};
