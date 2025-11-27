// CHANGE THE QUESRIES BELOW TO MODIFY THE VISUALIZATION
// Change the visualization models 
// 3 visualisation types is good keep the 3 bottons
// Think of some extra UI but keep it shit simple 

const ENDPOINT = "https://query.wikidata.org/sparql";

// ------------- SPARQL QUERIES (1 per mode) -----------------

const QUERIES = {
  // Bubble: disease–tissue pairs, limited for overview
  graph: `
PREFIX wd:  <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX bd:  <http://www.bigdata.com/rdf#>

SELECT
  ?disease ?diseaseLabel
  ?goTerm ?goTermLabel
  (COUNT(DISTINCT ?orthologSpecies) AS ?supportingSpecies)
WHERE {
  VALUES ?disease {
    wd:Q12174
    wd:Q11081
    wd:Q206901
    wd:Q844935
    wd:Q187255
    wd:Q8277
  }

  VALUES ?modelSpecies {
    wd:Q83310
    wd:Q184224
    wd:Q169444
    wd:Q130506
    wd:Q91703
    wd:Q27510868
  }

  ?humanGene wdt:P703 wd:Q15978631 ;
             wdt:P2293 ?disease ;
             wdt:P684  ?orthologGene ;
             wdt:P688  ?protein .

  ?orthologGene wdt:P703 ?orthologSpecies .
  FILTER(?orthologSpecies IN (?modelSpecies))

  ?protein wdt:P682 ?goTerm .

  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "en".
  }
}
GROUP BY
  ?disease ?diseaseLabel
  ?goTerm ?goTermLabel
ORDER BY
  ?diseaseLabel ?goTermLabel
   
  `,

  // Heatmap: same shape, but we can keep more rows (matrix view)
  grouped_bar_chart: `
  PREFIX wd:  <http://www.wikidata.org/entity/>
  PREFIX wdt: <http://www.wikidata.org/prop/direct/>
  PREFIX wikibase: <http://wikiba.se/ontology#>
  PREFIX bd:  <http://www.bigdata.com/rdf#>

  SELECT
    ?orthologSpecies ?orthologSpeciesLabel
    ?disease ?diseaseLabel
    (COUNT(DISTINCT ?goTerm) AS ?goAnnotationCount)
  WHERE {
    # 1) choose your six model organisms
    VALUES ?orthologSpecies {
      wd:Q83310      # mouse
      wd:Q184224     # rat
      wd:Q169444     # zebrafish
      wd:Q130506     # fly
      wd:Q91703      # worm
      wd:Q27510868   # yeast
    }

    # 2) choose a SMALL set of diseases (fill in from a "top N" query)
    VALUES ?disease {
      wd:Q12174     # obesity
      wd:Q11081     # Alzheimer's disease
      wd:Q206901    # amyotrophic lateral sclerosis
      wd:Q844935    # coronary artery disease
      wd:Q187255    # rheumatoid arthritis
      wd:Q8277      # multiple sclerosis
    }

    # 3) human genes connected to these diseases + their orthologs
    ?humanGene wdt:P703 wd:Q15978631 ;  # taxon = human
              wdt:P2293 ?disease ;
              wdt:P684  ?orthologGene .

    ?orthologGene wdt:P703 ?orthologSpecies .

    # 4) proteins and GO annotations
    ?humanGene wdt:P688 ?protein .
    ?protein wdt:P682 ?goTerm      # biological process

  

    SERVICE wikibase:label {
      bd:serviceParam wikibase:language "en" .
    }
  }
  GROUP BY
    ?orthologSpecies ?orthologSpeciesLabel
    ?disease ?diseaseLabel
  ORDER BY
    ?orthologSpeciesLabel
    ?diseaseLabel 
  `,

  // BAR PLOT: ortholog counts per species
  bar: `
#Takes all human genes (?humanGene with P703 = human).
# For each human gene, gets its ortholog model gene (P684 ?modelGene).
# Finds which species that model gene belongs to (?modelGene wdt:P703 ?species).
# Counts distinct model genes per species: COUNT(DISTINCT ?modelGene) AS ?orthologCount.

# So:“For each species, how many distinct ortholog model genes (of human genes) do we have?”
# No disease filter here.

#LEGEND 
# wdt:
# found in taxon (P703)
# ortholog (P684) -> orthologous gene in another species (use with 'species' qualifier)

# wd:
# Homo sapiens (Q15978631) -> species of mammal

# Note that ! symbol means "is NOT"


    SELECT ?species ?speciesLabel (COUNT(DISTINCT ?modelGene) AS ?orthologCount) WHERE {
      ?humanGene wdt:P703 wd:Q15978631 .
      ?humanGene wdt:P684 ?modelGene .
      ?modelGene wdt:P703 ?species .
      FILTER(?species != wd:Q15978631)
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    GROUP BY ?species ?speciesLabel
    HAVING (COUNT(DISTINCT ?modelGene) > 1000)
    ORDER BY DESC(?orthologCount)
  `
};

