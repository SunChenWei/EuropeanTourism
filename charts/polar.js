import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

export function createPolar() {
  const container = d3.select('#slot-polar .slot-body');
  const tooltip = d3.select('#tooltip');
  let svg, g, legend;
  let selectedSeasons = new Set();

  // Configuration
  const seasons = ["Spring","Summer","Fall","Winter","Year-round"];
  const colorScale = d3.scaleOrdinal()
    .domain(seasons)
    .range(["#4daf4a","#ffea00","#ff7f00","#377eb8","#999999"]);

  // Computes the chart size and radius based on container dimensions
  function getSize() {
    const bbox = container.node().getBoundingClientRect();           
    const chartWidth = bbox.width;
    const chartHeight = bbox.height;
    const size = Math.min(chartWidth, chartHeight);
    return {
        width: chartWidth,
        height: chartHeight,
        radius: size / 2 - 20,
        containerWidth: bbox.width
    };
  }

  // Renders or updates the polar chart based on the provided dataset
  function render(data) {
    const { width, height, radius } = getSize();
    const chartCenterX = width/2 - 70;   // offset for layout alignment
    const chartCenterY = height/2;

    container.style('position','relative');

    // Create SVG and legend once
    if (!svg) {
      svg = container.append('svg')
        .attr('width', width)
        .attr('height', height);
      g = svg.append('g')
        .attr('transform', `translate(${chartCenterX},${chartCenterY})`);

      legend = container.append('div')
        .attr('id','polar-legend')
        .style('position','absolute')
        .style('top','50%')
        .style('right','10px')
        .style('transform','translateY(-50%)')
        .style('background','rgba(255,255,255,0.9)')
        .style('padding','10px')
        .style('border-radius','8px')
        .style('box-shadow','0 0 6px rgba(0,0,0,0.2)')
        .style('font-family','sans-serif');

      createLegend();

    } else {
      g.selectAll('*').remove();
      g.attr('transform', `translate(${chartCenterX},${chartCenterY})`);
    }

    // Process data by season
    const seasonData = seasons.map(season => {
      const filtered = data.filter(d =>
        Array.isArray(d.season) ? d.season.includes(season) : d.season === season
      );
      return {
        season,
        count: filtered.length,
        avgVisitors: filtered.length ? d3.mean(filtered,d=>d.visitors) : 0
      };
    }).filter(d => d.count > 0); // remove empty slices

    // Scales
    const rScale = d3.scaleSqrt()
      .domain([0,d3.max(seasonData,d=>d.count)])
      .range([0,radius]);

    const angleScale = d3.scaleBand()
      .domain(seasonData.map(d=>d.season))
      .range([0,2*Math.PI]);

    const arcGenerator = d3.arc()
      .innerRadius(0)
      .outerRadius(d => rScale(d.count))
      .startAngle(d => angleScale(d.season))
      .endAngle(d => angleScale(d.season) + angleScale.bandwidth())
      .padAngle(0.02);

    // Draw slices
    const wedges = g.selectAll('path').data(seasonData,d=>d.season);
    wedges.exit().remove();

    wedges.enter().append('path')
      .attr('d',arcGenerator)
      .attr('fill', d=>colorScale(d.season))
      .attr('stroke','#333')
      .attr('stroke-width',1)
      .style('cursor','pointer')
      .style('opacity', d => selectedSeasons.size && !selectedSeasons.has(d.season) ? 0.3 : 1)
      .on('mouseover',(event,d)=>{
        tooltip.style('display','block')
          .html(`<strong>${d.season}</strong><br/>Destinations: ${d.count}<br/>Avg visitors: ${Math.round(d.avgVisitors)}`);
      })
      .on('mousemove', (event)=>{
        tooltip.style('left',(event.pageX+12)+'px')
               .style('top',(event.pageY+12)+'px');
      })
      .on('mouseout', ()=> tooltip.style('display','none'))
      .on('click',(event,d)=> toggleSeason(d.season))
      .merge(wedges)
      .transition().duration(750)
      .attr('d',arcGenerator)
      .attr('fill', d=>colorScale(d.season))
      .style('opacity', d => selectedSeasons.size && !selectedSeasons.has(d.season) ? 0.3 : 1);

    updateLegend();
  }

  // Builds the interactive legend for the chart
  function createLegend() {
    seasons.forEach(season => {
      const row = legend.append('div')
        .style('display','flex')
        .style('align-items','center')
        .style('gap','8px')
        .style('margin','4px 0')
        .style('cursor','pointer')
        .on('click', ()=> toggleSeason(season));

      const colorBox = row.append('div')
        .attr('class','legend-box')
        .style('width','20px')
        .style('height','20px')
        .style('background', colorScale(season))
        .style('border','1px solid #333')
        .style('border-radius','4px')
        .style('display','flex')
        .style('align-items','center')
        .style('justify-content','center');

      colorBox.append('span')
        .attr('class','checkmark')
        .style('color','#fff')
        .style('font-size','14px')
        .style('display','none')
        .text('✔');

      row.append('span')
        .text(season)
        .style('font-size','14px')
        .style('user-select','none');
    });
  }

  // Updates the legend’s checkmarks and opacity according to current selection
  function updateLegend() {
    legend.selectAll('.legend-box').each(function(_,i){
      const season = seasons[i];
      const box = d3.select(this);
      const check = box.select('.checkmark');
      const isActive = selectedSeasons.has(season);
      box.style('opacity', isActive || selectedSeasons.size===0 ? 1 : 0.3);
      check.style('display', isActive ? 'block' : 'none');
    });

    g.selectAll('path')
      .transition().duration(300)
      .style('opacity', d => selectedSeasons.size && !selectedSeasons.has(d.season) ? 0.3 : 1);
  }

  function toggleSeason(season) {
    if (selectedSeasons.has(season)) selectedSeasons.delete(season);
    else selectedSeasons.add(season);
    updateLegend();

    const event = new CustomEvent('polarFilter', { detail: Array.from(selectedSeasons) });
    window.dispatchEvent(event);
  }

  return { render, selectedSeasons, updateLegend };
}
