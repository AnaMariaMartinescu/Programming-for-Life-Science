// Creates a constant variable named ENDPOINT that stores a string and assigns it the URL of the Wikidata SPARQL endpoint.

const ENDPOINT = "https://query.wikidata.org/sparql";

// ------------- SPARQL QUERIES (1 per mode) -----------------

// Create a constant variable named QUERIES that stores an js object containing three SPARQL queries as string values, each associated with a specific key representing a visualization mode: "graph", "grouped_bar_chart", and "bar".
// The Wikikata adress (from const endpoint) is saved and will be used for sendting the queries to it
const QUERIES = {


  //GRAPH QUERY: get diseases, their GO terms, and supporting ortholog species counts
  graph: `

#PREFIX makes it possible to use the short names like wd instead of the full URL

PREFIX wd:  <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX bd:  <http://www.bigdata.com/rdf#>

SELECT              #From all the matched variable-values, return only the variables I ask for.
  ?disease ?diseaseLabel
  ?goTerm ?goTermLabel
  (COUNT(DISTINCT ?orthologSpecies) AS ?supportingSpecies)  #count of distinct species and store the numbers them as supportingSpecies 

#wd: prefix for Wikidata items.
#wdt: prefix for Wikidata direct properties.


WHERE {           #Search the whole knowledge graph and find every place this pattern matches
  VALUES ?disease {
    wd:Q12174     # obesity
    wd:Q11081     # Alzheimer's disease
    wd:Q206901    # amyotrophic lateral sclerosis
    wd:Q844935    # coronary artery disease
    wd:Q187255    # rheumatoid arthritis
    wd:Q8277      # multiple sclerosis
  }

  VALUES ?modelSpecies {
      wd:Q83310      # mouse
      wd:Q184224     # rat
      wd:Q169444     # zebrafish
      wd:Q130506     # fly
      wd:Q91703      # worm
      wd:Q27510868   # yeast
  }

  ?humanGene wdt:P703 wd:Q15978631 ; #wdt:P703 taxon, wd:Q15978631 human (a taxon is a biological calssification group/hierarchy)
             wdt:P2293 ?disease ;
             wdt:P684  ?orthologGene ;
             wdt:P688  ?protein .

  ?orthologGene wdt:P703 ?orthologSpecies .  #wdt:P703 found in taxon,  it gives orthologGenes that are found in the taxon of orthologSpecies
  FILTER(?orthologSpecies IN (?modelSpecies))

  ?protein wdt:P682 ?goTerm . #wdt:P682 biological process 

#For every variable in my result that represents an item or property,automatically add a label variable in English.
  
SERVICE wikibase:label {
    bd:serviceParam wikibase:language "en".
  }
}
GROUP BY
  ?disease ?diseaseLabel
  ?goTerm ?goTermLabel
ORDER BY
  ?diseaseLabel ?goTermLabel
   
  `,

  // Grouped Bar Chart QUERY: get ortholog species, diseases, and counts of number GO annotations
  grouped_bar_chart: `
  PREFIX wd:  <http://www.wikidata.org/entity/>
  PREFIX wdt: <http://www.wikidata.org/prop/direct/>
  PREFIX wikibase: <http://wikiba.se/ontology#>
  PREFIX bd:  <http://www.bigdata.com/rdf#>

  #Select the ortholog species, disease, and count of GO annotations

  SELECT
    ?orthologSpecies ?orthologSpeciesLabel
    ?disease ?diseaseLabel
    (COUNT(DISTINCT ?goTerm) AS ?goAnnotationCount)  #count of distinct GO terms as goAnnotationCount - output numbers

  WHERE {
    # 1) choose your six model organisms
    VALUES ?orthologSpecies {
      wd:Q83310      # mouse
      wd:Q184224     # rat
      wd:Q169444     # zebrafish
      wd:Q130506     # fly
      wd:Q91703      # worm
      wd:Q27510868   # yeast
    }

    # 2) choose a SMALL set of diseases (Where extracted from a top N query that will be mentionned in the ABOUT website section)
    VALUES ?disease {
      wd:Q12174     # obesity
      wd:Q11081     # Alzheimer's disease
      wd:Q206901    # amyotrophic lateral sclerosis
      wd:Q844935    # coronary artery disease
      wd:Q187255    # rheumatoid arthritis
      wd:Q8277      # multiple sclerosis
      wd:Q11085     # Parkinson's disease
    }

    # 3) human genes connected to these diseases + their orthologs
    ?humanGene wdt:P703 wd:Q15978631 ;  # taxon = human
               wdt:P2293 ?disease ;  # wdt:P2293 genetic association 
               wdt:P684  ?orthologGene . # wdt:P684 ortholog 

    ?orthologGene wdt:P703 ?orthologSpecies . #wdt:P703 found in taxon 

    # 4) proteins and GO annotations
    ?humanGene wdt:P688 ?protein . # wdt:P688 encodes
    ?protein wdt:P682 ?goTerm . # wdt:P682 biological process 

  

    SERVICE wikibase:label {
      bd:serviceParam wikibase:language "en" .
    }
  }

#Put everything that belongs to the same (species, disease) pair into one group.
  GROUP BY
    ?orthologSpecies ?orthologSpeciesLabel
    ?disease ?diseaseLabel

# First sort alphabetically by the species name, then by the disease name.
  ORDER BY
    ?orthologSpeciesLabel
    ?diseaseLabel 
  `,

  // BAR PLOT: ortholog counts per species
bar: `
#Takes all human genes (?humanGene with P703 = human).
# For each human gene, gets its ortholog model gene (P684 ?modelGene).
# Finds which species that model gene belongs to (?modelGene wdt:P703 ?species).
# Counts distinct model genes per species: COUNT(DISTINCT ?modelGene) AS ?orthologCount.

# So:“For each species, how many distinct ortholog model genes (of human genes) do we have?”
# No disease filter here.

#LEGEND 
# wdt:found in taxon (P703)
# ortholog (P684) -> orthologous gene in another species (use with 'species' qualifier)
# wd:Homo sapiens (Q15978631) -> species of mammal
# Note that ! symbol means "is NOT"

  PREFIX wd:  <http://www.wikidata.org/entity/>
  PREFIX wdt: <http://www.wikidata.org/prop/direct/>
  PREFIX wikibase: <http://wikiba.se/ontology#>
  PREFIX bd:  <http://www.bigdata.com/rdf#>

    SELECT ?species ?speciesLabel (COUNT(DISTINCT ?modelGene) AS ?orthologCount) 
    
    WHERE {
      ?humanGene wdt:P703 wd:Q15978631 .
      ?humanGene wdt:P684 ?modelGene .
      ?modelGene wdt:P703 ?species .
      FILTER(?species != wd:Q15978631) #(filter any species that are NOT human)
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    GROUP BY ?species ?speciesLabel
    HAVING (COUNT(DISTINCT ?modelGene) > 1000) #show only species/speciesLabel that have more than 1000 genes
    ORDER BY DESC(?orthologCount)  #sort them from highest to lowest 
  `
};

