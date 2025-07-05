let prices = {};

const itemDisplayOrder = [{
    id: 'lead',
    label: 'Lead',
    class: 'dark-gray'
  },
  {
    id: 'coca',
    label: 'Mysterious plant',
    class: 'dark-gray'
  },
  {
    id: 'iron',
    label: 'Iron',
    class: 'dark-gray'
  },
  {
    id: 'fish',
    label: 'Fish',
    class: 'dark-gray'
  },
  {
    id: 'livestock',
    label: 'Livestock',
    class: 'dark-gray'
  },
  {
    id: 'grain',
    label: 'Grain',
    class: 'dark-gray'
  },
  {
    id: 'limestone',
    label: 'Limestone',
    class: 'dark-gray'
  },
  {
    id: 'lightAmmo',
    label: 'Light ammo',
    class: 'dark-green'
  },
  {
    id: 'bread',
    label: 'Bread',
    class: 'dark-green'
  },
  {
    id: 'steel',
    label: 'Steel',
    class: 'dark-green'
  },
  {
    id: 'concrete',
    label: 'Concrete',
    class: 'dark-green'
  },
  {
    id: 'ammo',
    label: 'Ammo',
    class: 'dark-blue'
  },
  {
    id: 'steak',
    label: 'Steak',
    class: 'dark-blue'
  },
  {
    id: 'heavyAmmo',
    label: 'Heavy ammo',
    class: 'purple'
  },
  {
    id: 'cocain',
    label: 'Pill',
    class: 'purple'
  },
  {
    id: 'cookedFish',
    label: 'Cooked fish',
    class: 'purple'
  }
];

const recipes = {
  grain: {
    pp: 1,
    materials: {}
  },
  coca: {
    pp: 1,
    materials: {}
  },
  lead: {
    pp: 1,
    materials: {}
  },
  iron: {
    pp: 1,
    materials: {}
  },
  limestone: {
    pp: 1,
    materials: {}
  },
  lightAmmo: {
    pp: 1,
    materials: {
      lead: 1
    }
  },
  ammo: {
    pp: 4,
    materials: {
      lead: 4
    }
  },
  livestock: {
    pp: 20,
    materials: {}
  },
  bread: {
    pp: 10,
    materials: {
      grain: 10
    }
  },
  concrete: {
    pp: 10,
    materials: {
      limestone: 10
    }
  },
  steel: {
    pp: 10,
    materials: {
      iron: 10
    }
  },
  heavyAmmo: {
    pp: 16,
    materials: {
      lead: 16
    }
  },
  steak: {
    pp: 20,
    materials: {
      livestock: 1
    }
  },
  fish: {
    pp: 40,
    materials: {}
  },
  cookedFish: {
    pp: 40,
    materials: {
      fish: 1
    }
  },
  cocain: {
    pp: 200,
    materials: {
      coca: 200
    }
  }
};

const currentPage = window.location.pathname;
if (currentPage.includes('calc.html')) {
document.getElementById('nav-calc').style.fontWeight = 'bold';
document.getElementById('nav-calc').style.backgroundColor = '#ddd';
} else if (currentPage.includes('war_stats.html')) {
document.getElementById('nav-stats').style.fontWeight = 'bold';
document.getElementById('nav-stats').style.backgroundColor = '#ddd';
}

async function loadPrices() {
  const res = await fetch('/.netlify/functions/getPrices');
  prices = await res.json();
  calculateAllProfitabilities();
}

function calculateAllProfitabilities() {
  const bonus = parseFloat(document.getElementById('bonusInput').value) || 0;
  const salary = parseFloat(document.getElementById('salaryInput').value);
  if (isNaN(salary)) return;

  const tbody = document.querySelector('#profitTable tbody');
  tbody.innerHTML = '';

  for (const {
      id,
      label,
      class: colorClass
    }
    of itemDisplayOrder) {
    if (!prices[id]) continue;
    const sellPrice = prices[id];
    const recipe = recipes[id];

    const row = document.createElement('tr');
    const itemCell = document.createElement('td');
    itemCell.textContent = label;
    itemCell.className = colorClass;
    row.appendChild(itemCell);

    const priceCell = document.createElement('td');
    priceCell.textContent = sellPrice.toFixed(3);
    row.appendChild(priceCell);

    const marketCell = document.createElement('td');
    if (Object.keys(recipe.materials).length > 0) {
      const marketProfit = calculateProfitability(id, bonus, salary, 'market');
      marketCell.textContent = marketProfit !== null ? (marketProfit * 100).toFixed(2) + '%' : '—';
      marketCell.className = marketProfit > 0 ? 'positive' : 'negative';
    } else {
      marketCell.textContent = '—';
    }
    row.appendChild(marketCell);

    const prodProfit = calculateProfitability(id, bonus, salary, 'production');
    const prodCell = document.createElement('td');
    prodCell.textContent = prodProfit !== null ? (prodProfit * 100).toFixed(2) + '%' : '—';
    prodCell.className = prodProfit > 0 ? 'positive' : 'negative';
    row.appendChild(prodCell);

    tbody.appendChild(row);
  }
}

function calculateProfitability(item, bonus, salary, source) {
  const recipe = recipes[item];
  const sellPrice = prices[item];
  if (!recipe || !sellPrice || sellPrice <= 0) return null;

  if (Object.keys(recipe.materials).length === 0) {
    const pp = recipe.pp / (1 + bonus / 100);
    const cost = pp * salary;
    return (sellPrice - cost) / cost;
  }

  if (source === 'market') {
    let matCost = 0;
    for (const [mat, qty] of Object.entries(recipe.materials)) {
      if (!prices[mat]) return null;
      matCost += prices[mat] * qty;
    }
    const pp = recipe.pp / (1 + bonus / 100);
    const cost = matCost + pp * salary;
    return (sellPrice - cost) / cost;
  }

  if (source === 'production') {
    const totalPP = calculatePPTotal(item, bonus);
    if (totalPP === null) return null;
    const pp = totalPP / (1 + bonus / 100);
    const cost = pp * salary;
    return (sellPrice - cost) / cost;
  }

  return null;
}

function calculatePPTotal(item) {
  const recipe = recipes[item];
  if (!recipe) return null;
  let totalPP = recipe.pp;
  for (const [mat, qty] of Object.entries(recipe.materials)) {
    const subPP = calculatePPTotal(mat);
    if (subPP === null) return null;
    totalPP += subPP * qty;
  }
  return totalPP;
}

loadPrices();
