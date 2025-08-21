export const itemDisplayOrder = [{
    id: 'petroleum',
    label: 'Petroleum',
    class: 'dark-gray'
  },
  {
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
    id: 'oil',
    label: 'Oil',
    class: 'dark-green'
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
  },
  {
    id: 'case1',
    label: 'Case',
    class: 'gold'
  }
];

export const recipes = {
  grain: {
    pp: 1,
    materials: {}
  },
  petroleum: {
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
  oil: {
    pp: 1,
    materials: {
      petroleum: 1
    }
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

export function makeTableSortable(tableId) {
  const table = document.getElementById(tableId);
  const headers = table.querySelectorAll("th");
  let currentSort = { column: null, ascending: true };

  headers.forEach(th => {
    const colIndex = parseInt(th.dataset.column);
    th.classList.add('sortable');

    th.addEventListener("click", () => {
      const ascending = currentSort.column === colIndex ? !currentSort.ascending : true;
      currentSort = { column: colIndex, ascending };

      headers.forEach(h => h.classList.remove('asc', 'desc'));
      th.classList.add(ascending ? 'asc' : 'desc');

      const tbody = table.querySelector("tbody");
      const rows = Array.from(tbody.querySelectorAll("tr"));

      rows.sort((a, b) => {
        const cellA = a.children[colIndex].textContent.trim().replaceAll(',', '');
        const cellB = b.children[colIndex].textContent.trim().replaceAll(',', '');

        const numA = parseFloat(cellA);
        const numB = parseFloat(cellB);

        const isNumeric = !isNaN(numA) && !isNaN(numB);

        if (isNumeric) {
          return ascending ? numA - numB : numB - numA;
        } else {
          return ascending
            ? cellA.localeCompare(cellB)
            : cellB.localeCompare(cellA);
        }
      });

      tbody.innerHTML = "";
      rows.forEach(row => tbody.appendChild(row));
    });
  });
}

const navMap = {
    '/': 'nav-prodprofit',
    'production_profit.html': 'nav-prodprofit',
    'market_stats.html': 'nav-marketstats',
    'price_history.html': 'nav-itemprice',
    'premium_info.html': 'nav-premiuminfo',
    'country_wars.html': 'nav-countrywars',
    'country_players.html': 'nav-countryplayers',
    'country_overview.html': 'nav-countryoverview'
};

const currentPath = window.location.pathname;
for (const key in navMap) {
  if (currentPath.endsWith(key) || currentPath === key) {
    const navElement = document.getElementById(navMap[key]);
    if (navElement) {
      navElement.classList.add('active-nav');
    }
    break;
  }
}