//======================================
// DEFINE START POINT OF LOADING (data) +  PREPARE STORAGE FOR RESUTS 
//======================================

let currentMode = "graph"; // sets the default mode to graph, gives the program a starting point
const cache = {}; // This creates an empty object that will later store results per mode.


//======================================
// RUN SPARQL QUERYS FOR GIVEN MODE (VISUALISATIO TYPE:graph, gtouped bar chart, bar )
//======================================


//ASYNC FUNCTION MEANING: A Promise is an object that represents a value(data) that will arrive in the future; await lets you pause until the Promise is fulfilled.
//ASYNC FUNCTION TASK: Run the SPARQL query for this visualization mode
// mode tells the function what visualization type to process (graph, grouped bar chart, bar)
async function fetchBindings(mode) {
  // we use chache to avoid re-fetching the same data multiple times
  // use cache if available, bindings = results array/rows
  if (cache[mode]?.bindings) 
    return cache[mode].bindings;


  // we have an object called QUERIES(basically a dictionary- value lookup map/table) that contains the SPARQL queries for each mode
  // the query contstant variable stores the SPARQL query string for the specified mode(selects which query to run/use)
  const query = QUERIES[mode];
  //url constant variable place to store and build the full URL that you will send to the SPARQL server.
  // Creates a proper SPARQL request URL by attaching your SPARQL query (encoded) and the format (JSON) to the endpoint.
  const url = ENDPOINT + "?format=json&query=" + encodeURIComponent(query);

  //Wait until the server responds, then put the response object into contant "res" variable. 
  const res = await fetch(url, {
    headers: { "Accept": "application/sparql-results+json" } // Tells the server that you want the results in JSON format.
  });
  
  //If server did not respond correctly, throw an error with details about the failure(will be visible in the console:WEB DEV TOOLS).
  if (!res.ok) {
    throw new Error(`SPARQL (${mode}) failed: ${res.status} ${res.statusText}`);//stops the function execution and shows the error message
  }

  //Parse the JSON response from the server to extract the actual data results.
  const json = await res.json(); // reads the http reponse "res" and waits for the response to be converted into a JavaScript object.
  const bindings = json.results.bindings; //Extract the array from the JSON response and store it in the variable bindings. (json = the full response, json.results = the results object, json.results.bindings = the actual data row/array)
  cache[mode] = cache[mode] || {}; // ensure cache[mode] exists (if not, create an empty object there)
  cache[mode].bindings = bindings;  // store the fetched bindings in the cache for this mode for future use
  return bindings; // return the fetched data(rows) to the caller
}


//====================================================================================
//GRAPH VISUALIZATION
//====================================================================================

//------------------------------------------------------------------------------------
//      GRAPH PROCESSOR: process the SPARQL results for the graph visualization
//------------------------------------------------------------------------------------
function processGraph(bindings) {  // Define a function called processGraph that takes one input called 'bindings'.
  // bindings expected to contain:
  // ?disease ?diseaseLabel ?goTerm ?goTermLabel (COUNT(DISTINCT ?orthologSpecies) AS ?supportingSpecies)
  // These comments describe what kind of fields we expect each binding object to have.

//--------------------------
//STEP 1: EMPTY INPUT CHECK
  if (!Array.isArray(bindings) || bindings.length === 0) {  // If 'bindings' is not an array OR it is an empty array...
    return { nodes: [], links: [] };                       // ...then return an empty graph structure with no nodes and no links.
  }

  //--------------------------
  //STEP 2: CREATE DISEASE MAP
  // Map diseaseId -> { id, name, goTerms:Set, totalSpeciesSupport }
  const diseases = new Map();  // Create a new Map to store information about each disease, using the disease ID as the key.

  //--------------------------
  //STEP 3: LOOP THROUGH EACH SPARQL RESULT ROW
  for (const b of bindings) {  // Loop over each item 'b' inside the 'bindings' array.
    const disease_Id = b.disease?.value || b.diseaseLabel?.value ;  
    // Try to get the disease ID from b.disease.value, or if missing use b.diseaseLabel.value

    const disease_Label = b.diseaseLabel?.value ?? disease_Id;  
    // Try to get the human-readable disease label, and if it doesn’t exist, fall back to using the disease ID as the label.

    const goId = b.goTerm?.value ?? null;  
    // Try to get the GO term ID (a kind of functional annotation), or set it to null if it doesn’t exist.

    const goLabel = b.goTermLabel?.value ?? "";  
    // Try to get the GO term label (human-readable text), or use an empty string if it’s not there.

    const speciesSupport = parseInt(b.supportingSpecies?.value ?? "0", 10);  
    // Read how many species support this disease-GO link, convert it to an integer(decimals, base 10, from 0 to 9), or use 0 if it’s missing.
    //--------------------------
  //STEP 4:CREATE OR UPDATE DISEASE ENTRY IN MAP IF NEEDED
    if (!diseases.has(disease_Id)) {  
      // If we have not yet created an entry for this disease ID in the Map...
      diseases.set(disease_Id, {               // ...then create one and store it in the Map.
        id: disease_Id,                        // Save the disease ID as 'id'.
        name: disease_Label,                   // Save the disease label as 'name'.
        goTerms: new Set(),             // Create an empty Set to store all GO terms connected to this disease.NO DUPLICATES ALLOWED
        totalSpeciesSupport: 0          // Start with total species support equal to 0.
      });
    }

    const entry = diseases.get(disease_Id);  
    // Get the existing disease object from the Map so we can update its fields.

    //--------------------------
    //STEP 5: UPDATE DISEASE ENTRY WITH GO TERM + SPECIES SUPPORT
    if (goId) entry.goTerms.add(goId + "|" + goLabel);  
    // If there is a GO term ID, add a combined string "goId|goLabel" into the Set of GO terms for this disease (avoids duplicates automatically).
    entry.totalSpeciesSupport += isNaN(speciesSupport) ? 0 : speciesSupport;  
    // Increase the total species support by this value, but add 0 if the value is not a number.
  }

  //--------------------------
  //STEP 6: CONVER MAP INTO ARRAY OF NODES 
  const nodes = Array.from(diseases.values()).map(d => ({  
    // Take all disease objects stored in the Map and turn them into an array of node objects for the graph.
    id: d.id,                               // Keep the disease ID as the node ID.
    name: d.name,                           // Keep the disease name for labeling.
    goTerms: Array.from(d.goTerms),         // Convert the Set of GO terms into an array so it can be easily used later.
    totalSpeciesSupport: d.totalSpeciesSupport  // Keep the total species support count.
  }));

  //--------------------------
  //STEP 7: BUILD LINKS BASED ON JACCARD SIMILARITY
  // build links by Jaccard similarity on GO term sets
  const links = [];  
  // Start with an empty array where we will store the links (edges) between disease nodes.

  for (let i = 0; i < nodes.length; i++) {  
    // Loop over each node by index 'i' from 0 to nodes.length - 1.
    for (let j = i + 1; j < nodes.length; j++) {  
      // For each node at index i, loop over all nodes after it (j > i) to form unique pairs without repeating or reversing them.
      const a = nodes[i];  
      // 'a' is the disease node at position i.
      const b = nodes[j];  
      // 'b' is the disease node at position j.

      const setA = new Set(a.goTerms);  
      // Create a Set from node a's GO terms so we can do set operations (like intersection).
      const setB = new Set(b.goTerms);  
      // Create a Set from node b's GO terms.

      let inter = 0;  
      // Start a counter for the size of the intersection (how many GO terms the two diseases share).

      for (const x of setA) if (setB.has(x)) inter++;  
      // For each GO term in setA, if the same term is also in setB, increase the intersection counter by 1.

      const union = setA.size + setB.size - inter;  
      // Compute the size of the union of the two sets using |A ∪ B| = |A| + |B| - |A ∩ B|.

      const jaccard = union === 0 ? 0 : inter / union;  
      // Calculate the Jaccard similarity as intersection/union, but if union is 0 (no GO terms at all), define it as 0.

      // threshold to avoid hairball; tweak if desired
      if (jaccard > 0.02) {  
        // If the similarity is above 0.02, we decide it is strong enough to draw a link between these two diseases.
        //--------------------------
        //STEP 8: BUILD LINKS USING JACCARD SIMILARITY BETWEEN GO SETS
        links.push({  
          // Add a new link (edge) object to the links array.
          source: a.id,          // The link starts from disease a's ID.
          target: b.id,          // The link goes to disease b's ID.
          jaccard,               // Store the Jaccard similarity value.
          intersection: inter,   // Store the size of the intersection (shared GO terms).
          union                  // Store the size of the union (total distinct GO terms in both).
        });
      }
    }
  }
//--------------------------
//STEP 9: RETURN THE GRAPH DATA STRUCTURE
  return { nodes, links };  
  // Finally, return an object containing all the nodes and links so that it can be used for visualization (e.g., in a graph).
}


