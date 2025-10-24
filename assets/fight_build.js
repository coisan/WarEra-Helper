// ==============================
// FIGHT BUILD CALCULATOR
// ==============================

// Called by the "Generate" button in the HTML
window.calcFightBuilds = function () {
  // === 1. Read all input values ===
  const spLimit = parseInt(document.getElementById("spInput").value) || 0;
  const regenValue = parseFloat(document.getElementById("regenSelect").value) || 0;
  const ammoValue = parseFloat(document.getElementById("ammoSelect").value) || 0;

  const weaponDmg = parseFloat(document.getElementById("weaponDmg").value) || 0;
  const weaponCritCh = parseFloat(document.getElementById("weaponCritCh").value) || 0;
  const helmetCritDmg = parseFloat(document.getElementById("helmetCritDmg").value) || 0;
  const chestArmor = parseFloat(document.getElementById("chestArmor").value) || 0;
  const pantsArmor = parseFloat(document.getElementById("pantsArmor").value) || 0;
  const bootsDodge = parseFloat(document.getElementById("bootsDodge").value) || 0;
  const glovesPrec = parseFloat(document.getElementById("glovesPrec").value) || 0;

  // === 2. Define skill categories ===
  const skillNames = [
    "attack",
    "precision",
    "criticalChance",
    "criticalDamage",
    "armor",
    "dodge",
    "health",
    "hunger",
  ];

  // === 3. Equipment bonuses (equivalent to fight_itemBonuses) ===
  const itemBonuses = {
    attack: weaponDmg,
    precision: glovesPrec,
    criticalChance: weaponCritCh,
    criticalDamage: helmetCritDmg,
    armor: chestArmor + pantsArmor,
    dodge: bootsDodge,
    health: 0,
    hunger: 0,
  };

  // === 4. Skill level cost table (fight_costRow equivalent) ===
  // Level -> cumulative cost
  const skillCosts = [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55];
  const MAX_LEVEL = skillCosts.length - 1; // 10

  const POINT_TOLERANCE = 4; // allow slight under-spend like in AppScript

  const topResults = [];

  // === 5. Brute-force generate all skill combinations ===
  const combos = [];
  function generateCombos(index, current) {
    if (index === skillNames.length) {
      const totalCost = current.reduce((sum, lvl) => sum + skillCosts[lvl], 0);
      if (totalCost <= spLimit && totalCost >= spLimit - POINT_TOLERANCE) {
        combos.push({ levels: [...current], totalCost });
      }
      return;
    }

    for (let lvl = 0; lvl <= MAX_LEVEL; lvl++) {
      current[index] = lvl;
      generateCombos(index + 1, current);
    }
  }

  generateCombos(0, Array(skillNames.length).fill(0));
  console.log(`Generated ${combos.length.toLocaleString()} possible skill configurations.`);

  // === 6. Evaluate each combination ===
  for (const { levels, totalCost } of combos) {
    const skills = {};
    skillNames.forEach((name, i) => {
      skills[name] = levels[i] + (itemBonuses[name] || 0);
    });

    const daily_damage = evaluateDamage(skills, regenValue);

    topResults.push({
      daily_damage,
      cost: totalCost,
      ...skills,
    });
  }

  // === 7. Sort by best total damage ===
  const sorted = topResults.sort((a, b) => b.daily_damage - a.daily_damage).slice(0, 50);

  // === 8. Display results ===
  const tbody = document.querySelector("#skillsTable tbody");
  tbody.innerHTML = "";

  for (const r of sorted) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.daily_damage}</td>
      <td>${r.cost}</td>
      <td>${r.attack.toFixed(1)}</td>
      <td>${r.precision.toFixed(1)}</td>
      <td>${r.criticalChance.toFixed(1)}</td>
      <td>${r.criticalDamage.toFixed(1)}</td>
      <td>${r.armor.toFixed(1)}</td>
      <td>${r.dodge.toFixed(1)}</td>
      <td>${r.health.toFixed(1)}</td>
      <td>${r.hunger.toFixed(1)}</td>
    `;
    tbody.appendChild(tr);
  }

  console.log("Calculation complete. Displaying top 50 results.");
};

// ==============================
// DAMAGE EVALUATION FUNCTION
// ==============================
function evaluateDamage(skills, regenValue) {
  // Adapted from your calcDamage / evaluate_fight logic
  const total_health =
    Math.max(0, skills.health) + Math.floor(Math.max(0, skills.hunger)) * regenValue;

  const attacks = Math.floor(
    Math.floor(total_health / (10 * (1 - skills.armor / 100))) * (1 + skills.dodge / 100)
  );

  const miss_damage = skills.attack * (1 - skills.precision / 100);
  const normal_damage =
    skills.attack * (skills.precision / 100) * (1 - skills.criticalChance / 100);
  const crit_damage =
    skills.attack *
    (skills.precision / 100) *
    (skills.criticalChance / 100) *
    (1 + skills.criticalDamage / 100);

  const daily_damage = attacks * Math.round(miss_damage + normal_damage + crit_damage);
  return daily_damage;
}

// ==============================
// SIMPLE TABLE SORTING HELPER
// ==============================
document.addEventListener("click", (e) => {
  const th = e.target.closest("th.sortable");
  if (!th) return;

  const table = th.closest("table");
  const columnIndex = parseInt(th.dataset.column, 10);
  const rows = Array.from(table.querySelectorAll("tbody tr"));

  const asc = !th.classList.contains("asc");
  rows.sort((a, b) => {
    const aVal = parseFloat(a.children[columnIndex].textContent) || 0;
    const bVal = parseFloat(b.children[columnIndex].textContent) || 0;
    return asc ? aVal - bVal : bVal - aVal;
  });

  table.querySelector("tbody").append(...rows);
  table.querySelectorAll("th.sortable").forEach((h) => h.classList.remove("asc", "desc"));
  th.classList.add(asc ? "asc" : "desc");
});
