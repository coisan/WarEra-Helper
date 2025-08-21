import {itemDisplayOrder, makeTableSortable} from './config.js';

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

async function buildMarketTable() {
  const table = document.getElementById("marketTable");
  const tbody = table.querySelector("tbody");

  table.style.display = "none";
  tbody.innerHTML = "";

  const loadingDiv = document.getElementById("loadingMessage");
  loadingDiv.style.display = "block";
  try {
    for (const {
        id,
        label,
        class: colorClass
      } of itemDisplayOrder) {
      const { bid, ask, spread } = await fetchMarketOrders(id);
      const txs = await fetchAllTransactions(id);
  
      const volumeBTC = txs.reduce((sum, tx) => sum + tx.money, 0);
      const volumeUnits = txs.reduce((sum, tx) => sum + tx.quantity, 0);
      const averagePrice = volumeUnits > 0
        ? (volumeBTC / volumeUnits)
        : null;

      const marketAveragePrice = (bid !== null && ask !== null)
        ? (bid + ask) / 2
        : null;

      // Add trend indicator
      let trendHTML = "";
      if (averagePrice !== null && marketAveragePrice !== null) {
        if (marketAveragePrice > averagePrice) {
          trendHTML = ` <span class="positive" title="Current price ${formatNumber(marketAveragePrice)} is higher than the 24h avg">▲</span>`;
        } else if (marketAveragePrice < averagePrice) {
          trendHTML = ` <span class="negative" title="Current price ${formatNumber(marketAveragePrice)} is lower than the 24h avg">▼</span>`;
        }
      }

      const row = createTableRow([
        `<span class="${colorClass}"><b>${label}</b></span>`,
        formatNumber(bid),
        formatNumber(ask),
        spread,
        volumeUnits.toLocaleString(),
        Math.round(volumeBTC).toLocaleString(),
        `${formatNumber(averagePrice)}${trendHTML}`
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