//--------------------------------------------------------------------------------------------------
//REDERED: GRAPH
//--------------------------------------------------------------------------------------------------

// update renderers to target the inner plot root
function renderGraph(data) {
  // ensure any leftover graph UI from a previous render is cleared first
  // use existing visualisation helper
  RemovePreviousVis();
  const plotRoot = document.getElementById("plotly-root");
  if (!plotRoot) return;
  plotRoot.innerHTML = ""; // ensure clean target
  // remove loader overlays now that we're drawing
  if (window.hideVisLoader) window.hideVisLoader(); //hide any loading overlays


  // extract nodes and links from processed data
  const nodes = (data && data.nodes) || [];
  const links = (data && data.links) || [];
  // NO NODES -> SHOW MESSAGE AND EXIT
  if (!nodes.length) {
    plotRoot.innerHTML = "<div style='padding:12px;color:#666'>No data to display for graph visualization.</div>";
    return;
  }

  //------------------------------------------------------------------
  // STEP 1: FIND THE PLACEHOLDER FOR THE TOOLTIP + VIS AREA (search for html id vis-area)
  //WITOUT THIS CODE CHUNK THE TOOLTIP WILL NOT APPEAR WHEN HOVERING OVER A NODE
  let tooltip = document.getElementById("vis-graph-tooltip");
  // tolerate old/new ids; prefer the canonical id used by cleanup helpers
  if (!tooltip) tooltip = document.getElementById("vis-bubble-tooltip");

  const visArea = document.getElementById("vis-area");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "vis-bubble-tooltip";
    Object.assign(tooltip.style, {
      position: "absolute",
      pointerEvents: "none",
      padding: "8px 10px",
      background: "rgba(21, 23, 27, 0.9)", //background of the hover text box
      color: "#fff", //Color of text when hover the node of the graph
      fontSize: "12px",
      borderRadius: "6px",
      transition: "opacity 120ms ease, transform 120ms ease",
      opacity: "0",
      zIndex: "999"
    });
    if (visArea && window.getComputedStyle(visArea).position === "static") {
      visArea.style.position = "relative";
    }
    (visArea || document.body).appendChild(tooltip);
  }

  // HELPER TO POSITION TOOLTIP WITHIN VIS AREA
  // positions the tooltip element within the vis area based on mouse event
  //Multiple controls for the mouse and saftey checks to ensure the tooltip stays within the visible area of the visualization.
  function positionTooltipWithinVisArea(event, tip) {
    // safety checks
    if (!visArea || !tip) return;
    const areaRect = visArea.getBoundingClientRect();
    // prefer client/user coordinates, account for page scroll
    // get mouse position relative to vis-area
    const relX = event.clientX - areaRect.left;
    const relY = event.clientY - areaRect.top;

    // set content first so size can be measured
    tip.style.left = "0px";
    tip.style.top = "0px";
    tip.style.opacity = "0";
    tip.style.transform = "translateY(0)";

    // measure
    // get tooltip size
    const tipRect = tip.getBoundingClientRect();
    const tipW = tipRect.width || 160;
    const tipH = tipRect.height || 40;

    // desired offset (right and down)
    const offsetX = 12;
    const offsetY = 8;

    let left = relX + offsetX;
    let top = relY + offsetY;
    // adjust to keep within vis-area bounds
    /*If there’s space to the right of the cursor → show tooltip on the right.
      If you’re too close to the right edge → flip it to left side of the cursor.*/ 
    const maxLeft = areaRect.width - tipW - 6;
    if (left > maxLeft) {
      left = Math.max(6, relX - tipW - offsetX);
    }
    // if tooltip would overflow bottom, move above cursor
    const maxTop = areaRect.height - tipH - 6;
    if (top > maxTop) {
      top = Math.max(6, relY - tipH - offsetY);
    }

    //Moves the tooltip horizontally to follow the mouse.
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
    tip.style.opacity = "1";
    tip.style.transform = "translateY(-4px)";
  }

  //-------------------------------
  // STEP 2: BUILD THE GRAPH USING D3.JS
  
  //ensure plotRoot has a height -- makes not difference if removed because of CSS - is for safety
  plotRoot.style.width = "100%"; // full width
  plotRoot.style.height = plotRoot.style.height ; // default height

  // build SVG - in other words creates the drawing area for the graph
  const width = plotRoot.clientWidth || 900;
  const height = plotRoot.clientHeight || 520;

  // create the SVG element inside the plotRoot container
  //Create an SVG inside the container that fills its width, uses a fixed internal coordinate system,
  //and scales smoothly while staying centered without distortion.
  const svg = d3.select(plotRoot)
    .append("svg")
    .attr("width", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

 
  //-----------------------------------------------------------------------
  //COLOR THE NODES 
  // color: categorical, one distinct color per disease (node.id)
  // build a base palette
  const palette = []; 
  const basePal = (d3.schemeCategory10.slice()) &&
                  ["#63ffd5ff","#001fcdff","#00a2ffff","#8047c6ff","#430090ff","#ff8bf1ff"];
  
  //Build a palette long enough for however many nodes we have by repeating the base palette as needed.
  while (palette.length < nodes.length) palette.push(...basePal);
  //palette.length = Math.max(nodes.length, basePal.length); // ensure palette is at least as long as basePal
  
  //Create a categorical color scale that maps each disease ID to a distinct color from the palette.
  const color = d3.scaleOrdinal()
    .domain(nodes.map(d => d.id))
    .range(palette);

  /*This code computes min/max GO counts and Jaccard values, then builds two scales 
    that turn “GO term count” into bubble radius and “similarity” into edge thickness, 
    keeping all sizes in a nice visual range.*/ 
  const rExtent = d3.extent(nodes, d => d.goTerms.length || 0);
  const rScale = d3.scaleSqrt().domain(rExtent).range([20, 70]);

  const wExtent = d3.extent(links, d => d.jaccard || 0);
  const wScale = d3.scaleLinear().domain(wExtent).range([0.5, 6]);

  // FORCE SIMULATION SETUP
  /*
   * This creates a physics simulation where nodes are pushed apart, 
   * pulled together by links, kept away from overlapping, 
   * and centered in the middle of the SVG.
   */
  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(160).strength(0.6))
    .force("charge", d3.forceManyBody().strength(-200))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide().radius(d => (rScale(d.goTerms.length) || 12) + 4));

