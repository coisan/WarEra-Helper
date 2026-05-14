// Country Donations Module
// Fetches transaction data from WarEra API and calculates weekly donations per player

const TABLE_ID = 'donationsTable';
const COUNTRY_SELECT_ID = 'countrySelect';
const STATS_ID = 'donationStats';
const LOADING_ID = 'loadingMessage';

let allCountries = [];
let currentCountryId = null;

// API key — prompted once and cached for the session
let apiKey = null;

// Prompt the user for their API key (once per session)
function getApiKey() {
  if (apiKey) return apiKey;

  const key = window.prompt(
    'Enter your WarEra private API key.\n\nThis is required to fetch transaction data and will only be asked once per session.',
    ''
  );

  if (!key || key.trim() === '') {
    throw new Error('API key is required to load donation data.');
  }

  apiKey = key.trim();
  return apiKey;
}

// Initialize page
async function initializeCountryDonations() {
  try {
    // Load countries
    const response = await fetch(
      "https://api2.warera.io/trpc/country.getAllCountries"
    );

    const result = await response.json();

    allCountries = result.result.data || [];

    // Populate country select dropdown
    const countrySelect = document.getElementById(COUNTRY_SELECT_ID);

    if (countrySelect) {
      countrySelect.innerHTML =
        '<option value="">-- Select a country --</option>';

      allCountries.forEach(country => {
        const option = document.createElement('option');
        option.value = country._id;
        option.textContent = country.name;
        countrySelect.appendChild(option);
      });

      countrySelect.addEventListener('change', (e) => {
        currentCountryId = e.target.value;

        if (currentCountryId) {
          loadCountryDonations(currentCountryId);
        } else {
          clearTable();
        }
      });
    }
  } catch (error) {
    console.error('Error initializing country donations:', error);
  }
}

// Load donations for selected country
async function loadCountryDonations(countryId) {
  const loadingMessage = document.getElementById(LOADING_ID);

  if (loadingMessage) {
    loadingMessage.style.display = 'block';
  }

  try {
    const key = getApiKey();

    // Current week start
    const now = new Date();

    const currentWeekStart = new Date(now);

    currentWeekStart.setDate(
      now.getDate() - now.getDay()
    );

    currentWeekStart.setHours(0, 0, 0, 0);

    // =========================================
    // FETCH ALL COUNTRY USERS
    // =========================================

    const allUsers = [];

    let usersCursor = undefined;

    while (true) {
      const input = {
        countryId: countryId,
        limit: 100
      };

      if (usersCursor !== undefined) {
        input.cursor = usersCursor;
      }

      const response = await fetch(
        "https://api2.warera.io/trpc/user.getUsersByCountry?input=" +
          encodeURIComponent(JSON.stringify(input)),
        {
          headers: {
            'x-api-key': key
          }
        }
      );

      const data = await response.json();

      if (data.error?.data?.code === 'UNAUTHORIZED') {
        apiKey = null;

        throw new Error(
          'Invalid API key. Please reload the page and try again.'
        );
      }

      const fetchedUsers =
        data.result.data?.items || [];

      allUsers.push(...fetchedUsers);

      usersCursor =
        data.result.data?.nextCursor;

      if (!usersCursor) {
        break;
      }
    }

    // =========================================
    // FETCH WEEKLY DONATIONS ONLY
    // =========================================

    const weeklyDonations = {};

    let transactionsCursor = undefined;

    while (true) {
      const transInput = {
        countryId: countryId,
        transactionType: 'donation',
        limit: 100
      };

      if (transactionsCursor !== undefined) {
        transInput.cursor = transactionsCursor;
      }

      const transResponse = await fetch(
        "https://api2.warera.io/trpc/transaction.getPaginatedTransactions?input=" +
          encodeURIComponent(JSON.stringify(transInput)),
        {
          headers: {
            'x-api-key': key
          }
        }
      );

      const transResult = await transResponse.json();

      if (transResult.error?.data?.code === 'UNAUTHORIZED') {
        apiKey = null;

        throw new Error(
          'Invalid API key. Please reload the page and try again.'
        );
      }

      const transactions =
        transResult.result.data?.items || [];

      // Stop once older transactions appear
      let reachedOldTransactions = false;

      for (const trans of transactions) {
        const transDate = new Date(trans.createdAt);

        if (transDate < currentWeekStart) {
          reachedOldTransactions = true;
          break;
        }

        const userId = trans.buyerId;

        if (!userId) {
          continue;
        }

        if (!weeklyDonations[userId]) {
          weeklyDonations[userId] = 0;
        }

        weeklyDonations[userId] +=
          trans.money || 0;
      }

      if (reachedOldTransactions) {
        break;
      }

      transactionsCursor =
        transResult.result.data?.nextCursor;

      if (!transactionsCursor) {
        break;
      }
    }

    // =========================================
    // BUILD FINAL TABLE DATA
    // =========================================

    const donationsArray = allUsers.map(user => {
      return {
        userId: user._id,
        userName: user.username || 'Unknown',
        userWealth:
          user.rankings?.userWealth?.value || 0,
        weeklyTotal:
          weeklyDonations[user._id] || 0
      };
    });

    // Sort by weekly donations descending
    donationsArray.sort(
      (a, b) => b.weeklyTotal - a.weeklyTotal
    );

    // =========================================
    // STATS
    // =========================================

    const totalWeeklyDonations =
      donationsArray.reduce(
        (sum, d) => sum + d.weeklyTotal,
        0
      );

    const statsDiv =
      document.getElementById(STATS_ID);

    if (statsDiv) {
      statsDiv.innerHTML = `
        <div style="margin-left: 2rem;">
          <strong>Weekly Donations Total: ${formatMoney(totalWeeklyDonations)}</strong>
          <br>
          <strong>Donors This Week: ${donationsArray.filter(d => d.weeklyTotal > 0).length}</strong>
        </div>
      `;
    }

    // Populate table
    populateTable(donationsArray);

  } catch (error) {
    console.error(
      'Error loading country donations:',
      error
    );

    alert(
      'Error loading donation data: ' +
      error.message
    );

  } finally {
    if (loadingMessage) {
      loadingMessage.style.display = 'none';
    }
  }
}

