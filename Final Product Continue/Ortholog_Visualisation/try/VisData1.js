// VisData.js

const ENDPOINT = "https://query.wikidata.org/sparql";

// Aggregated (disease, tissue, geneCount)
const QUERY = `
SELECT
  ?disease ?diseaseLabel
  ?tissue ?tissueLabel
  (COUNT(DISTINCT ?humanGene) AS ?geneCount)
WHERE {
  ?humanGene wdt:P703 wd:Q15978631 ;   # human
             wdt:P594 ?humanEnsembl ;
             wdt:P2293 ?disease ;      # gene -> disease
             wdt:P684 ?ratGene .       # ortholog

  ?ratGene  wdt:P703 wd:Q184224 ;
            wdt:P594 ?ratEnsembl .

  ?disease wdt:P927 ?tissue .          # anatomical structure affected

  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "en".
  }
}
GROUP BY ?disease ?diseaseLabel ?tissue ?tissueLabel
ORDER BY DESC(?geneCount)
LIMIT 200
`;

// global viz state
let vizState = null;
let currentMode = "bubble";

async function fetchBindings() {
  const url = ENDPOINT + "?format=json&query=" + encodeURIComponent(QUERY);
  const res = await fetch(url, {
    headers: { "Accept": "application/sparql-results+json" }
  });
  if (!res.ok) {
    throw new Error("SPARQL error: " + res.status + " " + res.statusText);
  }
  const json = await res.json();
  return json.results.bindings;
}

// Build data structures shared by all views
function processData(bindings) {
  // total gene count per disease / tissue
  const diseaseTotals = new Map();
  const tissueTotals = new Map();

  for (const row of bindings) {
    const d = row.diseaseLabel.value;
    const t = row.tissueLabel.value;
    const c = parseInt(row.geneCount.value, 10);

    diseaseTotals.set(d, (diseaseTotals.get(d) || 0) + c);
    tissueTotals.set(t, (tissueTotals.get(t) || 0) + c);
  }

  const topDiseases = [...diseaseTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label]) => label);

  const topTissues = [...tissueTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label]) => label);

  // --- Bubble data (scatter markers) ---
  const bubbleX = [];
  const bubbleY = [];
  const bubbleSizes = [];
  const bubbleText = [];

  // Heatmap matrix: rows=tissues, cols=diseases
  const dIndex = new Map(topDiseases.map((d, i) => [d, i]));
  const tIndex = new Map(topTissues.map((t, i) => [t, i]));
  const z = Array.from({ length: topTissues.length }, () =>
    Array(topDiseases.length).fill(0)
  );

  // Fill both bubble and heatmap
  for (const row of bindings) {
    const d = row.diseaseLabel.value;
    const t = row.tissueLabel.value;
    const c = parseInt(row.geneCount.value, 10);

    if (!topDiseases.includes(d) || !topTissues.includes(t)) continue;

    bubbleX.push(d);
    bubbleY.push(t);
    bubbleSizes.push(c * 6);
    bubbleText.push(`${d} – ${t}<br>${c} genes`);

    const di = dIndex.get(d);
    const ti = tIndex.get(t);
    z[ti][di] = c;
  }

  // Bar chart (diseases)
  const barX = topDiseases;
  const barY = topDiseases.map(d => diseaseTotals.get(d));

  return {
    bindings,
    topDiseases,
    topTissues,
    bubble: { x: bubbleX, y: bubbleY, sizes: bubbleSizes, text: bubbleText },
    heatmap: { z, diseases: topDiseases, tissues: topTissues },
    bar: { x: barX, y: barY }
  };
}

// ----------- RENDERERS -------------

function renderBubbleMatrix() {
  const container = document.getElementById("vis-area");
  const { x, y, sizes, text } = vizState.bubble;

  const trace = {
    x,
    y,
    mode: "markers",
    marker: {
      size: sizes,
      sizemode: "area",
      sizeref: 2 * Math.max(...sizes) / (80 ** 2),
      opacity: 0.8
    },
    text,
    hovertemplate: "%{text}<extra></extra>"
  };

  const layout = {
    title: "Disease–Tissue Gene Clusters (Bubble matrix)",
    xaxis: {
      title: "Diseases",
      tickangle: -45,
      automargin: true
    },
    yaxis: {
      title: "Tissues",
      automargin: true
    },
    margin: { t: 60, b: 150, l: 90, r: 30 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)"
  };

  Plotly.newPlot(container, [trace], layout, { responsive: true });
}

function renderHeatmap() {
  const container = document.getElementById("vis-area");
  const { z, diseases, tissues } = vizState.heatmap;

  const trace = {
    z,
    x: diseases,
    y: tissues,
    type: "heatmap",
    colorscale: "Viridis",
    colorbar: { title: "Gene count" },
    hovertemplate: "Disease: %{x}<br>Tissue: %{y}<br>Genes: %{z}<extra></extra>"
  };

  const layout = {
    title: "Disease–Tissue Gene Clusters (Heatmap)",
    xaxis: {
      tickangle: -45,
      automargin: true
    },
    yaxis: {
      automargin: true
    },
    margin: { t: 60, b: 150, l: 120, r: 30 }
  };

  Plotly.newPlot(container, [trace], layout, { responsive: true });
}

function renderBarChart() {
  const container = document.getElementById("vis-area");
  const { x, y } = vizState.bar;

  const trace = {
    x,
    y,
    type: "bar"
  };

  const layout = {
    title: "Top Diseases by Total Gene Count",
    xaxis: {
      tickangle: -45,
      automargin: true
    },
    yaxis: {
      title: "Total gene count"
    },
    margin: { t: 60, b: 150, l: 70, r: 30 }
  };

  Plotly.newPlot(container, [trace], layout, { responsive: true });
}

function renderCurrent() {
  if (!vizState) return;
  if (currentMode === "bubble") renderBubbleMatrix();
  else if (currentMode === "heatmap") renderHeatmap();
  else if (currentMode === "bar") renderBarChart();
}

// ----------- INIT -------------

async function init() {
  const container = document.getElementById("vis-area");
  if (!container) return;

  container.textContent = "Loading data from Wikidata…";

  try {
    const bindings = await fetchBindings();
    vizState = processData(bindings);
    renderCurrent();
  } catch (err) {
    console.error(err);
    container.textContent = "Error loading visualization: " + err.message;
  }

  // wire toggle buttons
  const buttons = document.querySelectorAll("[data-viz-mode]");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.vizMode;
      if (!mode || mode === currentMode) return;

      currentMode = mode;

      // update active styling
      buttons.forEach(b => b.classList.remove("viz-toggle-btn--active"));
      btn.classList.add("viz-toggle-btn--active");

      renderCurrent();
    });
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
