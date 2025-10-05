import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import * as topojson from "https://cdn.jsdelivr.net/npm/topojson-client@3/+esm";

// Configuration constants
const CONFIG = {
  DATA_PATH: "data/destinations.csv",
  EUROPE_GEOJSON: "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json",
  
  // Visual styling
  COLORS: {
    PRIMARY: '#2777cc',
    SELECTED: '#222',
    ROUTE: '#4CAF50',
    HOVER: '#00D4FF',
    STROKE_NORMAL: '#fff',
    STROKE_ROUTE: '#e74c3c',
    MAP_FILL: '#e8f4f8',
    MAP_STROKE: '#b0c4de'
  },
  
  // Circle sizing
  RADIUS: {
    MIN: 2,
    MAX: 15,
    DEFAULT: 5,
    SELECTED_MULTIPLIER: 1.4,
    HOVER_MULTIPLIER: 1.3
  },
  
  // Stroke widths
  STROKE_WIDTH: {
    NORMAL: 1,
    SELECTED: 3,
    ROUTE: 3,
    HOVER: 2
  },
  
  // Animation durations
  DURATION: {
    FAST: 150,
    NORMAL: 200,
    SLOW: 300,
    VERY_SLOW: 500
  },
  
  // Selection limits
  MAX_SELECTIONS: 5,
  MIN_ROUTE_DESTINATIONS: 3,
  MAX_ROUTE_DESTINATIONS: 5,
  
  // Map settings
  MAP_SCALE_FACTOR: 0.45,
  ZOOM_SCALE_EXTENT: [0.5, 8],
  
  // Safety labels
  SAFETY_LABELS: {
    "-1": "Restricted",
    "2": "Unsafe", 
    "3": "Moderate",
    "4": "Safe",
    "5": "Very Safe"
  },
  
  // Cost labels
  COST_LABELS: {
    1: "Free",
    2: "Medium", 
    3: "Medium-high",
    4: "High",
    5: "Extremely high"
  }
};

let allData = [];
let filtered = [];
let selectedDestinations = [];
let svg, g, mapGroup, circleGroup, routeGroup, projection, radiusScale, zoom;
let selectedCircle = null;

// Get safety label from numeric value
function getSafetyLabel(safetyValue) {
  return CONFIG.SAFETY_LABELS[safetyValue.toString()] || safetyValue.toString();
}

// Circle styling functions
function applyCircleStyle(circle, style, zoomLevel = 1) {
  const baseRadius = getBaseRadius(circle.datum(), zoomLevel, style.strokeWidth);
  const radius = style.multiplier ? baseRadius * style.multiplier : baseRadius;
  
  circle.transition().duration(style.duration || CONFIG.DURATION.NORMAL)
    .attr('fill', style.fill)
    .attr('stroke', style.stroke)
    .attr('stroke-width', style.strokeWidth)
    .attr('r', radius)
    .style('opacity', style.opacity || 0.7);
}

function getCircleStyle(type, zoomLevel = 1) {
  const styles = {
    normal: {
      fill: CONFIG.COLORS.PRIMARY,
      stroke: CONFIG.COLORS.STROKE_NORMAL,
      strokeWidth: CONFIG.STROKE_WIDTH.NORMAL,
      multiplier: 1,
      duration: CONFIG.DURATION.NORMAL
    },
    selected: {
      fill: CONFIG.COLORS.PRIMARY,
      stroke: CONFIG.COLORS.SELECTED,
      strokeWidth: CONFIG.STROKE_WIDTH.SELECTED,
      multiplier: CONFIG.RADIUS.SELECTED_MULTIPLIER,
      duration: CONFIG.DURATION.NORMAL
    },
    hover: {
      fill: CONFIG.COLORS.PRIMARY,
      stroke: CONFIG.COLORS.HOVER,
      strokeWidth: CONFIG.STROKE_WIDTH.HOVER,
      multiplier: CONFIG.RADIUS.HOVER_MULTIPLIER,
      duration: CONFIG.DURATION.FAST
    },
    route: {
      fill: CONFIG.COLORS.ROUTE,
      stroke: CONFIG.COLORS.SELECTED,
      strokeWidth: CONFIG.STROKE_WIDTH.ROUTE,
      multiplier: CONFIG.RADIUS.SELECTED_MULTIPLIER,
      duration: CONFIG.DURATION.SLOW
    }
  };
  
  return styles[type] || styles.normal;
}

