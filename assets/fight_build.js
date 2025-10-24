// =========================
// fight_build.js
// =========================

// --- Skill data (values for levels 0–10) ---
const skillValues = {
  attack:     [100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300],
  precision:  [0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 1.00],
  critChance: [0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60],
  critDamage: [1.00, 1.20, 1.40, 1.60, 1.80, 2.00, 2.20, 2.40, 2.60, 2.80, 3.00],
  armor:      [0.00, 0.04, 0.08, 0.12, 0.16, 0.20, 0.24, 0.28, 0.32, 0.36, 0.40],
  dodge:      [0.00, 0.04, 0.08, 0.12, 0.16, 0.20, 0.24, 0.28, 0.32, 0.36, 0.40],
  health:     [50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150],
  hunger:     [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
};

// --- Skill point cost for levels 0–10 ---
const fight_costRow = [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55];

function clampInput(id, min, max) {
  const input = document.getElementById(id);
  let value = parseFloat(input.value);
  if (isNaN(value)) value = min;        // default if user typed non-number
  if (value < min) value = min;         // clamp to min
  if (value > max) value = max;         // clamp to max
  input.value = value;                  // update the input visually
  return value;                         // return the safe value
}

// --- Populate regenSelect dropdown ---
function populateRegens() {
  const regenSelect = document.getElementById("regenSelect");
  const options = [
    { value: "10", text: "Bread (10 hp)" },
    { value: "20", text: "Steak (20 hp)" },
    { value: "30", text: "Cooked fish (30 hp)" }
  ];
  for (const { value, text } of options) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    regenSelect.appendChild(option);
  }
}

// --- Populate ammoSelect dropdown ---
function populateAmmo() {
  const ammoSelect = document.getElementById("ammoSelect");
  const options = [
    { value: "0.1", text: "Light ammo (10%)" },
    { value: "0.2", text: "Ammo (20%)" },
    { value: "0.3", text: "Heavy ammo (30%)" }
  ];
  for (const { value, text } of options) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    ammoSelect.appendChild(option);
  }
}

// --- Convert single index to skill combo ---
function indexToCombo(index, numRows, numCols) {
  const combo = [];
  for (let i = 0; i < numRows; i++) {
    combo.unshift(index % numCols);
    index = Math.floor(index / numCols);
  }
  return combo;
}

// --- Damage evaluation function ---
function evaluateDamage(skills, regenValue, ammoValue) {
  const daily_health = skills.health * 2.4 + Math.floor(skills.hunger * 2.4) * regenValue;

  const attacks = Math.floor(
    Math.floor(daily_health / (10 * (1 - skills.armor))) * (1 + skills.dodge)
  );

  const miss_damage = skills.attack * (1 - skills.precision) * 0.5;
  const normal_damage = skills.attack * skills.precision * (1 - skills.critChance);
  const crit_damage = skills.attack * skills.precision * skills.critChance * (1 + skills.critDamage);

  const daily_damage = attacks * Math.round((miss_damage + normal_damage + crit_damage) * (1 + ammoValue));

  return daily_damage;
}

// --- Main calculation function with progress update ---
window.calcFightBuilds = function calcFightBuilds() {
  const tbody = document.querySelector("#skillsTable tbody");
  tbody.innerHTML = "<tr><td colspan='10'>Calculating best builds... 0%</td></tr>";

  const regenValue = parseFloat(document.getElementById("regenSelect").value || "0");
  const ammoValue = parseFloat(document.getElementById("ammoSelect").value || "0");

  // --- Read equipment bonuses ---
  const spLimit       = clampInput("spInput", 0, 120);
  const weaponDmg     = clampInput("weaponDmg", 0, 280);
  const weaponCritCh  = clampInput("weaponCritCh", 0, 40)/100;
  const helmetCritDmg = clampInput("helmetCritDmg", 0, 80)/100;
  const chestArmor    = clampInput("chestArmor", 0, 40)/100;
  const pantsArmor    = clampInput("pantsArmor", 0, 40)/100;
  const bootsDodge    = clampInput("bootsDodge", 0, 40)/100;
  const glovesPrec    = clampInput("glovesPrec", 0, 40)/100;

  const numSkills = 8;
  const numLevels = 11;
  const totalCombos = Math.pow(numLevels, numSkills);

  const topResults = [];
  let i = 0;
  const chunkSize = 50000; // combos per chunk

  function processChunk() {
    const end = Math.min(i + chunkSize, totalCombos);
    for (; i < end; i++) {
      const combo = indexToCombo(i, numSkills, numLevels);
      const totalCost = combo.reduce((sum, lvl) => sum + fight_costRow[lvl], 0);
      if (totalCost > spLimit) continue;

      // --- Combine skills + equipment bonuses ---
      const skills = {
        attack: skillValues.attack[combo[0]] + weaponDmg,
        precision: skillValues.precision[combo[1]] + glovesPrec,
        critChance: skillValues.critChance[combo[2]] + weaponCritCh,
        critDamage: skillValues.critDamage[combo[3]] + helmetCritDmg,
        armor: skillValues.armor[combo[4]] + chestArmor + pantsArmor,
        dodge: skillValues.dodge[combo[5]] + bootsDodge,
        health: skillValues.health[combo[6]],
        hunger: skillValues.hunger[combo[7]]
      };

      const daily_damage = evaluateDamage(skills, regenValue, ammoValue);

      topResults.push({
        combo,
        skills,
        totalCost,
        daily_damage
      });
    }

    // Update progress %
    const percent = Math.floor((i / totalCombos) * 100);
    tbody.innerHTML = `<tr><td colspan='10'>Calculating best builds... ${percent}%</td></tr>`;

    if (i < totalCombos) {
      setTimeout(processChunk, 0);
    } else {
      // Done — show top 10 results
      topResults.sort((a, b) => b.daily_damage - a.daily_damage);
      const best10 = topResults.slice(0, 10);

      tbody.innerHTML = "";
      for (const r of best10) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${r.daily_damage}</td>
          <td>${r.totalCost}</td>
          <td>${skillValues.attack[r.combo[0]]}</td>
          <td>${Math.round(skillValues.precision[r.combo[1]]*100)}%</td>
          <td>${Math.round(skillValues.critChance[r.combo[2]]*100)}%</td>
          <td>${Math.round(skillValues.critDamage[r.combo[3]]*100)}%</td>
          <td>${Math.round(skillValues.armor[r.combo[4]]*100)}%</td>
          <td>${Math.round(skillValues.dodge[r.combo[5]]*100)}%</td>
          <td>${skillValues.health[r.combo[6]]}</td>
          <td>${skillValues.hunger[r.combo[7]]}</td>
        `;
        tbody.appendChild(tr);
      }
    }
  }

  processChunk();
};

// --- Initialize dropdowns on page load ---
document.addEventListener("DOMContentLoaded", () => {
  populateRegens();
  populateAmmo();
});
