const fetch = require("node-fetch");

exports.handler = async function (event, context) {
  try {
    const response = await fetch("https://api2.warera.io/trpc/itemTrading.getPrices", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "trpc-batch-mode": "true"
      },
      body: JSON.stringify({
        "0": {
          "json": {
            "language": "en"
          }
        }
      })
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: "API call failed", status: response.status })
      };
    }

    const data = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify(data.result.data)
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
