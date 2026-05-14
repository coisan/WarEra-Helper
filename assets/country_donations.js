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
    const response = await fetch("https://api2.warera.io/trpc/country.getAllCountries");
    const result = await response.json();
    allCountries = result.result.data || [];
    
    // Populate country select dropdown
    const countrySelect = document.getElementById(COUNTRY_SELECT_ID);
    if (countrySelect) {
      countrySelect.innerHTML = '<option value="">-- Select a country --</option>';
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
  if (loadingMessage) loadingMessage.style.display = 'block';
  
  try {
    // Ensure we have the API key before making authenticated requests
    const key = getApiKey();

    // Fetch all donation transactions for the selected country in one paginated stream
    const allTransactions = [];
    let transactionsCursor = undefined;

    while (true) {
      const transInput = {
        "countryId": countryId,
        "transactionType": "donation",
        "limit": 100
      };
      if (transactionsCursor !== undefined) transInput.cursor = transactionsCursor;

      const transResponse = await fetch(
        "https://api2.warera.io/trpc/transaction.getPaginatedTransactions?input=" + encodeURIComponent(JSON.stringify(transInput)),
        {
          headers: {
            'x-api-key': key
          }
        }
      );
      const transResult = await transResponse.json();

      // If the API returns an auth error, clear the cached key so the user
      // can re-enter it on their next attempt
      if (transResult.error?.data?.code === 'UNAUTHORIZED') {
        apiKey = null;
        throw new Error('Invalid API key. Please reload the page and try again.');
      }

      const transactions = transResult.result.data?.items || [];
      allTransactions.push(...transactions);

      transactionsCursor = transResult.result.data?.nextCursor;
      if (!transactionsCursor) break;
    }

    // Aggregate donation data per user
    const donationData = {};
    
    // Cache usernames by userId
    const userCache = {};
    
    // Extract unique user IDs
    const uniqueUserIds = [
      ...new Set(
        allTransactions
          .map(t => t.buyerId)
          .filter(Boolean)
      )
    ];
    
    // Fetch each user only once
    await Promise.all(
      uniqueUserIds.map(async (userId) => {
        try {
          const input = { userId };
    
          const res = await fetch(
            "https://api2.warera.io/trpc/user.getUserLite?input=" +
            encodeURIComponent(JSON.stringify(input))
          );
    
          const result = await res.json();
    
          userCache[userId] =
            result.result?.data?.username || 'Unknown';
        } catch (err) {
          console.error(`Failed loading user ${userId}:`, err);
          userCache[userId] = 'Unknown';
        }
      })
    );
    
    // Process transactions
    for (const trans of allTransactions) {
      const userId = trans.buyerId;
    
      if (!userId) continue;
    
      const fallbackUserName =
        trans.username ||
        trans.fromUsername ||
        trans.senderName ||
        'Unknown';
    
      const userName =
        userCache[userId] || fallbackUserName;
    
      if (!donationData[userId]) {
        donationData[userId] = {
          userId,
          userName,
          weeklyTotal: 0,
          totalDonations: 0,
          lastDonation: null,
          transactionCount: 0
        };
      }
    
      donationData[userId].transactionCount++;
      donationData[userId].totalDonations += trans.money || 0;
    
      // Check if donation is from this week
      if (isThisWeek(trans.createdAt)) {
        donationData[userId].weeklyTotal += trans.money || 0;
      }
    
      // Track most recent donation
      const donationDate = new Date(trans.createdAt);
    
      if (
        !donationData[userId].lastDonation ||
        donationDate > new Date(donationData[userId].lastDonation)
      ) {
        donationData[userId].lastDonation = trans.createdAt;
      }
    }
    
    // Filter users with donations
    const donationsArray = Object.values(donationData).filter(d => d.transactionCount > 0);
    
    // Sort by weekly donations
    donationsArray.sort((a, b) => b.weeklyTotal - a.weeklyTotal);
    
    // Update statistics
    const totalWeeklyDonations = donationsArray.reduce((sum, d) => sum + d.weeklyTotal, 0);
    const statsDiv = document.getElementById(STATS_ID);
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
    console.error('Error loading country donations:', error);
    alert('Error loading donation data: ' + error.message);
  } finally {
    if (loadingMessage) loadingMessage.style.display = 'none';
  }
}

// Check if date is within current week
function isThisWeek(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  const currentWeekStart = new Date(today.setDate(today.getDate() - today.getDay()));
  const currentWeekEnd = new Date(currentWeekStart);
  currentWeekEnd.setDate(currentWeekEnd.getDate() + 6);
  
  return date >= currentWeekStart && date <= currentWeekEnd;
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
  const tbody = document.querySelector(`#${TABLE_ID} tbody`);
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  donations.forEach(donation => {
    const row = tbody.insertRow();
    row.innerHTML = `
      <td><strong>${donation.userName || 'Unknown'}</strong></td>
      <td>${formatMoney(donation.weeklyTotal)}</td>
      <td>${formatMoney(donation.totalDonations)}</td>
      <td>${donation.lastDonation ? new Date(donation.lastDonation).toLocaleDateString() : 'N/A'}</td>
    `;
  });
  
  setupSorting();
}

// Clear table
function clearTable() {
  const tbody = document.querySelector(`#${TABLE_ID} tbody`);
  if (tbody) tbody.innerHTML = '';
  
  const statsDiv = document.getElementById(STATS_ID);
  if (statsDiv) statsDiv.innerHTML = '';
}

// Setup table sorting
function setupSorting() {
  const headers = document.querySelectorAll(`#${TABLE_ID} th.sortable`);
  headers.forEach(header => {
    header.addEventListener('click', () => {
      const columnIndex = header.getAttribute('data-column');
      const tbody = document.querySelector(`#${TABLE_ID} tbody`);
      const rows = Array.from(tbody.querySelectorAll('tr'));
      
      const isAsc = header.classList.contains('asc');
      
      // Remove active class from all headers
      headers.forEach(h => h.classList.remove('asc', 'desc'));
      
      // Sort rows
      rows.sort((a, b) => {
        let aVal = a.cells[columnIndex].textContent.trim();
        let bVal = b.cells[columnIndex].textContent.trim();
        
        // Try to parse as number
        const aNum = parseFloat(aVal.replace(/[$,]/g, ''));
        const bNum = parseFloat(bVal.replace(/[$,]/g, ''));
        
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return isAsc ? aNum - bNum : bNum - aNum;
        }
        
        return isAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });
      
      // Add sorted rows back
      rows.forEach(row => tbody.appendChild(row));
      
      // Add active class to clicked header
      header.classList.add(isAsc ? 'desc' : 'asc');
    });
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initializeCountryDonations);
