// =========================
// fight_build.js
// =========================

// Skill data
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

// Clamp & visually update inputs
function clampInput(id,min,max){
  const input=document.getElementById(id);
  let value=parseFloat(input.value);
  if(isNaN(value)) value=min;
  if(value<min) value=min;
  if(value>max) value=max;
  input.value=value;
  return value;
}

// Populate dropdowns
function populateRegens(){
  const regenSelect=document.getElementById("regenSelect");
  [{value:"10",text:"Bread (10 hp)"},
   {value:"20",text:"Steak (20 hp)"},
   {value:"30",text:"Cooked fish (30 hp)"}]
  .forEach(({value,text})=>{
    const opt=document.createElement("option"); opt.value=value; opt.textContent=text; regenSelect.appendChild(opt);
  });
}

function populateAmmo(){
  const ammoSelect=document.getElementById("ammoSelect");
  [{value:"0.1",text:"Light ammo (10%)"},
   {value:"0.2",text:"Ammo (20%)"},
   {value:"0.3",text:"Heavy ammo (30%)"}]
  .forEach(({value,text})=>{
    const opt=document.createElement("option"); opt.value=value; opt.textContent=text; ammoSelect.appendChild(opt);
  });
}

function populateEquipment() {
  const weaponSelect = document.getElementById("weaponSelect");
  const armorSelect  = document.getElementById("armorSelect");

  const options = [
    { value: "common",    text: "Common" },
    { value: "uncommon",  text: "Uncommon" },
    { value: "rare",      text: "Rare" },
    { value: "epic",      text: "Epic" },
    { value: "legendary", text: "Legendary" },
    { value: "mythic",    text: "Mythic" }
  ];

  [weaponSelect, armorSelect].forEach(select => {
    options.forEach(({ value, text }) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = text;
      select.appendChild(opt);
    });
  });
}

// Main calculation using Web Worker
window.calcFightBuilds = function() {
  const tbody = document.querySelector("#skillsTable tbody");
  tbody.innerHTML = "<tr><td colspan='10'>Calculating best builds... 0% (estimating time...)</td></tr>";

  const spLimit       = clampInput("spInput",0,120);
  const regenValue    = parseFloat(document.getElementById("regenSelect").value);
  const ammoValue     = parseFloat(document.getElementById("ammoSelect").value);
  const weaponDmg     = clampInput("weaponDmg",0,280);
  const weaponCritCh  = clampInput("weaponCritCh",0,40)/100;
  const helmetCritDmg = clampInput("helmetCritDmg",0,80)/100;
  const chestArmor    = clampInput("chestArmor",0,40)/100;
  const pantsArmor    = clampInput("pantsArmor",0,40)/100;
  const bootsDodge    = clampInput("bootsDodge",0,40)/100;
  const glovesPrec    = clampInput("glovesPrec",0,40)/100;

  const worker = new Worker("assets/fight_build_worker.js");

  let startTime = Date.now();

  worker.onmessage = function(e) {
    if (e.data.progress !== undefined) {
      const percent = e.data.progress;
      const elapsed = (Date.now() - startTime)/1000; // seconds
      const estTotal = elapsed / (percent/100);
      const remaining = Math.max(0, estTotal - elapsed);
      
      // Format remaining as mm:ss
      const min = Math.floor(remaining/60);
      const sec = Math.floor(remaining%60).toString().padStart(2,'0');

      tbody.innerHTML = `<tr><td colspan='10'>Calculating best builds... ${percent}% (ETA: ${min}:${sec})</td></tr>`;
    } else if (e.data.done) {
      tbody.innerHTML = "";
      e.data.results.forEach(r => {
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
      });
      worker.terminate();
    }
  };

  worker.postMessage({spLimit, regenValue, ammoValue, weaponDmg, weaponCritCh, helmetCritDmg, chestArmor, pantsArmor, bootsDodge, glovesPrec});
};

// Initialize dropdowns
document.addEventListener("DOMContentLoaded",()=>{
  populateRegens();
  populateAmmo();
  populateEquipment();
});
