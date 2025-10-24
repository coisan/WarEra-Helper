function calcDamage(userData) {
  const regenSelect = document.getElementById("regenSelect")
  const total_health = Math.max(0, userData.skills.health.currentBarValue) + Math.floor(Math.max(0, userData.skills.hunger.currentBarValue)) * regenSelect.value;
  const attacks = Math.floor(Math.floor(total_health / (10 * (1 - userData.skills.armor.total/100))) * (1 + userData.skills.dodge.total/100));
  const miss_damage = userData.skills.attack.total * (1 - userData.skills.precision.total/100);
  const normal_damage = userData.skills.attack.total * (userData.skills.precision.total/100) * (1 - userData.skills.criticalChance.total/100);
  const crit_damage = userData.skills.attack.total * (userData.skills.precision.total/100) * (userData.skills.criticalChance.total/100) * (1 + userData.skills.criticalDamages.total/100);
  return attacks * Math.round(miss_damage + normal_damage + crit_damage);
}

function calcFighBuilds() {
  
}
