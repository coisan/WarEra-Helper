let prices = {};
let bestBonuses = {};

import { itemDisplayOrder, recipes, makeTableSortable } from './config.js';

/* =======================
   DATA LOADING
======================= */

async function loadPrices() {
  const res = await fetch("https://api2.warera.io/trpc/itemTrading.getPrices");
  const data = await res.json();
  prices = data.result?.data ?? {};
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

    if (!bestByItem[item] || bonus > bestByItem[item].value) {
      bestByItem[item] = {
        value: bonus,
        country: country.name ?? country.id ?? "Unknown"
      };
    }
  }

  return bestByItem;
}

/* =======================
   TABLE RENDERING
======================= */

function renderProfitTable() {
  const tbody = document.querySelector('#profitTable tbody');
  tbody.innerHTML = '';

  for (const { id, label, class: colorClass } of itemDisplayOrder) {
    if (!prices[id] || id === "case1") continue;

    const sellPrice = prices[id];
    const best = bestBonuses[id];

    const row = document.createElement('tr');
    row.dataset.itemId = id;

    // Item
    const itemCell = document.createElement('td');
    itemCell.className = colorClass;
    itemCell.innerHTML = `<b>${label}</b>`;
    row.appendChild(itemCell);

    // Sell price
    const priceCell = document.createElement('td');
    priceCell.textContent = sellPrice.toFixed(3);
    row.appendChild(priceCell);

    // Bonus input
    const bonusCell = document.createElement('td');
    const bonusInput = document.createElement('input');
    bonusInput.type = 'number';
    bonusInput.step = '0.5';
    bonusInput.className = 'bonus-input';
    bonusInput.value = best?.value ?? 0;
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

/* =======================
   CALCULATION BUTTON
======================= */

window.calculateAllProfitabilities = function calculateAllProfitabilities() {
  const salary = parseFloat(document.getElementById('salaryInput').value);
  const rows = document.querySelectorAll('#profitTable tbody tr');

  // Build bonus map from UI (calculation snapshot)
  const bonusMap = {};
  for (const row of rows) {
    const itemId = row.dataset.itemId;
    const bonusInput = row.querySelector('.bonus-input');
    bonusMap[itemId] = parseFloat(bonusInput.value) || 0;
  }

  for (const row of rows) {
    const itemId = row.dataset.itemId;
    const recipe = recipes[itemId];

    const marketCell = row.children[4];
    const prodCell = row.children[5];

    /* ---- MARKET ---- */
    if (Object.keys(recipe.materials).length > 0) {
      const marketProfit = calculateProfitability(
        itemId,
        bonusMap,
        salary,
        'market'
      );

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

    /* ---- PRODUCTION ---- */
    const prodProfit = calculateProfitability(
      itemId,
      bonusMap,
      salary,
      'production'
    );

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

/* =======================
   PROFIT CALCULATION
======================= */

function calculateProfitability(item, bonusMap, salary, source) {
  const recipe = recipes[item];
  const sellPrice = prices[item];
  if (!recipe || !sellPrice || sellPrice <= 0) return null;

  const bonus = bonusMap[item] ?? 0;

  // No materials
  if (Object.keys(recipe.materials).length === 0) {
    const pp = recipe.pp / (1 + bonus / 100);
    if (isNaN(salary)) {
      return sellPrice / pp;
    } else {
      const cost = pp * salary;
      return (sellPrice - cost) / cost;
    }
  }

  // MARKET
  if (source === 'market') {
    let matCost = 0;
    for (const [mat, qty] of Object.entries(recipe.materials)) {
      if (!prices[mat]) return null;
      matCost += prices[mat] * qty;
    }

    const pp = recipe.pp / (1 + bonus / 100);

    if (isNaN(salary)) {
      return (sellPrice - matCost) / pp;
    } else {
      const cost = matCost + pp * salary;
      return (sellPrice - cost) / cost;
    }
  }

  // PRODUCTION (bonus-aware per step)
  if (source === 'production') {
    const totalPP = calculatePPTotalWithBonuses(item, bonusMap);
    if (totalPP === null) return null;

    if (isNaN(salary)) {
      return sellPrice / totalPP;
    } else {
      const cost = totalPP * salary;
      return (sellPrice - cost) / cost;
    }
  }

  return null;
}

/* =======================
   BONUS-AWARE PP RECURSION
======================= */

function calculatePPTotalWithBonuses(item, bonusMap) {
  const recipe = recipes[item];
  if (!recipe) return null;

  const bonus = bonusMap[item] ?? 0;
  let totalPP = recipe.pp / (1 + bonus / 100);

  for (const [mat, qty] of Object.entries(recipe.materials)) {
    const subPP = calculatePPTotalWithBonuses(mat, bonusMap);
    if (subPP === null) return null;
    totalPP += subPP * qty;
  }

  return totalPP;
}

/* =======================
   INIT
======================= */

async function init() {
  await loadPrices();
  bestBonuses = await getBestProductionBonuses();
  renderProfitTable();
  makeTableSortable("profitTable");
}

init();