// Generate destination info HTML
function generateDestinationInfoHTML(destination) {
  return `
    <div class="destination-detail">
      <span class="title">${destination.destination}</span>
      <div class="info-row"><span class="info-label">Country:</span> <span class="info-value">${destination.country}</span></div>
      <div class="info-row"><span class="info-label">Region:</span> <span class="info-value">${destination.region}</span></div>
      <div class="info-row"><span class="info-label">Category:</span> <span class="info-value">${destination.category}</span></div>
      <div class="info-row"><span class="info-label">Visitors:</span> <span class="info-value">${d3.format(",")(Math.round(destination.visitors))}</span></div>
      <div class="info-row"><span class="info-label">Cost of Living:</span> <span class="info-value">${destination.cost}</span></div>
      <div class="info-row"><span class="info-label">Safety:</span> <span class="info-value">${getSafetyLabel(destination.safety)}</span></div>
      <div class="info-row"><span class="info-label">Best Season:</span> <span class="info-value">${destination.season || 'N/A'}</span></div>
    </div>`;
}

// Update info panel based on selection state
function updateInfoPanel() {
  const infoDiv = document.getElementById('destination-info');
  
  if (selectedDestinations.length === 0) {
    infoDiv.innerHTML = "[Info will appear here]";
    removeFloatingList();
  } else if (selectedDestinations.length === 1) {
    infoDiv.innerHTML = generateDestinationInfoHTML(selectedDestinations[0]);
    removeFloatingList();
  } else {
    infoDiv.innerHTML = "";
    renderMultiSelectionList();
  }
}

// Remove floating list helper
function removeFloatingList() {
  const floatingList = container.select('.floating-selection-list');
  if (!floatingList.empty()) {
    floatingList.remove();
  }
}

const tooltip = d3.select('#tooltip');
const container = d3.select('#dotmap-container');
const containerNode = container.node();

// Parse visitors
function parseVisitors(value) {
  if (!value) return null;
  let v = String(value).toLowerCase().trim();
  v = v.replace(/,/g, '').replace(/\(.*?\)/g, '');
  const num = parseFloat(v.replace(/[^\d\.]/g, ''));
  return isNaN(num) ? null : num;
}

// Map cost to numeric for route optimization
function mapCostToNum(c) {
  const reverseMap = Object.fromEntries(
    Object.entries(CONFIG.COST_LABELS).map(([num, label]) => [label, parseInt(num)])
  );
  return reverseMap[c] ?? 3;
}

// Get container size
function getSize() {
  const bbox = containerNode.getBoundingClientRect();
  return {
    // width: Math.max(400, bbox.width - 20),
    width: bbox.width,
    height: Math.max(340, bbox.height - 20)
  };
}

// Get base radius for a data point (scales with zoom level)
function getBaseRadius(d, zoomLevel = 1, strokeWidth = CONFIG.STROKE_WIDTH.NORMAL) {
  if (!radiusScale) {
    return CONFIG.RADIUS.DEFAULT;
  }
  
  // Ensure visitor value is valid
  const visitors = d.visitors || 0;
  if (typeof visitors !== 'number' || isNaN(visitors) || visitors < 0) {
    return CONFIG.RADIUS.DEFAULT;
  }
  
  const baseRadius = radiusScale(visitors);
  if (isNaN(baseRadius)) {
    return CONFIG.RADIUS.DEFAULT;
  }
  
  // Scale radius inversely with zoom level (smaller dots when zoomed in)
  const scaledRadius = baseRadius / Math.sqrt(zoomLevel);
  
  // Ensure minimum radius to accommodate stroke width
  const minRadius = strokeWidth + 2;
  
  return Math.max(minRadius, scaledRadius);
}

// Update circle sizes based on current zoom level
function updateCircleSizes(zoomLevel) {
  if (!circleGroup) return;
  
  circleGroup.selectAll('circle')
    .transition()
    .duration(CONFIG.DURATION.FAST)
    .attr('r', d => getBaseRadius(d, zoomLevel, CONFIG.STROKE_WIDTH.NORMAL));
}

