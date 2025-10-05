import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const tooltip = d3.select('#tooltip');
const container = d3.select('#scatter-container');
const containerNode = container.node();

let svg, g;

// Label maps
const safetyLabels = {
  "-1": "Restricted",
  "2": "Unsafe",
  "3": "Moderate",
  "4": "Safe",
  "5": "Very Safe"
};

// Get safety label from numeric value
function getSafetyLabel(safetyValue) {
  return safetyLabels[safetyValue.toString()] || safetyValue.toString();
}

const colLabels = {
  "1": "Free",
  "2": "Medium",
  "3": "Medium-high",
  "4": "High",
  "5": "Extremely high"
};

// Get container size
function getSize() {
  const bbox = containerNode.getBoundingClientRect();
  return {
    width: Math.max(320, bbox.width - 20),
    height: Math.max(260, bbox.height - 20)
  };
}

// Initialize scatter
export async function initScatter() {
  const size = getSize();
  
  svg = container.append('svg')
    .attr('width', size.width)
    .attr('height', size.height);
  
  g = svg.append('g')
    .attr('transform', `translate(20,30)`);
  
  window.addEventListener('resize', () => {
    // Resize handled in updateScatter
  });
}

// Update/draw scatterplot
export function updateScatter(data) {
  const size = getSize();

  svg.attr('width', size.width).attr('height', size.height);

  const margin = { top: 30, right: 160, bottom: 50, left: 20 };
  const innerW = size.width - margin.left - margin.right + 140;
  const innerH = size.height - margin.top - margin.bottom;

  // Scales
  const xDomainMin = Math.max(1, d3.min(data, d => d.visitors));
  const xDomainMax = d3.max(data, d => d.visitors);
  const xScale = d3.scaleLog()
    .domain([xDomainMin, xDomainMax])
    .range([0, innerW])
    .nice();

  const costLevels = ["Free", "Medium", "Medium-high", "High", "Extremely high"];
  const yScale = d3.scalePoint().domain(costLevels).range([innerH, 0]).padding(0.5);

  const colorScale = d3.scaleOrdinal()
    .domain([-1, 2, 3, 4, 5])
    .range(["#000000", "#e41a1c", "#ff7f00", "#4daf4a", "#377eb8"]);

  // Transition
  const t = d3.transition().duration(750).ease(d3.easeCubicOut);

  // Axes
  const xAxis = d3.axisBottom(xScale).ticks(6, "~s");
  const yAxis = d3.axisLeft(yScale).tickFormat(() => "");

  // X axis
  let xAxisG = g.select('g.x-axis');
  if (xAxisG.empty()) {
    xAxisG = g.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${innerH})`);
  }
  xAxisG.transition(t).call(xAxis);

  // X label
  let xLabel = xAxisG.select('text.label');
  if (xLabel.empty()) {
    xLabel = xAxisG.append('text').attr('class', 'label');
  }
  xLabel
    .attr('x', innerW / 2)
    .attr('y', 40)
    .attr('fill', '#333')
    .attr('text-anchor', 'middle')
    .style('font-size', '14px')
    .text('Approximate Annual Tourists');

  // Y axis
  let yAxisG = g.select('g.y-axis');
  if (yAxisG.empty()) {
    yAxisG = g.append('g').attr('class', 'y-axis');
  }
  yAxisG.transition(t).call(yAxis);

  // Y label
  let yLabel = yAxisG.select('text.label');
  if (yLabel.empty()) {
    yLabel = yAxisG.append('text').attr('class', 'label');
  }
  yLabel
    .attr('x', -15)
    .attr('y', -15)
    .attr('fill', '#333')
    .attr('text-anchor', 'start')
    .style('font-size', '14px')
    .text('Cost of Living');

  // Points
  const circles = g.selectAll('circle')
    .data(data, d => d.id);

  // Exit
  circles.exit()
    .transition(t)
    .style('opacity', 0)
    .attr('r', 0)
    .remove();

  // Enter
  const enter = circles.enter().append('circle')
    .attr('cx', d => xScale(d.visitors))
    .attr('cy', d => yScale(d.cost))
    .attr('r', 0)
    .style('opacity', 0)
    .attr('stroke', '#222')
    .attr('fill', d => colorScale(d.safety ?? -1));

  // Events
  enter
    .on('mouseover', (event, d) => {
      tooltip.style('display', 'block')
        .html(`<strong>${d.destination}</strong><br/>${d.country}<br/>Visitors: ${formatNumber(d.visitors)}<br/>Cost: ${d.cost}<br/>Safety: ${getSafetyLabel(d.safety)}`);

      // Check if this destination is already selected
      const selectedDestinations = window.getSelectedDestinations ? window.getSelectedDestinations() : [];
      const isSelected = selectedDestinations.find(dest => dest.id === d.id); 

      // Only apply hover effect if not selected
      if (!isSelected) {
        d3.select(event.currentTarget)
          .transition()
          .duration(200)
          .attr('r', 5);
      }
    })
    .on('mousemove', (event) => {
      tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY + 12) + 'px');
    })
    .on('mouseout', (event, d) => {
      tooltip.style('display', 'none');

      // Check if this destination is already selected
      const selectedDestinations = window.getSelectedDestinations ? window.getSelectedDestinations() : [];
      const isSelected = selectedDestinations.find(dest => dest.id === d.id);

      // Only return to normal size if not selected
      if (!isSelected) {
        d3.select(event.currentTarget)
          .transition()
          .duration(200)
          .attr('r', 3);
      }
    })
    .on('click', (event, d) => {

      const circle = d3.select(event.currentTarget);
      const infoDiv = document.getElementById('destination-info');
      
      // Debug: Check current selection state
      const currentSelections = window.getSelectedDestinations ? window.getSelectedDestinations() : [];
      
      // Check if this destination is already selected (using global selectedDestinations)
      const isAlreadySelected = window.getSelectedDestinations && 
        window.getSelectedDestinations().find(dest => dest.id === d.id);
      
      if (isAlreadySelected) {
        // Deselect this destination
        if (window.removeFromMultiSelection) {
          window.removeFromMultiSelection(d.id);
        }
        
        // Update dotmap to reflect deselection
        if (window.highlightAllDestinations) {
          window.highlightAllDestinations();
        }
        
        // Update scatter plot to reflect deselection
        if (window.highlightAllScatterDestinations) {
          window.highlightAllScatterDestinations();
        }
      } else {
        // Add to selection (max 5)
        if (window.getSelectedDestinations && window.getSelectedDestinations().length < 5) {
          if (window.addToMultiSelection) {
            window.addToMultiSelection(d);
          }
          
          // Update dotmap to reflect selection
          if (window.highlightAllDestinations) {
            window.highlightAllDestinations();
          }
          
          // Update scatter plot to reflect selection
          if (window.highlightAllScatterDestinations) {
            window.highlightAllScatterDestinations();
          } 
        } else {
          // Cannot add to selection
        }
      }
      
      // Update display based on selection count
      if (window.getSelectedDestinations) {
        const selectedDestinations = window.getSelectedDestinations();
        
        if (selectedDestinations.length === 0) {
          infoDiv.innerHTML = "[Info will appear here]";
        } else if (selectedDestinations.length === 1) {
          // Single selection - show details in sidebar
          const dest = selectedDestinations[0];
          infoDiv.innerHTML = `
            <div style="text-align:left; line-height:1.5;">
              <strong style="font-size:16px;font-weight:1000">${dest.destination}</strong><br/>
              Country: ${dest.country}<br/>
              Region: ${dest.region}<br/>
              Category: ${dest.category}<br/>
              Visitors: ${formatNumber(dest.visitors)}<br/>
              Cost of Living: ${dest.cost}<br/>
              Safety: ${getSafetyLabel(dest.safety)}
            </div>
          `;
        } else {
          // Multiple selections - empty sidebar
          infoDiv.innerHTML = "";
        }
      }
    });

  // Update
  enter.merge(circles)
    .transition(t)
    .attr('cx', d => xScale(d.visitors))
    .attr('cy', d => yScale(d.cost))
    .attr('fill', d => colorScale(d.safety ?? -1))
    .attr('r', d => {
      // Check if this destination is selected
      const selectedDestinations = window.getSelectedDestinations ? window.getSelectedDestinations() : [];
      const isSelected = selectedDestinations.find(dest => dest.id === d.id);

      if (isSelected) {
        return 5; // Selected radius
      } else {
        return 3; // Normal radius
      }
    })
    .attr('stroke', '#222') // Black stroke for all circles like reference
    .attr('stroke-width', d => {
      // Check if this destination is selected
      const selectedDestinations = window.getSelectedDestinations ? window.getSelectedDestinations() : [];
      const isSelected = selectedDestinations && Array.isArray(selectedDestinations) 
        ? selectedDestinations.find(dest => dest.id === d.id)
        : null;
      
      if (isSelected) {
        return 2; // Thick stroke for selected
      }
      return 1; // Thin stroke for normal
    })
    .style('opacity', 0.85);

  // Legend
  let legend = svg.select('.legend');
  if (legend.empty()) {
    const legendData = [
      { val: -1, label: "Restricted", color: "#000000" },
      { val: 2, label: "Unsafe", color: "#e41a1c" },
      { val: 3, label: "Moderate", color: "#ff7f00" },
      { val: 4, label: "Safe", color: "#4daf4a" },
      { val: 5, label: "Very Safe", color: "#377eb8" }
    ];
    legend = svg.append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${size.width - 80},250)`);

    // Color squares with rounded corners and stroke
    legend.selectAll(".legend-rect")
      .data(legendData)
      .join("rect")
      .attr("class", "legend-rect")
      .attr("x", 0)
      .attr("y", (d, i) => i * 18)
      .attr("width", 11)
      .attr("height", 11)
      .attr("fill", d => d.color)
      .attr("stroke", "#333")
      .attr("stroke-width", 1)
      .attr("rx", 3)
      .attr("ry", 3);

    // Legend labels with improved styling
    legend.selectAll(".legend-text")
      .data(legendData)
      .join("text")
      .attr("class", "legend-text")
      .attr("x", 16)
      .attr("y", (d, i) => i * 18 + 6)
      .text(d => d.label)
      .style("font-size", "12px")
      .style("font-family", "Inter, 'Helvetica Neue', Lato, sans-serif")
      .attr("fill", "#444")
      .attr("alignment-baseline", "middle");
  } else {
    legend.attr("transform", `translate(${size.width - 80},250)`);
  }
}