//DRAW EDGES/LINKS/LINES    
//  This code creates one SVG <line> per link, gives it a transparent stroke, 
// and sets its thickness according to the Jaccard similarity value.
  const link = svg.append("g")
    .attr("stroke", "#b5ccffff") //color of the edges/lines
    .attr("stroke-opacity", 0.45)
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("stroke-width", d => Math.max(0.6, wScale(d.jaccard)));

//Make NODE DRAGGABLE   
/*This code creates one SVG group per node and makes it draggable by temporarily fixing its position during drag, 
  waking up the physics simulation, and releasing it afterward so it smoothly returns to the force layout.*/
  const node = svg.append("g")
    .selectAll("g")
    .data(nodes)
    .join("g")
    .attr("cursor", "pointer")
    .call(d3.drag()
      .filter(event => !event.button)
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.2).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
      }));

  /*This code draws each bubble, sizes and colors it based on data, 
    and adds interactive hover and click behaviors using a tooltip and smooth fade animations.*/ 
  node.append("circle")
    .attr("r", d => rScale(d.goTerms.length || 0))
    .attr("fill", d => color(d.id)) // color by disease id
    .attr("stroke", "#ffffff3e") //color the BORDER of the NODES
    .attr("stroke-width", 1.2)
    .on("mousemove", (event, d) => {
      tooltip.innerHTML = `<strong>${d.name}</strong><div style="font-size:12px;color:#d1d5db">GO terms: ${d.goTerms.length || 0} | ortholog support: ${d.totalSpeciesSupport || 0}</div>`;
      positionTooltipWithinVisArea(event, tooltip);
    })
    .on("mouseout", () => {  //make sure the hover text disappears when not hovering over a node
      tooltip.style.opacity = "0";
      tooltip.style.transform = "translateY(0)";
    })
    
  /*a short, centered, white label inside each bubble, sizing the text based on the bubble radius, 
  hiding labels for very small bubbles, and ensuring the text doesn’t block mouse interactions.*/
  node.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", d => (rScale(d.goTerms.length || 0) > 20 ? ".35em" : ".35em"))
    .style("pointer-events", "none")
    .style("font-size", d => Math.max(10, Math.min(15, (rScale(d.goTerms.length || 0) / 3))) + "px")
    .style("fill", "#ffffff") // force white TEXT INSIDE BUBBLES
    .text(d => {
      // short label: try disease name, fallback to id
      const words = (d.name || d.id || "").split(" ");
      return rScale(d.goTerms.length || 0) > 18 ? words.slice(0, 3).join(" ") : "";
    });

  /*Every tick of the force simulation updates each link’s endpoints to match the moving nodes 
  and moves each node’s <g> group to its new position so the whole graph animates smoothly.*/
  simulation.on("tick", () => {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

    node.attr("transform", d => `translate(${d.x},${d.y})`);
  });

  //-----------------------------------------------------------------------
  // LEGEND + SUMMARY 
  //-----------------------------------------------------------------------

//Decide where to attach the summary box
  const legendHost = visArea || plotRoot.parentElement || document.body;
  let summary = document.getElementById("vis-bubble-summary");
  //Create the summary box if it doesn’t exist yet
  //Configuration for the summary box’s appearance and positioning.
  if (!summary) {
    summary = document.createElement("div");
    summary.id = "vis-bubble-summary";
    Object.assign(summary.style, {
      position: "absolute",
      right: "24px",
      bottom: "32px",
      maxWidth: "200px",
      padding: "12px 16px",
      borderRadius: "10px",
      background: "rgba(35, 36, 41, 0.92)", //LEGEND BACKGROUND COLOR
      color: "#f1f3f8ff", //LEGEND TEXT COLOR
      fontSize: "12px",
      lineHeight: "1.4",
      zIndex: "998",
      pointerEvents: "none"
    });
    //Attach the Summary Legend
    (legendHost || document.body).appendChild(summary);
  }

  //COMPUTE SUMMARY STATS FOR THE LEGEND
  // compute summary stats (safe guards for empty arrays)
  //NODE WITH MOST ORTHOLOG SUPPORT 
  const maxSupportNode = nodes.length ? nodes.reduce((best, d) =>
    (best == null || (d.totalSpeciesSupport || 0) > (best.totalSpeciesSupport || 0)) ? d : best
  , null) : null;

  //NODE WITH MOST GO TERMS
  const maxGoNode = nodes.length ? nodes.reduce((best, d) =>
    (best == null || (d.goTerms.length || 0) > (best.goTerms.length || 0)) ? d : best
  , null) : null;

  //STRONGEST LINK BETWEEN TWO NODES BASED ON JACCARD SIMILARITY
  const strongestLink = links.length ? links.reduce((best, l) =>
    (best == null || (l.jaccard || 0) > (best.jaccard || 0)) ? l : best
  , null) : null;

  //--------------------------------------------

  // helper to get node name from id or object
  //Create a fast lookup table for nodes by ID
  const nodeById = new Map(nodes.map(n => [n.id, n]));
  const formatNodeName = d => d ? (d.name || d.id || "—") : "—"; //Helper to format a node's display name

  //Helper to extract a node ID from weird D3 link objects
  const extractId = v => {
    if (!v) return null;
    if (typeof v === "string") return v;
    if (typeof v === "object") return v.id || (v.source && extractId(v.source)) || null;
    return null;
  };

  //Build the label for the most similar pair
  const mostSimilarPair = strongestLink
    ? `${formatNodeName(nodeById.get(extractId(strongestLink.source)))} ↔ ${formatNodeName(nodeById.get(extractId(strongestLink.target)))}`
    : "—";

  // populate summary via DOM (no innerHTML)
  // Reset the box before adding new content.
  while (summary.firstChild) summary.removeChild(summary.firstChild);

  //Create the summary title
  const sTitle = document.createElement("div");
  sTitle.style.fontWeight = "600";
  sTitle.style.fontSize = "13px";
  sTitle.style.marginBottom = "6px";
  sTitle.textContent = "Graph network summary";
  summary.appendChild(sTitle);

  //Create a container for the body items
  const sBody = document.createElement("div");
  sBody.style.color = "#ebebebff"; //Legend Text color
  sBody.style.fontSize = "12px";

  //Item 1 — Most GO-annotated disease
  const item1 = document.createElement("div");
  const it1Title = document.createElement("strong");
  it1Title.textContent = "Most GO-annotated disease:";
  item1.appendChild(it1Title);
  const it1Val = document.createElement("div");
  it1Val.style.marginTop = "4px";
  it1Val.textContent = `${formatNodeName(maxGoNode)} (${maxGoNode?.goTerms.length || 0} GO terms)`;
  item1.appendChild(it1Val);
  sBody.appendChild(item1);

  //Item 2 — Strongest ortholog support
  const item2 = document.createElement("div");
  item2.style.marginTop = "8px";
  const it2Title = document.createElement("strong");
  it2Title.textContent = "Strongest ortholog support:";
  item2.appendChild(it2Title);
  const it2Val = document.createElement("div");
  it2Val.style.marginTop = "4px";
  it2Val.textContent = `${formatNodeName(maxSupportNode)} (${maxSupportNode?.totalSpeciesSupport || 0} ortholog hits)`;
  item2.appendChild(it2Val);
  sBody.appendChild(item2);

  //Item 3 — Most similar pair by Jaccard
  const item3 = document.createElement("div");
  item3.style.marginTop = "8px";
  const Title3 = document.createElement("strong");
  Title3.textContent = "Most similar pair (edges):";
  item3.appendChild(Title3);
  const Val3 = document.createElement("div");
  Val3.style.marginTop = "4px";
  Val3.textContent = `${mostSimilarPair}${strongestLink ? ` (Jaccard = ${Number(strongestLink.jaccard || 0).toFixed(3)})` : ""}`;
  item3.appendChild(Val3);
  sBody.appendChild(item3);
  //Append the body to the summary box
  summary.appendChild(sBody); 
}

