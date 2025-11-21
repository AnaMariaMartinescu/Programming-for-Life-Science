document.addEventListener('DOMContentLoaded', () => {
  const split = document.getElementById('split');
  const leftPanel = document.getElementById('leftPanel');
  const rightPanel = document.getElementById('rightPanel');
  const gutter = document.getElementById('gutter');
  const swapToggle = document.getElementById('swapToggle'); // optional

  // stop if essential nodes are missing
  if (!split || !leftPanel || !rightPanel || !gutter) return;

  const getVars = () => {
    const cs = getComputedStyle(document.documentElement);
    return {
      minLeft: parseInt(cs.getPropertyValue('--min-left')) || 220,
      minRight: parseInt(cs.getPropertyValue('--min-right')) || 200,
      gutterW: parseInt(cs.getPropertyValue('--gutter-w')) || 12
    };
  };

  const getMaxLeft = () => Math.floor(window.innerWidth * 0.8);

  const applySwapClass = (checked) => split.classList.toggle('swap', checked);
  if (swapToggle) {
    applySwapClass(swapToggle.checked);
    swapToggle.addEventListener('change', () => {
      applySwapClass(swapToggle.checked);
    });
  }

  let dragging = false;
  let startX = 0;
  let startLeftWidth = 0;
  let activePointerId = null;

  const startDrag = (clientX) => {
    dragging = true;
    startX = clientX;
    startLeftWidth = leftPanel.getBoundingClientRect().width;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
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

  gutter.addEventListener('pointerdown', (e) => {
    if (e.button && e.button !== 0) return;
    activePointerId = e.pointerId;
    try { gutter.setPointerCapture(activePointerId); } catch (_) {}
    startDrag(e.clientX);
  });

  gutter.addEventListener('pointermove', (e) => {
    if (e.pointerId !== activePointerId) return;
    moveDrag(e.clientX);
  });

  const endPointer = (e) => {
    if (e.pointerId && activePointerId && e.pointerId !== activePointerId) return;
    dragging = false;
    activePointerId = null;
    try { if (e.pointerId) gutter.releasePointerCapture(e.pointerId); } catch (_) {}
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  };

  gutter.addEventListener('pointerup', endPointer);
  gutter.addEventListener('pointercancel', endPointer);
  window.addEventListener('pointerup', endPointer);
  window.addEventListener('pointercancel', endPointer);
  window.addEventListener('pointermove', (e) => {
    if (!activePointerId) return;
    moveDrag(e.clientX);
  });

  gutter.addEventListener('dblclick', () => {
    leftPanel.style.flex = '';
    leftPanel.style.width = '';
    rightPanel.style.flex = '';
    rightPanel.style.width = '';
  });

  window.addEventListener('resize', () => {
    const cur = leftPanel.getBoundingClientRect().width;
    const max = getMaxLeft();
    if (cur > max) {
      leftPanel.style.flex = `0 0 ${max}px`;
      leftPanel.style.width = `${max}px`;
    }
  });
});