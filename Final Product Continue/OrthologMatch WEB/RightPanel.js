document.addEventListener('DOMContentLoaded', () => {
  console.log('RightPanel.js loaded');
  const resultsBody = document.getElementById('resultsBody');
  const visContainer = document.querySelector('.visualization-placeholder');

  if (!resultsBody || !visContainer) {
    console.warn('RightPanel: missing resultsBody or visualization-placeholder', { resultsBody, visContainer });
    return;
  }

  // detect column by header keywords or fallback heuristics
  function detectColumnIndex(preferredKeywords, fallbackIndex) {
    const ths = Array.from(document.querySelectorAll('.results-table thead th'));
    for (let i = 0; i < ths.length; i++) {
      const t = (ths[i].textContent || '').toLowerCase();
      for (const kw of preferredKeywords) if (t.includes(kw)) return i;
    }
    const firstRow = resultsBody.querySelector('tr');
    if (firstRow) {
      const cells = Array.from(firstRow.cells);
      for (let i = 0; i < cells.length; i++) {
        const txt = (cells[i].textContent || '').trim();
        if (txt && isNaN(Number(txt))) return i;
      }
      return Math.min(fallbackIndex, cells.length - 1);
    }
    return fallbackIndex;
  }

  function getIndexes() {
    const diseaseIdx = detectColumnIndex(['disease', 'phenotype', 'condition'], Math.max(0, (document.querySelectorAll('.results-table thead th').length - 1)));
    // human gene may be labeled "human gene" or "humanGeneLabel" etc.
    const humanIdx = detectColumnIndex(['human gene', 'humanGene', 'humanGenelabel', 'hgnc', 'symbol'], 0);
    const ratIdx = detectColumnIndex(['rat gene', 'ratGene', 'ratGenelabel'], Math.min(1, document.querySelectorAll('.results-table thead th').length - 1));
    return { diseaseIdx, humanIdx, ratIdx };
  }

  // parse table -> map disease => { humans: Set, rats: Set }
  function parseDiseaseGeneSets() {
    const { diseaseIdx, humanIdx, ratIdx } = getIndexes();
    console.debug('RightPanel indexes', { diseaseIdx, humanIdx, ratIdx, rows: resultsBody.rows.length });
    const map = new Map();
    Array.from(resultsBody.rows).forEach((row, rIndex) => {
      const cells = row.cells;
      if (!cells || cells.length === 0) return;
      const disease = (cells[diseaseIdx]?.textContent || '').trim();
      const human = (cells[humanIdx]?.textContent || '').trim();
      const rat = (cells[ratIdx]?.textContent || '').trim();

      // if disease missing try to find any textual cell as fallback
      const key = disease || Array.from(cells).map(c => (c.textContent||'').trim()).find(t => t && isNaN(Number(t)));
      if (!key) return;
      if (!map.has(key)) map.set(key, { humans: new Set(), rats: new Set() });
      if (human) map.get(key).humans.add(human);
      if (rat) map.get(key).rats.add(rat);
    });

    const out = Array.from(map.entries()).map(([key, sets]) => ({
      disease: key,
      humanCount: sets.humans.size,
      ratCount: sets.rats.size,
      total: sets.humans.size + sets.rats.size
    }));
    console.debug('RightPanel parsed disease counts (sample):', out.slice(0, 10));
    return out;
  }

  function renderGroupedBarChart(data) {
    visContainer.innerHTML = '';
    if (!data || data.length === 0) {
      const msg = document.createElement('div');
      msg.style.color = '#cbd5e1';
      msg.style.padding = '12px';
      msg.textContent = 'No data to display — ensure left panel results table has rows.';
      const btn = document.createElement('button');
      btn.textContent = 'Refresh';
      btn.style.marginLeft = '12px';
      btn.addEventListener('click', update);
      msg.appendChild(btn);
      visContainer.appendChild(msg);
      return;
    }

    // sort by total descending, limit to top N for readability
    data.sort((a, b) => b.total - a.total);
    const TOP_N = 15;
    const display = data.slice(0, TOP_N).reverse(); // reverse so largest at right (optional)

    const padding = { top: 24, right: 20, bottom: 140, left: 64 };
    const containerW = Math.max(420, visContainer.clientWidth || 800);
    const containerH = Math.max(300, 320);
    const innerW = containerW - padding.left - padding.right;
    const innerH = containerH - padding.top - padding.bottom;

    const maxVal = Math.max(...display.map(d => Math.max(d.humanCount, d.ratCount)), 1);

    const groups = display.length;
    const groupGap = 18;
    const groupWidth = groups ? (innerW - (groups - 1) * groupGap) / groups : innerW;
    const barGap = 6;
    const barWidth = Math.max(6, (groupWidth - barGap) / 2);

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', containerW);
    svg.setAttribute('height', containerH);
    svg.setAttribute('viewBox', `0 0 ${containerW} ${containerH}`);
    svg.style.width = '100%';
    svg.style.height = 'auto';
    svg.style.display = 'block';
    svg.style.fontFamily = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial';
    visContainer.appendChild(svg);

    // y axis grid + ticks
    const ticks = Math.min(6, Math.max(2, Math.ceil(maxVal / 1)));
    for (let i = 0; i <= ticks; i++) {
      const v = Math.round((maxVal / ticks) * i);
      const y = padding.top + innerH - (v / maxVal) * innerH;
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', padding.left);
      line.setAttribute('x2', padding.left + innerW);
      line.setAttribute('y1', y);
      line.setAttribute('y2', y);
      line.setAttribute('stroke', 'rgba(255,255,255,0.04)');
      line.setAttribute('stroke-width', '1');
      svg.appendChild(line);
      const label = document.createElementNS(svgNS, 'text');
      label.setAttribute('x', padding.left - 8);
      label.setAttribute('y', y + 4);
      label.setAttribute('fill', '#cbd5e1');
      label.setAttribute('font-size', '12');
      label.setAttribute('text-anchor', 'end');
      label.textContent = v;
      svg.appendChild(label);
    }

    // draw groups and bars
    display.forEach((d, i) => {
      const groupX = padding.left + i * (groupWidth + groupGap);
      // human bar (left in group)
      const humanH = Math.round((d.humanCount / maxVal) * innerH);
      const humanY = padding.top + innerH - humanH;
      const humanRect = document.createElementNS(svgNS, 'rect');
      humanRect.setAttribute('x', groupX + (groupWidth - 2 * barWidth - barGap) / 2);
      humanRect.setAttribute('y', humanY);
      humanRect.setAttribute('width', barWidth);
      humanRect.setAttribute('height', Math.max(1, humanH));
      humanRect.setAttribute('rx', 3);
      humanRect.setAttribute('fill', '#58a6ff');
      svg.appendChild(humanRect);

      // rat bar (right in group)
      const ratH = Math.round((d.ratCount / maxVal) * innerH);
      const ratY = padding.top + innerH - ratH;
      const ratRect = document.createElementNS(svgNS, 'rect');
      ratRect.setAttribute('x', groupX + (groupWidth - 2 * barWidth - barGap) / 2 + barWidth + barGap);
      ratRect.setAttribute('y', ratY);
      ratRect.setAttribute('width', barWidth);
      ratRect.setAttribute('height', Math.max(1, ratH));
      ratRect.setAttribute('rx', 3);
      ratRect.setAttribute('fill', '#7ee787');
      svg.appendChild(ratRect);

      // value labels
      const hv = document.createElementNS(svgNS, 'text');
      hv.setAttribute('x', Number(humanRect.getAttribute('x')) + barWidth / 2);
      hv.setAttribute('y', humanY - 6);
      hv.setAttribute('fill', '#9fb6ff');
      hv.setAttribute('font-size', '11');
      hv.setAttribute('text-anchor', 'middle');
      hv.textContent = d.humanCount;
      svg.appendChild(hv);

      const rv = document.createElementNS(svgNS, 'text');
      rv.setAttribute('x', Number(ratRect.getAttribute('x')) + barWidth / 2);
      rv.setAttribute('y', ratY - 6);
      rv.setAttribute('fill', '#9ff2a6');
      rv.setAttribute('font-size', '11');
      rv.setAttribute('text-anchor', 'middle');
      rv.textContent = d.ratCount;
      svg.appendChild(rv);

      // x label rotated
      const lblX = groupX + groupWidth / 2;
      const lblY = padding.top + innerH + 16;
      const lbl = document.createElementNS(svgNS, 'text');
      lbl.setAttribute('x', lblX);
      lbl.setAttribute('y', lblY);
      lbl.setAttribute('fill', '#ddd');
      lbl.setAttribute('font-size', '11');
      lbl.setAttribute('text-anchor', 'end');
      lbl.setAttribute('transform', `rotate(-40 ${lblX} ${lblY})`);
      lbl.textContent = d.disease.length > 40 ? d.disease.slice(0, 37) + '...' : d.disease;
      svg.appendChild(lbl);
    });

    // axis labels + legend
    const xlabel = document.createElementNS(svgNS, 'text');
    xlabel.setAttribute('x', padding.left + innerW / 2);
    xlabel.setAttribute('y', containerH - 8);
    xlabel.setAttribute('fill', '#bfcbdc');
    xlabel.setAttribute('font-size', '12');
    xlabel.setAttribute('text-anchor', 'middle');
    xlabel.textContent = 'Disease';
    svg.appendChild(xlabel);

    const ylabel = document.createElementNS(svgNS, 'text');
    ylabel.setAttribute('x', 12);
    ylabel.setAttribute('y', padding.top + innerH / 2);
    ylabel.setAttribute('fill', '#bfcbdc');
    ylabel.setAttribute('font-size', '12');
    ylabel.setAttribute('text-anchor', 'middle');
    ylabel.setAttribute('transform', `rotate(-90 12 ${padding.top + innerH / 2})`);
    ylabel.textContent = 'Number of genes';
    svg.appendChild(ylabel);

    // legend
    const legendX = padding.left + 6;
    const legendY = padding.top - 8;
    const lh = 12;
    const gap = 8;
    // human
    const lRectH = document.createElementNS(svgNS, 'rect');
    lRectH.setAttribute('x', legendX);
    lRectH.setAttribute('y', legendY - lh);
    lRectH.setAttribute('width', 14);
    lRectH.setAttribute('height', 10);
    lRectH.setAttribute('rx', 2);
    lRectH.setAttribute('fill', '#58a6ff');
    svg.appendChild(lRectH);
    const lTextH = document.createElementNS(svgNS, 'text');
    lTextH.setAttribute('x', legendX + 18);
    lTextH.setAttribute('y', legendY - lh + 8);
    lTextH.setAttribute('fill', '#ddd');
    lTextH.setAttribute('font-size', '11');
    lTextH.textContent = 'Human genes';
    svg.appendChild(lTextH);
    // rat
    const lRectR = document.createElementNS(svgNS, 'rect');
    lRectR.setAttribute('x', legendX + 120);
    lRectR.setAttribute('y', legendY - lh);
    lRectR.setAttribute('width', 14);
    lRectR.setAttribute('height', 10);
    lRectR.setAttribute('rx', 2);
    lRectR.setAttribute('fill', '#7ee787');
    svg.appendChild(lRectR);
    const lTextR = document.createElementNS(svgNS, 'text');
    lTextR.setAttribute('x', legendX + 144);
    lTextR.setAttribute('y', legendY - lh + 8);
    lTextR.setAttribute('fill', '#ddd');
    lTextR.setAttribute('font-size', '11');
    lTextR.textContent = 'Rat genes';
    svg.appendChild(lTextR);
  }

  function update() {
    const parsed = parseDiseaseGeneSets();
    renderGroupedBarChart(parsed);
  }

  const mo = new MutationObserver(() => requestAnimationFrame(update));
  mo.observe(resultsBody, { childList: true, subtree: true, characterData: true });

  window.addEventListener('resize', () => requestAnimationFrame(update));

  // initial
  update();
});

