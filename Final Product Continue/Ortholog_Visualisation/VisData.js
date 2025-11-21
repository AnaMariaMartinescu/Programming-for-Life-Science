// VisData.js

const ENDPOINT = "https://query.wikidata.org/sparql";

// ------------- SPARQL QUERIES (1 per mode) -----------------

const QUERIES = {
  // Bubble: disease–tissue pairs, limited for overview
  bubble: `
    SELECT
      ?disease ?diseaseLabel
      ?tissue ?tissueLabel
      (COUNT(DISTINCT ?humanGene) AS ?geneCount)
    WHERE {
      ?humanGene wdt:P703 wd:Q15978631 ;
                 wdt:P594 ?humanEnsembl ;
                 wdt:P2293 ?disease ;
                 wdt:P684  ?ratGene .

      ?ratGene  wdt:P703 wd:Q184224 ;
                wdt:P594 ?ratEnsembl .

      ?disease wdt:P927 ?tissue .

      SERVICE wikibase:label {
        bd:serviceParam wikibase:language "en" .
      }
    }
    GROUP BY ?disease ?diseaseLabel ?tissue ?tissueLabel
    ORDER BY DESC(?geneCount)
    LIMIT 200
  `,

  // Heatmap: same shape, but we can keep more rows (matrix view)
  heatmap: `
    SELECT
      ?disease ?diseaseLabel
      ?tissue ?tissueLabel
      (COUNT(DISTINCT ?humanGene) AS ?geneCount)
    WHERE {
      ?humanGene wdt:P703 wd:Q15978631 ;
                 wdt:P594 ?humanEnsembl ;
                 wdt:P2293 ?disease ;
                 wdt:P684  ?ratGene .

      ?ratGene  wdt:P703 wd:Q184224 ;
                wdt:P594 ?ratEnsembl .

      ?disease wdt:P927 ?tissue .

      SERVICE wikibase:label {
        bd:serviceParam wikibase:language "en" .
      }
    }
    GROUP BY ?disease ?diseaseLabel ?tissue ?tissueLabel
    ORDER BY DESC(?geneCount)
    LIMIT 400
  `,

  // Bar chart: disease only (aggregated)
  bar: `
    SELECT
      ?disease ?diseaseLabel
      (COUNT(DISTINCT ?humanGene) AS ?geneCount)
    WHERE {
      ?humanGene wdt:P703 wd:Q15978631 ;
                 wdt:P594 ?humanEnsembl ;
                 wdt:P2293 ?disease ;
                 wdt:P684  ?ratGene .

      ?ratGene  wdt:P703 wd:Q184224 ;
                wdt:P594 ?ratEnsembl .

      ?disease wdt:P927 ?tissue .

      SERVICE wikibase:label {
        bd:serviceParam wikibase:language "en" .
      }
    }
    GROUP BY ?disease ?diseaseLabel
    ORDER BY DESC(?geneCount)
    LIMIT 20
  `
};

// ------------- STATE -----------------

let currentMode = "bubble";
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

// ------------ PROCESSORS PER MODE ----------------

// shared: compute top diseases/tissues from any disease–tissue bindings
function computeTopDiseaseTissue(bindings, topN = 10) {
  const diseaseTotals = new Map();
  const tissueTotals = new Map();

  for (const row of bindings) {
    const d = row.diseaseLabel.value;
    const t = row.tissueLabel.value;
    const c = parseInt(row.geneCount.value, 10);

    diseaseTotals.set(d, (diseaseTotals.get(d) || 0) + c);
    tissueTotals.set(t, (tissueTotals.get(t)  || 0) + c);
  }

  const topDiseases = [...diseaseTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([label]) => label);

  const topTissues = [...tissueTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([label]) => label);

  return { topDiseases, topTissues, diseaseTotals, tissueTotals };
}

function processBubble(bindings) {
  const { topDiseases, topTissues } = computeTopDiseaseTissue(bindings, 10);

  const xs = [];
  const ys = [];
  const sizes = [];
  const texts = [];

  for (const row of bindings) {
    const d = row.diseaseLabel.value;
    const t = row.tissueLabel.value;
    const c = parseInt(row.geneCount.value, 10);
    if (!topDiseases.includes(d) || !topTissues.includes(t)) continue;

    xs.push(d);
    ys.push(t);
    sizes.push(c * 6);
    texts.push(`${d} – ${t}<br>${c} genes`);
  }

  return { x: xs, y: ys, sizes, texts, topDiseases, topTissues };
}