// Initialize the dot map
export async function initDotMap() {
  // Load data
  const data = await d3.csv(CONFIG.DATA_PATH, d => {
    return {
      id: d.Destination + "_" + d.Country,
      destination: d.Destination,
      country: d.Country,
      region: d.Region,
      category: d.Category,
      latitude: +d.Latitude,
      longitude: +d.Longitude,
      visitors: parseVisitors(d["Approximate Annual Tourists"]),
      cost: d["Cost of Living"].trim(),
      costNum: mapCostToNum(d["Cost of Living"]),
      safety: +d.Safety,
      season: (d["Best Time to Visit"] || "").replace(/\(.*?\)/g, '').split(',')[0].trim()
    };
  });

  allData = data.filter(d => d.visitors && d.latitude && d.longitude);
  filtered = [...allData];

  await setupMap();
  updateDotMap(filtered);
}

// Setup the map SVG and projection
async function setupMap() {
  const size = getSize();

  // Create SVG
  svg = container.append('svg')
    .attr('width', size.width)
    .attr('height', size.height);

  // Create groups for layering
  g = svg.append('g');
  mapGroup = g.append('g').attr('class', 'map-group');
  routeGroup = g.append('g').attr('class', 'route-group');
  circleGroup = g.append('g').attr('class', 'circle-group');

  // Setup projection for Europe
  projection = d3.geoMercator()
    .center([10, 52])  // Center on Europe
    .scale(size.width * CONFIG.MAP_SCALE_FACTOR)  
    .translate([size.width / 2, size.height / 2]);

  // Load and draw Europe map
  const world = await d3.json(CONFIG.EUROPE_GEOJSON);
  const countries = topojson.feature(world, world.objects.countries);
  
  // Filter to Europe countries (including European part of Russia)
  const europeCountries = countries.features.filter(d => {
    const centroid = d3.geoCentroid(d);
    const lon = centroid[0];
    const lat = centroid[1];
    
    // Get country name from various possible property fields
    const countryName = d.properties?.NAME || d.properties?.name || d.properties?.NAME_EN || d.properties?.name_en || 'Unknown';
    
    // Include European Russia (west of ~60°E longitude) or any country with Russia in the name
    const isInBounds = lon > -25 && lon < 60 && lat > 35 && lat < 72;
    const isRussia = countryName.toLowerCase().includes('russia') || countryName.toLowerCase().includes('russian');
    
    return isInBounds || isRussia;
  });

  const pathGenerator = d3.geoPath().projection(projection);

  mapGroup.selectAll('path')
    .data(europeCountries)
    .join('path')
    .attr('d', pathGenerator)
    .attr('fill', CONFIG.COLORS.MAP_FILL)
    .attr('stroke', CONFIG.COLORS.MAP_STROKE)
    .attr('stroke-width', 0.5);

  // Setup zoom behavior
  zoom = d3.zoom()
    .scaleExtent(CONFIG.ZOOM_SCALE_EXTENT)
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
      // Update circle sizes based on new zoom level
      updateCircleSizes(event.transform.k);
    });

  svg.call(zoom);

  // Add zoom controls
  const zoomControls = container.append('div')
    .attr('class', 'zoom-controls')
    .style('position', 'absolute')
    .style('top', '10px')
    .style('left', '10px')
    .style('display', 'flex')
    .style('flex-direction', 'column')
    .style('gap', '5px');

  // Add route planning controls
  const routeControls = container.append('div')
    .attr('class', 'route-controls')
    .style('position', 'absolute')
    .style('top', '10px')
    .style('right', '10px')
    .style('display', 'flex')
    .style('flex-direction', 'column')
    .style('gap', '5px');

