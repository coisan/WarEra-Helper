import {makeTableSortable} from './config.js';

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

async function fetchAllCountries() {
  const res = await fetch("https://api2.warera.io/trpc/country.getAllCountries");
  const data = await res.json();
  return data.result?.data ?? [];
}

async function buildCountriesTable() {
  const table = document.getElementById("countriesTable");
  const tbody = table.querySelector("tbody");

  table.style.display = "none";
  tbody.innerHTML = "";

  const loadingDiv = document.getElementById("loadingMessage");
  loadingDiv.style.display = "block";
  try {
    const countriesData = await fetchAllCountries();

    countriesData.forEach((country) => {
      const row = createTableRow([
        country.name,
        country.rankings.countryActivePopulation.value,
        `${country.strategicResources.bonuses.productionPercent}%`,
        `${country.taxes.income}%`,
        `${country.taxes.market}%`,
        formatNumber(country.rankings.countryDevelopment.value),
        formatNumber(country.rankings.countryWealth.value)
      ]);
      tbody.appendChild(row);
    });
  }
  finally {
    loadingDiv.style.display = "none";
  }
    
  table.style.display = "table";
}

window.addEventListener("DOMContentLoaded", buildCountriesTable);
makeTableSortable("countriesTable");
