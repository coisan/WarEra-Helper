const countryMap = new Map();
const statsByCountry = new Map();

document.getElementById("countrySelect").addEventListener("change", (e) => {
  const selectedId = e.target.value;
  if (selectedId) {
    buildStats(selectedId);
  } else {
    // Clear table if no selection
    const tbody = document.querySelector("#battleTable tbody");
    tbody.innerHTML = "";
    statsByCountry.clear();
  }
});

async function fetchAllCountries() {
  const res = await fetch("https://api2.warera.io/trpc/country.getAllCountries");
  const data = await res.json();
  return data.result?.data ?? [];
}

async function fetchBattles() {
  const res = await fetch("https://api2.warera.io/trpc/battle.getBattles?input=" + encodeURIComponent(JSON.stringify({ limit: 100, direction: "backward" })));
  const data = await res.json();
  return data.result?.data ?? [];
}

async function fetchRanking(battleId, side) {
  const res = await fetch("https://api2.warera.io/trpc/battleRanking.getRanking?input=" + encodeURIComponent(JSON.stringify({
    battleId,
    dataType: "damage",
    type: "country",
    side,
    limit: 100
  })));
  const data = await res.json();
  return data.result?.data ?? [];
}

async function fetchCountryName(id) {
  if (countryMap.has(id)) return countryMap.get(id);
  const res = await fetch("https://api2.warera.io/trpc/country.getCountryById?input=" + encodeURIComponent(JSON.stringify({ countryId: id })));
  const data = await res.json();
  const name = data.result?.data?.name || id;
  countryMap.set(id, name);
  return name;
}

async function buildStats(selectedCountryId) {
  statsByCountry.clear(); // Clear previous stats

  const battles = await fetchBattles();

  // Filter battles where selectedCountryId is attacker or defender
  const filteredBattles = battles.items.filter(battle => {
    return battle.attacker.country === selectedCountryId || battle.defender.country === selectedCountryId;
  });

  for (const battle of filteredBattles) {
    const battleId = battle._id;
    const attackerId = battle.attacker.country;
    const defenderId = battle.defender.country;

    // Make sure we cache attacker and defender country names
    await Promise.all([attackerId, defenderId].map(fetchCountryName));

    const [atkList, defList] = await Promise.all([
      fetchRanking(battleId, "attacker"),
      fetchRanking(battleId, "defender")
    ]);

    for (const entry of atkList.rankings) {
      const id = entry.country;
      const damage = entry.value;
      if (!statsByCountry.has(id)) statsByCountry.set(id, { name: countryMap.get(id), attacked: new Map(), defended: new Map() });
      const target = statsByCountry.get(id).attacked;
      const key = countryMap.get(defenderId);
      target.set(key, (target.get(key) || 0) + damage);
    }

    for (const entry of defList.rankings) {
      const id = entry.country;
      const damage = entry.value;
      if (!statsByCountry.has(id)) statsByCountry.set(id, { name: countryMap.get(id), attacked: new Map(), defended: new Map() });
      const source = statsByCountry.get(id).defended;
      const key = countryMap.get(attackerId);
      source.set(key, (source.get(key) || 0) + damage);
    }
  }

  populateTable();
}

async function populateDropdown() {
  const select = document.getElementById("countrySelect");
  select.innerHTML = '<option value="">-- Alege o țară --</option>';

  const countries = await fetchAllCountries();

  // Sort countries by rankings.countryActivePopulation.value descending
  countries.sort((a, b) => {
    const aPop = a.rankings?.countryActivePopulation?.value ?? 0;
    const bPop = b.rankings?.countryActivePopulation?.value ?? 0;
    return bPop - aPop;
  });

  countries.forEach(country => {
    countryMap.set(country._id, country.name); // Cache country names

    const pop = country.rankings?.countryActivePopulation?.value ?? 0;
    const option = document.createElement("option");
    option.value = country._id;
    option.textContent = `${country.name} (${pop.toLocaleString()})`;
    select.appendChild(option);
  });
}

function populateTable() {
  const countryId = document.getElementById("countrySelect").value;
  if (!countryId || !statsByCountry.has(countryId)) return;

  const tbody = document.querySelector("#battleTable tbody");
  tbody.innerHTML = "";

  const { attacked, defended } = statsByCountry.get(countryId);

  // Convert Maps to arrays of [countryName, damage]
  const atkArray = Array.from(attacked.entries());
  const defArray = Array.from(defended.entries());

  // Sort descending by damage value
  atkArray.sort((a, b) => b[1] - a[1]);
  defArray.sort((a, b) => b[1] - a[1]);

  const max = Math.max(atkArray.length, defArray.length);

  let totalAtk = 0;
  let totalDef = 0;

  for (let i = 0; i < max; i++) {
    const row = document.createElement("tr");

    const atkNameCell = document.createElement("td");
    const atkDmgCell = document.createElement("td");
    const defNameCell = document.createElement("td");
    const defDmgCell = document.createElement("td");

    if (atkArray[i]) {
      atkNameCell.textContent = atkArray[i][0];
      atkDmgCell.textContent = atkArray[i][1].toLocaleString();
      totalAtk += atkArray[i][1];
    } else {
      atkNameCell.textContent = "";
      atkDmgCell.textContent = "";
    }

    if (defArray[i]) {
      defNameCell.textContent = defArray[i][0];
      defDmgCell.textContent = defArray[i][1].toLocaleString();
      totalDef += defArray[i][1];
    } else {
      defNameCell.textContent = "";
      defDmgCell.textContent = "";
    }

    row.appendChild(atkNameCell);
    row.appendChild(atkDmgCell);
    row.appendChild(defNameCell);
    row.appendChild(defDmgCell);

    tbody.appendChild(row);
  }

  // Add total row
  const totalRow = document.createElement("tr");
  totalRow.style.fontWeight = "bold";

  const totalLabelCell = document.createElement("td");
  totalLabelCell.textContent = "Total";
  totalRow.appendChild(totalLabelCell);

  const totalAtkCell = document.createElement("td");
  totalAtkCell.textContent = totalAtk.toLocaleString();
  totalRow.appendChild(totalAtkCell);

  // Empty cell between the two totals
  const emptyCell = document.createElement("td");
  totalRow.appendChild(emptyCell);

  const totalDefCell = document.createElement("td");
  totalDefCell.textContent = totalDef.toLocaleString();
  totalRow.appendChild(totalDefCell);

  tbody.appendChild(totalRow);
}

populateDropdown();

// Nav highlight
const path = window.location.pathname;
if (path === '/' || path.includes('calc.html')) {
  document.getElementById('nav-calc').style.fontWeight = 'bold';
  document.getElementById('nav-calc').style.backgroundColor = '#ddd';
} else if (path.includes('war_stats.html')) {
  document.getElementById('nav-stats').style.fontWeight = 'bold';
  document.getElementById('nav-stats').style.backgroundColor = '#ddd';
}
