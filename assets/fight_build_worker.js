// =========================
// fight_build_worker.js
// =========================
let prices = {};
// Skill data (values for levels 0–10)
const skillValues = {
  attack:     [100,120,140,160,180,200,220,240,260,280,300],
  precision:  [0.50,0.55,0.60,0.65,0.70,0.75,0.80,0.85,0.90,0.95,1.00],
  critChance: [0.10,0.15,0.20,0.25,0.30,0.35,0.40,0.45,0.50,0.55,0.60],
  critDamage: [1.00,1.20,1.40,1.60,1.80,2.00,2.20,2.40,2.60,2.80,3.00],
  armor:      [0.00,0.04,0.08,0.12,0.16,0.20,0.24,0.28,0.32,0.36,0.40],
  dodge:      [0.00,0.04,0.08,0.12,0.16,0.20,0.24,0.28,0.32,0.36,0.40],
  health:     [50,60,70,80,90,100,110,120,130,140,150],
  hunger:     [4,5,6,7,8,9,10,11,12,13,14]
};

const fight_costRow = [0,1,3,6,10,15,21,28,36,45,55];

const craftTable = {
  common:      { scraps: 6,    steel: 1 },
  uncommon:    { scraps: 18,   steel: 2 },
  rare:        { scraps: 54,   steel: 4 },
  epic:        { scraps: 162,  steel: 8 },
  legendary:   { scraps: 486,  steel: 16 },
  mythic:      { scraps: 1458, steel: 32 }
};

async function loadPrices() {
  const res = await fetch("https://api2.warera.io/trpc/itemTrading.getPrices");
  const data = await res.json();
  return data.result?.data ?? {};
}

function indexToCombo(index, numRows, numCols) {
  const combo = [];
  for (let i=0; i<numRows; i++) {
    combo.unshift(index % numCols);
    index = Math.floor(index / numCols);
  }
  return combo;
}

function evaluateDamage(skills, regenValue, ammoValue) {
  const daily_health = skills.health*2.4 + Math.floor(skills.hunger*2.4)*regenValue;
  const attacks = Math.floor(Math.floor(daily_health / (10*(1-skills.armor))) * (1+skills.dodge));
  const miss_damage = skills.attack * (1-skills.precision) * 0.5;
  const normal_damage = skills.attack * skills.precision * (1-skills.critChance);
  const crit_damage = skills.attack * skills.precision * skills.critChance * (1+skills.critDamage);
  
  return attacks * Math.round((miss_damage + normal_damage + crit_damage) * (1+ammoValue));
}

function evaluateCost(skills, weapon_price, armor_price, ammo_price, food_price) {
  const daily_health = skills.health*2.4 + Math.floor(skills.hunger*2.4)*regenValue;
  const attacks = Math.floor(daily_health / (10*(1-skills.armor)));
  const dodged_attacks = Math.floor(attacks * skills.dodge);

  const food_cost = Math.floor(skills.hunger*2.4) * food_price;
  const ammo_cost = (attacks + dodged_attacks) * ammo_price;
  const weapon_cost = (attacks + dodged_attacks) * (weapon_price / 100);
  const armor_cost = attacks * (armor_price / 100);

  return food_cost + ammo_cost + weapon_cost + armor_cost;
}

// Worker listener
self.onmessage = async function(e) {
  const { spLimit, regenValue, ammoValue, weaponDmg, weaponCritCh, helmetCritDmg, chestArmor, pantsArmor, bootsDodge, glovesPrec, weaponQual, armorQual } = e.data;

  const numSkills = 8, numLevels = 11;
  const totalCombos = Math.pow(numLevels, numSkills);
  const topResults = [];
  let i = 0;
  const chunkSize = 50000;

  prices = await loadPrices();
  const weapon_price = (craftTable[weaponQual].scraps * prices['scraps'] + craftTable[weaponQual].steel * prices['steel']);
  const armor_price = 5 * (craftTable[armorQual].scraps * prices['scraps'] + craftTable[armorQual].steel * prices['steel']);
  let ammo_price = 0, food_price = 0;
  switch (ammoValue) {
      case 0.1:
        ammo_price = prices['lightAmmo'];
        break;
      case 0.2:
        ammo_price = prices['ammo'];
        break;
      case 0.4:
        ammo_price = prices['heavyAmmo'];
        break;
    }
    switch (regenValue) {
      case 10:
        food_price = prices['bread'];
        break;
      case 20:
        food_price = prices['steak'];
        break;
      case 30:
        food_price = prices['cookedFish'];
        break;
    }

  function processChunk() {
    const end = Math.min(i + chunkSize, totalCombos);
    for (; i < end; i++) {
      const combo = indexToCombo(i, numSkills, numLevels);
      const totalCost = combo.reduce((sum,lvl)=>sum+fight_costRow[lvl],0);
      if (totalCost > spLimit) continue;

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
      const daily_cost = evaluateCost(skills, weapon_price, armor_price, ammo_price, food_price);
      topResults.push({ combo, totalCost, daily_damage, daily_cost });
    }

    self.postMessage({ progress: Math.floor((i/totalCombos)*100) });

    if (i < totalCombos) setTimeout(processChunk,0);
    else {
      topResults.sort((a,b)=>b.daily_damage - a.daily_damage);
      self.postMessage({ done:true, results: topResults.slice(0,10) });
    }
  }

  processChunk();
};
