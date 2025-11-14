// Ensembl REST API endpoint 
// Issue , not extracting what I am actually interested in 
// We are interested in looking up isorforms / transcripts for given essembl gene ids ( that we previously extraded in the data file )

const BASE = "https://rest.ensembl.org";

// caches
const lookupCache = new Map();

let _verbose = false;
export function setVerbose(v = true) { _verbose = !!v; }

/**
 * Batched lookup (expand=1).
 * Returns an object mapping id -> lookup object (or null on error).
 */
export async function lookupBatch(ids, { chunkSize = 50, delayMs = 150 } = {}) {
  const out = {};
  const toFetch = [];

  for (const id of ids) {
    if (lookupCache.has(id)) out[id] = lookupCache.get(id);
    else toFetch.push(id);
  }

  for (let i = 0; i < toFetch.length; i += chunkSize) {
    const chunk = toFetch.slice(i, i + chunkSize);
    try {
      const res = await fetch(`${BASE}/lookup/id?expand=1`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ ids: chunk })
      });
      if (!res.ok) {
        const txt = await res.text();
        console.warn("Ensembl lookup error", res.status, txt);
        for (const id of chunk) { out[id] = null; lookupCache.set(id, null); }
      } else {
        const json = await res.json();
        for (const id of chunk) {
          const val = json[id] ?? null;
          out[id] = val;
          lookupCache.set(id, val);
        }
      }
    } catch (err) {
      console.warn("Ensembl lookup fetch error", err);
      for (const id of chunk) { out[id] = null; lookupCache.set(id, null); }
    }
    if (i + chunkSize < toFetch.length) await new Promise(r => setTimeout(r, delayMs));
  }

  // include any remaining cache entries
  for (const [id, val] of lookupCache) if (!(id in out)) out[id] = val;

  return out;
}

/**
 * Robust transcript count for a lookup result
 */
export function transcriptCountFromLookup(lu) {
  if (!lu) return 0;
  const candidates = [
    lu.Transcript, lu.transcript, lu.Transcripts, lu.transcripts,
    lu.children, lu.translated, null
  ];
  for (const c of candidates) if (Array.isArray(c)) return c.length;

  const arrGuess = Object.values(lu).filter(v => Array.isArray(v) && v.length && v[0]?.object_type === "Transcript");
  if (arrGuess.length) return arrGuess[0].length;
  return 0;
}

/** Scoring helpers */
export function ratioFromCounts(hCount, rCount) {
  if (hCount === 0 && rCount === 0) return 0;
  return Math.min(hCount, rCount) / Math.max(hCount, rCount);
}
export function transcriptScore(ratio) {
  if (ratio < 0.3) return 0;
  if (ratio < 0.5) return ((ratio - 0.3) / 0.2) * 0.5;
  return 0.5 + ((ratio - 0.5) / 0.5) * 0.5;
}

