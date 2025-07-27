window.generatePremiumInfo = async function generatePremiumInfo() {
  const userId = document.getElementById("playerIdInput").value.trim();
  if (!userId) {
    alert("Te rog introdu un ID de jucător valid.");
    return;
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const transactions = [];

  let cursor = undefined;
  while (true) {
    const input = {
      limit: 100,
      userId
    };
    if (cursor !== undefined) input.cursor = cursor;

    const response = await fetch(`https://api2.warera.io/trpc/transaction.getPaginatedTransactions?input=` + encodeURIComponent(JSON.stringify(input)));
    const result = await response.json();

    if (result.error?.data?.httpStatus === 500) {
      alert("IDul este invalid sau nu a fost găsit.");
      return;
    }

    const items = result.result?.data?.items || [];

    for (const tx of items) {
      const txDate = new Date(tx.createdAt);
      if (txDate < weekAgo) {
        cursor = null;
        break;
      }
      transactions.push(tx);
    }

    cursor = result.result?.data?.nextCursor;
    if (!cursor) break;
  }

  const income = {};
  const expenses = {};

  for (const tx of transactions) {
    const type = tx.transactionType;
    const money = tx.money || 0;

    if (tx.buyerId === userId) {
      expenses[type] = (expenses[type] || 0) + money;
    } else if (tx.sellerId === userId) {
      income[type] = (income[type] || 0) + money;
    }
  }

  const buildTable = (data, title) => {
    let subtotal = 0;
    const rows = Object.entries(data).map(([type, amount]) => {
      subtotal += amount;
      return `<tr><td>${type}</td><td>${amount.toFixed(3)}</td></tr>`;
    }).join("");

    const subtotalRow = `<tr><td><strong>Total ${title.toLowerCase()}</strong></td><td><strong>${subtotal.toFixed(3)}</strong></td></tr>`;
    const fullTable = `
      <h3>${title}</h3>
      <table>
        <thead><tr><th>Tip tranzacție</th><th>Suma</th></tr></thead>
        <tbody>${rows}${subtotalRow}</tbody>
      </table>
    `;
    return { html: fullTable, subtotal };
  };

  const incomeTable = buildTable(income, "Venituri");
  const expensesTable = buildTable(expenses, "Cheltuieli");
  const grandTotal = incomeTable.subtotal - expensesTable.subtotal;

  const grandTotalHtml = `<p><strong>Total ultimele 7 zile:</strong> ${grandTotal.toFixed(3)}</p>`;

  document.getElementById("premiumStatsOutput").innerHTML =
    incomeTable.html + expensesTable.html + grandTotalHtml;
};
