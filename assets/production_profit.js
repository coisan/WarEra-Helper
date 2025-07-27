let prices = {};
import {itemDisplayOrder, recipes, makeTableSortable} from './config.js';

window.loadPrices = async function loadPrices() {
  const res = await fetch("https://api2.warera.io/trpc/itemTrading.getPrices");
  const data = await res.json();
  prices =  data.result?.data ?? [];
  calculateAllProfitabilities();
}

function calculateAllProfitabilities() {
  const bonus = parseFloat(document.getElementById('bonusInput').value) || 0;
  const salary = parseFloat(document.getElementById('salaryInput').value);
  if (isNaN(salary)) return;

  const tbody = document.querySelector('#profitTable tbody');
  tbody.innerHTML = '';

  for (const {
      id,
      label,
      class: colorClass
    }
    of itemDisplayOrder) {
    if (!prices[id] || id == "case1") continue;
    const sellPrice = prices[id];
    const recipe = recipes[id];

    const row = document.createElement('tr');
    const itemCell = document.createElement('td');
    itemCell.className = colorClass;
    const boldLabel = document.createElement('b');
    boldLabel.textContent = label;
    itemCell.appendChild(boldLabel);
    row.appendChild(itemCell);

    const priceCell = document.createElement('td');
    priceCell.textContent = sellPrice.toFixed(3);
    row.appendChild(priceCell);

    const marketCell = document.createElement('td');
    if (Object.keys(recipe.materials).length > 0) {
      const marketProfit = calculateProfitability(id, bonus, salary, 'market');
      marketCell.textContent = marketProfit !== null ? (marketProfit * 100).toFixed(2) + '%' : '—';
      marketCell.className = marketProfit > 0 ? 'positive' : 'negative';
    } else {
      marketCell.textContent = '—';
    }
    row.appendChild(marketCell);

    const prodProfit = calculateProfitability(id, bonus, salary, 'production');
    const prodCell = document.createElement('td');
    prodCell.textContent = prodProfit !== null ? (prodProfit * 100).toFixed(2) + '%' : '—';
    prodCell.className = prodProfit > 0 ? 'positive' : 'negative';
    row.appendChild(prodCell);

    tbody.appendChild(row);
  }
}

function calculateProfitability(item, bonus, salary, source) {
  const recipe = recipes[item];
  const sellPrice = prices[item];
  if (!recipe || !sellPrice || sellPrice <= 0) return null;

  if (Object.keys(recipe.materials).length === 0) {
    const pp = recipe.pp / (1 + bonus / 100);
    const cost = pp * salary;
    return (sellPrice - cost) / cost;
  }

  if (source === 'market') {
    let matCost = 0;
    for (const [mat, qty] of Object.entries(recipe.materials)) {
      if (!prices[mat]) return null;
      matCost += prices[mat] * qty;
    }
    const pp = recipe.pp / (1 + bonus / 100);
    const cost = matCost + pp * salary;
    return (sellPrice - cost) / cost;
  }

  if (source === 'production') {
    const totalPP = calculatePPTotal(item, bonus);
    if (totalPP === null) return null;
    const pp = totalPP / (1 + bonus / 100);
    const cost = pp * salary;
    return (sellPrice - cost) / cost;
  }

  return null;
}

function calculatePPTotal(item) {
  const recipe = recipes[item];
  if (!recipe) return null;
  let totalPP = recipe.pp;
  for (const [mat, qty] of Object.entries(recipe.materials)) {
    const subPP = calculatePPTotal(mat);
    if (subPP === null) return null;
    totalPP += subPP * qty;
  }
  return totalPP;
}

loadPrices();
makeTableSortable("profitTable");

// Nav highlight
const path = window.location.pathname;
if (path === '/' || path.includes('production_profit.html')) {
  document.getElementById('nav-calc').style.fontWeight = 'bold';
  document.getElementById('nav-calc').style.backgroundColor = '#ddd';
} else if (path.includes('war_stats.html')) {
  document.getElementById('nav-stats').style.fontWeight = 'bold';
  document.getElementById('nav-stats').style.backgroundColor = '#ddd';
} else if (path.includes('market.html')) {
  document.getElementById('nav-market').style.fontWeight = 'bold';
  document.getElementById('nav-market').style.backgroundColor = '#ddd';
}