// Create styled button helper
function createStyledButton(parent, text, config = {}) {
  const button = parent.append('button')
    .text(text)
    .style('width', '30px')
    .style('height', '30px')
    .style('background', config.background || CONFIG.COLORS.PRIMARY)
    .style('color', '#fff')
    .style('border', 'none')
    .style('border-radius', '4px')
    .style('cursor', config.cursor || 'pointer')
    .style('font-size', config.fontSize || '16px')
    .style('font-weight', 'bold')
    .style('opacity', config.opacity || '1')
    .style('display', 'flex')
    .style('align-items', 'center')
    .style('justify-content', 'center');
    
  if (config.id) button.attr('id', config.id);
  if (config.title) button.attr('title', config.title);
  if (config.disabled !== undefined) button.property('disabled', config.disabled);
  
  return button;
}

  // Zoom in button
  createStyledButton(zoomControls, '+', {
    background: CONFIG.COLORS.PRIMARY
  }).on('click', () => {
    svg.transition().duration(CONFIG.DURATION.SLOW).call(
      zoom.scaleBy, 2
    );
  });

  // Zoom out button
  createStyledButton(zoomControls, '−', {
    background: CONFIG.COLORS.PRIMARY
  }).on('click', () => {
    svg.transition().duration(CONFIG.DURATION.SLOW).call(
      zoom.scaleBy, 0.5
    );
  });

  // Reset zoom button
  createStyledButton(zoomControls, '⌂', {
    title: 'Reset Zoom',
    background: '#666',
    fontSize: '14px'
  }).on('click', () => {
    svg.transition().duration(CONFIG.DURATION.SLOW).call(
      zoom.transform, d3.zoomIdentity
    );
  });

  // Compute route button
  createStyledButton(routeControls, '➜', {
    id: 'computeRoute',
    title: 'Compute Route (3-5 destinations)',
    background: CONFIG.COLORS.ROUTE,
    opacity: '0.5',
    cursor: 'not-allowed',
    disabled: true
  });

  // Clear route button
  createStyledButton(routeControls, '✕', {
    id: 'clearRoute',
    title: 'Clear Route & Selections',
    background: CONFIG.COLORS.STROKE_ROUTE,
    opacity: '0.5',
    cursor: 'not-allowed',
    disabled: true
  });

  // Handle window resize
  window.addEventListener('resize', () => {
    const newSize = getSize();
    svg.attr('width', newSize.width).attr('height', newSize.height);
    
    // Reset zoom and update projection
    svg.call(zoom.transform, d3.zoomIdentity);
    projection
      .scale(newSize.width * CONFIG.MAP_SCALE_FACTOR)  
      .translate([newSize.width / 2, newSize.height / 2]);
    
    updateDotMap(filtered);
  });
}

