export const ENDPOINT = "https://query.wikidata.org/sparql";

export const QUERY = `
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
}
GROUP BY ?humanGene ?humanGeneLabel ?ratGene ?ratGeneLabel ?disease ?diseaseLabel
LIMIT 1000
`;

export async function fetchRows() {
  const res = await fetch(ENDPOINT + "?query=" + encodeURIComponent(QUERY), {
    headers: { "Accept": "application/sparql-results+json" }
  });
  if (!res.ok) throw new Error(`SPARQL HTTP ${res.status}`);
  const data = await res.json();
  return (data.results?.bindings ?? []).map(b => ({
    diseaseLabel:   b.diseaseLabel?.value,
    humanGene:      b.humanGene?.value,
    humanGeneLabel: b.humanGeneLabel?.value,
    humanEnsembl:   b.humanEnsembl?.value,
    ratGene:        b.ratGene?.value,
    ratGeneLabel:   b.ratGeneLabel?.value,
    ratEnsembl:     b.ratEnsembl?.value,
  }));
}

export function filterRows(rows, q, mode) {
  if (!q) return rows;
  q = q.toLowerCase();
  if (mode === "disease") {
    return rows.filter(r => (r.diseaseLabel || "").toLowerCase().includes(q));
  }
  return rows.filter(r =>
    (r.humanGeneLabel || "").toLowerCase().includes(q) ||
    (r.ratGeneLabel   || "").toLowerCase().includes(q)
  );
}