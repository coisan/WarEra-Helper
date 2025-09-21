const SKILL_COSTS = [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55];
const FIGHT_SKILLS = ["health", "hunger", "attack", "criticalChance", "criticalDamages", "armor", "precision", "dodge", "lootChance"];
const ECONOMY_SKILLS = ["energy", "companies", "entrepreneurship", "production"];

const countrySelect = document.getElementById("countrySelect");
const usersTableBody = document.querySelector("#usersTable tbody");
const countryMap = new Map();
const muMap = new Map();
let playerChartInstance = null;

import {makeTableSortable} from './config.js';

function sumSkillPoints(skillObj, skillNames) {
  return skillNames.reduce((total, key) => {
    const level = skillObj[key]?.level || 0;
    return total + (SKILL_COSTS[level] || 0);
  }, 0);
}

function timeUntilReset(lastResetAt) {
  const last = new Date(lastResetAt);
  const now = new Date();
  const diffMs = now - last;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  if (diffMs >= sevenDaysMs || !lastResetAt) return "available";
  const msLeft = sevenDaysMs - diffMs;
  const days = Math.floor(msLeft / (24 * 60 * 60 * 1000));
  const hours = Math.floor((msLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  return `${days}d ${hours}h`;
}

function getTimeDiffString(targetDate) {
  const now = new Date();
  const target = new Date(targetDate)
  const diffMs = Math.abs(now - target); // ms difference

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  return `${hours}h${minutes}m`;
}

async function fetchMuName(id) {
  if (muMap.has(id)) return muMap.get(id);
  const res = await fetch("https://api2.warera.io/trpc/mu.getById?input=" + encodeURIComponent(JSON.stringify({ muId: id })));
  const data = await res.json();
  const name = data.result?.data?.name || id;
  muMap.set(id, name);
  return name;
}

function checkBuff(userData) {
  if (userData.buffs) {
    if (userData.buffs.buffCodes)
      return "Buff: " + getTimeDiffString(userData.buffs.buffEndAt);
    if (userData.buffs.debuffCodes)
      return "Debuff: " + getTimeDiffString(userData.buffs.debuffEndAt);
  }
  else {
    return "-";
  }
}

async function fetchAllCountries() {
  const res = await fetch("https://api2.warera.io/trpc/country.getAllCountries");
  const data = await res.json();
  return data.result?.data ?? [];
}

async function loadCountries() {
  const select = document.getElementById("countrySelect");
  select.innerHTML = '<option value="">-- Pick one --</option>';
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

function renderChart(data) {
  
    const canvas = document.getElementById("playerChart");
    const labels = Object.keys(data).sort((a, b) => a - b);
    const lvlData = labels.map(lvl => data[lvl]);

    playerChartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Players per Level',
          data: lvlData,
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }]
      },
      options: {
        scales: {
          x: {
            title: { display: true, text: "Level" }
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: "Number of Players" }
          }
        }
      }
    });
}

async function loadUsersByCountry(countryId) {
  usersTableBody.innerHTML = "<tr><td colspan='9'>Loading...</td></tr>";
  const countDisplay = document.getElementById("playerCount");
  countDisplay.style.display = "none";
  
  const users = [];
  const levelCounts = {};
  let cursor = undefined;
  let fightCnt = 0, hybridCnt = 0, economyCnt = 0;

  while (true) {
    const input = {
        "countryId": countryId,
        "limit": 100,
      };
    if (cursor !== undefined) input.cursor = cursor;
    
    const response = await fetch("https://api2.warera.io/trpc/user.getUsersByCountry?input=" + encodeURIComponent(JSON.stringify(input)));
    const data = await response.json();
    const fetchedUsers = data.result.data.items;

    for (const user of fetchedUsers) {
      const input = {
        userId: user._id
      };
      const res = await fetch(`https://api2.warera.io/trpc/user.getUserLite?input=` + encodeURIComponent(JSON.stringify(input)));
      const userLite = (await res.json()).result.data;

      const userId = user._id;
      const name = userLite.username;
      const level = userLite.leveling.level;
      const fight = sumSkillPoints(userLite.skills, FIGHT_SKILLS);
      const damage = userLite.rankings?.weeklyUserDamages?.value.toLocaleString() ?? 0;
      const economy = sumSkillPoints(userLite.skills, ECONOMY_SKILLS);
      const wealth = Math.round(userLite.rankings?.userWealth?.value).toLocaleString() ?? 0;
      const total = fight + economy;
      const fightRatio = total > 0 ? (fight / total * 100).toFixed(0) + "%" : "0%";
      const economyRatio = total > 0 ? (economy / total * 100).toFixed(0) + "%" : "0%";
      if (level >= 3) {
        if (Number(fightRatio.replace('%','')) > 70) fightCnt += 1;
        else if (Number(economyRatio.replace('%','')) > 70) economyCnt += 1;
        else hybridCnt += 1;
      }
      const reset = timeUntilReset(userLite.dates.lastSkillsResetAt);
      const buff = checkBuff(userLite);
      const muName = userLite.mu ? await fetchMuName(userLite.mu) : "-";
      levelCounts[level] = (levelCounts[level] || 0) + 1;

      users.push({ userId, name, level, fightRatio, damage, economyRatio, wealth, reset, buff, muName });
    }

    cursor = data.result?.data?.nextCursor;
    if (!cursor) break;
  }

  countDisplay.style.display = "block";
  countDisplay.innerHTML = `Fight builds (70%+): ${fightCnt}<br>Hybrid builds: ${hybridCnt}<br>Economy builds (70%+): ${economyCnt}`;

  renderChart(levelCounts);
  usersTableBody.innerHTML = users.map(u => `
    <tr>
      <td><a href="https://app.warera.io/user/${u.userId}" target="_blank">${u.name}</a></td>
      <td>${u.level}</td>
      <td>${u.fightRatio}</td>
      <td>${u.damage}</td>
      <td>${u.economyRatio}</td>
      <td>${u.wealth}</td>
      <td>${u.reset}</td>
      <td>${u.buff}</td>
      <td>${u.muName}</td>
    </tr>
  `).join("");

  makeTableSortable("usersTable");
}

countrySelect.addEventListener("change", () => {
  if (playerChartInstance) {
    playerChartInstance.destroy();
  }
  const countryId = countrySelect.value;
  if (countryId) loadUsersByCountry(countryId);
});

loadCountries();
