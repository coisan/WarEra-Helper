window.generatePremiumInfo = async function generatePremiumInfo() {
  const userId = document.getElementById("playerIdInput").value.trim();
  if (!userId) {
    alert("Please enter a valid Player ID");
    return;
  }

  const loadingDiv = document.getElementById("loadingMessage");
  loadingDiv.style.display = "block";

  try {
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
        alert("Played ID not valid or not found");
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
    const employeeWork = {};

    for (const tx of transactions) {
      const type = tx.transactionType;
      const money = tx.money || 0;
      const quantity = tx.quantity || 0;

      if (tx.buyerId === userId) {
        expenses[type] = (expenses[type] || 0) + money;
        if (type === "wage" && tx.buyerId) {
          if (!employeeWork[tx.sellerId]) {
            employeeWork[tx.sellerId] = { money: 0, quantity: 0 };
          }
          employeeWork[tx.sellerId].money += money;
          employeeWork[tx.sellerId].quantity += quantity;
        }
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
        <div class="table-responsive">
          <table class="sortable">
            <thead><tr><th>Transaction type</th><th>Ammount</th></tr></thead>
            <tbody>${rows}${subtotalRow}</tbody>
          </table>
        </div>
      `;
      return { html: fullTable, subtotal };
    };

    const usernameCache = {};

    async function getUsername(id) {
      if (usernameCache[id]) return usernameCache[id];

      try {
        const input = {
          userId: id
        };
        const res = await fetch(`https://api2.warera.io/trpc/user.getUserLite?input=` + encodeURIComponent(JSON.stringify(input)));
        const data = await res.json();
        const username = data.result?.data?.username || id;
        usernameCache[id] = username;
        return username;
      } catch (e) {
        return id; // fallback to ID if error
      }
    }

    const buildEmployeeTable = async (data) => {
      if (Object.keys(data).length === 0) return "";
    
      const countryCache = {};
    
      async function getCountryName(countryId) {
        if (!countryId) return "-";
        if (countryCache[countryId]) return countryCache[countryId];
    
        try {
          const input = { countryId };
          const res = await fetch(
            `https://api2.warera.io/trpc/country.getCountryById?input=` +
              encodeURIComponent(JSON.stringify(input))
          );
          const result = await res.json();
          const name = result.result?.data?.name || countryId;
          countryCache[countryId] = name;
          return name;
        } catch {
          return countryId;
        }
      }
    
      const entries = await Promise.all(
        Object.entries(data).map(async ([id, { money, quantity }]) => {
          const input = { userId: id };
          try {
            const res = await fetch(
              `https://api2.warera.io/trpc/user.getUserLite?input=` +
                encodeURIComponent(JSON.stringify(input))
            );
            const result = await res.json();
            const user = result.result?.data;
            return {
              username: user?.username || id,
              country: await getCountryName(user?.country),
              money,
              quantity,
            };
          } catch {
            return {
              username: id,
              country: "-",
              money,
              quantity,
            };
          }
        })
      );
    
      entries.sort((a, b) => b.quantity - a.quantity);
    
      const rows = entries.map((entry) => {
        return `<tr>
          <td>${entry.username}</td>
          <td>${entry.country}</td>
          <td>${entry.money.toFixed(3)}</td>
          <td>${entry.quantity}</td>
          <td>${(entry.money/entry.quantity).toFixed(3)}</td>
        </tr>`;
      });
    
      return `
        <h3>Employees overview</h3>
        <table>
          <thead>
            <tr><th>Employee</th><th>Country</th><th>Paid</th><th>Produced</th><th>Avg salary</th></tr>
          </thead>
          <tbody>${rows.join("")}</tbody>
        </table>
      `;
    };

    const incomeTable = buildTable(income, "Income");
    const expensesTable = buildTable(expenses, "Expenses");
    const grandTotal = incomeTable.subtotal - expensesTable.subtotal;
    const grandTotalHtml = `<p><strong>Balance (last 7 days):</strong> ${grandTotal.toFixed(3)}</p>`;
    const employeeTable = await buildEmployeeTable(employeeWork);

    document.getElementById("premiumStatsOutput").innerHTML =
      incomeTable.html + expensesTable.html + grandTotalHtml + employeeTable;

  } finally {
    loadingDiv.style.display = "none";
  }
};
