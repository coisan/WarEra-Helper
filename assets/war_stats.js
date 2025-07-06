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
  const allBattles = [];
  let nextCursor = null;
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  while (true) {
    const input = {
      limit: 100,
      direction: "backward",
      ...(nextCursor && { cursor: nextCursor }) // include only if it's defined
    };

    const res = await fetch("https://api2.warera.io/trpc/battle.getBattles?input=" + encodeURIComponent(JSON.stringify(input)));
    const data = await res.json();
    const result = data.result?.data;

    if (!result?.items?.length) break;

    for (const battle of result.items) {
      const timestamp = new Date(battle.createdAt).getTime();
      if (timestamp < oneWeekAgo) {
        return { items: allBattles }; // stop if battle is older than 1 week
      }
      allBattles.push(battle);
    }

    nextCursor = result.nextCursor;
    if (!nextCursor) break; // no more pages
  }

  return { items: allBattles };
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

  const damageDat = new Map();       // Opponent country -> damage by selected country
  const damagePrimit = new Map();    // Opponent country -> damage received by selected country
  const damageAliati = new Map();    // Ally country -> damage by allies (same side as selected)

  await fetchCountryName(selectedCountryId);

  for (const battle of filteredBattles) {
    const battleId = battle._id;
    const attackerId = battle.attacker.country;
    const defenderId = battle.defender.country;

    const isAttacker = attackerId === selectedCountryId;
    const isDefender = defenderId === selectedCountryId;

    await Promise.all([attackerId, defenderId].map(fetchCountryName));

    const attackerRankings = await fetchRanking(battleId, "attacker");
    const defenderRankings = await fetchRanking(battleId, "defender");

    const selectedSide = isAttacker ? "attacker" : "defender";
    const opponentSide = selectedSide === "attacker" ? "defender" : "attacker";

    // 1. Damage by selected country to opponent side (damageDat)
    const selectedRanking = (selectedSide === "attacker" ? attackerRankings.rankings : defenderRankings.rankings)
      .find(e => e.country === selectedCountryId);
    if (selectedRanking) {
      const opponentCountryId = selectedSide === "attacker" ? defenderId : attackerId;
      const opponentName = countryMap.get(opponentCountryId);
      damageDat.set(opponentName, (damageDat.get(opponentName) || 0) + selectedRanking.value);
    }

    // 2. Damage received by selected country from opponent side (damagePrimit)
    const opponentRankings = (opponentSide === "attacker" ? attackerRankings.rankings : defenderRankings.rankings);
    for (const entry of opponentRankings) {
      if (entry.country === selectedCountryId) continue;
      const opponentName = countryMap.get(entry.country);
      damagePrimit.set(opponentName, (damagePrimit.get(opponentName) || 0) + entry.value);
    }

    // 3. Allied damage: damage done by all other countries on selected side (allies) to the opponent
    const selectedSideRankings = (selectedSide === "attacker" ? attackerRankings.rankings : defenderRankings.rankings);
    for (const entry of selectedSideRankings) {
      if (entry.country === selectedCountryId) continue;
      const allyName = countryMap.get(entry.country);
      damageAliati.set(allyName, (damageAliati.get(allyName) || 0) + entry.value);
    }
  }

  statsByCountry.set(selectedCountryId, {
    name: countryMap.get(selectedCountryId),
    damageDat,
    damageAliati,
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

  const { damageDat, damageAliati, damagePrimit } = statsByCountry.get(countryId);

  // Convert Maps to arrays and sort descending by damage
  const datArray = Array.from(damageDat.entries()).sort((a, b) => b[1] - a[1]);
  const aliatiArray = Array.from(damageAliati.entries()).sort((a, b) => b[1] - a[1]);
  const primitArray = Array.from(damagePrimit.entries()).sort((a, b) => b[1] - a[1]);

  const max = Math.max(datArray.length, aliatiArray.length, primitArray.length);

  let totalDat = 0;
  let totalAliati = 0;
  let totalPrimit = 0;

  for (let i = 0; i < max; i++) {
    const row = document.createElement("tr");

    const datCountryCell = document.createElement("td");
    const datDamageCell = document.createElement("td");
    const aliatiCountryCell = document.createElement("td");
    const aliatiDamageCell = document.createElement("td");
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

    if (aliatiArray[i]) {
      aliatiCountryCell.textContent = aliatiArray[i][0];
      aliatiDamageCell.textContent = aliatiArray[i][1].toLocaleString();
      totalAliati += aliatiArray[i][1];
    } else {
      aliatiCountryCell.textContent = "";
      aliatiDamageCell.textContent = "";
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
    row.appendChild(aliatiCountryCell);
    row.appendChild(aliatiDamageCell);
    row.appendChild(primitCountryCell);
    row.appendChild(primitDamageCell);

    tbody.appendChild(row);
  }

  // Add totals row
  const totalRow = document.createElement("tr");
  totalRow.style.fontWeight = "bold";

  const emptyCell = document.createElement("td");
  totalRow.appendChild(emptyCell);

  const totalDatCell = document.createElement("td");
  totalDatCell.textContent = totalDat.toLocaleString();
  totalRow.appendChild(totalDatCell);

  totalRow.appendChild(emptyCell);

  const totalAliatiCell = document.createElement("td");
  totalAliatiCell.textContent = totalAliati.toLocaleString();
  totalRow.appendChild(totalAliatiCell);

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
