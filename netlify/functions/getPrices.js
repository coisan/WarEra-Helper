// This version uses CommonJS syntax compatible with Netlify default runtime
const fetch = require("node-fetch");

exports.handler = async function (event, context) {
  try {
    const apiResponse = await fetch('https://api2.warera.io/trpc/itemTrading.getPrices', {
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

    if (!apiResponse.ok) {
      return {
        statusCode: apiResponse.status,
        body: JSON.stringify({ error: "API call failed", status: apiResponse.status })
      };
    }

    const data = await apiResponse.json();

    return {
      statusCode: 200,
      body: JSON.stringify(data.result.data)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Unknown error" })
    };
  }
};
