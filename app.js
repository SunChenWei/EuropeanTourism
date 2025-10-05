// import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
// import { initScatter, updateScatter, clearScatterSelection, highlightScatterDestination, highlightAllScatterDestinations } from './charts/scatter.js';
// import { initDotMap, updateDotMap, clearSelections as clearDotMapSelections, highlightDestination, highlightAllDestinations, clearDestination, addToMultiSelection, removeFromMultiSelection, computeRoute, clearRouteAndResetDots, getSelectedDestinations } from './charts/dotmap.js';

// const DATA_PATH = "data/destinations.csv";
// let idCount = 0;
// let allData = [];
// let filtered = [];

// // DOM refs
// const countrySelect = document.getElementById('countrySelect');
// const regionSelect = document.getElementById('regionSelect');
// const categorySelect = document.getElementById('categorySelect');
// const seasonSelect = document.getElementById('seasonSelect');
// const colRange = document.getElementById('colRange');
// const colRangeVal = document.getElementById('colRangeVal');
// const safetyRange = document.getElementById('safetyRange');
// const safetyRangeVal = document.getElementById('safetyRangeVal');
// const clearBtn = document.getElementById('clearFilters');
// const resultCount = document.getElementById('resultCount');

// // Label maps
// const safetyLabels = {
//   "-1": "Restricted",
//   "2": "Unsafe",
//   "3": "Moderate",
//   "4": "Safe",
//   "5": "Very Safe"
// };

// const colLabels = {
//   "1": "Free",
//   "2": "Medium",
//   "3": "Medium-high",
//   "4": "High",
//   "5": "Extremely high"
// };

// // Parse visitors
// function parseVisitors(value) {
//   if (!value) return null;
//   let v = String(value).toLowerCase().trim();
//   v = v.replace(/,/g, '').replace(/\(.*?\)/g, '');
//   const num = parseFloat(v.replace(/[^\d\.]/g, ''));
//   return isNaN(num) ? null : num;
// }

// // Map cost to numeric
// function mapCostToNum(c) {
//   const map = { "Free": 1, "Medium": 2, "Medium-high": 3, "High": 4, "Extremely high": 5 };
//   return map[c] ?? null;
// }

// // Populate select dropdowns
// function populateSelect(el, values) {
//   values.forEach(v => {
//     if (!v) return;
//     const opt = document.createElement('option');
//     opt.value = v;
//     opt.textContent = v;
//     el.appendChild(opt);
//   });
// }

// // Handle filter changes
// function handleFilterChange() {
//   applyFilters({
//     country: countrySelect.value || null,
//     region: regionSelect.value || null,
//     category: categorySelect.value || null,
//     season: seasonSelect.value || null,
//     colMin: +colRange.value,
//     safetyMin: +safetyRange.value
//   });
// }

// // Clear all filters
// function clearFilters() {
//   countrySelect.value = "";
//   regionSelect.value = "";
//   categorySelect.value = "";
//   seasonSelect.value = "";
//   colRange.value = 1;
//   colRangeVal.textContent = colLabels[1];
//   safetyRange.value = -1;
//   safetyRangeVal.textContent = safetyLabels[-1];
  
//   // Clear selections in all charts
//   clearScatterSelection();
//   clearDotMapSelections();
  
//   // Reset route buttons to initial state
//   const computeBtn = document.getElementById('computeRoute');
//   const clearBtn = document.getElementById('clearRoute');
  
//   if (computeBtn) {
//     computeBtn.disabled = true;
//     computeBtn.style.opacity = '0.5';
//     computeBtn.style.cursor = 'not-allowed';
//   }
  
//   if (clearBtn) {
//     clearBtn.disabled = true;
//     clearBtn.style.opacity = '0.5';
//     clearBtn.style.cursor = 'not-allowed';
//   }
  
//   // Clear any route visualization
//   if (window.clearRouteAndResetDots) {
//     // Don't call the full function, just clear the route
//     const routeGroup = document.querySelector('.route-group');
//     if (routeGroup) {
//       routeGroup.innerHTML = '';
//     }
//   }
  
//   applyFilters({});
// }

