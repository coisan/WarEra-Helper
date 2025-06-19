const fetch = require("node-fetch");

exports.handler = async function (event, context) {
  const proxyUrl = "https://corsproxy.io/?" +
    encodeURIComponent("https://api2.warera.io/trpc/itemTrading.getPrices");

  const res = await fetch(proxyUrl, {
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

  const data = await res.json();
  return {
    statusCode: 200,
    body: JSON.stringify(data)
  };
};
