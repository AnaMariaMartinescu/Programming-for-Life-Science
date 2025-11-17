document.addEventListener('DOMContentLoaded', () => {
  const split = document.getElementById('split');
  const leftPanel = document.getElementById('leftPanel');
  const rightPanel = document.getElementById('rightPanel');
  const gutter = document.getElementById('gutter');
  const swapToggle = document.getElementById('swapToggle');
  if (!split || !leftPanel || !rightPanel || !gutter || !swapToggle) return;

  // helper to read CSS vars
  const getVars = () => {
    const cs = getComputedStyle(document.documentElement);
    return {
      minLeft: parseInt(cs.getPropertyValue('--min-left')) || 220,
      minRight: parseInt(cs.getPropertyValue('--min-right')) || 200,
      gutterW: parseInt(cs.getPropertyValue('--gutter-w')) || 12
    };
  };

  // initialize swap state from checkbox
  const applySwapClass = (checked) => {
    split.classList.toggle('swap', checked);
  };
  applySwapClass(swapToggle.checked);

  // Swap handler: toggle class and swap explicit flex bases so sizes remain visually the same
  swapToggle.addEventListener('change', () => {
    const leftRect = leftPanel.getBoundingClientRect();
    const rightRect = rightPanel.getBoundingClientRect();

    // set explicit flex-basis so sizes are preserved after reordering
    leftPanel.style.flex = `0 0 ${leftRect.width}px`;
    rightPanel.style.flex = `0 0 ${rightRect.width}px`;

    // toggle the visual order
    applySwapClass(swapToggle.checked);

    // after swapping, swap the flex values so the panels keep their sizes in the new positions
    const leftFlex = leftPanel.style.flex;
    const rightFlex = rightPanel.style.flex;
    leftPanel.style.flex = rightFlex;
    rightPanel.style.flex = leftFlex;
  });

  // Drag / touch resizing
  let dragging = false;
  let startX = 0;
  let startLeftWidth = 0;

  const startDrag = (clientX) => {
    dragging = true;
    startX = clientX;
    startLeftWidth = leftPanel.getBoundingClientRect().width;
    document.body.style.userSelect = 'none';
  };

  const moveDrag = (clientX) => {
    if (!dragging) return;
    const dx = clientX - startX;
    const effectiveDx = split.classList.contains('swap') ? -dx : dx;
    const vars = getVars();
    const containerW = split.getBoundingClientRect().width;
    let newLeft = startLeftWidth + effectiveDx;
    const maxLeft = containerW - vars.minRight - vars.gutterW;
    newLeft = Math.max(vars.minLeft, Math.min(maxLeft, newLeft));
    leftPanel.style.flex = `0 0 ${newLeft}px`;
    rightPanel.style.flex = `0 0 ${containerW - newLeft - vars.gutterW}px`;
  };

  // mouse
  gutter.addEventListener('mousedown', (e) => startDrag(e.clientX));
  window.addEventListener('mousemove', (e) => moveDrag(e.clientX));
  window.addEventListener('mouseup', () => { dragging = false; document.body.style.userSelect = ''; });

  // touch
  gutter.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches[0]) startDrag(e.touches[0].clientX);
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches[0]) moveDrag(e.touches[0].clientX);
  }, { passive: true });
  window.addEventListener('touchend', () => { dragging = false; document.body.style.userSelect = ''; });
});