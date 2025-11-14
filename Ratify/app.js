// Load once from WDQS, then filter locally.
// Toggle search mode: Disease | Gene Name

let mode = "disease"; // or "gene"
let rows = [];        // all pairs
let filteredRows = [];

const input   = document.getElementById("q");
const modeBtn = document.getElementById("modeBtn");

// Build minimal UI (status + table) via JS so HTML stays tiny
const statusEl = make("div", { id: "status", textContent: "Loading data from Wikidata…" }, document.body);
const table  = make("table", { id: "results", style: "margin-top:8px;border-collapse:collapse;" }, document.body);
const thead  = make("thead", {}, table);
// kept one header definition below
thead.innerHTML = `
  <tr>
    <th style="border:1px solid #ddd;padding:6px;">Human gene</th>
    <th style="border:1px solid #ddd;padding:6px;">Human Ensembl</th>
    <th style="border:1px solid #ddd;padding:6px;">Human transcripts</th>
    <th style="border:1px solid #ddd;padding:6px;">Disease</th>
    <th style="border:1px solid #ddd;padding:6px;">Rat gene</th>
    <th style="border:1px solid #ddd;padding:6px;">Rat Ensembl</th>
    <th style="border:1px solid #ddd;padding:6px;">Rat transcripts</th>
    <th style="border:1px solid #ddd;padding:6px;">TranscriptScore</th>
  </tr>`;
const tbody  = make("tbody", {}, table);

// add a datalist for disease autocompletion and wire it to the input
const diseaseList = make("datalist", { id: "diseases" }, document.body);
input.setAttribute("list", "diseases");

// Helpers
import { make, eh } from "./utils.js";
import { fetchRows, filterRows } from "./data.js";
import { lookupBatch, transcriptCountFromLookup, ratioFromCounts, transcriptScore } from "./EnsemblEndPoint.js";

// add compute UI (small and safe) — create button but insert next to the existing mode button
const computeBtn = make("button", { textContent: "Compute scores" }); // don't append to body
modeBtn.insertAdjacentElement("afterend", computeBtn); // place immediately after modeBtn
computeBtn.style.marginLeft = "8px";

// modify update() to expose filteredRows and render extra columns if present
// (replace the existing thead / tbody logic or ensure you have columns for counts & score)
thead.innerHTML = `
  <tr>
    <th style="border:1px solid #ddd;padding:6px;">Human gene</th>
    <th style="border:1px solid #ddd;padding:6px;">Human Ensembl</th>
    <th style="border:1px solid #ddd;padding:6px;">Human transcripts</th>
    <th style="border:1px solid #ddd;padding:6px;">Disease</th>
    <th style="border:1px solid #ddd;padding:6px;">Rat gene</th>
    <th style="border:1px solid #ddd;padding:6px;">Rat Ensembl</th>
    <th style="border:1px solid #ddd;padding:6px;">Rat transcripts</th>
    <th style="border:1px solid #ddd;padding:6px;">TranscriptScore</th>
  </tr>`;

