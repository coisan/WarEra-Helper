import {itemDisplayOrder} from './config.js';

async function fetchAllTransactions(itemCode) {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
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
      if (ts < sevenDaysAgo) return transactions;
      transactions.push(tx);
    }

    cursor = data.result?.data?.nextCursor;
    if (!cursor) break;
  }

  return transactions;
}

function processTransactions(transactions) {

    // Group by day
    const dailyData = {};
    transactions.forEach(tx => {
        const date = new Date(tx.timestamp);
        const dayKey = date.toISOString().split("T")[0];

        if (!dailyData[dayKey]) dailyData[dayKey] = [];
        dailyData[dayKey].push(tx.price);
    });

    // Convert to array sorted by date
    const result = Object.keys(dailyData)
        .sort()
        .slice(-7) // last 7 days
        .map(day => {
            const prices = dailyData[day];
            const min = Math.min(...prices);
            const max = Math.max(...prices);
            const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
            return { day, min, avg, max };
        });

    return result;
}

function renderChart(data) {
    const ctx = document.getElementById("priceHistoryChart").getContext("2d");
    new Chart(ctx, {
        type: "line",
        data: {
            labels: data.map(d => d.day),
            datasets: [
                {
                    label: "Min Price",
                    data: data.map(d => d.min),
                    borderColor: "red",
                    fill: false
                },
                {
                    label: "Average Price",
                    data: data.map(d => d.avg),
                    borderColor: "blue",
                    fill: false
                },
                {
                    label: "Max Price",
                    data: data.map(d => d.max),
                    borderColor: "green",
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: "top" }
            },
            scales: {
                x: { title: { display: true, text: "Date" } },
                y: { title: { display: true, text: "Price" } }
            }
        }
    });
}

async function init() {

    // Populate dropdown
    const select = document.getElementById("itemSelect");
    itemDisplayOrder.forEach(item => {
        const opt = document.createElement("option");
        opt.value = item.id;
        opt.textContent = item.label;
        select.appendChild(opt);
    });

    // On change
    select.addEventListener("change", () => {
        const selectedItem = select.value;
        const transactions = await fetchAllTransactions(selectedItem);
        const chartData = processTransactions(transactions);
        document.getElementById("priceHistoryChart").remove();
        const canvas = document.createElement("canvas");
        canvas.id = "priceHistoryChart";
        select.parentNode.appendChild(canvas);
        renderChart(chartData);
    });
}

init();
