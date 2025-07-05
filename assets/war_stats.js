const countryMap = new Map();
const statsByCountry = new Map();

async function fetchBattles() {
  const res = await fetch("https://api2.warera.io/trpc/battle.getBattles?input=" + encodeURIComponent(JSON.stringify({ limit: 100, direction: "backwards" })));
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

async function buildStats() {
  const battles = await fetchBattles();

  for (const battle of battles) {
    const battleId = battle._id;
    const attackerId = battle.attacker.id;
    const defenderId = battle.defender.id;

    await Promise.all([attackerId, defenderId].map(fetchCountryName));

    const [atkList, defList] = await Promise.all([
      fetchRanking(battleId, "attacker"),
      fetchRanking(battleId, "defender")
    ]);

    for (const entry of atkList) {
      const id = entry.country.id;
      if (!statsByCountry.has(id)) statsByCountry.set(id, { name: countryMap.get(id), attacked: new Set(), defended: new Set() });
      statsByCountry.get(id).attacked.add(countryMap.get(defenderId));
    }

    for (const entry of defList) {
      const id = entry.country.id;
      if (!statsByCountry.has(id)) statsByCountry.set(id, { name: countryMap.get(id), attacked: new Set(), defended: new Set() });
      statsByCountry.get(id).defended.add(countryMap.get(attackerId));
    }
  }

  populateDropdown();
}

function populateDropdown() {
  const select = document.getElementById("countrySelect");

  Array.from(statsByCountry.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(({ name }, i) => {
      const id = Array.from(statsByCountry.keys())[i];
      const option = document.createElement("option");
      option.value = id;
      option.textContent = name;
      select.appendChild(option);
    });
}

function populateTable() {
  const countryId = document.getElementById("countrySelect").value;
  if (!countryId || !statsByCountry.has(countryId)) return;

  const tbody = document.querySelector("#battleTable tbody");
  tbody.innerHTML = "";

  const { attacked, defended } = statsByCountry.get(countryId);
  const atkArray = Array.from(attacked);
  const defArray = Array.from(defended);
  const max = Math.max(atkArray.length, defArray.length);

  for (let i = 0; i < max; i++) {
    const row = document.createElement("tr");
    const atkCell = document.createElement("td");
    const defCell = document.createElement("td");
    atkCell.textContent = atkArray[i] || "";
    defCell.textContent = defArray[i] || "";
    row.appendChild(atkCell);
    row.appendChild(defCell);
    tbody.appendChild(row);
  }
}

buildStats();

// Nav highlight
const path = window.location.pathname;
if (path === '/' || path.includes('calc.html')) {
  document.getElementById('nav-calc').style.fontWeight = 'bold';
  document.getElementById('nav-calc').style.backgroundColor = '#ddd';
} else if (path.includes('war_stats.html')) {
  document.getElementById('nav-stats').style.fontWeight = 'bold';
  document.getElementById('nav-stats').style.backgroundColor = '#ddd';
}
