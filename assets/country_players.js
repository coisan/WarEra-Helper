const SKILL_COSTS = [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55];
const FIGHT_SKILLS = ["health", "hunger", "attack", "criticalChance", "criticalDamages", "armor", "precision", "dodge", "lootChance"];
const ECONOMY_SKILLS = ["energy", "companies", "entrepreneurship", "production"];
const API_KEY_STORAGE_KEY = 'warera_api_key';

const countrySelect = document.getElementById("countrySelect");
const usersTableBody = document.querySelector("#usersTable tbody");
const countryMap = new Map();
const muMap = new Map();
let playerChartInstance = null;
let apiKey = null;

import {makeTableSortable} from './config.js';

// =========================================
// API KEY STORAGE FUNCTIONS
// =========================================

function loadApiKeyFromStorage() {
  const stored = localStorage.getItem(API_KEY_STORAGE_KEY);
  if (stored) {
    apiKey = stored;
  }
}

function saveApiKeyToStorage(key) {
  localStorage.setItem(API_KEY_STORAGE_KEY, key);
}

function clearApiKeyFromStorage() {
  localStorage.removeItem(API_KEY_STORAGE_KEY);
  apiKey = null;
}

function getApiKey() {
  if (apiKey) return apiKey;

  const key = window.prompt(
    'Enter your WarEra private API key.\n\nThis is required to fetch transaction data and will be saved for future use.',
    ''
  );

  if (!key || key.trim() === '') {
    throw new Error('API key is required to load player data.');
  }

  apiKey = key.trim();
  saveApiKeyToStorage(apiKey);
  return apiKey;
}

// =========================================
// MODULAR API CALL FUNCTIONS
// =========================================

async function fetchApi(endpoint, input = null, requiresAuth = false) {
  try {
    let url = endpoint;
    if (input) {
      url += "?input=" + encodeURIComponent(JSON.stringify(input));
    }

    const options = {};
    if (requiresAuth) {
      const key = getApiKey();
      options.headers = {
        'x-api-key': key
      };
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (data.error?.data?.code === 'UNAUTHORIZED') {
      clearApiKeyFromStorage();
      throw new Error('Invalid API key. Please reload the page and try again.');
    }

    return data;
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}

async function fetchAllCountries() {
  const data = await fetchApi("https://api2.warera.io/trpc/country.getAllCountries");
  return data.result?.data ?? [];
}

async function fetchUsersByCountry(countryId, cursor = undefined) {
  const input = {
    countryId: countryId,
    limit: 100
  };
  if (cursor) input.cursor = cursor;

  const data = await fetchApi(
    "https://api2.warera.io/trpc/user.getUsersByCountry",
    input,
    true
  );
  return {
    users: data.result?.data?.items ?? [],
    nextCursor: data.result?.data?.nextCursor
  };
}

async function fetchUserLite(userId) {
  const input = { userId: userId };
  const data = await fetchApi(
    "https://api2.warera.io/trpc/user.getUserLite",
    input,
    true
  );
  return data.result?.data ?? null;
}

async function fetchWeeklyTransactions(userId, cursor = undefined) {
  const input = {
    userId: userId,
    limit: 100
  };
  if (cursor) input.cursor = cursor;

  const data = await fetchApi(
    "https://api2.warera.io/trpc/transaction.getPaginatedTransactions",
    input,
    true
  );
  return {
    transactions: data.result?.data?.items ?? [],
    nextCursor: data.result?.data?.nextCursor
  };
}

async function fetchMuName(muId) {
  if (muMap.has(muId)) return muMap.get(muId);
  
  const input = { muId: muId };
  const data = await fetchApi(
    "https://api2.warera.io/trpc/mu.getById",
    input,
    false
  );
  const name = data.result?.data?.name || muId;
  muMap.set(muId, name);
  return name;
}

// =========================================
// UTILITY FUNCTIONS
// =========================================

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
  const diffMs = Math.abs(now - target);

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  return `${hours}h${minutes}m`;
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

function isThisWeek(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  const currentWeekStart = new Date(today.setDate(today.getDate() - today.getDay()));
  currentWeekStart.setHours(0, 0, 0, 0);
  const currentWeekEnd = new Date(currentWeekStart);
  currentWeekEnd.setDate(currentWeekEnd.getDate() + 6);
  
  return date >= currentWeekStart && date <= currentWeekEnd;
}

function formatMoney(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount || 0);
}

// =========================================
// WEEKLY DONATIONS CALCULATION
// =========================================

async function getWeeklyDonations(userId) {
  try {
    let transactionsCursor = undefined;
    let weeklyTotal = 0;
    
    while (true) {
      const { transactions, nextCursor } = await fetchWeeklyTransactions(userId, transactionsCursor);
      
      // Filter for donation-type transactions and this week
      transactions.forEach(trans => {
        if (trans.type && (trans.type.includes('donation') || trans.type.includes('transfer') || trans.type.includes('gift'))) {
          if (isThisWeek(trans.createdAt)) {
            weeklyTotal += trans.money || 0;
          }
        }
      });
      
      transactionsCursor = nextCursor;
      if (!transactionsCursor) break;
    }
    
    return weeklyTotal;
  } catch (error) {
    console.error(`Error fetching donations for user ${userId}:`, error);
    return 0;
  }
}

// =========================================
// UI RENDERING FUNCTIONS
// =========================================

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
    countryMap.set(country._id, country.name);

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
  usersTableBody.innerHTML = "<tr><td colspan='10'>Loading...</td></tr>";
  const countDisplay = document.getElementById("playerCount");
  countDisplay.style.display = "none";
  
  const users = [];
  const levelCounts = {};
  let cursor = undefined;
  let fightCnt = 0, hybridCnt = 0, economyCnt = 0;

  try {
    while (true) {
      const { users: fetchedUsers, nextCursor } = await fetchUsersByCountry(countryId, cursor);

      for (const user of fetchedUsers) {
        const userLite = await fetchUserLite(user._id);
        
        if (!userLite) continue;

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
        const weeklyDonations = await getWeeklyDonations(userId);
        levelCounts[level] = (levelCounts[level] || 0) + 1;

        users.push({ userId, name, level, fightRatio, damage, economyRatio, wealth, weeklyDonations, reset, buff, muName });
      }

      cursor = nextCursor;
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
        <td>${formatMoney(u.weeklyDonations)}</td>
        <td>${u.reset}</td>
        <td>${u.buff}</td>
        <td>${u.muName}</td>
      </tr>
    `).join("");

    makeTableSortable("usersTable");
  } catch (error) {
    console.error('Error loading users:', error);
    alert('Error loading player data: ' + error.message);
    usersTableBody.innerHTML = "<tr><td colspan='10'>Error loading data</td></tr>";
  }
}

// =========================================
// EVENT LISTENERS & INITIALIZATION
// =========================================

countrySelect.addEventListener("change", () => {
  if (playerChartInstance) {
    playerChartInstance.destroy();
  }
  const countryId = countrySelect.value;
  if (countryId) loadUsersByCountry(countryId);
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadApiKeyFromStorage();
  loadCountries();
});
