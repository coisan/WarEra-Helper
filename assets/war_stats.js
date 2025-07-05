const countryMap = new Map();
const statsByCountry = new Map();

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
  console.log("COUNTRY ID:", id);
  const res = await fetch("https://api2.warera.io/trpc/country.getCountryById?input=" + encodeURIComponent(JSON.stringify({ countryId: id })));
  const data = await res.json();
  const name = data.result?.data?.name || id;
  countryMap.set(id, name);
  return name;
}

async function buildStats() {
  const battles = await fetchBattles();

  for (let i = 0; i < battles.items.length; i++) {
    const battle = battles.items[i];
    const battleId = battle._id;
    console.log("BATTLE:", battleId);
    const attackerId = battle.attacker.id;
    const defenderId = battle.defender.id;

    await Promise.all([attackerId, defenderId].map(fetchCountryName));

    const [atkList, defList] = await Promise.all([
      fetchRanking(battleId, "attacker"),
      fetchRanking(battleId, "defender")
    ]);

    for (const entry of atkList) {
      const id = entry.country.id;
      const damage = entry.value;
      if (!statsByCountry.has(id)) statsByCountry.set(id, { name: countryMap.get(id), attacked: new Map(), defended: new Map() });
      const target = statsByCountry.get(id).attacked;
      const key = countryMap.get(defenderId);
      target.set(key, (target.get(key) || 0) + damage);
    }

    for (const entry of defList) {
      const id = entry.country.id;
      const damage = entry.value;
      if (!statsByCountry.has(id)) statsByCountry.set(id, { name: countryMap.get(id), attacked: new Map(), defended: new Map() });
      const source = statsByCountry.get(id).defended;
      const key = countryMap.get(attackerId);
      source.set(key, (source.get(key) || 0) + damage);
    }
    
  }
  populateDropdown();
}

function populateDropdown() {
  const select = document.getElementById("countrySelect");
  select.innerHTML = '<option value="">-- Alege o țară --</option>';
  Array.from(statsByCountry.entries())
    .sort((a, b) => a[1].name.localeCompare(b[1].name))
    .forEach(([id, { name }]) => {
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
  const atkArray = Array.from(attacked.entries());
  const defArray = Array.from(defended.entries());
  const max = Math.max(atkArray.length, defArray.length);

  for (let i = 0; i < max; i++) {
    const row = document.createElement("tr");

    const atkNameCell = document.createElement("td");
    const atkDmgCell = document.createElement("td");
    const defNameCell = document.createElement("td");
    const defDmgCell = document.createElement("td");

    if (atkArray[i]) {
      atkNameCell.textContent = atkArray[i][0];
      atkDmgCell.textContent = atkArray[i][1].toLocaleString();
    } else {
      atkNameCell.textContent = "";
      atkDmgCell.textContent = "";
    }

    if (defArray[i]) {
      defNameCell.textContent = defArray[i][0];
      defDmgCell.textContent = defArray[i][1].toLocaleString();
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