//====================================================================================
//GROUPED BAR CHART VISUALIZATION 
//====================================================================================

//------------------------------------------------------------------------------------
//      GROUPED BAR CHART: process the SPARQL results for the grouped bar chart visualization
//------------------------------------------------------------------------------------

// function that processes the SPARQL results for the grouped bar chart visualization
// bindings are the data rows returned from the SPARQL query
// normalize is an optional flag to indicate if row-normalization should be applied (default: false)
function processGroupedBarChart(bindings, normalize = false) {
  if (!Array.isArray(bindings) || bindings.length === 0) {
    return { traces: [], diseaseLabels: [] };
  }

  const rows = bindings.map(b => ({
    speciesLabel: b.orthologSpeciesLabel?.value ?? b.speciesLabel?.value ?? "Unknown",
    diseaseLabel: b.diseaseLabel?.value ?? "Unknown",
    goAnnotationCount: Number(b.goAnnotationCount?.value ?? 0)
  }));

  const speciesLabels = [...new Set(rows.map(r => r.speciesLabel))];
  const diseaseLabels = [...new Set(rows.map(r => r.diseaseLabel))];

  // One Plotly trace per species
  const traces = speciesLabels.map(sp => ({
    type: "bar",
    name: sp,
    x: diseaseLabels,                            // categories on x-axis
    y: diseaseLabels.map(dLabel => {             // bar heights
      const found = rows.find(r =>
        r.speciesLabel === sp && r.diseaseLabel === dLabel
      );
      return found ? found.goAnnotationCount : 0;
    })
  }));

  return { traces, diseaseLabels };
}

//-----------------------------------------------------------------------
//REDERED: GROUPED BAR CHART
//-----------------------------------------------------------------------

function renderGroupedBarChart(processed) {
  // 1) Find the container where Plotly will render.
  const res = ensurePlotRoot();
  const container = res?.plotRoot ?? document.getElementById("plotly-root");
  if (!container) return;

  hideVisLoader();
  const orphan = document.getElementById("heatmap-top-diseases");
  if (orphan) orphan.remove();

  const COLORS = ["#047139ff", "#29b6b2ff", "#1957baff", "#8e57dfff", "#ff8dd9ff"];

  // --------------------------------------------------------
  // buildTraces: normalize input to ordered Plotly traces
  // --------------------------------------------------------
  const buildTraces = (input) => {
    const speciesEntries = [];

    // Case 1: already in Plotly trace shape
    if (Array.isArray(input?.traces) && input.traces.length) {
      const traces = input.traces;
      const globalX = input.diseaseLabels || traces[0].x || [];

      for (const t of traces) {
        const x = t.x || globalX;
        const y = t.y || [];
        const diseaseMap = {};

        for (let i = 0; i < x.length; i++) {
          diseaseMap[x[i]] = Number(y[i] ?? 0);
        }

        speciesEntries.push({
          speciesLabel: t.name ?? t.speciesLabel ?? "Unknown",
          diseaseMap
        });
      }

    // Case 2: custom GroupedBarChartData shape
    } else if (Array.isArray(input?.GroupedBarChartData) && input.GroupedBarChartData.length) {
      for (const sp of input.GroupedBarChartData) {
        const diseaseMap = {};
        for (const d of (sp.diseases || [])) {
          diseaseMap[d.diseaseLabel] = Number(d.goAnnotationCount ?? 0);
        }
        speciesEntries.push({
          speciesLabel: sp.speciesLabel ?? "Unknown",
          diseaseMap
        });
      }

    } else {
      return [];
    }

    // ---- Disease ordering: by total GO count (descending) ----
    const diseaseTotals = {};
    for (const sp of speciesEntries) {
      for (const [disease, value] of Object.entries(sp.diseaseMap)) {
        diseaseTotals[disease] = (diseaseTotals[disease] || 0) + Number(value || 0);
      }
    }
    const diseaseOrder = Object.keys(diseaseTotals).sort(
      (a, b) => diseaseTotals[b] - diseaseTotals[a]
    );
    if (!diseaseOrder.length) return [];

    // ---- Species ordering: by total GO count (descending) ----
    const speciesTotals = speciesEntries.map(sp => ({
      label: sp.speciesLabel,
      total: Object.values(sp.diseaseMap).reduce(
        (sum, v) => sum + Number(v || 0),
        0
      )
    }));
    const sortedSpeciesLabels = speciesTotals
      .sort((a, b) => b.total - a.total)
      .map(s => s.label);

    // ---- Build final Plotly traces in that order ----
    return sortedSpeciesLabels.map((label, idx) => {
      const sp = speciesEntries.find(s => s.speciesLabel === label) || { diseaseMap: {} };
      const y = diseaseOrder.map(d => sp.diseaseMap[d] ?? 0);
      return {
        x: diseaseOrder,
        y,
        name: label,
        type: "bar",
        marker: { color: COLORS[idx % COLORS.length] }
      };
    });
  };

  const traces = buildTraces(processed);
  if (!traces.length) {
    container.innerHTML = "<div style='padding:18px;color:#ddd'>No data to display.</div>";
    return;
  }


  // --------- Layout ---------
  const layout = {
    title: "Go annotations per Disease across Ortholog Organism Species",
    barmode: "group",
    xaxis: { title: "Disease", tickangle: -30, automargin: true },
    yaxis: { title: "GO annotations (count)", automargin: true },
    margin: { t: 60, b: 140, l: 80, r: 30 },
    legend: { orientation: "v", x: 1.02, xanchor: "left", y: 1 }
  };

  const opts = { responsive: true };
  const plotPromise = container._plotly
    ? Plotly.react(container, traces, layout, opts)
    : Plotly.newPlot(container, traces, layout, opts);

  plotPromise
    .then(() => { if (window.hideVisLoader) window.hideVisLoader(); })
    .catch(err => {
      console.error("renderGroupedBarChart failed:", err);
      container.textContent = "Failed to render grouped bar chart.";
    });
}