// // Apply filters to data
// function applyFilters(criteria) {
//   filtered = allData.filter(d => {
//     if (criteria.country && d.country !== criteria.country) return false;
//     if (criteria.region && d.region !== criteria.region) return false;
//     if (criteria.category && d.category !== criteria.category) return false;
//     if (criteria.season && d.season !== criteria.season) return false;
//     if (criteria.colMin && d.costNum < criteria.colMin) return false;
//     if ((criteria.safetyMin || criteria.safetyMin === 0) && d.safety < criteria.safetyMin) return false;
//     return true;
//   });
  
//   resultCount.textContent = `Showing: ${filtered.length}`;
  
//   // Update all visualizations
//   updateScatter(filtered);
//   updateDotMap(filtered);
// }

// // Initialize app
// async function init() {
//   // Load data
//   const data = await d3.csv(DATA_PATH, d => {
//     return {
//       id: idCount++,
//       destination: d.Destination,
//       country: d.Country,
//       region: d.Region,
//       category: d.Category,
//       latitude: +d.Latitude,
//       longitude: +d.Longitude,
//       visitors: parseVisitors(d["Approximate Annual Tourists"]),
//       cost: d["Cost of Living"].trim(),
//       costNum: mapCostToNum(d["Cost of Living"]),
//       safety: +d.Safety,
//       season: (d["Best Time to Visit"] || "").replace(/\(.*?\)/g, '').split(',')[0].trim()
//     };
//   });

//   allData = data.filter(d => d.visitors && d.cost);
//   filtered = [...allData];

//   // Populate filter dropdowns
//   populateSelect(countrySelect, [...new Set(allData.map(d => d.country))].sort());
//   populateSelect(regionSelect, [...new Set(allData.map(d => d.region))].sort());
//   populateSelect(categorySelect, [...new Set(allData.map(d => d.category))].sort());
//   populateSelect(seasonSelect, [...new Set(allData.map(d => d.season))].sort());

//   // Setup event listeners
//   countrySelect.addEventListener('change', handleFilterChange);
//   regionSelect.addEventListener('change', handleFilterChange);
//   categorySelect.addEventListener('change', handleFilterChange);
//   seasonSelect.addEventListener('change', handleFilterChange);

//   colRange.addEventListener('input', () => {
//     colRangeVal.textContent = colLabels[colRange.value];
//     handleFilterChange();
//   });

//   safetyRange.addEventListener('input', () => {
//     const allowed = [-1, 2, 3, 4, 5];
//     let val = allowed.reduce((prev, curr) =>
//       Math.abs(curr - safetyRange.value) < Math.abs(prev - safetyRange.value) ? curr : prev
//     );
//     safetyRange.value = val;
//     safetyRangeVal.textContent = safetyLabels[val];
//     handleFilterChange();
//   });

//   clearBtn.addEventListener('click', clearFilters);

//   // Initialize visualizations
//   await initDotMap();
//   await initScatter();
  
//   // Set up route planning event listeners after dotmap is initialized
//   const computeRouteBtn = document.getElementById('computeRoute');
//   const clearRouteBtn = document.getElementById('clearRoute');
  
//   if (computeRouteBtn) {
//     computeRouteBtn.addEventListener('click', computeRoute);
//   }
  
//   if (clearRouteBtn) {
//     clearRouteBtn.addEventListener('click', clearRouteAndResetDots);
//   }
  
//   // Expose functions globally for cross-chart communication
//   window.clearScatterSelection = clearScatterSelection;
//   window.highlightScatterDestination = highlightScatterDestination;
//   window.highlightAllScatterDestinations = highlightAllScatterDestinations;
//   window.clearDotMapSelections = clearDotMapSelections;
//   window.highlightDestination = highlightDestination;
//   window.highlightAllDestinations = highlightAllDestinations;
//   window.clearDestination = clearDestination;
//   window.addToMultiSelection = addToMultiSelection;
//   window.removeFromMultiSelection = removeFromMultiSelection;
//   window.getSelectedDestinations = getSelectedDestinations;
//   window.clearRouteAndResetDots = clearRouteAndResetDots;
  
//   // Initial render
//   resultCount.textContent = `Showing: ${filtered.length}`;
//   updateScatter(filtered);
//   updateDotMap(filtered);
// }

// // Start app
// init();