function update() {
  const q = input.value.trim();
  const list = filterRows(rows, q, mode);
  filteredRows = list;

  // when in disease mode, populate the datalist with distinct matching disease labels
  if (mode === "disease") {
    const qlc = q.toLowerCase();
    const labels = [...new Set(rows.map(r => r.diseaseLabel).filter(Boolean))]
      .filter(l => l.toLowerCase().includes(qlc))
      .slice(0, 50); // limit suggestions
    diseaseList.innerHTML = labels.map(l => `<option value="${eh(l)}"></option>`).join("");
  } else {
    diseaseList.innerHTML = "";
  }

  tbody.innerHTML = list.map(r => `
    <tr>
      <td style="border:1px solid #ddd;padding:6px;">
        <a href="${eh(r.humanGene)}" target="_blank" rel="noopener">${eh(r.humanGeneLabel)}</a>
      </td>
      <td style="border:1px solid #ddd;padding:6px;padding:6px;">
        ${r.humanEnsembl ? `<a href="https://www.ensembl.org/id/${eh(r.humanEnsembl)}" target="_blank" rel="noopener">${eh(r.humanEnsembl)}</a>` : ""}
      </td>
      <td style="border:1px solid #ddd;padding:6px;text-align:center;">
        ${typeof r.hTranscriptCount === "number" ? r.hTranscriptCount : ""}
      </td>
      <td style="border:1px solid #ddd;padding:6px;">
        ${eh(r.diseaseLabel || "")}
      </td>
      <td style="border:1px solid #ddd;padding:6px;">
        <a href="${eh(r.ratGene)}" target="_blank" rel="noopener">${eh(r.ratGeneLabel)}</a>
      </td>
      <td style="border:1px solid #ddd;padding:6px;">
        ${r.ratEnsembl ? `<a href="https://www.ensembl.org/id/${eh(r.ratEnsembl)}" target="_blank" rel="noopener">${eh(r.ratEnsembl)}</a>` : ""}
      </td>
      <td style="border:1px solid #ddd;padding:6px;text-align:center;">
        ${typeof r.rTranscriptCount === "number" ? r.rTranscriptCount : ""}
      </td>
      <td style="border:1px solid #ddd;padding:6px;text-align:center;">
        ${typeof r.transcriptScore === "number" ? r.transcriptScore : ""}
      </td>
    </tr>
  `).join("");

  table.style.display = list.length ? "table" : "none";
  statusEl.textContent = `Mode: ${mode === "disease" ? "Disease" : "Gene name"} — Showing ${list.length} of ${rows.length}` +
                         (input.value ? ` for “${input.value}”` : "");
  window.filteredRows = list; // handy for debugging
}

async function init() {
  try {
    rows = await fetchRows();
    window.rows = rows;
    update();
  } catch (err) {
    statusEl.textContent = "Error: " + err.message;
    statusEl.style.color = "crimson";
    table.style.display = "none";
  }
}

modeBtn.addEventListener("click", () => {
  mode = (mode === "disease") ? "gene" : "disease";
  modeBtn.textContent = `Mode: ${mode === "disease" ? "Disease" : "Gene"}`;
  update();
});

// compute wiring: safe defaults and progress
computeBtn.addEventListener("click", async () => {
  // operate only on visible filtered rows
  const list = filteredRows.length ? filteredRows : rows;
  const MAX = 200;
  if (list.length > MAX && !confirm(`This will fetch Ensembl data for ${list.length} rows (may be slow). Limit to first ${MAX}?`)) return;
  const target = list.slice(0, MAX);

  computeBtn.disabled = true;
  computeBtn.textContent = "Computing…";
  statusEl.textContent = `Looking up Ensembl IDs for ${target.length} rows…`;

  // collect unique Ensembl IDs
  const ids = new Set();
  const humanIds = new Set();
  for (const r of target) {
    if (r.humanEnsembl) { ids.add(String(r.humanEnsembl)); humanIds.add(String(r.humanEnsembl)); }
    if (r.ratEnsembl) ids.add(String(r.ratEnsembl));
  }
  try {
    const lookups = await lookupBatch(Array.from(ids));

    // annotate rows with transcript counts & score (no orthology)
    for (const r of target) {
      const hId = r.humanEnsembl ? String(r.humanEnsembl) : null;
      const rtId = r.ratEnsembl ? String(r.ratEnsembl) : null;
      const hLu = hId ? lookups[hId] : null;
      const rLu = rtId ? lookups[rtId] : null;
      const hCount = transcriptCountFromLookup(hLu);
      const rCount = transcriptCountFromLookup(rLu);
      const ratio = ratioFromCounts(hCount, rCount);
      const score = transcriptScore(ratio);
      r.hTranscriptCount = hCount;
      r.rTranscriptCount = rCount;
      r.transcriptScore = Number(score.toFixed(3));

      // orthology columns removed — no homology fetches or annotations
    }
    statusEl.textContent = `Computed ${target.length} rows — updating table.`;
    update();
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Error fetching Ensembl data: " + err.message;
    statusEl.style.color = "crimson";
  } finally {
    computeBtn.disabled = false;
    computeBtn.textContent = "Compute scores";
  }
});

let t;
input.addEventListener("input", () => {
  clearTimeout(t);
  t = setTimeout(update, 120);
});

init();
