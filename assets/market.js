const API = "https://api2.warera.io/trpc";

async function fetchItemList() {
  const res = await fetch(`${API}/itemTrading.getPrices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });

  const data = await res.json();
  const items = data.result.data;
  return items.map(item => item.itemCode);
}

async function fetchMarketOrders(itemCode) {
  const res = await fetch(`${API}/tradingOrder.getTopOrders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemCode, limit: 10 })
  });

  const data = await res.json();
  const orders = data.result.data;

  const bids = orders.filter(o => o.type === "buy").map(o => o.price).sort((a, b) => b - a);
  const asks = orders.filter(o => o.type === "sell").map(o => o.price).sort((a, b) => a - b);

  const bid = bids[0] ?? null;
  const ask = asks[0] ?? null;
  const spread = (bid !== null && ask !== null)
    ? ((ask - bid) / ((ask + bid) / 2) * 100).toFixed(1) + "%"
    : "-";

  return { bid, ask, spread };
}

async function fetchAllTransactions(itemCode) {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  let cursor = undefined;
  let transactions = [];

  while (true) {
    const body = { itemCode, limit: 100 };
    if (cursor !== undefined) body.cursor = cursor;

    const res = await fetch(`${API}/transaction.getPaginatedTransactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    const items = data.result.data.items;

    for (const tx of items) {
      const ts = new Date(tx.createdAt).getTime();
      if (ts < oneDayAgo) return transactions;
      transactions.push(tx);
    }

    cursor = data.result.data.nextCursor;
    if (!cursor) break;
  }

  return transactions;
}

export async function analyzeMarket() {
  const itemCodes = await fetchItemList();
  const stats = {};

  for (const itemCode of itemCodes) {
    const { bid, ask, spread } = await fetchMarketOrders(itemCode);
    const txs = await fetchAllTransactions(itemCode);

    const volumeBTC = txs.reduce((sum, tx) => sum + tx.money, 0);
    const volumeUnits = txs.reduce((sum, tx) => sum + tx.quantity, 0);
    const weightedAveragePrice = volumeUnits > 0
      ? (txs.reduce((sum, tx) => sum + tx.money, 0) / volumeUnits)
      : null;

    stats[itemCode] = {
      bid,
      ask,
      spread,
      volumeBTC,
      volumeUnits,
      weightedAveragePrice
    };
  }

  return stats;
}
