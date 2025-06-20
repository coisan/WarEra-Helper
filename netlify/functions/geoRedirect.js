exports.handler = async (event, context) => {
  const country = event.headers['x-nf-geo-country'] || 'XX';

  if (country !== 'RO') {
    return {
      statusCode: 403,
      body: 'Access restricted to Romania only.'
    };
  }

  // Serve the index.html or redirect
  return {
    statusCode: 302,
    headers: {
      Location: '/index.html'
    }
  };
};
