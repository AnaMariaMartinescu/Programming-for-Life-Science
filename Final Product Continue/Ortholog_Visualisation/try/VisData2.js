// VisData.js

const ENDPOINT = "https://query.wikidata.org/sparql";

const QUERY = `
SELECT ?disease ?diseaseLabel ?humanEnsembl
WHERE {
  ?humanGene wdt:P703 wd:Q15978631 ;
             wdt:P594 ?humanEnsembl ;
             wdt:P2293 ?disease ;
             wdt:P684  ?ratGene .

  ?ratGene  wdt:P703 wd:Q184224 .

  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "en" .
  }
}
LIMIT 100
`;

// Fetch as JSON
async function fetchSPARQL() {
  const url = ENDPOINT + "?format=json&query=" + encodeURIComponent(QUERY);
  const res = await fetch(url, {
    headers: { "Accept": "application/sparql-results+json" }
  });
  const json = await res.json();
  return json.results.bindings;
}

// Convert bindings → UpSetJS format
function buildSets(bindings) {
  const sets = new Map();   // diseaseName -> Set of genes

  bindings.forEach(row => {
    const d = row.diseaseLabel.value;
    const g = row.humanEnsembl.value;

    if (!sets.has(d)) sets.set(d, new Set());
    sets.get(d).add(g);
  });

  // Convert to UpSetJS input
  const upset = [];
  for (const [name, genes] of sets.entries()) {
    upset.push({
      name,
      elems: Array.from(genes)
    });
  }

  return upset;
}

async function init() {
  const container = document.getElementById("vis-area");
  container.textContent = "Loading UpSet Plot…";

  try {
    const bindings = await fetchSPARQL();
    const upsetData = buildSets(bindings);

    // Convert to UpSetJS internal structure
    const sets = UpSetJS.asSets(upsetData);

    // Render UpSet plot
    container.textContent = ""; // clear placeholder

    UpSetJS.render(container, {
      sets,
      width: 900,
      height: 550,
      selection: null,
      showSetSize: true,
      showIntersectionSize: true
    });

  } catch (err) {
    console.error(err);
    container.textContent = "Error loading UpSet plot: " + err.message;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