// ------------- STATE -----------------

let currentMode = "graph";
const cache = {}; // mode -> { bindings, processed }

// ------------- HELPERS -----------------

async function fetchBindings(mode) {
  // use cache if available
  if (cache[mode]?.bindings) return cache[mode].bindings;

  const query = QUERIES[mode];
  const url = ENDPOINT + "?format=json&query=" + encodeURIComponent(query);

  const res = await fetch(url, {
    headers: { "Accept": "application/sparql-results+json" }
  });
  if (!res.ok) {
    throw new Error(`SPARQL (${mode}) failed: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  const bindings = json.results.bindings;
  cache[mode] = cache[mode] || {};
  cache[mode].bindings = bindings;
  return bindings;
}


// Run the graph query independently and print top diseases per species to the console
(async () => {
  try {
    // use fetchBindings instead of undefined runQuery
    const rows = await fetchBindings("graph");

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      console.warn("Graph query returned no rows or invalid result.");
      return;
    }

    // quick sanity-processing log
    const processed = processGraph(rows);
    console.info("Graph rows:", rows.length, "Processed nodes:", processed.nodes?.length ?? 0);

  } catch (err) {
    console.error("Error running graph query:", err);
  }
})();


//----------------------------------------------------------

// PROCESSORS PER MODE 

//------------------------------------------------------------------------------------
function processGraph(bindings) {
  // bindings expected to contain:
  // ?disease ?diseaseLabel ?goTerm ?goTermLabel (COUNT(DISTINCT ?orthologSpecies) AS ?supportingSpecies)
  if (!Array.isArray(bindings) || bindings.length === 0) {
    return { nodes: [], links: [] };
  }

  // Map diseaseId -> { id, name, goTerms:Set, totalSpeciesSupport }
  const diseases = new Map();
  for (const b of bindings) {
    const dId = b.disease?.value || b.diseaseLabel?.value || ("unknown-" + Math.random());
    const dLabel = b.diseaseLabel?.value ?? dId;
    const goId = b.goTerm?.value ?? null;
    const goLabel = b.goTermLabel?.value ?? "";
    const speciesSupport = parseInt(b.supportingSpecies?.value ?? "0", 10);

    if (!diseases.has(dId)) {
      diseases.set(dId, {
        id: dId,
        name: dLabel,
        goTerms: new Set(),
        totalSpeciesSupport: 0
      });
    }
    const entry = diseases.get(dId);
    if (goId) entry.goTerms.add(goId + "|" + goLabel);
    entry.totalSpeciesSupport += isNaN(speciesSupport) ? 0 : speciesSupport;
  }

  const nodes = Array.from(diseases.values()).map(d => ({
    id: d.id,
    name: d.name,
    goTerms: Array.from(d.goTerms),
    totalSpeciesSupport: d.totalSpeciesSupport
  }));

  // build links by Jaccard similarity on GO term sets
  const links = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const setA = new Set(a.goTerms);
      const setB = new Set(b.goTerms);
      let inter = 0;
      for (const x of setA) if (setB.has(x)) inter++;
      const union = setA.size + setB.size - inter;
      const jaccard = union === 0 ? 0 : inter / union;
      // threshold to avoid hairball; tweak if desired
      if (jaccard > 0.02) {
        links.push({
          source: a.id,
          target: b.id,
          jaccard,
          intersection: inter,
          union
        });
      }
    }
  }

  return { nodes, links };
}
//------------------------------------------------------------------------------------
function processGroupedBarChart(bindings, { normalize = false } = {}) {
  if (!Array.isArray(bindings) || bindings.length === 0) {
    return { x: [], y: [], z: [], heatmapData: [] };
  }

  // build simple rows
  const rows = bindings.map(b => ({
    speciesLabel: b.orthologSpeciesLabel?.value ?? b.speciesLabel?.value ?? "Unknown",
    diseaseLabel: b.diseaseLabel?.value ?? "Unknown",
    goAnnotationCount: Number(b.goAnnotationCount?.value ?? 0)
  }));

  // preserve first-seen species & disease order
  const speciesLabels = [...new Set(rows.map(r => r.speciesLabel))];
  const diseaseLabels = [...new Set(rows.map(r => r.diseaseLabel))];

  // build heatmapData: one entry per species with array of disease objects
  const heatmapData = speciesLabels.map(sp => {
    const diseases = diseaseLabels.map(dLabel => {
      const found = rows.find(r => r.speciesLabel === sp && r.diseaseLabel === dLabel);
      return { diseaseLabel: dLabel, goAnnotationCount: found ? found.goAnnotationCount : 0 };
    });
    return { speciesLabel: sp, diseases };
  });

  // also build matrix (rows = diseases, cols = species) for backward compat
  const z = diseaseLabels.map(d => speciesLabels.map(s => {
    const cell = rows.find(r => r.diseaseLabel === d && r.speciesLabel === s);
    return cell ? cell.goAnnotationCount : 0;
  }));

  // optional row-normalization (kept as flag, but grouped bar uses raw counts)
  const zNorm = normalize
    ? z.map(row => {
        const max = Math.max(...row);
        return max === 0 ? row.slice() : row.map(v => v / max);
      })
    : z;

  return {
    x: speciesLabels,
    y: diseaseLabels,
    z: zNorm,
    rawZ: z,
    heatmapData
  };
}

function renderGroupedBarChart(processed) {
  // render grouped bar plot (ordered by totals: diseases & species)
  const res = ensurePlotRoot();
  const container = res?.plotRoot ?? document.getElementById("plotly-root");
  if (!container) return;

  hideVisLoader();
  const orphan = document.getElementById("heatmap-top-diseases");
  if (orphan) orphan.remove();

  const heatmapData = processed?.heatmapData ?? [];
  if (!heatmapData.length) {
    container.innerHTML = "<div style='padding:18px;color:#ddd'>No data to display.</div>";
    return;
  }

  // 1) compute disease totals (sum across species)
  const diseaseTotals = {};
  for (const sp of heatmapData) {
    for (const d of sp.diseases) {
      diseaseTotals[d.diseaseLabel] = (diseaseTotals[d.diseaseLabel] || 0) + (d.goAnnotationCount || 0);
    }
  }
  // order diseases high -> low
  const diseaseOrder = Object.keys(diseaseTotals).sort((a, b) => diseaseTotals[b] - diseaseTotals[a]);

  // 2) compute species totals and order species high -> low
  const speciesTotals = heatmapData.map(sp => ({
    speciesLabel: sp.speciesLabel,
    total: sp.diseases.reduce((s, d) => s + (d.goAnnotationCount || 0), 0)
  }));
  const sortedSpeciesLabels = speciesTotals.sort((a, b) => b.total - a.total).map(s => s.speciesLabel);

  // 3) custom colors (will repeat if there are more species than colors)
  const speciesColors = [
    "#047139ff", "#29b6b2ff", "#1957baff", "#8e57dfff", "#ff8dd9ff", 
  ];

  // 4) reorder species data
  const orderedSpeciesData = sortedSpeciesLabels.map(label => heatmapData.find(sp => sp.speciesLabel === label)).filter(Boolean);

  // 5) build traces (one per species)
  const traces = orderedSpeciesData.map((sp, idx) => ({
    x: diseaseOrder,
    y: diseaseOrder.map(dLabel => {
      const found = sp.diseases.find(d => d.diseaseLabel === dLabel);
      return found ? (found.goAnnotationCount || 0) : 0;
    }),
    name: sp.speciesLabel,
    type: "bar",
    marker: { color: speciesColors[idx % speciesColors.length] }
  }));

  // 6) plot into the existing plot root
  container.style.width = "100%";
  container.style.height = container.style.height || "520px";
  container.innerHTML = "";

  const layout = {
    title: "Go annotations per Disease across Ortholog Organism Species",
    barmode: "group",
    xaxis: { title: "Disease", tickangle: -30, automargin: true },
    yaxis: { title: "GO annotations (count)", automargin: true },
    margin: { t: 60, b: 140, l: 80, r: 30 },
    legend: { orientation: "v", x: 1.02, xanchor: "left", y: 1 }
  };

  Plotly.newPlot(container, traces, layout, { responsive: true })
    .then(() => { if (window.hideVisLoader) window.hideVisLoader(); })
    .catch(err => {
      console.error("renderHeatmap (grouped bar) failed:", err);
      container.textContent = "Failed to render grouped bar chart.";
    });
}
//------------------------------------------------------------------------------------
function processBar(bindings) {
  const labels = [];
  const counts = [];
  for (const row of bindings) {
    // handle either the new species/orthologCount 
    const label = row.speciesLabel?.value ?? row.diseaseLabel?.value ?? "Unknown";
    const count = parseInt(row.orthologCount?.value ?? row.geneCount?.value ?? "0", 10);
    labels.push(label);
    counts.push(count);
  }
  return { x: labels, y: counts };
}

// ------------ RENDERERS PER MODE ----------------

// update renderers to target the inner plot root
function renderGraph(data) {
  // ensure any leftover graph UI from a previous render is cleared first
  // use existing bubble-removal helper (removeGraphUI didn't exist)
  removeBubbleUI();

  const plotRoot = document.getElementById("plotly-root");
  if (!plotRoot) return;
  plotRoot.innerHTML = ""; // ensure clean target
  // remove loader overlays now that we're drawing
  if (window.hideVisLoader) window.hideVisLoader();

  const nodes = (data && data.nodes) || [];
  const links = (data && data.links) || [];

  if (!nodes.length) {
    plotRoot.innerHTML = "<div style='padding:12px;color:#666'>No data to display for bubble visualization.</div>";
    return;
  }

  // create simple tooltip inside vis-area
  let tooltip = document.getElementById("vis-bubble-tooltip");
  const visArea = document.getElementById("vis-area");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "vis-bubble-tooltip";
    tooltip.style.position = "absolute"; // positioned relative to vis-area
    tooltip.style.pointerEvents = "none";
    tooltip.style.padding = "8px 10px";
    tooltip.style.background = "rgba(17,24,39,0.94)";
    tooltip.style.color = "#fff";
    tooltip.style.fontSize = "12px";
    tooltip.style.borderRadius = "6px";
    tooltip.style.boxShadow = "0 6px 18px rgba(2,6,23,0.3)";
    tooltip.style.transition = "opacity 120ms ease, transform 120ms ease";
    tooltip.style.opacity = "0";
    tooltip.style.zIndex = "999";
    // ensure vis-area exists and is positioned so absolute tooltip is inside it
    if (visArea && window.getComputedStyle(visArea).position === "static") {
      visArea.style.position = "relative";
    }
    visArea.appendChild(tooltip);
  }

  // helper: position tooltip inside vis-area bounded by its rect
  function positionTooltipWithinVisArea(event, tip) {
    if (!visArea || !tip) return;
    const areaRect = visArea.getBoundingClientRect();
    // prefer client coordinates, account for page scroll
    const relX = event.clientX - areaRect.left;
    const relY = event.clientY - areaRect.top;

    // set content first so size can be measured
    tip.style.left = "0px";
    tip.style.top = "0px";
    tip.style.opacity = "0";
    tip.style.transform = "translateY(0)";

    // measure
    const tipRect = tip.getBoundingClientRect();
    const tipW = tipRect.width || 160;
    const tipH = tipRect.height || 40;

    // desired offset (right and down)
    const offsetX = 12;
    const offsetY = 8;

    let left = relX + offsetX;
    let top = relY + offsetY;

    // if tooltip would overflow right edge, flip left
    const maxLeft = areaRect.width - tipW - 6;
    if (left > maxLeft) {
      left = Math.max(6, relX - tipW - offsetX);
    }
    // if tooltip would overflow bottom, move above cursor
    const maxTop = areaRect.height - tipH - 6;
    if (top > maxTop) {
      top = Math.max(6, relY - tipH - offsetY);
    }

    // apply (use px relative to vis-area)
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
    tip.style.opacity = "1";
    tip.style.transform = "translateY(-4px)";
  }
  
  // ensure plotRoot has a height
  plotRoot.style.width = "100%";
  plotRoot.style.height = plotRoot.style.height || "520px";

  // build SVG
  const width = plotRoot.clientWidth || 900;
  const height = plotRoot.clientHeight || 520;

  const svg = d3.select(plotRoot)
    .append("svg")
    .attr("width", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  // color: categorical, one distinct color per disease (node.id)
  // build a base palette and repeat if there are more nodes than colors
  const basePal = (d3.schemeTableau10 && d3.schemeTableau10.slice()) ||
                  (d3.schemeCategory10 && d3.schemeCategory10.slice()) ||
                  ["#4f46e5","#f97316","#10b981","#ef4444","#8b5cf6","#06b6d4","#f59e0b","#ec4899","#a3e635","#60a5fa"];
  const palette = [];
  while (palette.length < nodes.length) palette.push(...basePal);
  palette.length = Math.max(nodes.length, basePal.length);
  const color = d3.scaleOrdinal()
    .domain(nodes.map(d => d.id))
    .range(palette);

  // radius scale based on number of GO terms
  const rExtent = d3.extent(nodes, d => d.goTerms.length || 0);
  const rScale = d3.scaleSqrt()
    .domain(rExtent)
    .range([12, 46]);

  const wExtent = d3.extent(links, d => d.jaccard || 0);
  const wScale = d3.scaleLinear().domain(wExtent).range([0.6, 4]);

  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(160).strength(0.6))
    .force("charge", d3.forceManyBody().strength(-200))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide().radius(d => (rScale(d.goTerms.length) || 12) + 4));

  const link = svg.append("g")
    .attr("stroke", "#c9c9f0ff")
    .attr("stroke-opacity", 0.45)
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("stroke-width", d => Math.max(0.6, wScale(d.jaccard)));

  const node = svg.append("g")
    .selectAll("g")
    .data(nodes)
    .join("g")
    .attr("cursor", "pointer")
    .call(d3.drag()
      .filter(event => !event.button)
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.2).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
      }));

  node.append("circle")
    .attr("r", d => rScale(d.goTerms.length || 0))
    .attr("fill", d => color(d.id)) // color by disease id
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.2)
    .on("mousemove", (event, d) => {
      tooltip.innerHTML = `<strong>${d.name}</strong><div style="font-size:12px;color:#d1d5db">GO terms: ${d.goTerms.length || 0} | ortholog support: ${d.totalSpeciesSupport || 0}</div>`;
      positionTooltipWithinVisArea(event, tooltip);
    })
    .on("mouseout", () => {
      tooltip.style.opacity = "0";
      tooltip.style.transform = "translateY(0)";
    })
    .on("click", (event, d) => {
      // placeholder for click behaviour (expand, navigate, details)
      console.log("bubble click", d);
    });

  node.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", d => (rScale(d.goTerms.length || 0) > 20 ? ".35em" : ".35em"))
    .style("pointer-events", "none")
    .style("font-size", d => Math.max(10, Math.min(13, (rScale(d.goTerms.length || 0) / 3))) + "px")
    .style("fill", "#ffffff") // force white text inside bubbles
    .text(d => {
      // short label: try disease name, fallback to id
      const words = (d.name || d.id || "").split(" ");
      return rScale(d.goTerms.length || 0) > 18 ? words.slice(0, 3).join(" ") : "";
    });

  simulation.on("tick", () => {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

    node.attr("transform", d => `translate(${d.x},${d.y})`);
  });

  // --- LEGEND + SUMMARY --------------------------------------------------
  // bottom legend (light text)
  const bottomLegend = document.createElement("div");
  bottomLegend.id = "vis-bubble-legend";                // <-- give an id so it can be removed
  bottomLegend.style.fontSize = "12px";
  bottomLegend.style.color = "#d1d5db";
  bottomLegend.style.margin = "8px 12px";
  bottomLegend.style.maxWidth = "100%";
  bottomLegend.innerHTML = `
    <strong>Legend</strong><br>
    • Node = disease<br>
    • Radius = # GO terms<br>
    • Color = disease (distinct color per disease)<br>
    • Edge width = Jaccard similarity between GO sets
  `;
  plotRoot.appendChild(bottomLegend);

  // side summary box (right side of vis-area)
  const legendHost = visArea || plotRoot.parentElement || document.body;
  let summary = document.getElementById("vis-bubble-summary");
  if (!summary) {
    summary = document.createElement("div");
    summary.id = "vis-bubble-summary";
    summary.style.position = "absolute";
    summary.style.right = "24px";
    summary.style.bottom = "32px";
    summary.style.maxWidth = "320px";
    summary.style.padding = "12px 16px";
    summary.style.borderRadius = "10px";
    summary.style.background = "rgba(15,23,42,0.92)";
    summary.style.color = "#e5e7eb";
    summary.style.fontSize = "12px";
    summary.style.lineHeight = "1.4";
    summary.style.boxShadow = "0 12px 30px rgba(15,23,42,0.7)";
    summary.style.zIndex = "998";
    // do not block mouse interactions over the plot
    summary.style.pointerEvents = "none";

    // ensure host positioned for absolute children
    if (legendHost && window.getComputedStyle(legendHost).position === "static") {
      legendHost.style.position = "relative";
    }
    (legendHost || document.body).appendChild(summary);
  }

  // compute summary stats (safe guards for empty arrays)
  const maxSupportNode = nodes.length ? nodes.reduce((best, d) =>
    (best == null || (d.totalSpeciesSupport || 0) > (best.totalSpeciesSupport || 0)) ? d : best
  , null) : null;

  const maxGoNode = nodes.length ? nodes.reduce((best, d) =>
    (best == null || (d.goTerms.length || 0) > (best.goTerms.length || 0)) ? d : best
  , null) : null;

  const strongestLink = links.length ? links.reduce((best, l) =>
    (best == null || (l.jaccard || 0) > (best.jaccard || 0)) ? l : best
  , null) : null;

  // helper to get node name from id or object
  const nodeById = new Map(nodes.map(n => [n.id, n]));
  const formatNodeName = d => d ? (d.name || d.id || "—") : "—";

  // strong link endpoints may be strings or resolved node objects (after forceLink)
  const extractId = v => {
    if (!v) return null;
    if (typeof v === "string") return v;
    if (typeof v === "object") return v.id || (v.source && extractId(v.source)) || null;
    return null;
  };

  const mostSimilarPair = strongestLink
    ? `${formatNodeName(nodeById.get(extractId(strongestLink.source)))} ↔ ${formatNodeName(nodeById.get(extractId(strongestLink.target)))}`
    : "—";

  summary.innerHTML = `
    <div style="font-weight:600;font-size:13px;margin-bottom:6px;">
      Bubble network summary
    </div>
    <div style="color:#9ca3af;font-size:12px;">
      <div><strong>Most GO-annotated disease:</strong><br>
        ${formatNodeName(maxGoNode)} (${maxGoNode?.goTerms.length || 0} GO terms)</div>
      <div style="margin-top:8px;"><strong>Strongest ortholog support:</strong><br>
        ${formatNodeName(maxSupportNode)} (${maxSupportNode?.totalSpeciesSupport || 0} ortholog hits)</div>
      <div style="margin-top:8px;"><strong>Most similar pair (edges):</strong><br>
        ${mostSimilarPair}
        ${strongestLink ? `(Jaccard = ${Number(strongestLink.jaccard || 0).toFixed(3)})` : ""}
      </div>
      <div style="margin-top:8px;">
        <strong>Edges:</strong> thicker lines = higher overlap in GO terms between diseases.
      </div>
    </div>
  `;
}

// helper: remove bubble-only UI elements (legend, summary, tooltip)
function removeBubbleUI() {
  const ids = ["vis-bubble-summary", "vis-bubble-legend", "vis-bubble-tooltip", "bubble-side-legend", "vis-bubble-top-legend"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el && el.parentElement) el.parentElement.removeChild(el);
  });
}

// helper: remove any UI artifacts created by any renderer (single entrypoint)
function clearVizArtifacts() {
  // remove bubble-specific UI
  removeBubbleUI();

  // remove heatmap/bar specific DOM nodes (if present)
  ["heatmap-top-diseases", "species-bar", "plot-overlay", "species-side-panel", "vis-bubble-legend", "vis-bubble-summary", "vis-bubble-tooltip"].forEach(id => {
    const el = document.getElementById(id);
    if (el && el.parentElement) el.parentElement.removeChild(el);
  });

  // remove generic overlay / loaders / placeholders
  const visArea = document.getElementById("vis-area");
  if (visArea) {
    visArea.querySelectorAll(".loader, .longfazers, .loader-simple, .vis-placeholder").forEach(n => n.remove());
  }

  // clear the plot root content but do NOT remove the container element itself
  const plotRoot = document.getElementById("plotly-root");
  if (plotRoot) plotRoot.innerHTML = "";
}

// ---------- LOADER DOM HELPERS (show during fetch + plot) ----------
function ensurePlotRoot() {
  const visArea = document.getElementById("vis-area");
  if (!visArea) return null;
  let plotRoot = document.getElementById("plotly-root");
  if (!plotRoot) {
    plotRoot = document.createElement("div");
    plotRoot.id = "plotly-root";
    plotRoot.style.width = "100%";
    // use a fixed height so plots don't collapse/overlap; adjust to taste
    plotRoot.style.height = "360px";
    plotRoot.style.boxSizing = "border-box";
    // keep plot root in DOM but loader overlays are positioned absolutely above it
    visArea.appendChild(plotRoot);
  }
  return { visArea, plotRoot };
}

function showVisLoader() {
  const res = ensurePlotRoot();
  if (!res) return;
  const { visArea } = res;

  // if loader already exists, do nothing
  if (visArea.querySelector(".loader") || visArea.querySelector(".longfazers")) return;

  // create loader element structure (avoid innerHTML where possible)
  const loader = document.createElement("div");
  loader.className = "loader";
  loader.setAttribute("role", "status");

  const outerSpan = document.createElement("span");
  // inner four spans
  for (let i = 0; i < 4; i++) {
    const s = document.createElement("span");
    outerSpan.appendChild(s);
  }
  loader.appendChild(outerSpan);

  const base = document.createElement("div");
  base.className = "base";
  const baseSpan = document.createElement("span");
  base.appendChild(baseSpan);
  const face = document.createElement("div");
  face.className = "face";
  base.appendChild(face);
  loader.appendChild(base);

  const longfazers = document.createElement("div");
  longfazers.className = "longfazers";
  for (let i = 0; i < 4; i++) {
    const s = document.createElement("span");
    longfazers.appendChild(s);
  }

  const label = document.createElement("div");
  label.className = "vis-placeholder";
  label.textContent = "Loading visualization…";

  // append loader and longfazers under the visualization area
  visArea.appendChild(loader);
  visArea.appendChild(longfazers);
  visArea.appendChild(label);
}

function hideVisLoader() {
  const visArea = document.getElementById("vis-area");
  if (!visArea) return;
  // remove any previous overlays / loader elements
  visArea.querySelectorAll(".loader, .longfazers, .loader-simple, .vis-placeholder, .longfazers").forEach(n => n.remove());
}

// expose globally (backwards compat with any usage in HTML)
window.showVisLoader = showVisLoader;
window.hideVisLoader = hideVisLoader;
// ---------- end loader helpers ----------

// update switchMode so it cleans previous artifacts first
async function switchMode(mode) {
  currentMode = mode;

  // central cleanup BEFORE showing loader or fetching
  clearVizArtifacts();

  const visArea = document.getElementById("vis-area");
  const plotRoot = ensurePlotRoot()?.plotRoot;
  if (!visArea || !plotRoot) return;

  // remove any orphaned extra container created previously
  const orphan = document.getElementById("heatmap-top-diseases");
  if (orphan) orphan.remove();

  // show overlay loader immediately (covers fetch + plotting)
  showVisLoader();

  const hasProcessedCache = !!(cache[mode] && cache[mode].processed);

  let loadingTimer = null;
  if (!hasProcessedCache) {
    loadingTimer = setTimeout(() => {
      plotRoot.textContent = "Loading data from Wikidata…";
    }, 150);
  }

  try {
    const bindings = await fetchBindings(mode);

    if (loadingTimer) clearTimeout(loadingTimer);
    plotRoot.innerHTML = "";

    if (!cache[mode].processed) {
      let processed;
      if (mode === "graph") processed = processGraph(bindings);
      else if (mode === "grouped_bar_chart") processed = processGroupedBarChart(bindings);
      else if (mode === "bar") processed = processBar(bindings);
      cache[mode].processed = processed;
    }

    const data = cache[mode].processed;

    if (mode === "graph") renderGraph(data);
    else if (mode === "grouped_bar_chart") renderGroupedBarChart(data);
    else if (mode === "bar") renderBar(data);

  } catch (err) {
    if (loadingTimer) clearTimeout(loadingTimer);
    console.error(err);
    hideVisLoader();
    plotRoot.textContent = "Error loading visualization: " + (err.message || err);
  }
}

function setupToggleButtons() {
  const buttons = document.querySelectorAll("[data-viz-mode]");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.vizMode;
      if (!mode || mode === currentMode) return;

      // update active class
      buttons.forEach(b => b.classList.remove("viz-toggle-btn--active"));
      btn.classList.add("viz-toggle-btn--active");

      switchMode(mode);
    });
  });
}

// ------------ INIT ----------------

function init() {
  setupToggleButtons();
  // don't auto-render here; visualizations.html startFromHash will call switchMode(mode)
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

function renderBar(bindingsOrProcessed) {
  removeBubbleUI();
  const res = ensurePlotRoot();
  const container = res?.plotRoot ?? document.getElementById("plotly-root");
  if (!container) return;
  hideVisLoader();
  container.innerHTML = "";
  container.style.width = "100%";
  container.style.height = container.style.height || "520px";

  // accept either processed object {x,y} or raw bindings array
  let processed;
  if (bindingsOrProcessed && Array.isArray(bindingsOrProcessed.x) && Array.isArray(bindingsOrProcessed.y)) {
    processed = bindingsOrProcessed;
  } else if (Array.isArray(bindingsOrProcessed)) {
    processed = processBar(bindingsOrProcessed);
  } else {
    processed = cache.bar?.processed || processBar(cache.bar?.bindings || []);
  }

  // --- local species images/info (place files in project_root/images/) ---
  const speciesInfo = {
    "house mouse": {
      img: "images/House Mouse.jpg",
      scientific: "Mus musculus",
      text: "The house mouse is a small mammal of the order Rodentia; widely used as a model organism."
    },
    "brown rat": {
      img: "images/Brown Rat.jpg",
      scientific: "Rattus norvegicus",
      text: "The brown rat is commonly used in physiology and toxicology research."
    },
    "Danio rerio": {
      img: "images/Danio rerio.jpg",
      scientific: "Danio rerio",
      text: "Zebrafish are a popular developmental and genetic model organism."
    },
    "Drosophila melanogaster": {
      img: "images/Drosophila melanogaster.jpg",
      scientific: "Drosophila melanogaster",
      text: "Fruit fly — classic genetic model organism."
    },
    "Caenorhabditis elegans": {
      img: "images/Caenorhabditis elegans.jpg",
      scientific: "Caenorhabditis elegans",
      text: "Nematode used extensively in developmental biology and neurobiology."
    },
    "Saccharomyces cerevisiae S288c": {
      img: "images/Saccharomyces cerevisiae S288c.jpg",
      scientific: "Saccharomyces cerevisiae",
      text: "Baker's yeast — unicellular eukaryote used in many molecular studies."
    },
    // fallback placeholder
    "": { img: "images/placeholder.png", text: "No description available." }
  };
  
  const { x = [], y = [] } = processed;
  if (!x.length) {
    container.innerHTML = "<div style='padding:12px;color:#666'>No data to display for bar chart.</div>";
    return;
  }

  // create / reuse inner div for Plotly (so we don't clobber other overlays)
  let barDiv = document.getElementById("species-bar");
  if (!barDiv) {
    barDiv = document.createElement("div");
    barDiv.id = "species-bar";
    barDiv.style.width = "100%";
    barDiv.style.height = "100%";
    container.appendChild(barDiv);
  } else {
    barDiv.innerHTML = "";
  }

  // --- render the Plotly bar chart (was accidentally removed) ---
  const trace = {
    x,
    y,
    type: "bar",
    marker: { color: "#456df1", line: { width: 1 } }
  };

  const layout = {
    margin: { t: 40, r: 10, b: 80, l: 60 },
    title: "Ortholog support per model organism",
    xaxis: { automargin: true, tickangle: -30 },
    yaxis: { title: "Number of ortholog genes" }
  };

  Plotly.newPlot(barDiv, [trace], layout, { responsive: true })
    .then(() => { if (window.hideVisLoader) window.hideVisLoader(); })
    .catch(err => {
      console.error("renderBar failed:", err);
      barDiv.innerHTML = "<div style='padding:12px;color:#666'>Failed to render bar chart.</div>";
    });

  // --- SIDE PANEL + OVERLAY (create once, show on click) ---
  const legendHost = res?.visArea ?? container.parentElement ?? document.body;
  if (legendHost && window.getComputedStyle(legendHost).position === "static") {
    legendHost.style.position = "relative";
  }

  // Create overlay + panel once, keep references to inner elements for fast updates
  let overlay = document.getElementById("plot-overlay");
  let sidePanel = document.getElementById("species-side-panel");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "plot-overlay";
    Object.assign(overlay.style, {
      position: "absolute", left: "0", top: "0", right: "0", bottom: "0",
      background: "rgba(27, 27, 27, 0.64)", zIndex: "995", display: "none", cursor: "pointer"
    });
    (legendHost || document.body).appendChild(overlay);
  }

  if (!sidePanel) {
    sidePanel = document.createElement("aside");
    sidePanel.id = "species-side-panel";
    Object.assign(sidePanel.style, {
      position: "absolute", top: "24px", right: "24px", width: "360px",
      maxWidth: "calc(100% - 48px)", bottom: "24px", overflow: "auto",
      background: "#252525ff", color: "#141414ff", borderRadius: "8px", padding: "18px",
      zIndex: "998", display: "none", transition: "opacity 180ms ease"
    });

    // inner structure (no innerHTML)
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close");
    Object.assign(closeBtn.style, { position: "absolute", top: "10px", right: "12px", width: "34px", height: "34px", border: "none", background: "transparent", color: "#444", fontSize: "18px", cursor: "pointer", padding: "0" });
    closeBtn.textContent = "✕";

    const titleEl = document.createElement("h2");
    Object.assign(titleEl.style, { margin: "0 0 6px 0", fontSize: "20px", fontWeight: "700", color: "#ffffffff" });

    const sciEl = document.createElement("div");
    sciEl.style.fontStyle = "italic";
    sciEl.style.color = "#dadadaff";
    sciEl.style.marginBottom = "12px";

    const imgWrap = document.createElement("div");
    Object.assign(imgWrap.style, { width: "100%", height: "200px", borderRadius: "8px", overflow: "hidden", marginBottom: "12px" });
    const imgEl = document.createElement("img");
    Object.assign(imgEl.style, { width: "100%", height: "100%", objectFit: "cover", display: "block" });
    imgWrap.appendChild(imgEl);

    const countLabel = document.createElement("div");
    Object.assign(countLabel.style, { marginBottom: "8px", color: "#75a5ffff", fontSize: "13px", fontWeight: "600" });
    countLabel.textContent = "Ortholog Count";

    const countVal = document.createElement("div");
    Object.assign(countVal.style, { fontSize: "28px", color: "#1565ff", fontWeight: "700", marginBottom: "12px" });

    const descEl = document.createElement("div");
    Object.assign(descEl.style, { color: "#e0e0e0ff", fontSize: "13px", lineHeight: "1.45" });

    sidePanel.appendChild(closeBtn);
    sidePanel.appendChild(titleEl);
    sidePanel.appendChild(sciEl);
    sidePanel.appendChild(imgWrap);
    sidePanel.appendChild(countLabel);
    sidePanel.appendChild(countVal);
    sidePanel.appendChild(descEl);

    (legendHost || document.body).appendChild(sidePanel);

    // hide handler
    function hidePanel() {
      overlay.style.display = "none";
      sidePanel.style.opacity = "0";
      setTimeout(() => { sidePanel.style.display = "none"; }, 200);
    }
    overlay.addEventListener("click", hidePanel);
    closeBtn.addEventListener("click", hidePanel);

    // helper to open panel with data
    window.openSidePanel = function openSidePanel({ title = "", scientific = "", img = "images/placeholder.png", count = "", text = "" } = {}) {
      titleEl.textContent = title;
      sciEl.textContent = scientific;
      imgEl.src = img;
      imgEl.alt = title;
      countVal.textContent = (count !== null && count !== undefined) ? Number(count).toLocaleString() : "";
      descEl.textContent = text || "No description available.";
      overlay.style.display = "block";
      sidePanel.style.display = "block";
      requestAnimationFrame(() => { sidePanel.style.opacity = "1"; });
      sidePanel.scrollTop = 0;
    };
  }

  // attach Plotly click handler to call openSidePanel (no innerHTML)
  if (barDiv && typeof barDiv.on === "function") {
    barDiv.on("plotly_click", function (evt) {
      const pt = evt.points && evt.points[0];
      if (!pt) return;
      const label = pt.x;
      const count = pt.y;
      const mapped = speciesInfo[label] || ((typeof label === "string" && processed?.meta?.infoMap?.[label]) || {});
      const imgUrl = mapped.img || "images/placeholder.png";
      const sci = mapped.scientific || "";
      const text = mapped.text || "No description available.";
      if (typeof window.openSidePanel === "function") {
        window.openSidePanel({ title: label, scientific: sci, img: imgUrl, count, text });
      }
    });
  }
}