//====================================================================================
//BAR CHART VISUALIZATION
//====================================================================================

//------------------------------------------------------------------------------------
//      BAR CHART PROCESSOR: process the SPARQL results for bar chart visualization
//------------------------------------------------------------------------------------

function processBar(bindings) {
  const labels = [];
  const counts = [];
  for (const row of bindings) {
    // handle either the new species/orthologCount 
    const label = row.speciesLabel?.value ?? row.diseaseLabel?.value ?? "Unknown";
    const count = parseInt(row.orthologCount?.value ?? row.geneCount?.value ?? "0", 10);
    labels.push(label);
    counts.push(count);
  }
  return { x: labels, y: counts };
}
//---------------------------------------------------------------------------------------
//REDERED: BAR CHART
//---------------------------------------------------------------------------------------
 // --- local species images/info (place files in project_root/images/) ---
 const speciesInfo = {
    "house mouse": {
      img: "images/House Mouse.jpg",
      scientific: "Mus musculus",
      text: "The house mouse (Mus musculus) is a small rodent in the family Muridae, originally native to Central Asia and now distributed worldwide alongside humans. It adapts readily to laboratory conditions and is one of the most extensively studied mammals. The mouse is a key vertebrate model in genetics, immunology, neuroscience, cancer biology and pre-clinical drug development. Advantages include short generation time, high fecundity, a well‑characterized genome, and many available transgenic, knockout and CRISPR strains, enabling researchers to model human disease and study gene function. In the wild it occupies fields, buildings and urban areas, seeks shelter and food, and can reproduce year‑round under favorable conditions."
    },
    "brown rat": {
      img: "images/Brown Rat.jpg",
      scientific: "Rattus norvegicus",
      text: "The brown rat (Rattus norvegicus) is a medium‑sized rodent in the family Muridae, native to riverine and grassland regions of northern China but now distributed worldwide alongside humans. Highly adaptable, it occupies urban, agricultural and coastal habitats (burrows, sewers, warehouses, riverbanks) and thrives where food and shelter are available. The species is important in biomedical research for its physiological and genetic relevance to humans, relatively large body size, and suitability for controlled breeding. It has been central to studies in cardiovascular disease, neuroscience, endocrinology, toxicology and pharmacology; many inbred, outbred and genetically modified strains exist to support reproducible experimental work. Brown rats are social, breed readily under favorable conditions, and exhibit flexible foraging and nesting behaviours that allow them to persist across diverse environments."
    },
    "Danio rerio": {
      img: "images/Danio rerio.jpg",
      scientific: "Danio rerio",
      text: "The zebrafish (Danio rerio) is a freshwater ray‑finned fish in the family Danionidae, native to South Asia and commonly sold as the aquarium 'zebra danio'. It is an important vertebrate model organism used widely in developmental biology, genetics, oncology, teratology and pre‑clinical drug development. Advantages include high fecundity, transparent embryos, ease of genetic manipulation, simple drug delivery via water, and notable regenerative abilities; many transgenic strains have been produced. In the wild adults inhabit slow‑moving or standing waters (streams, canals, ponds, rice fields) and breed year‑round."
    },
    "Drosophila melanogaster": {
      img: "images/Drosophila melanogaster.jpg",
      scientific: "Drosophila melanogaster",
      text: "Drosophila melanogaster (fruit fly) is a small dipteran native to Africa and now distributed worldwide. It frequents fermenting fruit and human environments and is a common household pest. D. melanogaster is a premier genetic model organism — valued for a short life cycle (~10 days at 25°C), high fecundity, only four chromosome pairs, and powerful genetic tools. It underpins research in genetics, development, neurobiology, physiology and disease models, and work in this species has contributed to multiple Nobel Prizes."
    },
    "Caenorhabditis elegans": {
      img: "images/Caenorhabditis elegans.jpg",
      scientific: "Caenorhabditis elegans",
      text: "Caenorhabditis elegans is a free‑living, transparent nematode (roundworm) in the family Rhabditidae. It inhabits moist, microbe‑rich substrates such as compost, rotting fruit and leaf litter and feeds mainly on bacteria. C. elegans is a premier invertebrate model organism for developmental biology, neurobiology, genetics, aging and cell biology: it was the first multicellular animal with a fully sequenced genome and its entire cell lineage has been mapped. Advantages include a short life cycle, transparent body, well‑defined nervous system, and vast collections of mutants and transgenic strains. Reproduction is primarily by self‑fertilizing hermaphrodites (males occur at low frequency), and under stress larvae can enter a long‑lived, resistant dauer stage to survive adverse conditions."
    },
    "Saccharomyces cerevisiae S288c": {
      img: "images/Saccharomyces cerevisiae S288c.jpg",
      scientific: "Saccharomyces cerevisiae",
      text: "Saccharomyces cerevisiae (baker’s yeast) is a unicellular fungus in the phylum Ascomycota. Domesticated and widespread, it occupies sugar‑rich niches such as fruits, tree exudates, soil and fermented plant material, and is widely used in baking, brewing and biotechnology. S. cerevisiae is a key eukaryotic model organism in molecular biology, genetics, cell biology and biochemistry because of its rapid growth, easy genetic manipulation and a well‑annotated genome. Work in this species has driven discoveries in cell‑cycle control, DNA repair, metabolism, aging and protein secretion. It reproduces asexually by budding and can undergo meiosis and form resistant spores under nutrient stress."
    },
    // fallback placeholder
    "": { img: "images/placeholder.png", text: "No description available." }
  };