// Check if date is within current week
function isThisWeek(dateString) {
  const date = new Date(dateString);

  const today = new Date();

  const currentWeekStart = new Date(
    today.setDate(today.getDate() - today.getDay())
  );

  const currentWeekEnd = new Date(currentWeekStart);

  currentWeekEnd.setDate(
    currentWeekEnd.getDate() + 6
  );

  return (
    date >= currentWeekStart &&
    date <= currentWeekEnd
  );
}

// Format money with thousand separators
function formatMoney(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount || 0);
}

// Populate donations table
function populateTable(donations) {
  const tbody = document.querySelector(
    `#${TABLE_ID} tbody`
  );

  if (!tbody) return;

  tbody.innerHTML = '';

  donations.forEach(donation => {
    const row = tbody.insertRow();

    row.innerHTML = `
      <td><strong>${donation.userName || 'Unknown'}</strong></td>
      <td>${formatMoney(donation.userWealth)}</td>
      <td>${formatMoney(donation.weeklyTotal)}</td>
    `;
  });

  setupSorting();
}

// Clear table
function clearTable() {
  const tbody = document.querySelector(
    `#${TABLE_ID} tbody`
  );

  if (tbody) {
    tbody.innerHTML = '';
  }

  const statsDiv =
    document.getElementById(STATS_ID);

  if (statsDiv) {
    statsDiv.innerHTML = '';
  }
}

// Setup table sorting
function setupSorting() {
  const headers = document.querySelectorAll(
    `#${TABLE_ID} th.sortable`
  );

  headers.forEach(header => {
    header.addEventListener('click', () => {
      const columnIndex =
        header.getAttribute('data-column');

      const tbody = document.querySelector(
        `#${TABLE_ID} tbody`
      );

      const rows = Array.from(
        tbody.querySelectorAll('tr')
      );

      const isAsc =
        header.classList.contains('asc');

      // Remove active class from all headers
      headers.forEach(h =>
        h.classList.remove('asc', 'desc')
      );

      // Sort rows
      rows.sort((a, b) => {
        let aVal =
          a.cells[columnIndex].textContent.trim();

        let bVal =
          b.cells[columnIndex].textContent.trim();

        // Try to parse as number
        const aNum = parseFloat(
          aVal.replace(/[$,]/g, '')
        );

        const bNum = parseFloat(
          bVal.replace(/[$,]/g, '')
        );

        if (!isNaN(aNum) && !isNaN(bNum)) {
          return isAsc
            ? aNum - bNum
            : bNum - aNum;
        }

        return isAsc
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      });

      // Add sorted rows back
      rows.forEach(row =>
        tbody.appendChild(row)
      );

      // Add active class to clicked header
      header.classList.add(
        isAsc ? 'desc' : 'asc'
      );
    });
  });
}

// Initialize on page load
document.addEventListener(
  'DOMContentLoaded',
  initializeCountryDonations
);
