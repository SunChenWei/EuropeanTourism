import { loadData } from "./data.js";
import { setupFilters } from "./filters.js";
import { initScatter, updateScatter, clearScatterSelection, highlightScatterDestination, highlightAllScatterDestinations } from './charts/scatter.js';
import { initDotMap, updateDotMap, clearSelections as clearDotMapSelections, highlightDestination, highlightAllDestinations, clearDestination, addToMultiSelection, removeFromMultiSelection, computeRoute, clearRouteAndResetDots, getSelectedDestinations } from './charts/dotmap.js';
import { createPolar } from './charts/polar.js';

(async function(){
  const allData = await loadData();

  // Chart init
  const scatter = { init: initScatter, render: updateScatter };
  const dotmap = { init: initDotMap, render: updateDotMap };
  const polar = createPolar();
  
  // Polar chart selected seasons
  let activePolarSeasons = [];
  
  // Filters init
  const filters = setupFilters({
    allData,
    onChange: (criteria) => applyFilters(criteria)
  });

  // Core filtering logic that applies all active filter criteria
  function applyFilters(criteria) {
    const filtered = allData.filter(d => {
    // Apply dropdown filters
      if (criteria.country && d.country !== criteria.country) return false;
      if (criteria.region && d.region !== criteria.region) return false;
      if (criteria.category && d.category !== criteria.category) return false;
      // Handle season filter (single or multiple values)
      if (criteria.season) {
        const matches = Array.isArray(d.season)
          ? d.season.includes(criteria.season)
          : d.season === criteria.season;
        if (!matches) return false;
      }
      // Numeric filters
      if (criteria.colMin && d.costNum < criteria.colMin) return false;
      if ((criteria.safetyMin || criteria.safetyMin === 0) && d.safety < criteria.safetyMin) return false;

      // Apply polar chart filtering (if any active slices are selected)
      if (activePolarSeasons.length > 0) {
        const match = Array.isArray(d.season)
          ? d.season.some(s => activePolarSeasons.includes(s))
          : activePolarSeasons.includes(d.season);
        if (!match) return false;
      }

      return true;
    });

    // Update all charts with filtered data
    filters.resultCount.textContent = `Showing: ${filtered.length}`;
    scatter.render(filtered);
    dotmap.render(filtered);
    polar.render(filtered);
  }

  // Event Listener: Polar Chart Selection
  window.addEventListener('polarFilter', (e) => {
    activePolarSeasons = e.detail;  // array of selected season names
    const currentCriteria = filters.getCriteria ? filters.getCriteria() : {};
    applyFilters(currentCriteria);
  });

  // Initialize visualizations
  await dotmap.init();
  await scatter.init();
  
  // Set up route planning event listeners after dotmap is initialized
  const computeRouteBtn = document.getElementById('computeRoute');
  const clearRouteBtn = document.getElementById('clearRoute');
  
  if (computeRouteBtn) {
    computeRouteBtn.addEventListener('click', computeRoute);
  }
  
  if (clearRouteBtn) {
    clearRouteBtn.addEventListener('click', clearRouteAndResetDots);
  }
  
  // Expose functions globally for cross-chart communication
  window.clearScatterSelection = clearScatterSelection;
  window.highlightScatterDestination = highlightScatterDestination;
  window.highlightAllScatterDestinations = highlightAllScatterDestinations;
  window.clearDotMapSelections = clearDotMapSelections;
  window.highlightDestination = highlightDestination;
  window.highlightAllDestinations = highlightAllDestinations;
  window.clearDestination = clearDestination;
  window.addToMultiSelection = addToMultiSelection;
  window.removeFromMultiSelection = removeFromMultiSelection;
  window.getSelectedDestinations = getSelectedDestinations;
  window.clearRouteAndResetDots = clearRouteAndResetDots;

  // initial rendering
  scatter.render(allData);
  dotmap.render(allData);
  polar.render(allData);
  filters.resultCount.textContent = `Showing: ${allData.length}`;
})();