//---this function renders the bar chart using Plotly.js---
function renderBar(bindingsOrProcessed) {
  RemovePreviousVis();
  const res = ensurePlotRoot();
  const container = res?.plotRoot ?? document.getElementById("plotly-root");
  if (!container) return;
  hideVisLoader();
  container.innerHTML = "";
  container.style.width = "100%";
  // Ensure a usable height: if inline style is absent or is a percent (which may resolve to 0),
  // fall back to a reliable pixel height so Plotly can size correctly.
  const inlineH = container.style.height && parseInt(container.style.height, 10);
  const clientH = container.clientHeight || 0;
  if ((inlineH && inlineH < 80) || (!inlineH && clientH < 80)) {
    container.style.height = "520px";
  }
  // also provide a sensible minimum
  container.style.minHeight = container.style.minHeight || "360px";


  // accept either processed object {x,y} or raw bindings array
  let processed;
  if (bindingsOrProcessed?.x && Array.isArray(bindingsOrProcessed.x) &&
      bindingsOrProcessed?.y && Array.isArray(bindingsOrProcessed.y)) {
    // already in { x: [...], y: [...] } form
    processed = bindingsOrProcessed;
  } else if (Array.isArray(bindingsOrProcessed)) {
    // raw bindings array
    processed = processBar(bindingsOrProcessed);
  } else {
    // fallback to cached data
    processed = cache.bar?.processed || processBar(cache.bar?.bindings || []);
  }
  

  const { x = [], y = [] } = processed;
  if (!x.length) {
    container.innerHTML = "<div style='padding:12px;color:#666'>No data to display for bar chart.</div>";
    return;
  }

  // create / reuse inner div for Plotly (so we don't clobber other overlays)
  let barDiv = document.getElementById("species-bar");
  if (!barDiv) {
    barDiv = document.createElement("div");
    barDiv.id = "species-bar";
    barDiv.style.width = "100%";
    barDiv.style.height = "100%";
    container.appendChild(barDiv);
  } else {
    barDiv.innerHTML = "";
  }

  // --- render the Plotly bar chart (was accidentally removed) ---
  const trace = {
    x,
    y,
    type: "bar",
    marker: { color: "#456df1", line: { width: 1 } }
  };

  const layout = {
    margin: { t: 40, r: 10, b: 80, l: 60 },
    title: "Ortholog support per model organism",
    xaxis: { automargin: true, tickangle: -30 },
    yaxis: { title: "Number of ortholog genes" }
  };

  Plotly.newPlot(barDiv, [trace], layout, { responsive: true })
    .then(() => {
      if (window.hideVisLoader) window.hideVisLoader();
      // force Plotly to recalc sizes — multiple calls to be robust across browsers
      try { Plotly.Plots.resize(barDiv); } catch (e) { /* ignore */ }
      requestAnimationFrame(() => { try { Plotly.Plots.resize(barDiv); } catch (e) {} });
      setTimeout(() => { try { Plotly.Plots.resize(barDiv); } catch (e) {} }, 200);
    })
    .catch(err => {
      console.error("renderBar failed:", err);
      barDiv.innerHTML = "<div style='padding:12px;color:#666'>Failed to render bar chart.</div>";
    });

  // --- SIDE PANEL + OVERLAY (create once, show on click) ---
  const legendHost = res?.visArea ?? container.parentElement ?? document.body;
  if (legendHost && window.getComputedStyle(legendHost).position === "static") {
    legendHost.style.position = "relative";
  }

  // Create overlay + panel once, keep references to inner elements for fast updates
  let overlay = document.getElementById("plot-overlay");
  let sidePanel = document.getElementById("species-side-panel");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "plot-overlay";
    Object.assign(overlay.style, {
      position: "absolute", left: "0", top: "0", right: "0", bottom: "0",
      background: "rgba(27, 27, 27, 0.64)", zIndex: "995", display: "none", cursor: "pointer"
    });
    (legendHost || document.body).appendChild(overlay);
  }

  if (!sidePanel) {
    sidePanel = document.createElement("aside");
    sidePanel.id = "species-side-panel";
    Object.assign(sidePanel.style, {
      position: "absolute", top: "24px", right: "24px", width: "360px",
      maxWidth: "calc(100% - 48px)", bottom: "24px", overflow: "auto",
      background: "#252525ff", color: "#141414ff", borderRadius: "8px", padding: "18px",
      zIndex: "998", display: "none", transition: "opacity 180ms ease"
    });

    // inner structure (no innerHTML)
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close");
    Object.assign(closeBtn.style, { position: "absolute", top: "10px", right: "12px", width: "34px", height: "34px", border: "none", background: "transparent", color: "#444", fontSize: "18px", cursor: "pointer", padding: "0" });
    closeBtn.textContent = "✕";

    const titleEl = document.createElement("h2");
    Object.assign(titleEl.style, { margin: "0 0 6px 0", fontSize: "20px", fontWeight: "700", color: "#ffffffff" });

    const sciEl = document.createElement("div");
    sciEl.style.fontStyle = "italic";
    sciEl.style.color = "#dadadaff";
    sciEl.style.marginBottom = "12px";

    const imgWrap = document.createElement("div");
    Object.assign(imgWrap.style, { width: "100%", height: "200px", borderRadius: "8px", overflow: "hidden", marginBottom: "12px" });
    const imgEl = document.createElement("img");
    Object.assign(imgEl.style, { width: "100%", height: "100%", objectFit: "cover", display: "block" });
    imgWrap.appendChild(imgEl);

    const countLabel = document.createElement("div");
    Object.assign(countLabel.style, { marginBottom: "8px", color: "#75a5ffff", fontSize: "13px", fontWeight: "600" });
    countLabel.textContent = "Ortholog Count";

    const countVal = document.createElement("div");
    Object.assign(countVal.style, { fontSize: "28px", color: "#1565ff", fontWeight: "700", marginBottom: "12px" });

    const descEl = document.createElement("div");
    Object.assign(descEl.style, { color: "#e0e0e0ff", fontSize: "13px", lineHeight: "1.45" });

    sidePanel.appendChild(closeBtn);
    sidePanel.appendChild(titleEl);
    sidePanel.appendChild(sciEl);
    sidePanel.appendChild(imgWrap);
    sidePanel.appendChild(countLabel);
    sidePanel.appendChild(countVal);
    sidePanel.appendChild(descEl);

    (legendHost || document.body).appendChild(sidePanel);

    // hide handler
    function hidePanel() {
      overlay.style.display = "none";
      sidePanel.style.opacity = "0";
      setTimeout(() => { sidePanel.style.display = "none"; }, 200);
    }
    overlay.addEventListener("click", hidePanel);
    closeBtn.addEventListener("click", hidePanel);

    // helper to open panel with data
    window.openSidePanel = function openSidePanel({ title = "", scientific = "", img = "images/placeholder.png", count = "", text = "" } = {}) {
      titleEl.textContent = title;
      sciEl.textContent = scientific;
      imgEl.src = img;
      imgEl.alt = title;
      countVal.textContent = (count !== null && count !== undefined) ? Number(count).toLocaleString() : "";
      descEl.textContent = text || "No description available.";
      overlay.style.display = "block";
      sidePanel.style.display = "block";
      requestAnimationFrame(() => { sidePanel.style.opacity = "1"; });
      sidePanel.scrollTop = 0;
    };
  }

  // attach Plotly click handler to call openSidePanel (no innerHTML)
  if (barDiv && typeof barDiv.on === "function" && typeof barDiv.removeAllListeners === "function") {
  barDiv.removeAllListeners("plotly_click");
  barDiv.on("plotly_click", (evt) => {
    const pt = evt.points && evt.points[0];
    if (!pt) return;
    const label = pt.x;
    const count = pt.y;
    const mapped = speciesInfo[label] || (processed?.meta?.infoMap?.[label] || {});
    const imgUrl = mapped.img || "images/placeholder.png";
    const sci = mapped.scientific || "";
    const text = mapped.text || "No description available.";
    if (typeof window.openSidePanel === "function") {
      window.openSidePanel({ title: label, scientific: sci, img: imgUrl, count, text });
    }
  });
}



}

