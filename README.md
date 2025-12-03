# How to use ? 

## Make a folder on your pc and paste this in your terminal to clone the repo
```
bash git clone https://github.com/AnaMariaMartinescu/Programming-for-Life-Science.git
```

# OrthologExplore

OrthologExplore is a small static site for visualizing ortholog/gene annotation data fetched from Wikidata using SPARQL. Visualizations include a GO-term bubble network, a grouped bar chart, and a per-species bar chart.

Quick start
1. Open [index.html](index.html) in a browser, then click "Visualizations" (or open [visualizations.html](visualizations.html) directly).
2. The visualizations are driven by the script [VisData.js](VisData.js) which queries Wikidata's SPARQL endpoint.

Files
- [index.html](index.html) — Landing page with hero + link to visualizations.
- [visualizations.html](visualizations.html) — Main visualization UI and controls.
- [about.html](about.html) — About page.
- [styles.css](styles.css) — Global styles.
- [VisData.js](VisData.js) — Data fetching, processing, and rendering logic.
- [images/](images/) — Local images referenced by the bar chart side panel.

Developer notes
- SPARQL endpoint and queries: see [`ENDPOINT`](VisData.js) and [`QUERIES`](VisData.js).
- Data fetch and caching: see [`fetchBindings`](VisData.js).
- Mode switching and render pipeline: see [`switchMode`](VisData.js) and the renderer pairs:
  - Graph: [`processGraph`](VisData.js) → [`renderGraph`](VisData.js)
  - Grouped bar chart: [`processGroupedBarChart`](VisData.js) → [`renderGroupedBarChart`](VisData.js)
  - Bar chart: [`processBar`](VisData.js) → [`renderBar`](VisData.js)
- To change the diseases or species used, edit the SPARQL strings in [`QUERIES`](VisData.js).
- For local testing, a simple static server is recommended (e.g. `npx http-server` or `python -m http.server`) to avoid CORS/file URL issues.

License
This project is licensed under the MIT License — see [LICENSE](LICENSE).