function processHeatmap(bindings) {
  const { topDiseases, topTissues } = computeTopDiseaseTissue(bindings, 12);
  const dIndex = new Map(topDiseases.map((d, i) => [d, i]));
  const tIndex = new Map(topTissues.map((t, i) => [t, i]));
  const z = Array.from({ length: topTissues.length }, () =>
    Array(topDiseases.length).fill(0)
  );

  for (const row of bindings) {
    const d = row.diseaseLabel.value;
    const t = row.tissueLabel.value;
    const c = parseInt(row.geneCount.value, 10);
    if (!dIndex.has(d) || !tIndex.has(t)) continue;
    const di = dIndex.get(d);
    const ti = tIndex.get(t);
    z[ti][di] = c;
  }

  return { z, diseases: topDiseases, tissues: topTissues };
}

function processBar(bindings) {
  const labels = [];
  const counts = [];
  for (const row of bindings) {
    labels.push(row.diseaseLabel.value);
    counts.push(parseInt(row.geneCount.value, 10));
  }
  return { x: labels, y: counts };
}

// ------------ RENDERERS PER MODE ----------------

function renderBubble(data) {
  const container = document.getElementById("vis-area");
  const trace = {
    x: data.x,
    y: data.y,
    mode: "markers",
    marker: {
      size: data.sizes,
      sizemode: "area",
      sizeref: 2 * Math.max(...data.sizes) / (80 ** 2),
      opacity: 0.8
    },
    text: data.texts,
    hovertemplate: "%{text}<extra></extra>"
  };

  const layout = {
    title: "Disease–Tissue Gene Clusters (Bubble matrix)",
    xaxis: { title: "Diseases", tickangle: -45, automargin: true },
    yaxis: { title: "Tissues", automargin: true },
    margin: { t: 60, b: 150, l: 90, r: 30 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)"
  };

  Plotly.newPlot(container, [trace], layout, { responsive: true });
}

function renderHeatmap(data) {
  const container = document.getElementById("vis-area");
  const trace = {
    z: data.z,
    x: data.diseases,
    y: data.tissues,
    type: "heatmap",
    colorscale: "Viridis",
    colorbar: { title: "Gene count" },
    hovertemplate: "Disease: %{x}<br>Tissue: %{y}<br>Genes: %{z}<extra></extra>"
  };

  const layout = {
    title: "Disease–Tissue Gene Clusters (Heatmap)",
    xaxis: { tickangle: -45, automargin: true },
    yaxis: { automargin: true },
    margin: { t: 60, b: 150, l: 120, r: 30 }
  };

  Plotly.newPlot(container, [trace], layout, { responsive: true });
}

function renderBar(data) {
  const container = document.getElementById("vis-area");
  const trace = {
    x: data.x,
    y: data.y,
    type: "bar"
  };

  const layout = {
    title: "Top Diseases by Distinct Human Genes",
    xaxis: { tickangle: -45, automargin: true },
    yaxis: { title: "Distinct human genes (with rat orthologs)" },
    margin: { t: 60, b: 150, l: 70, r: 30 }
  };

  Plotly.newPlot(container, [trace], layout, { responsive: true });
}

// ------------ SWITCHING MODES ----------------

async function switchMode(mode) {
  currentMode = mode;

  const container = document.getElementById("vis-area");
  if (!container) return;

  // If we already have processed cached output, skip showing loading text to avoid flicker.
  const hasProcessedCache = !!(cache[mode] && cache[mode].processed);

  // Debounce the loading message so very-fast responses (cache) don't flash it.
  let loadingTimer = null;
  if (!hasProcessedCache) {
    loadingTimer = setTimeout(() => {
      container.textContent = "Loading data from Wikidata…";
    }, 150); // show loading only after 150ms
  }

  try {
    const bindings = await fetchBindings(mode);

    // Cancel any pending loading text and clear container so Plotly fully replaces it.
    if (loadingTimer) clearTimeout(loadingTimer);
    container.innerHTML = "";

    // process if not cached yet
    if (!cache[mode].processed) {
      let processed;
      if (mode === "bubble")      processed = processBubble(bindings);
      else if (mode === "heatmap") processed = processHeatmap(bindings);
      else if (mode === "bar")     processed = processBar(bindings);
      cache[mode].processed = processed;
    }

    const data = cache[mode].processed;

    if (mode === "bubble")      renderBubble(data);
    else if (mode === "heatmap") renderHeatmap(data);
    else if (mode === "bar")     renderBar(data);

  } catch (err) {
    if (loadingTimer) clearTimeout(loadingTimer);
    console.error(err);
    container.textContent = "Error loading visualization: " + (err.message || err);
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
  switchMode(currentMode); // default = "bubble"
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

// const DEFAULT_FETCH_TIMEOUT = 15000; // ms
