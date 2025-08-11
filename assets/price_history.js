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

async function processTransactions(inputItem) {

    const transactions = await fetchAllTransactions(inputItem);

    // Group by day
    const dailyData = {};
    transactions.forEach(tx => {
        const date = new Date(tx.createdAt);
        const dayKey = date.toISOString().split("T")[0];

        if (!dailyData[dayKey]) dailyData[dayKey] = [];
        dailyData[dayKey].push(tx.money/tx.quantity);
    });

    // Convert to array sorted by date
    const result = Object.keys(dailyData)
        .sort()
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
  
    const canvas = document.getElementById("priceHistoryChart");
    const barData = data.map(d => [d.min, d.max]); // floating bars [min, max]
    const avgData = data.map(d => d.avg);
    
    new Chart(canvas, {
        data: {
            labels: data.map(d => d.day),
            datasets: [
                {
                    label: 'Min-Max Range',
                    type: 'bar',
                    data: barData,
                    backgroundColor: 'rgba(0, 123, 255, 0.5)', // blueish translucent bar
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
        const canvas = document.getElementById("priceHistoryChart");
        canvas.remove();
        const chartData = await processTransactions(selectedItem);
        renderChart(chartData);
    });
}

init();
