// ==============================
// FIGHT BUILD CALCULATOR
// ==============================

// === Run on page load to populate dropdowns ===
window.addEventListener("DOMContentLoaded", () => {
  populateRegens();
  populateAmmos();
});

// === Populate the health regen options ===
function populateRegens() {
  const regenSelect = document.getElementById("regenSelect");
  const options = [
    { value: "10", text: "Bread (10 hp)" },
    { value: "20", text: "Steak (20 hp)" },
    { value: "30", text: "Cooked fish (30 hp)" },
  ];

  for (const { value, text } of options) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    regenSelect.appendChild(option);
  }
}

// === Populate the ammo type options ===
function populateAmmos() {
  const ammoSelect = document.getElementById("ammoSelect");
  const options = [
    { value: "0.1", text: "Light ammo (10%)" },
    { value: "0.2", text: "Ammo (20%)" },
    { value: "0.3", text: "Heavy ammo (30%)" },
  ];

  for (const { value, text } of options) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    ammoSelect.appendChild(option);
  }
}

// ==============================
// MAIN BUILD GENERATOR
// ==============================

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

  // === 3. Equipment bonuses (fight_itemBonuses equivalent) ===
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

  // === 4. Skill level cost table (fight_costRow) ===
  const skillCosts = [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55];
  const MAX_LEVEL = skillCosts.length - 1;
  const POINT_TOLERANCE = 4;

  const topResults = [];

  // === 5. Generate all possible skill combinations ===
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

    const daily_damage = evaluateDamage(skills, regenValue, ammoValue);

    topResults.push({
      daily_damage,
      cost: totalCost,
      ...skills,
    });
  }

  // === 7. Sort and display results ===
  const sorted = topResults.sort((a, b) => b.daily_damage - a.daily_damage).slice(0, 50);
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

function evaluateDamage(skills, regenValue, ammoValue) {
  // === Daily health from AppScript logic ===
  const daily_health = skills.health * 2.4 + Math.floor(skills.hunger * 2.4) * regenValue;

  const attacks = Math.floor(
    Math.floor(daily_health / (10 * (1 - skills.armor / 100))) * (1 + skills.dodge / 100)
  );

  const miss_damage = skills.attack * (1 - skills.precision / 100);
  const normal_damage =
    skills.attack * (skills.precision / 100) * (1 - skills.criticalChance / 100);
  const crit_damage =
    skills.attack *
    (skills.precision / 100) *
    (skills.criticalChance / 100) *
    (1 + skills.criticalDamage / 100);

  // Apply ammo bonus multiplier
  const daily_damage =
    attacks * Math.round((miss_damage + normal_damage + crit_damage) * (1 + ammoValue));

  return daily_damage;
}