// Update dot map with filtered data
export function updateDotMap(data) {
  filtered = data;

  // Update radius scale based on current data
  radiusScale = d3.scaleSqrt()
    .domain([0, d3.max(data, d => d.visitors) || 1])
    .range([CONFIG.RADIUS.MIN, CONFIG.RADIUS.MAX]);

  // Get current zoom level
  const currentTransform = d3.zoomTransform(svg.node());
  const zoomLevel = currentTransform ? currentTransform.k : 1;

  // Update circles
  const circles = circleGroup.selectAll('circle')
    .data(data, d => d.id);

  // Exit
  circles.exit()
    .transition()
    .duration(CONFIG.DURATION.VERY_SLOW)
    .style('opacity', 0)
    .attr('r', 0)
    .remove();

  // Enter
  const enter = circles.enter()
    .append('circle')
    .attr('cx', d => projection([d.longitude, d.latitude])[0])
    .attr('cy', d => projection([d.longitude, d.latitude])[1])
    .attr('r', 0)
    .attr('fill', CONFIG.COLORS.PRIMARY)
    .attr('stroke', CONFIG.COLORS.STROKE_NORMAL)
    .attr('stroke-width', CONFIG.STROKE_WIDTH.NORMAL)
    .style('opacity', 0)
    .style('cursor', 'pointer');

  // Events
  enter
    .on('mouseover', function(event, d) {
      tooltip.style('display', 'block')
        .html(`
          <strong>${d.destination}</strong><br/>
          ${d.country} (${d.region})<br/>
          Category: ${d.category}<br/>
          Visitors: ${d3.format(",")(Math.round(d.visitors))}<br/>
          Cost: ${d.cost}<br/>
          Safety: ${getSafetyLabel(d.safety)}
        `);

      // Increase circle temporarily (if not selected)
      const isSelected = selectedDestinations.find(dest => dest.id === d.id);
        
      if (!isSelected) {
        const currentZoom = d3.zoomTransform(svg.node())?.k || 1;
        const circle = d3.select(event.currentTarget);
        applyCircleStyle(circle, getCircleStyle('hover', currentZoom), currentZoom);
      }
    })
    .on('mousemove', event => {
      tooltip.style('left', (event.pageX + 12) + 'px')
        .style('top', (event.pageY + 12) + 'px');
    })
    .on('mouseout', function(event, d) {
      tooltip.style('display', 'none');

      // Return to normal size if not selected
      const isSelected = selectedDestinations.find(dest => dest.id === d.id);
        
      if (!isSelected) {
        const currentZoom = d3.zoomTransform(svg.node())?.k || 1;
        const circle = d3.select(event.currentTarget);
        applyCircleStyle(circle, getCircleStyle('normal', currentZoom), currentZoom);
      }
    })
    .on('click', function(event, d) {
      const circle = d3.select(event.currentTarget);
      const currentZoom = d3.zoomTransform(svg.node())?.k || 1;
      
      const isAlreadySelected = selectedDestinations.find(dest => dest.id === d.id);
      
      if (isAlreadySelected) {
        // Deselect this destination
        removeFromMultiSelection(d.id);
        applyCircleStyle(circle, getCircleStyle('normal', currentZoom), currentZoom);
        
        // Clear scatterplot selection if this was the only selected destination
        if (selectedDestinations.length === 0 && window.clearScatterSelection) {
          window.clearScatterSelection();
        }
      } else {
        // Add to selection (max 5)
        if (selectedDestinations.length < CONFIG.MAX_SELECTIONS) {
          addToMultiSelection(d);
          applyCircleStyle(circle, getCircleStyle('selected', currentZoom), currentZoom);
        }
      }
      
      updateInfoPanel();
    });

  // Merge and update positions/colors
  const merged = enter.merge(circles);
  
  merged
    .transition()
    .duration(CONFIG.DURATION.VERY_SLOW)
    .attr('cx', d => projection([d.longitude, d.latitude])[0])
    .attr('cy', d => projection([d.longitude, d.latitude])[1])
    .attr('r', d => {
      const isSelected = selectedDestinations.find(dest => dest.id === d.id);
      if (isSelected) {
        return getBaseRadius(d, zoomLevel, CONFIG.STROKE_WIDTH.SELECTED) * CONFIG.RADIUS.SELECTED_MULTIPLIER;
      }
      return getBaseRadius(d, zoomLevel, CONFIG.STROKE_WIDTH.NORMAL);
    })
    .attr('stroke', d => {
      const isSelected = selectedDestinations.find(dest => dest.id === d.id);
      return isSelected ? CONFIG.COLORS.SELECTED : CONFIG.COLORS.STROKE_NORMAL;
    })
    .attr('stroke-width', d => {
      const isSelected = selectedDestinations.find(dest => dest.id === d.id);
      return isSelected ? CONFIG.STROKE_WIDTH.SELECTED : CONFIG.STROKE_WIDTH.NORMAL;
    })
    .style('opacity', 0.7);

}

// Clear all selections
export function clearSelections() {
  if (selectedCircle) {
    const data = selectedCircle.datum();
    const zoomLevel = d3.zoomTransform(svg.node())?.k || 1;
    applyCircleStyle(selectedCircle, getCircleStyle('normal', zoomLevel), zoomLevel);
    selectedCircle = null;
  }
  
  // Clear multi-selections
  selectedDestinations = [];
  updateSelectedCount();
  clearRoute();
  removeFloatingList();
  
  document.getElementById('destination-info').innerHTML = "[Info will appear here]";
}

// Update compute route button state
function updateSelectedCount() {
  const routeBtn = document.getElementById('computeRoute');
  const clearBtn = document.getElementById('clearRoute');
  
  if (routeBtn) {
    const isValid = selectedDestinations.length >= 3 && selectedDestinations.length <= 5;
    routeBtn.disabled = !isValid;
    routeBtn.style.opacity = isValid ? '1' : '0.5';
    routeBtn.style.cursor = isValid ? 'pointer' : 'not-allowed';
  }
  
  if (clearBtn) {
    const hasSelections = selectedDestinations.length > 0;
    clearBtn.disabled = !hasSelections;
    clearBtn.style.opacity = hasSelections ? '1' : '0.5';
    clearBtn.style.cursor = hasSelections ? 'pointer' : 'not-allowed';
  }
}

// Add destination to multi-selection
export function addToMultiSelection(destination) {
  if (selectedDestinations.length >= CONFIG.MAX_SELECTIONS) return;
  
  const exists = selectedDestinations.find(d => d.id === destination.id);
  if (!exists) {
    selectedDestinations.push(destination);
    updateSelectedCount();
  }
}

