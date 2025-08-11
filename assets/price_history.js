import {itemDisplayOrder} from './config.js';
let priceHistoryChartInstance = null;

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

async function processTransactions(inputItem) {

    const transactions = await fetchAllTransactions(inputItem);

    // Group by day
    const dailyData = {};
    transactions.forEach(tx => {
        const date = new Date(tx.createdAt);
        //const dayKey = date.toISOString().split("T")[0];
        const dayPart = date.toISOString().split("T")[0];
        const hourPart = date.getUTCHours().toString().padStart(2, '0');
        const hourKey = `${dayPart}T${hourPart}:00:00Z`;

        if (!dailyData[hourKey]) dailyData[hourKey] = [];
        dailyData[hourKey].push({price: tx.money/tx.quantity, cost: tx.money, volume: tx.quantity});
    });

    // Convert to array sorted by date
    const result = Object.keys(dailyData)
        .sort()
        .map(day => {
            const prices = dailyData[day].map(p => p.price);
            const min = Number(Math.min(...prices).toFixed(3));
            const max = Number(Math.max(...prices).toFixed(3));
            const totalCost = dailyData[day].reduce((sum, entry) => sum + entry.cost, 0);
            const totalVolume = dailyData[day].reduce((sum, entry) => sum + entry.volume, 0);
            const avg = Number((totalCost / totalVolume).toFixed(3));
            return { day, min, avg, max };
        });

    return result;
}

function renderChart(data) {
    const canvas = document.getElementById("priceHistoryChart");

    // Destroy previous chart if exists
    if (priceHistoryChartInstance) {
        priceHistoryChartInstance.destroy();
    }

    const barData = data.map(d => [d.min, d.max]);
    const avgData = data.map(d => d.avg);

    priceHistoryChartInstance = new Chart(canvas, {
        data: {
            labels: data.map(d => d.day),
            datasets: [
                {
                    label: 'Min-Max Range',
                    type: 'bar',
                    data: barData,
                    backgroundColor: 'rgba(0, 123, 255, 0.5)',
                    borderColor: 'rgba(0, 123, 255, 1)',
                    borderWidth: 1,
                },
                {
                    label: 'Average Price',
                    type: 'line',
                    data: avgData,
                    borderColor: 'red',
                    fill: false,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: "top" }
            },
            scales: {
                x: {
                    title: { display: true, text: "Date" },
                    stacked: false
                },
                y: {
                    title: { display: true, text: "Price" },
                    stacked: false,
                    beginAtZero: false
                }
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
    select.addEventListener("change", async () => {
        const selectedItem = select.value;
        const chartData = await processTransactions(selectedItem);
        renderChart(chartData);
    });
}

init();
