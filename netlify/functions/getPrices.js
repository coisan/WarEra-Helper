exports.handler = async function (event, context) {
  try {
    const res = await fetch('https://api2.warera.io/trpc/itemTrading.getPrices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'trpc-batch-mode': 'true'
      },
      body: JSON.stringify({
        "0": {
          "json": {
            "language": "en"
          }
        }
      })
    });

    const data = await res.json();

    console.log("API Response:", JSON.stringify(data, null, 2)); // 👈 Logs to Netlify console

    return {
      statusCode: 200,
      body: JSON.stringify(data) // send the whole response back to browser
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        errorType: error.name,
        errorMessage: error.message
      })
    };
  }
};