// Remove destination from multi-selection
export function removeFromMultiSelection(destinationId) {
  selectedDestinations = selectedDestinations.filter(d => d.id !== destinationId);
  updateSelectedCount();
}

// Render floating list on dotmap for multi-selection
function renderMultiSelectionList(isRoute = false, totalDistance = 0, avgCost = "") {
  // Remove existing floating list if any
  let floatingList = container.select('.floating-selection-list');
  if (!floatingList.empty()) {
    floatingList.remove();
  }
  
  if (selectedDestinations.length === 0) {
    return;
  }
  
  // Build header based on whether it's a route or just selections
  let headerHTML = '';
  if (isRoute) {
    headerHTML = `
      <div class="floating-list-header">Route: ${selectedDestinations.length} stops</div>
      <div style="font-size: 10px; color: #666; margin-bottom: 6px;">
        Distance: ${Math.round(totalDistance)} km • Avg. Cost: ${avgCost}
      </div>
    `;
  } else {
    headerHTML = `<div class="floating-list-header">Selected: ${selectedDestinations.length} destination${selectedDestinations.length !== 1 ? 's' : ''}</div>`;
  }
  
  // Create floating list on the dotmap
  floatingList = container.append('div')
    .attr('class', 'floating-selection-list')
    .html(headerHTML);
  
  // Add the items container
  const itemsContainer = floatingList.append('div')
    .attr('class', 'floating-list-items');
  
  // Bind data and create items using D3
  const items = itemsContainer.selectAll('.floating-dest-item')
    .data(selectedDestinations)
    .enter()
    .append('div')
    .attr('class', 'floating-dest-item')
    .attr('data-dest-id', d => d.id)
    .html(d => {
      const index = selectedDestinations.indexOf(d);
      return `
        <span class="floating-dest-number ${isRoute ? 'route-number' : ''}">${index + 1}</span>
        <span class="floating-dest-name">${d.destination}</span>
      `;
    })
    .on('click', function(event, d) {
      event.stopPropagation();
      showDestinationDetailInSidebar(d.id);
    });
}

// Show detailed information in sidebar (for multi-select mode)
function showDestinationDetailInSidebar(destinationId) {
  const destination = selectedDestinations.find(d => d.id === destinationId);
  if (!destination) return;
  
  const infoDiv = document.getElementById('destination-info');
  infoDiv.innerHTML = `
    <div class="destination-detail">
      <span class="title">${destination.destination}</span>
      <div class="info-row"><span class="info-label">Country:</span> <span class="info-value">${destination.country}</span></div>
      <div class="info-row"><span class="info-label">Region:</span> <span class="info-value">${destination.region}</span></div>
      <div class="info-row"><span class="info-label">Category:</span> <span class="info-value">${destination.category}</span></div>
      <div class="info-row"><span class="info-label">Visitors:</span> <span class="info-value">${d3.format(",")(Math.round(destination.visitors))}</span></div>
      <div class="info-row"><span class="info-label">Cost of Living:</span> <span class="info-value">${destination.cost}</span></div>
      <div class="info-row"><span class="info-label">Safety:</span> <span class="info-value">${getSafetyLabel(destination.safety)}</span></div>
      <div class="info-row"><span class="info-label">Best Season:</span> <span class="info-value">${destination.season || 'N/A'}</span></div>
    </div>
  `;
}

// Clear route visualization only (keeps selections)
function clearRoute() {
  if (routeGroup) {
    routeGroup.selectAll('*').remove();
  }
  
  // Restore original circle colors for all selected destinations
  if (circleGroup && selectedDestinations.length > 0) {
    const currentZoom = d3.zoomTransform(svg.node())?.k || 1;
    
    selectedDestinations.forEach(dest => {
      const circle = circleGroup.selectAll('circle').filter(d => d.id === dest.id);
      if (!circle.empty()) {
        applyCircleStyle(circle, getCircleStyle('selected', currentZoom), currentZoom);
      }
    });
  }
}

