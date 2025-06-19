exports.handler = async function (event, context) {
  try {
    const input = encodeURIComponent(JSON.stringify({
      "0": {
        "json": {
          "language": "en"
        }
      }
    }));

    const url = `https://api2.warera.io/trpc/itemTrading.getPrices?batch=1&input=${input}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'trpc-batch-mode': 'true'
      }
    });

    const data = await res.json();

    // Log to Netlify for debugging
    console.log("Response:", JSON.stringify(data, null, 2));

    // Try to access the data safely
    const prices = data?.[0]?.result?.data;

    return {
      statusCode: 200,
      body: JSON.stringify(prices)
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        errorType: err.name,
        errorMessage: err.message
      })
    };
  }
};
