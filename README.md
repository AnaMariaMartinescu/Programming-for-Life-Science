# 📘 OrthologExplore
OrthologExplore is a lightweight static web application for exploring **ortholog** and **gene-annotation** data from **Wikidata** using SPARQL queries.
It provides three fully interactive visualizations:
- 🫧 **GO-term graph network**
- 📊 **Grouped bar chart (ortholog counts per organism)**
- 🐭 **Per-species bar chart with detailed side panel (image + description)**
All data is fetched live from Wikidata and rendered client-side.
---
## 🚀 Quick Start
### 1. Clone the repository
Create a folder on your computer, open a terminal inside it, and run:
```bash
git clone https://github.com/AnaMariaMartinescu/Programming-for-Life-Science.git
```
Then open the folder in **VS Code** or your preferred editor.
---
## 🔍 Recommended Local Preview (VS Code)
The easiest way to preview the site locally is using the **Live Preview** extension by Microsoft.
### How to use Live Preview
1. Open the project folder in VS Code.  
2. Install **Live Preview** (Microsoft).  
3. Right-click **index.html**.  
4. Select **“Show Preview”** or **“Open with Live Preview”**.
This opens a browser-like window inside VS Code with full JavaScript support, avoiding any CORS or `file://` issues.
---
## 📁 Project Structure
| File / Folder | Description |
|---------------|-------------|
| **index.html** | Landing page with animated hero header and link to the visualizations. |
| **visualizations.html** | Main UI containing visualization modes and controls. |
| **about.html** | About page describing the purpose and context of the project. |
| **styles.css** | Global styling for the website. |
| **VisData.js** | Core logic for SPARQL fetching, processing, caching, and rendering. |
| **images/** | Local images used in the bar-chart side panel. |
---
## 🧠 Developer Notes
### SPARQL Query System
Defined in:
```js
ENDPOINT
QUERIES
```
Edit these SPARQL templates to:
- Change species being queried  
- Update GO-term selections  
- Fetch additional gene annotations  
### Fetching & Caching
See:
```js
fetchBindings()
```
All SPARQL results are cached per visualization mode.
### Render Pipeline
Each visualization mode uses a processing → rendering pair:
| Visualization | Processing Function | Rendering Function |
|---------------|---------------------|--------------------|
| GO-term bubble graph | `processGraph()` | `renderGraph()` |
| Grouped bar chart | `processGroupedBarChart()` | `renderGroupedBarChart()` |
| Species bar chart | `processBar()` | `renderBar()` |
---
## 🖥 Optional: Run a Local Static Server
Instead of relying on browser `file://` URLs, you may serve the project locally:
```bash
npx http-server
```
or:
```bash
python3 -m http.server
```
---
## 📜 Code License (MIT)
All original source code (JavaScript, HTML, CSS, rendering logic) is licensed under the **MIT License**.  
See the `LICENSE` file for details.
---
## 🔗 Data License (Wikidata — CC BY-SA 4.0)
All visualization data retrieved from Wikidata is subject to the  
**Creative Commons Attribution–ShareAlike 4.0 International License**.
Full license text:  
https://creativecommons.org/licenses/by-sa/4.0/
See the `DATA_LICENSE` file for details.
---
## 🧩 Acknowledgements
This project uses:
- Wikidata SPARQL endpoint 
- D3.js
- Plotly.js  
- Live Preview (Microsoft)  
