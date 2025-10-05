export function setupFilters({allData, onChange}) {
    const countrySelect = document.getElementById('countrySelect');
    const regionSelect = document.getElementById('regionSelect');
    const categorySelect = document.getElementById('categorySelect');
    const seasonSelect = document.getElementById('seasonSelect');
    const colRange = document.getElementById('colRange');
    const colRangeVal = document.getElementById('colRangeVal');
    const safetyRange = document.getElementById('safetyRange');
    const safetyRangeVal = document.getElementById('safetyRangeVal');
    const clearBtn = document.getElementById('clearFilters');
    const resultCount = document.getElementById('resultCount');
  
    const safetyLabels = {
      "-1": "Restricted",
      "2": "Unsafe",
      "3": "Moderate",
      "4": "Safe",
      "5": "Very Safe"
    };
  
    const colLabels = {
      "1": "Free",
      "2": "Medium",
      "3": "Medium-high",
      "4": "High",
      "5": "Extremely high"
    };
  
    function populateSelect(el, values){
      values.forEach(v => {
        if (!v) return;
        const opt = document.createElement('option');
        opt.value = v; opt.textContent = v;
        el.appendChild(opt);
      });
    }
  
    // Populate dropdown filters using unique sorted values from the dataset
    populateSelect(countrySelect, [...new Set(allData.map(d=>d.country))].sort());
    populateSelect(regionSelect, [...new Set(allData.map(d=>d.region))].sort());
    populateSelect(categorySelect, [...new Set(allData.map(d=>d.category))].sort());
    
    // Extract and populate unique season values (handling arrays in data)
    const allSeasons = [...new Set(allData.flatMap(d => d.season))].sort();
    populateSelect(seasonSelect, allSeasons);
  
    // --- Event Listeners ---
    // Trigger onChange whenever a dropdown changes
    countrySelect.addEventListener('change', ()=>onChange(getCriteria()));
    regionSelect.addEventListener('change', ()=>onChange(getCriteria()));
    categorySelect.addEventListener('change', ()=>onChange(getCriteria()));
    seasonSelect.addEventListener('change', ()=>onChange(getCriteria()));
  
    // Update cost-of-living label and trigger change
    colRange.addEventListener('input', () => {
      colRangeVal.textContent = colLabels[colRange.value];
      onChange(getCriteria());
    });
    
    // Update safety label, snap to nearest allowed value, and trigger change
    safetyRange.addEventListener('input', () => {
      const allowed = [-1,2,3,4,5];
      let val = allowed.reduce((prev,curr) =>
        Math.abs(curr - safetyRange.value) < Math.abs(prev - safetyRange.value) ? curr : prev
      );
      safetyRange.value = val;
      safetyRangeVal.textContent = safetyLabels[val];
      onChange(getCriteria());
    });
    
    // Reset all filters to default state
    clearBtn.addEventListener('click', () => {
      countrySelect.value = "";
      regionSelect.value = "";
      categorySelect.value = "";
      seasonSelect.value = "";
      colRange.value = 1; colRangeVal.textContent = colLabels[1];
      safetyRange.value = -1; safetyRangeVal.textContent = safetyLabels[-1];
      onChange({});
    });
  
    function getCriteria(){
      return {
        country: countrySelect.value || null,
        region: regionSelect.value || null,
        category: categorySelect.value || null,
        season: seasonSelect.value || null,
        colMin: +colRange.value,
        safetyMin: +safetyRange.value
      };
    }
  
    return { resultCount, getCriteria };
  }