// ---------- VISUALIZATION CLEANUP HELPERS ----------
function RemovePreviousVis() {
  const ids = [
    "vis-bubble-summary",
    "vis-bubble-legend",
    "vis-bubble-tooltip",
    "bubble-side-legend",
    "vis-bubble-top-legend"
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
}

// helper: remove any UI artifacts created by any renderer (single entrypoint)
function clearVizArtifacts() {
  // remove bubble-specific UI first (legend/summary/tooltip appended outside plotRoot)
  if (typeof RemovePreviousVis === "function") RemovePreviousVis();

  // remove generic overlay / loaders / placeholders
  const visArea = document.getElementById("vis-area");
  if (visArea) {
  visArea
    .querySelectorAll(".loader-simple, .vis-placeholder")
    .forEach(n => n.remove());
}

  
}

// ---------- LOADER DOM HELPERS (show during fetch + plot) ----------
function ensurePlotRoot() {
  const visArea = document.getElementById("vis-area");
  if (!visArea) return null;
  let plotRoot = document.getElementById("plotly-root");
  if (!plotRoot) {
    plotRoot = document.createElement("div");
    plotRoot.id = "plotly-root";
    plotRoot.style.width = "100%";
    // make plotRoot fill the vis-area and provide a reliable minimum height
    plotRoot.style.height = "100%";
    plotRoot.style.minHeight = "360px";
    plotRoot.style.boxSizing = "border-box";
    // keep plot root in DOM but loader overlays are positioned absolutely above it
    visArea.appendChild(plotRoot);
  }
  return { visArea, plotRoot };
}

function showVisLoader() {
  const res = ensurePlotRoot();
  if (!res) return;
  const { visArea } = res;
  if (visArea.querySelector(".loader") || visArea.querySelector(".longfazers")) return;

  const loader = document.createElement("div");
  loader.className = "loader";
  loader.setAttribute("role", "status");
  loader.setAttribute("aria-hidden", "true");
  loader.style.pointerEvents = "none"; // allow clicks to pass through

  const outerSpan = document.createElement("span");
  for (let i = 0; i < 4; i++) outerSpan.appendChild(document.createElement("span"));
  loader.appendChild(outerSpan);

  const base = document.createElement("div");
  base.className = "base";
  base.appendChild(document.createElement("span"));
  const face = document.createElement("div");
  face.className = "face";
  base.appendChild(face);
  loader.appendChild(base);

  const longfazers = document.createElement("div");
  longfazers.className = "longfazers";
  longfazers.style.pointerEvents = "none";
  for (let i = 0; i < 4; i++) longfazers.appendChild(document.createElement("span"));

  const label = document.createElement("div");
  label.className = "vis-placeholder";
  label.textContent = "Loading visualization…";
  label.style.pointerEvents = "none";
  label.setAttribute("aria-hidden", "true");

  visArea.appendChild(loader);
  visArea.appendChild(longfazers);
  visArea.appendChild(label);
}

function hideVisLoader() {
  const visArea = document.getElementById("vis-area");
  if (!visArea) return;
  visArea.querySelectorAll(".loader, .longfazers, .loader-simple, .vis-placeholder").forEach(n => n.remove());
}

// update switchMode: paint loader first, fetch, render, then prefetch other modes in background
async function switchMode(mode) {
  if (!mode) mode = "graph";
  currentMode = mode;

  // clear any previous artifacts
  clearVizArtifacts();

  const visArea = document.getElementById("vis-area");
  const plotRoot = ensurePlotRoot()?.plotRoot;
  if (!visArea || !plotRoot) return;

  const orphan = document.getElementById("heatmap-top-diseases");
  if (orphan) orphan.remove();

  // show loader and let browser paint
  showVisLoader();
  await new Promise(resolve => requestAnimationFrame(resolve));

  let loadingTimer = null;
  const hasProcessedCache = !!(cache[mode] && cache[mode].processed);

  try {
    const bindings = await fetchBindings(mode);
    if (loadingTimer) clearTimeout(loadingTimer);
    plotRoot.innerHTML = "";

    if (!cache[mode].processed) {
      let processed;
      if (mode === "graph") processed = processGraph(bindings);
      else if (mode === "grouped_bar_chart") processed = processGroupedBarChart(bindings);
      else processed = processBar(bindings);
      cache[mode].processed = processed;
    }

    const data = cache[mode].processed;

    if (mode === "graph") renderGraph(data);
    else if (mode === "grouped_bar_chart") renderGroupedBarChart(data);
    else renderBar(data);

    // background prefetch other modes (non-blocking)
    setTimeout(() => {
      Object.keys(QUERIES).forEach(m => {
        if (m === mode) return;
        if (!cache[m]?.bindings) {
          fetchBindings(m).then(b => {
            if (!cache[m].processed) {
              const p = (m === "graph") ? processGraph(b) : (m === "grouped_bar_chart") ? processGroupedBarChart(b) : processBar(b);
              cache[m].processed = p;
            }
          }).catch(() => {/* swallow background fetch errors */});
        }
      });
    }, 0);

   } catch (err) {
    if (loadingTimer) clearTimeout(loadingTimer);
    console.error(err);
    plotRoot.textContent = "Error loading visualization: " + (err.message || err);
  } finally {
    // ensure loader removed after render or error
    hideVisLoader();
  }
}

function setupToggleButtons() {
  const buttons = document.querySelectorAll("[data-viz-mode]");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.vizMode;
      if (!mode || mode === currentMode) return;
      buttons.forEach(b => b.classList.remove("viz-toggle-btn--active"));
      btn.classList.add("viz-toggle-btn--active");
      switchMode(mode);
    });
  });
}

function init() {
  setupToggleButtons();
  // mark the default toggle active if present
  const buttons = document.querySelectorAll("[data-viz-mode]");
  const activeBtn = Array.from(buttons).find(b => b.dataset.vizMode === currentMode) || buttons[0];
  if (activeBtn) activeBtn.classList.add("viz-toggle-btn--active");

  // auto-load default view (non-blocking)
  switchMode(currentMode).catch(err => console.error("switchMode failed:", err));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}



