const ENDPOINT = "https://query.wikidata.org/sparql";

const BASE_SELECT = `
SELECT ?humanGene ?humanGeneLabel ?ratGene ?ratGeneLabel ?disease ?diseaseLabel
       (SAMPLE(?humanEnsembl) AS ?humanEnsembl)
       (SAMPLE(?ratEnsembl)   AS ?ratEnsembl)
WHERE {
  ?humanGene wdt:P703 wd:Q15978631 ;
             wdt:P594 ?humanEnsembl ;
             wdt:P2293 ?disease ;
             wdt:P684 ?ratGene .
  ?ratGene  wdt:P703 wd:Q184224 ;
            wdt:P594 ?ratEnsembl .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
`;


// simple HTML escaper for safe innerHTML insertion of text content
function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// helper to build an anchor or plain escaped text
function buildAnchor(href, text) {
  if (!href) return escapeHtml(text || "—");
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text || href)}</a>`;
}

// builds a consistent cell: title (link or text) + meta line (ensembl/id link)
function buildCell(titleHref, titleText, metaHref, metaText) {
  const title = buildAnchor(titleHref, titleText);
  const meta = metaHref ? `<div class="cell-meta">${buildAnchor(metaHref, metaText)}</div>` : `<div class="cell-meta">${escapeHtml(metaText || "")}</div>`;
  return `<div class="cell"><div class="cell-title">${title}</div>${meta}</div>`;
}

// map SPARQL binding to row object
function mapBindingToRow(b) {
  return {
    disease:         b.disease?.value,
    diseaseLabel:    b.diseaseLabel?.value,
    humanGene:       b.humanGene?.value,
    humanGeneLabel:  b.humanGeneLabel?.value,
    humanEnsembl:    b.humanEnsembl?.value,
    ratGene:         b.ratGene?.value,
    ratGeneLabel:    b.ratGeneLabel?.value,
    ratEnsembl:      b.ratEnsembl?.value,
  };
}

/**
 * Render SPARQL JSON bindings into the results table expected by RightPanel.
 * Each row: [humanLabel, humanEnsembl, ratLabel, ratEnsembl, diseaseLabel]
 */
function renderBindingsToTable(bindings) {
  const table = document.querySelector('.results-table');
  if (!table) return console.warn('renderBindingsToTable: missing .results-table');

  // ensure tbody with id resultsBody exists
  let tbody = document.getElementById('resultsBody');
  if (!tbody) {
    tbody = document.createElement('tbody');
    tbody.id = 'resultsBody';
    table.appendChild(tbody);
  }

  // ensure a simple header exists (adjust text as desired)
  let thead = table.querySelector('thead');
  if (!thead) {
    thead = document.createElement('thead');
    thead.innerHTML = `<tr>
      <th>Human</th><th>HumanEnsembl</th><th>Rat</th><th>RatEnsembl</th><th>Disease</th>
    </tr>`;
    table.insertBefore(thead, tbody);
  }

  tbody.innerHTML = '';
  bindings.forEach(b => {
    const humanLabel = b.humanGeneLabel?.value || b.humanGene?.value || '';
    const humanEnsembl = b.humanEnsembl?.value || '';
    const ratLabel = b.ratGeneLabel?.value || b.ratGene?.value || '';
    const ratEnsembl = b.ratEnsembl?.value || '';
    const diseaseLabel = b.diseaseLabel?.value || b.disease?.value || '';

    const tr = document.createElement('tr');
    [humanLabel, humanEnsembl, ratLabel, ratEnsembl, diseaseLabel].forEach(txt => {
      const td = document.createElement('td');
      td.textContent = txt;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  console.log('LeftPanel: rendered', bindings.length, 'rows');
}

/**
 * Fetch SPARQL JSON and render results.
 * Adds GROUP BY because BASE_SELECT uses SAMPLE(...) aggregations.
 */
async function fetchAndRender(extraWhere = '', limit = 500) {
  const groupBy = `GROUP BY ?humanGene ?humanGeneLabel ?ratGene ?ratGeneLabel ?disease ?diseaseLabel`;
  const fullQuery = `${BASE_SELECT}
${extraWhere}
}
${groupBy}
LIMIT ${limit}`;

  console.debug('LeftPanel: SPARQL query:', fullQuery);
  try {
    const url = ENDPOINT + '?query=' + encodeURIComponent(fullQuery);
    const res = await fetch(url, { headers: { Accept: 'application/sparql-results+json' } });
    console.debug('LeftPanel: SPARQL status', res.status);
    if (!res.ok) {
      const text = await res.text();
      console.error('LeftPanel: SPARQL failed', res.status, text);
      return;
    }
    const json = await res.json();
    const bindings = (json.results && json.results.bindings) ? json.results.bindings : [];
    console.log('LeftPanel: fetched bindings', bindings.length);
    renderBindingsToTable(bindings);
  } catch (err) {
    console.error('LeftPanel: fetch error', err);
  }
}

// Option: call automatically on load (or call from your search handler)
fetchAndRender();



