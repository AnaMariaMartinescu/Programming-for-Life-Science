# How to use ? 

## Make a folder on your pc and paste this in your terminal to clone the repo
```
bash git clone https://github.com/AnaMariaMartinescu/Programming-for-Life-Science.git
```
## Recommended Local Preview

For the best experience when running the project locally, we recommend using the **Live Preview** extension by Microsoft in VS Code.

### How to use Live Preview

1. Open the project folder in **VS Code**.
2. Install the **Live Preview** extension (Microsoft).
3. Right-click on `index.html`.
4. Select **"Show Preview"** or **"Open with Live Preview"**.
5. The visualizations will load inside a local browser window without CORS issues.

This is the easiest and most reliable way to view `index.html` and `visualizations.html` when developing or exploring the project locally.

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


### Code License (MIT)
All original source code in this repository (JavaScript, HTML, CSS, and logic files)
is licensed under the MIT License.

See the `LICENSE` file for details.

### Data License (Wikidata – CC-BY-SA 4.0)
All data and visualizations in this repository that are derived from Wikidata 
are licensed under the Creative Commons Attribution-ShareAlike 4.0 International License.

See the `DATA_LICENSE` file for full terms.

Wikidata License: https://creativecommons.org/licenses/by-sa/4.0/


