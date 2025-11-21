const ENDPOINT = "https://query.wikidata.org/sparql";

async function fetchSPARQL(query) {
  const url = ENDPOINT + "?format=json&query=" + encodeURIComponent(query);
  const res = await fetch(url, {
    headers: { "Accept": "application/sparql-results+json" }
  });

  if (!res.ok) {
    throw new Error("SPARQL error: " + res.status + " " + res.statusText);
  }

  const json = await res.json();
  return json.results.bindings;
}

const QUERY = `
SELECT
  ?tissue ?tissueLabel
  ?species ?speciesLabel
  (COUNT(DISTINCT ?humanGene) AS ?numGenes)
WHERE {
  ?humanGene wdt:P703 wd:Q15978631 ;
             wdt:P2293 ?disease ;
             wdt:P684 ?modelGene .

  ?modelGene wdt:P703 ?species .

  ?disease wdt:P927 ?tissue .

  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY
  ?tissue ?tissueLabel
  ?species ?speciesLabel
ORDER BY
  DESC(?numGenes)
`;

function organizeMatrix(bindings) {
  const tissues = [];
  const species = [];
  const matrix = {}; // tissue -> { species: numGenes }

  bindings.forEach(row => {
    const tissue = row.tissueLabel?.value || "Unknown";
    const sp = row.speciesLabel?.value || "Unknown";
    const num = Number(row.numGenes?.value);
    const count = Number.isFinite(num) ? Math.round(num) : 0;

    if (!tissues.includes(tissue)) tissues.push(tissue);
    if (!species.includes(sp)) species.push(sp);

    if (!matrix[tissue]) matrix[tissue] = {};
    matrix[tissue][sp] = count;
  });

  return { tissues, species, matrix };
}

function drawGroupedBarPlot({ tissues, species, matrix }) {
  const container = document.getElementById("vis-area");
  container.innerHTML = "";
  
  const traces = species.map(sp => {
    return {
      x: tissues,
      y: tissues.map(t => matrix[t][sp] || 0),
      name: sp,
      type: "bar"
    };
  });

  const layout = {
    title: "Number of Genes per Tissue per Model Species",
    barmode: "group",
    xaxis: { title: "Tissue", automargin: true },
    yaxis: { title: "Gene count" },
    margin: { t: 50, b: 150 }
  };

  Plotly.newPlot(container, traces, layout);
}

function drawStackedBarPlot({ tissues, species, matrix }) {
  const container = document.getElementById("vis-area");
  container.innerHTML = "";

  // Nice color palette (Tableau)
  const COLORS = [
    "#28389eff", // blue
    "#45c9bcff", // orange
    "#088089ff", // green
    "#680082ff", // red
    "#ec6dfaff", // purple
    "#b91f67ff"  // brown
  ];

  const traces = species.map((sp, i) => ({
    x: tissues,
    y: tissues.map(t => matrix[t][sp] || 0),
    name: sp,
    type: "bar",
    marker: { color: COLORS[i % COLORS.length] }
  }));

  const layout = {
    title: "Gene Support per Tissue (Stacked by Model Species)",
    barmode: "stack",
    xaxis: {
      title: "Tissue",
      automargin: true,
      tickangle: -45
    },
    yaxis: { title: "Gene count" },
    margin: { t: 60, b: 180, l: 60, r: 20 },
    legend: { orientation: "h", y: -0.25 }
  };

  Plotly.newPlot(container, traces, layout, { responsive: true });
}

async function init() {
  const container = document.getElementById("vis-area");
  container.textContent = "Loading tissue-species disease counts…";

  try {
    const bindings = await fetchSPARQL(QUERY);
    const processed = organizeMatrix(bindings);
    drawStackedBarPlot(processed);

  } catch (err) {
    console.error(err);
    container.textContent = "Error: " + err.message;
  }
}

// DOM READY CHECK (OUTSIDE init)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
