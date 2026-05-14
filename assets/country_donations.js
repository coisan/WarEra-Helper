// Country Donations Module
// Fetches transaction data from WarEra API and calculates weekly donations per player

import { API_BASE_URL } from './config.js';

const TABLE_ID = 'donationsTable';
const COUNTRY_SELECT_ID = 'countrySelect';
const STATS_ID = 'donationStats';
const LOADING_ID = 'loadingMessage';

let allCountries = [];
let currentCountryId = null;

// Initialize page
async function initializeCountryDonations() {
  try {
    // Load countries
    const response = await fetch(`${API_BASE_URL}/country.getAllCountries`);
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
    // Get all users in country
    const usersResponse = await fetch(`${API_BASE_URL}/user.getUsersByCountry?countryId=${countryId}&limit=1000`);
    const usersResult = await usersResponse.json();
    const users = usersResult.result.data?.items || [];
    
    // Collect transaction data for all users
    const donationData = {};
    
    for (const userSummary of users) {
      const userId = userSummary._id;
      try {
        // Get transactions for this user
        const transResponse = await fetch(`${API_BASE_URL}/transaction.getPaginatedTransactions?userId=${userId}&limit=1000`);
        const transResult = transResponse.json();
        
        const transactions = (await transResult).result.data?.items || [];
        
        // Filter for donation-type transactions (looking for financial transfers)
        transactions.forEach(trans => {
          if (trans.type && (trans.type.includes('donation') || trans.type.includes('transfer') || trans.type.includes('gift'))) {
            if (!donationData[userId]) {
              donationData[userId] = {
                userId: userId,
                userName: userSummary.username || 'Unknown',
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
            if (!donationData[userId].lastDonation || donationDate > new Date(donationData[userId].lastDonation)) {
              donationData[userId].lastDonation = trans.createdAt;
            }
          }
        });
      } catch (error) {
        console.error(`Error fetching transactions for user ${userId}:`, error);
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
    alert('Error loading donation data. Please try again.');
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
