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
  statsByCountry.clear();

  const battles = await fetchBattles();

  const filteredBattles = battles.items.filter(battle =>
    battle.attacker.country === selectedCountryId || battle.defender.country === selectedCountryId
  );

  const damageDat = new Map();     // Country -> damage dealt by selected country
  const damagePrimit = new Map();  // Country -> damage dealt to selected country

  await fetchCountryName(selectedCountryId);

  for (const battle of filteredBattles) {
    const battleId = battle._id;
    const attackerId = battle.attacker.country;
    const defenderId = battle.defender.country;

    const isAttacker = attackerId === selectedCountryId;
    const isDefender = defenderId === selectedCountryId;

    // Cache attacker and defender country names
    await Promise.all([attackerId, defenderId].map(fetchCountryName));

    // Fetch rankings
    const attackerRankings = await fetchRanking(battleId, "attacker");
    const defenderRankings = await fetchRanking(battleId, "defender");

    if (isAttacker) {
      // 1. Damage dealt by selected country → defender
      const entry = attackerRankings.rankings.find(e => e.country === selectedCountryId);
      if (entry) {
        const defenderName = countryMap.get(defenderId);
        damageDat.set(defenderName, (damageDat.get(defenderName) || 0) + entry.value);
      }

      // 2. Damage received from defenders (damage primit)
      for (const entry of defenderRankings.rankings) {
        if (entry.country === selectedCountryId) continue;
        const defenderName = countryMap.get(entry.country);
        damagePrimit.set(defenderName, (damagePrimit.get(defenderName) || 0) + entry.value);
      }
    }

    if (isDefender) {
      // 3. Damage dealt by selected country → attacker
      const entry = defenderRankings.rankings.find(e => e.country === selectedCountryId);
      if (entry) {
        const attackerName = countryMap.get(attackerId);
        damageDat.set(attackerName, (damageDat.get(attackerName) || 0) + entry.value);
      }

      // 4. Damage received from attackers (damage primit)
      for (const entry of attackerRankings.rankings) {
        if (entry.country === selectedCountryId) continue;
        const attackerName = countryMap.get(entry.country);
        damagePrimit.set(attackerName, (damagePrimit.get(attackerName) || 0) + entry.value);
      }
    }
  }

  statsByCountry.set(selectedCountryId, {
    name: countryMap.get(selectedCountryId),
    damageDat,
    damagePrimit
  });

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

  const { damageDat, damagePrimit } = statsByCountry.get(countryId);

  // Convert Maps to arrays and sort descending by damage
  const datArray = Array.from(damageDat.entries()).sort((a, b) => b[1] - a[1]);
  const primitArray = Array.from(damagePrimit.entries()).sort((a, b) => b[1] - a[1]);

  const max = Math.max(datArray.length, primitArray.length);

  let totalDat = 0;
  let totalPrimit = 0;

  for (let i = 0; i < max; i++) {
    const row = document.createElement("tr");

    const datCountryCell = document.createElement("td");
    const datDamageCell = document.createElement("td");
    const primitCountryCell = document.createElement("td");
    const primitDamageCell = document.createElement("td");

    if (datArray[i]) {
      datCountryCell.textContent = datArray[i][0];
      datDamageCell.textContent = datArray[i][1].toLocaleString();
      totalDat += datArray[i][1];
    } else {
      datCountryCell.textContent = "";
      datDamageCell.textContent = "";
    }

    if (primitArray[i]) {
      primitCountryCell.textContent = primitArray[i][0];
      primitDamageCell.textContent = primitArray[i][1].toLocaleString();
      totalPrimit += primitArray[i][1];
    } else {
      primitCountryCell.textContent = "";
      primitDamageCell.textContent = "";
    }

    row.appendChild(datCountryCell);
    row.appendChild(datDamageCell);
    row.appendChild(primitCountryCell);
    row.appendChild(primitDamageCell);

    tbody.appendChild(row);
  }

  // Add totals row
  const totalRow = document.createElement("tr");
  totalRow.style.fontWeight = "bold";

  const totalLabelCell = document.createElement("td");
  totalLabelCell.textContent = "Total";
  totalRow.appendChild(totalLabelCell);

  const totalDatCell = document.createElement("td");
  totalDatCell.textContent = totalDat.toLocaleString();
  totalRow.appendChild(totalDatCell);

  // Empty cell between the two totals
  const emptyCell = document.createElement("td");
  totalRow.appendChild(emptyCell);

  const totalPrimitCell = document.createElement("td");
  totalPrimitCell.textContent = totalPrimit.toLocaleString();
  totalRow.appendChild(totalPrimitCell);

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