// Clear route and reset all dots to unselected state
export function clearRouteAndResetDots() {
  // Clear route visualization
  if (routeGroup) {
    routeGroup.selectAll('*').remove();
  }
  
  // Reset all circles to normal styling
  if (circleGroup) {
    const allCircles = circleGroup.selectAll('circle');
    const zoomLevel = d3.zoomTransform(svg.node())?.k || 1;
    
    allCircles.transition().duration(CONFIG.DURATION.NORMAL)
      .attr('fill', CONFIG.COLORS.PRIMARY)
      .attr('stroke', CONFIG.COLORS.STROKE_NORMAL)
      .attr('stroke-width', CONFIG.STROKE_WIDTH.NORMAL)
      .attr('r', d => getBaseRadius(d, zoomLevel, CONFIG.STROKE_WIDTH.NORMAL));
  }
  
  // Clear selections
  selectedDestinations = [];
  updateSelectedCount();
  
  // Clear scatterplot selection
  if (window.clearScatterSelection) {
    window.clearScatterSelection();
  }
  
  removeFloatingList();
  
  // Disable clear route button
  const clearBtn = document.getElementById('clearRoute');
  if (clearBtn) {
    clearBtn.disabled = true;
    clearBtn.style.opacity = '0.5';
    clearBtn.style.cursor = 'not-allowed';
  }
  
  // Clear info panel
  const infoDiv = document.getElementById('destination-info');
  if (infoDiv) {
    infoDiv.innerHTML = "[Info will appear here]";
  }
}

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Cost-optimized TSP solver
// Starts at destination with lowest cost of living
// Then uses nearest neighbor with cost weighting
function solveTSP(destinations) {
  if (destinations.length < 2) return destinations;
  
  // Find destination with lowest cost of living
  let lowestCostDest = destinations[0];
  for (let i = 1; i < destinations.length; i++) {
    if (destinations[i].costNum < lowestCostDest.costNum) {
      lowestCostDest = destinations[i];
    }
  }
  
  // Start route with lowest cost destination
  const route = [lowestCostDest];
  const remaining = destinations.filter(d => d.id !== lowestCostDest.id);
  
  // Build route using nearest neighbor with cost weighting
  while (remaining.length > 0) {
    const current = route[route.length - 1];
    let bestNext = remaining[0];
    let bestScore = Infinity;
    
    for (let i = 0; i < remaining.length; i++) {
      const dest = remaining[i];
      const distance = calculateDistance(current.latitude, current.longitude,
                                       dest.latitude, dest.longitude);
      
      // Score = distance + cost penalty
      // Lower cost destinations get preference (cost penalty is lower)
      const costPenalty = dest.costNum * 100; // Scale cost to be comparable to distance
      const score = distance + costPenalty;
      
      if (score < bestScore) {
        bestScore = score;
        bestNext = dest;
      }
    }
    
    route.push(bestNext);
    remaining.splice(remaining.indexOf(bestNext), 1);
  }
  
  return route;
}

// Compute and visualize route
export function computeRoute() {
  if (selectedDestinations.length < CONFIG.MIN_ROUTE_DESTINATIONS || selectedDestinations.length > CONFIG.MAX_ROUTE_DESTINATIONS) {
    alert(`Please select ${CONFIG.MIN_ROUTE_DESTINATIONS}-${CONFIG.MAX_ROUTE_DESTINATIONS} destinations for route computation`);
    return;
  }
  
  clearRoute();
  
  // Solve TSP
  const route = solveTSP([...selectedDestinations]);
  const currentZoom = d3.zoomTransform(svg.node())?.k || 1;
  
  // Draw route lines (no arrows)
  const routePath = routeGroup.append('path')
    .attr('d', () => {
      const pathData = route.map(d => {
        const [x, y] = projection([d.longitude, d.latitude]);
        return `${x},${y}`;
      }).join(' L');
      return `M${pathData}`;
    })
    .attr('fill', 'none')
    .attr('stroke', CONFIG.COLORS.STROKE_ROUTE)
    .attr('stroke-width', CONFIG.STROKE_WIDTH.ROUTE)
    .attr('stroke-dasharray', '10,5')
    .style('opacity', 0.8);
  
  // Modify the original dots to green
  route.forEach((dest, index) => {
    // Find the original circle
    const circle = circleGroup.selectAll('circle').filter(d => d.id === dest.id);
    
    if (!circle.empty()) {
      applyCircleStyle(circle, getCircleStyle('route', currentZoom), currentZoom);
    }
  });
  
  // Update info with route details
  const totalDistance = route.reduce((total, dest, index) => {
    if (index === 0) return 0;
    const prev = route[index - 1];
    return total + calculateDistance(prev.latitude, prev.longitude, 
                                   dest.latitude, dest.longitude);
  }, 0);
  
  // Calculate average cost
  const avgCost = route.reduce((sum, d) => sum + d.costNum, 0) / route.length;
  const avgCostLabel = CONFIG.COST_LABELS[Math.round(avgCost)] || "Medium";
  
  // Update selectedDestinations to match route order
  selectedDestinations = [...route];
  
  // Clear sidebar
  const infoDiv = document.getElementById('destination-info');
  infoDiv.innerHTML = "[Info will appear here]";
  
  // Enable clear route button
  const clearBtn = document.getElementById('clearRoute');
  if (clearBtn) {
    clearBtn.disabled = false;
    clearBtn.style.opacity = '1';
    clearBtn.style.cursor = 'pointer';
  }
  
  // Update floating list with route info
  renderMultiSelectionList(true, totalDistance, avgCostLabel);
}


