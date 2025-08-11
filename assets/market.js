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

function createPriceRangeBar(minValue, avgValue, maxValue, trend) {
    if (minValue === null || avgValue === null || maxValue === null) {
        return '';
    }

    const range = maxValue - minValue;
    const avgPos = range > 0 ? ((avgValue - minValue) / range) * 100 : 50;

    let trendSymbol = '';
    let trendClass = '';
    if (trend > 0) {
        trendSymbol = '▲';
        trendClass = 'positive';
    } else if (trend < 0) {
        trendSymbol = '▼';
        trendClass = 'negative';
    } else {
        trendSymbol = '■';
        trendClass = 'neutral';
    }

    return `
        <div class="price-bar-container" style="display:flex; align-items:center; gap:6px;">
            <div class="price-bar">
                <div class="price-bar-min" title="Min: ${minValue.toFixed(2)}"></div>
                <div class="price-bar-avg" style="left:${avgPos}%;" title="Avg: ${avgValue.toFixed(2)}"></div>
                <div class="price-bar-max" title="Max: ${maxValue.toFixed(2)}"></div>
            </div>
            <span class="${trendClass}">${trendSymbol}</span>
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
