const SKILL_COSTS = [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55];
const FIGHT_SKILLS = ["health", "hunger", "attack", "criticalChance", "criticalDamages", "armor", "precision", "dodge", "lootChance"];
const ECONOMY_SKILLS = ["energy", "companies", "entrepreneurship", "production"];

const usersTableBody = document.querySelector("#usersTable tbody");
const countryMap = new Map();

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

async function fetchCountryName(id) {
  if (countryMap.has(id)) return countryMap.get(id);
  const res = await fetch("https://api2.warera.io/trpc/country.getCountryById?input=" + encodeURIComponent(JSON.stringify({ countryId: id })));
  const data = await res.json();
  const name = data.result?.data?.name || id;
  countryMap.set(id, name);
  return name;
}

window.generateMuInfo = async function generateMuInfo() {
  usersTableBody.innerHTML = "<tr><td colspan='9'>Loading...</td></tr>";
  const countDisplay = document.getElementById("playerCount");
  countDisplay.style.display = "none";
  
  const muId = document.getElementById("muIdInput").value.trim();
  const users = [];
  let cursor = undefined;
  let fightCnt = 0, hybridCnt = 0, economyCnt = 0;

  const input = {
      "muId": muId,
    };
  const response = await fetch("https://api2.warera.io/trpc/mu.getById?input=" + encodeURIComponent(JSON.stringify(input)));
  const data = await response.json();
  const fetchedUsers = data.result.data.members;
  const muName = data.result.data.name;

  for (const user of fetchedUsers) {
    const input = {
      userId: user
    };
    const res = await fetch(`https://api2.warera.io/trpc/user.getUserLite?input=` + encodeURIComponent(JSON.stringify(input)));
    const userLite = (await res.json()).result.data;
    
    const userId = user;
    const name = userLite.username;
    const country = await fetchCountryName(userLite.country);
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

    users.push({ user, name, country, level, fightRatio, damage, economyRatio, wealth, reset, buff });
  }

  countDisplay.style.display = "block";
  countDisplay.innerHTML = `<br><b>${muName}</b><br>
                            Fight builds (70%+): ${fightCnt}
                            Hybrid builds: ${hybridCnt}
                            Economy builds (70%+): ${economyCnt}`;
  
  usersTableBody.innerHTML = users.map(u => `
    <tr>
      <td><a href="https://app.warera.io/user/${u.userId}" target="_blank">${u.name}</a></td>
      <td>${u.country}</td>
      <td>${u.level}</td>
      <td>${u.fightRatio}</td>
      <td>${u.damage}</td>
      <td>${u.economyRatio}</td>
      <td>${u.wealth}</td>
      <td>${u.reset}</td>
      <td>${u.buff}</td>
    </tr>
  `).join("");

  makeTableSortable("usersTable");
}