// Export for integration
export function getSelectedDestinations() {
  return selectedDestinations;
}

// Clear a specific destination from selection (called from scatterplot)
export function clearDestination(destinationId) {
  if (!circleGroup) return;
  
  // Remove from multi-selection
  removeFromMultiSelection(destinationId);
  
  // Find and reset the circle
  const circles = circleGroup.selectAll('circle');
  const targetCircle = circles.filter(d => d.id === destinationId);
  
  if (!targetCircle.empty()) {
    const zoomLevel = d3.zoomTransform(svg.node())?.k || 1;
    applyCircleStyle(targetCircle, getCircleStyle('normal', zoomLevel), zoomLevel);
  }
  
  updateInfoPanel();
}

// Highlight all selected destinations (called from scatterplot)
export function highlightAllDestinations() {
  if (!circleGroup) return;
  
  // Get all selected destinations
  const selectedDestinations = getSelectedDestinations();
  
  // First, reset all circles to normal styling
  const allCircles = circleGroup.selectAll('circle');
  const zoomLevel = d3.zoomTransform(svg.node())?.k || 1;
  
  allCircles.transition().duration(CONFIG.DURATION.NORMAL)
    .attr('fill', CONFIG.COLORS.PRIMARY)
    .attr('stroke', CONFIG.COLORS.STROKE_NORMAL)
    .attr('stroke-width', CONFIG.STROKE_WIDTH.NORMAL)
    .attr('r', d => getBaseRadius(d, zoomLevel, CONFIG.STROKE_WIDTH.NORMAL));
  
  // Then highlight each selected destination
  selectedDestinations.forEach(dest => {
    const circles = circleGroup.selectAll('circle');
    const targetCircle = circles.filter(d => d.id === dest.id);
    
    if (!targetCircle.empty()) {
      applyCircleStyle(targetCircle, getCircleStyle('selected', zoomLevel), zoomLevel);
    }
  });
  
  updateInfoPanel();
}

// Highlight a specific destination by ID (called from scatterplot)
export function highlightDestination(destinationId) {
  if (!circleGroup) return;
  
  // Clear current selections
  clearSelections();
  
  // Find the destination data
  const destination = allData.find(d => d.id === destinationId);
  if (!destination) return;
  
  // Add to multi-selection (this will handle the visual styling)
  addToMultiSelection(destination);
  
  // Find and style the circle
  const circles = circleGroup.selectAll('circle');
  const targetCircle = circles.filter(d => d.id === destinationId);
  
  if (!targetCircle.empty()) {
    const zoomLevel = d3.zoomTransform(svg.node())?.k || 1;
    applyCircleStyle(targetCircle, getCircleStyle('selected', zoomLevel), zoomLevel);
    
    // Update info box
    const infoDiv = document.getElementById('destination-info');
    infoDiv.innerHTML = generateDestinationInfoHTML(destination);
    
    // Center map on selected destination
    const [x, y] = projection([destination.longitude, destination.latitude]);
    const centerX = svg.attr('width') / 2;
    const centerY = svg.attr('height') / 2;
    
    svg.transition().duration(CONFIG.DURATION.VERY_SLOW).call(
      zoom.transform,
      d3.zoomIdentity.translate(centerX - x, centerY - y)
    );
  }
}