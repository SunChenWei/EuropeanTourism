import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const DATA_PATH = "data/destinations.csv";
let idCount = 0;

function parseVisitors(value){
  if (!value) return null;
  let v = String(value).toLowerCase().trim();
  v = v.replace(/,/g,'').replace(/\(.*?\)/g,'');
  const num = parseFloat(v.replace(/[^\d\.]/g,''));
  return isNaN(num) ? null : num;
}

function mapCostToNum(c){
  const map = { "Free":1,"Medium":2,"Medium-high":3,"High":4,"Extremely high":5 };
  return map[c] ?? null;
}

function parseSeasons(value) {
    if (!value) return [];
    return value
      .replace(/\(.*?\)/g, '')          
      .split(/,|\/|or|and/i)          
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

export async function loadData(){
  const data = await d3.csv(DATA_PATH, d => ({
    id: idCount++,
    destination: d.Destination,
    country: d.Country,
    region: d.Region,
    category: d.Category,
    visitors: parseVisitors(d["Approximate Annual Tourists"]),
    cost: d["Cost of Living"]?.trim(),
    costNum: mapCostToNum(d["Cost of Living"]),
    safety: +d.Safety,
    season: parseSeasons(d["Best Time to Visit"]),
    longitude: +d.Longitude,
    latitude: +d.Latitude
  }));
  return data.filter(d => d.visitors && d.cost);
}
