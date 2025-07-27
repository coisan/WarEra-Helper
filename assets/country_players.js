const SKILL_COSTS = [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55];
const FIGHT_SKILLS = ["health", "hunger", "attack", "criticalChance", "criticalDamages", "armor", "precision", "dodge", "lootChance"];
const ECONOMY_SKILLS = ["energy", "companies", "entrepreneurship", "production"];

const countrySelect = document.getElementById("countrySelect");
const usersTableBody = document.querySelector("#usersTable tbody");

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

  if (diffMs >= sevenDaysMs) return "available";
  const msLeft = sevenDaysMs - diffMs;
  const days = Math.floor(msLeft / (24 * 60 * 60 * 1000));
  const hours = Math.floor((msLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  return `${days}d ${hours}h`;
}

async function loadCountries() {
  const res = await fetch("https://api2.warera.io/trpc/country.getAllCountries");
  const countries = await res.json();
  countries.result.data.forEach(country => {
    const option = document.createElement("option");
    option.value = country._id;
    option.textContent = country.name;
    countrySelect.appendChild(option);
  });
}

async function loadUsersByCountry(countryId) {
  usersTableBody.innerHTML = "<tr><td colspan='5'>Loading...</td></tr>";
  const users = [];
  let cursor = undefined;

  while (true) {
    const input = {
        "countryId": countryId,
        "limit": 100,
        "cursor": cursor
      };
    if (cursor !== undefined) input.cursor = cursor;
    const response = await fetch("https://api2.warera.io/trpc/user/getUsersByCountry?input=" + encodeURIComponent(JSON.stringify(input)));
    const data = await response.json();
    const fetchedUsers = data.result.data.users;
    cursor = data.result.data.nextCursor;

    for (const user of fetchedUsers) {
      const input = {
        userId: user._id
      };
      const res = await fetch(`https://api2.warera.io/trpc/user.getUserLite?input=` + encodeURIComponent(JSON.stringify(input)));
      const userLite = (await res.json()).result.data;

      const name = userLite.username;
      const level = userLite.leveling.level;
      const fight = sumSkillPoints(userLite.skills, FIGHT_SKILLS);
      const economy = sumSkillPoints(userLite.skills, ECONOMY_SKILLS);
      const total = fight + economy;
      const fightRatio = total > 0 ? (fight / total * 100).toFixed(0) + "%" : "0%";
      const economyRatio = total > 0 ? (economy / total * 100).toFixed(0) + "%" : "0%";
      const reset = timeUntilReset(userLite.dates.lastSkillsResetAt);

      users.push({ name, level, fightRatio, economyRatio, reset });
    }

    cursor = result.result?.data?.nextCursor;
    if (!cursor) break;
  }
  
  usersTableBody.innerHTML = users.map(u => `
    <tr>
      <td>${u.name}</td>
      <td>${u.level}</td>
      <td>${u.fightRatio}</td>
      <td>${u.economyRatio}</td>
      <td>${u.reset}</td>
    </tr>
  `).join("");
}

countrySelect.addEventListener("change", () => {
  const countryId = countrySelect.value;
  if (countryId) loadUsersByCountry(countryId);
});

loadCountries();