// Clear selection
export function clearScatterSelection() {
  // Reset all circles to normal styling
  if (g) {
    g.selectAll('circle')
      .transition().duration(200)
      .attr('r', 3)
      .attr('stroke-width', 1)
      .attr('stroke', '#222'); // Black stroke like reference
  }
}

// Highlight all selected destinations (called from dotmap)
export function highlightAllScatterDestinations() {
  if (!g) return;
  
  // Clear all selections first
  clearScatterSelection();
  
  // Get all selected destinations
  if (window.getSelectedDestinations) {
    const selectedDestinations = window.getSelectedDestinations();
    
    // Highlight each selected destination
    selectedDestinations.forEach(dest => {
      const circles = g.selectAll('circle');
      const targetCircle = circles.filter(d => d.id === dest.id);
      
      if (!targetCircle.empty()) {
        targetCircle.transition().duration(200)
          .attr('r', 5)
          .attr('stroke-width', 2)
          .attr('stroke', '#222'); 
      }
    });
  }
}

// Highlight a specific destination by ID (called from dotmap)
export function highlightScatterDestination(destinationId) {
  if (!g) return;
  
  // Find and highlight the destination
  const circles = g.selectAll('circle');
  const targetCircle = circles.filter(d => d.id === destinationId);
  
  if (!targetCircle.empty()) {
    targetCircle.transition().duration(200)
      .attr('r', 5)
      .attr('stroke-width', 2)
      .attr('stroke', '#222'); 
  }
}

// Format number
function formatNumber(n) {
  return n ? d3.format(",")(Math.round(n)) : "—";
}