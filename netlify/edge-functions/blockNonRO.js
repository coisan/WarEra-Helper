export default async (request, context) => {
  const country = context.geo?.country?.toUpperCase();

  if (country !== 'RO') {
    return new Response('Access denied. Available only in Romania.', {
      status: 403,
    });
  }

  return context.next(); // allow request
};
