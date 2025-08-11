import { itemDisplayOrder, makeTableSortable } from './config.js';

async function fetchMarketOrders(itemCode) {
  const res = await fetch(`https://api2.warera.io/trpc/tradingOrder.getTopOrders?input=` + encodeURIComponent(JSON.stringify({ itemCode, limit: 10 })));

  const data = await res.json();
  const orders = data.result?.data ?? {};

  const buyOrders = orders.buyOrders || [];
  const sellOrders = orders.sellOrders || [];

  const bids = buyOrders.map(o => o.price).sort((a, b) => b - a);
  const asks = sellOrders.map(o => o.price).sort((a, b) => a - b);

  const bid = bids.length ? bids[0] : null;
  const ask = asks.length ? asks[0] : null;
  const spread = (bid !== null && ask !== null)
    ? (((ask - bid) / ((ask + bid) / 2)) * 100).toFixed(1) + "%"
    : "-";

  return { bid, ask, spread };
}

async function fetchAllTransactions(itemCode) {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  let cursor = undefined;
  let transactions = [];

  while (true) {
    const input = { itemCode, limit: 100 };
    if (cursor !== undefined) input.cursor = cursor;

    const res = await fetch(`https://api2.warera.io/trpc/transaction.getPaginatedTransactions?input=` + encodeURIComponent(JSON.stringify(input)));

    const data = await res.json();
    const items = data.result?.data?.items ?? [];

    for (const tx of items) {
      const ts = new Date(tx.createdAt).getTime();
      if (ts < oneDayAgo) return transactions;
      transactions.push(tx);
    }

    cursor = data.result?.data?.nextCursor;
    if (!cursor) break;
  }

  return transactions;
}

function formatNumber(value, decimals = 3) {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function createTableRow(cells) {
  const tr = document.createElement("tr");
  for (const cellData of cells) {
    const td = document.createElement("td");
    td.innerHTML = cellData;
    tr.appendChild(td);
  }
  return tr;
}

function createPriceRangeBar(min, avg, max, marketAvg) {
  if (min === null || avg === null || max === null) return "-";

  min = parseFloat(min);
  avg = parseFloat(avg);
  max = parseFloat(max);

  const range = max - min || 1;
  const avgPos = ((avg - min) / range) * 100;

  // Trend indicator
  let trendHTML = "";
  if (marketAvg !== null) {
    if (marketAvg > avg) {
      trendHTML = ` <span class="positive" title="Prețul actual ${formatNumber(marketAvg)} este mai mare decât media din ultimele 24h">▲</span>`;
    } else if (marketAvg < avg) {
      trendHTML = ` <span class="negative" title="Prețul actual ${formatNumber(marketAvg)} este mai mic decât media din ultimele 24h">▼</span>`;
    }
  }

  return `
    <div style="position: relative; height: 24px; background: #ddd; border-radius: 4px; padding: 2px;">
      <div style="position: absolute; left: 0; font-size: 10px;">${formatNumber(min)}</div>
      <div style="position: absolute; right: 0; font-size: 10px;">${formatNumber(max)}</div>
      <div style="position: absolute; left: ${avgPos}%; transform: translateX(-50%); top: -8px; font-size: 10px; color: #333;">
        ${formatNumber(avg)}${trendHTML}
      </div>
      <div style="position: absolute; left: ${avgPos}%; transform: translateX(-50%); width: 4px; height: 100%; background: #ff4d4d;"></div>
    </div>
  `;
}

async function buildMarketTable() {
  const table = document.getElementById("marketTable");
  const tbody = table.querySelector("tbody");

  table.style.display = "none";
  tbody.innerHTML = "";

  const loadingDiv = document.getElementById("loadingMessage");
  loadingDiv.style.display = "block";
  try {
    for (const { id, label, class: colorClass } of itemDisplayOrder) {
      const { bid, ask, spread } = await fetchMarketOrders(id);
      const txs = await fetchAllTransactions(id);

      const prices = txs.map(tx => tx.money / tx.quantity).filter(p => !isNaN(p));
      const minPrice = prices.length ? Math.min(...prices) : null;
      const maxPrice = prices.length ? Math.max(...prices) : null;
      const volumeBTC = txs.reduce((sum, tx) => sum + tx.money, 0);
      const volumeUnits = txs.reduce((sum, tx) => sum + tx.quantity, 0);
      const avgPrice = volumeUnits > 0 ? (volumeBTC / volumeUnits) : null;

      const marketAvg = (bid !== null && ask !== null) ? (bid + ask) / 2 : null;

      const row = createTableRow([
        `<span class="${colorClass}"><b>${label}</b></span>`,
        formatNumber(bid),
        formatNumber(ask),
        spread,
        volumeUnits.toLocaleString(),
        Math.round(volumeBTC).toLocaleString(),
        createPriceRangeBar(minPrice, avgPrice, maxPrice, marketAvg)
      ]);
      tbody.appendChild(row);
    }
  }
  finally {
    loadingDiv.style.display = "none";
  }

  table.style.display = "table";
}

window.addEventListener("DOMContentLoaded", buildMarketTable);
makeTableSortable("marketTable");
