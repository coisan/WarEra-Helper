let prices = {};
let bestBonuses = {};
import {itemDisplayOrder, recipes, makeTableSortable} from './config.js';

async function loadPrices() {
  const res = await fetch("https://api2.warera.io/trpc/itemTrading.getPrices");
  const data = await res.json();
  return data.result?.data ?? [];
}

async function getBestProductionBonuses() {
  const res = await fetch("https://api2.warera.io/trpc/country.getAllCountries");
  const data = await res.json();
  const countries = data.result?.data ?? [];

  const bestByItem = {};

  for (const country of countries) {
    const item = country.specializedItem;
    const bonus = country?.rankings?.countryProductionBonus?.value;

    if (!item || typeof bonus !== "number") continue;

    // Initialize or replace if this country has a higher bonus
    if (
      !bestByItem[item] ||
      bonus > bestByItem[item].value
    ) {
      bestByItem[item] = {
        value: bonus,
        country: country.name ?? country.id ?? "Unknown"
      };
    }
  }
  return bestByItem;
}

function renderProfitTable() {
  const tbody = document.querySelector('#profitTable tbody');
  tbody.innerHTML = '';

  for (const { id, label, class: colorClass } of itemDisplayOrder) {
    if (!prices[id] || id === "case1") continue;

    const sellPrice = prices[id];
    const best = bestBonuses[id];

    const row = document.createElement('tr');
    row.dataset.itemId = id; // important

    // Item
    const itemCell = document.createElement('td');
    itemCell.className = colorClass;
    itemCell.innerHTML = `<b>${label}</b>`;
    row.appendChild(itemCell);

    // Price
    const priceCell = document.createElement('td');
    priceCell.textContent = sellPrice.toFixed(3);
    row.appendChild(priceCell);

    // Bonus input
    const bonusCell = document.createElement('td');
    const bonusInput = document.createElement('input');
    bonusInput.type = 'number';
    bonusInput.step = '0.5';
    bonusInput.value = best?.value ?? 0;
    bonusInput.className = 'bonus-input';
    bonusCell.appendChild(bonusInput);
    row.appendChild(bonusCell);

    // Country
    const countryCell = document.createElement('td');
    countryCell.textContent = best?.country ?? '—';
    row.appendChild(countryCell);

    // Market result (empty)
    row.appendChild(document.createElement('td'));

    // Production result (empty)
    row.appendChild(document.createElement('td'));

    tbody.appendChild(row);
  }

  document.getElementById("profitTable").hidden = false;
}

window.calculateAllProfitabilities = function calculateAllProfitabilities() {
  const salary = parseFloat(document.getElementById('salaryInput').value);
  const rows = document.querySelectorAll('#profitTable tbody tr');

  for (const row of rows) {
    const itemId = row.dataset.itemId;
    const recipe = recipes[itemId];

    const bonusInput = row.querySelector('.bonus-input');
    const bonus = parseFloat(bonusInput.value) || 0;

    const marketCell = row.children[4];
    const prodCell = row.children[5];

    // MARKET
    if (Object.keys(recipe.materials).length > 0) {
      const marketProfit = calculateProfitability(itemId, bonus, salary, 'market');

      if (isNaN(salary)) {
        marketCell.textContent = marketProfit !== null ? marketProfit.toFixed(3) : '—';
      } else {
        marketCell.textContent = marketProfit !== null
          ? (marketProfit * 100).toFixed(2) + '%'
          : '—';
        marketCell.className = marketProfit > 0 ? 'positive' : 'negative';
      }
    } else {
      marketCell.textContent = '—';
    }

    // PRODUCTION
    const prodProfit = calculateProfitability(itemId, bonus, salary, 'production');
    if (isNaN(salary)) {
      prodCell.textContent = prodProfit !== null ? prodProfit.toFixed(3) : '—';
    } else {
      prodCell.textContent = prodProfit !== null
        ? (prodProfit * 100).toFixed(2) + '%'
        : '—';
      prodCell.className = prodProfit > 0 ? 'positive' : 'negative';
    }
  }

  // Update headers
  document.querySelector("#profitTable thead th:nth-child(5)").textContent =
    isNaN(salary)
      ? "Value per pp if buying materials"
      : "Profit if buying materials";

  document.querySelector("#profitTable thead th:nth-child(6)").textContent =
    isNaN(salary)
      ? "Value per pp if producing materials"
      : "Profit if producing materials";
};

function calculateProfitability(item, bonus, salary, source) {
  const recipe = recipes[item];
  const sellPrice = prices[item];
  if (!recipe || !sellPrice || sellPrice <= 0) return null;

  if (Object.keys(recipe.materials).length === 0) {
    const pp = recipe.pp / (1 + bonus / 100);
    if (isNaN(salary)) {
      return sellPrice / pp;
    }
    else {
      const cost = pp * salary;
      return (sellPrice - cost) / cost;
    }
  }

  if (source === 'market') {
    let matCost = 0;
    for (const [mat, qty] of Object.entries(recipe.materials)) {
      if (!prices[mat]) return null;
      matCost += prices[mat] * qty;
    }
    const pp = recipe.pp / (1 + bonus / 100);
    if (isNaN(salary)) {
      return (sellPrice - matCost) / pp;
    }
    else {
      const cost = matCost + pp * salary;
      return (sellPrice - cost) / cost;
    }
  }

  if (source === 'production') {
    const totalPP = calculatePPTotal(item, bonus);
    if (totalPP === null) return null;
    const pp = totalPP / (1 + bonus / 100);
    if (isNaN(salary)) {
      return sellPrice / pp;
    }
    else {
      const cost = pp * salary;
      return (sellPrice - cost) / cost;
    }
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

async function init() {
  prices = await loadPrices();
  bestBonuses = await getBestProductionBonuses();
  renderProfitTable();
  makeTableSortable("profitTable");
}

init();
