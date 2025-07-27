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
    const rows = Object.entries(data).map(
      ([type, amount]) => `<tr><td>${type}</td><td>${amount.toFixed(2)}</td></tr>`
    ).join("");
    return `<h3>${title}</h3><table><thead><tr><th>Tip tranzacție</th><th>Suma</th></tr></thead><tbody>${rows}</tbody></table>`;
  };

  const html = buildTable(income, "Venituri") + buildTable(expenses, "Cheltuieli");
  document.getElementById("premiumStatsOutput").innerHTML = html;
}
