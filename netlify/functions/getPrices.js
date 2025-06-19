export async function handler(event, context) {
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
      body: JSON.stringify({ error: "Failed to fetch War Era data." })
    };
  }

  const data = await apiResponse.json();

  return {
    statusCode: 200,
    body: JSON.stringify(data.result.data)
  };
}
