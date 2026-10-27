// Keeps the environment panel movable without coupling drag behavior to its controls.
export function mountDraggablePanel(panel) {
  const summary = panel.querySelector("summary");
  const events = new AbortController();
  let activePointer = null;
  let startX = 0;
  let startY = 0;
  let originX = 0;
  let originY = 0;
  let desiredX = 0;
  let desiredY = 0;
  let positioned = false;
  let dragging = false;
  let ignoreClick = false;
  let clearClickTimer;

  function place() {
    if (!positioned) return;
    const maxX = Math.max(0, document.documentElement.clientWidth-panel.offsetWidth);
    const maxY = Math.max(0, document.documentElement.clientHeight-panel.offsetHeight);
    panel.style.left = `${Math.max(0,Math.min(desiredX,maxX))}px`;
    panel.style.top = `${Math.max(0,Math.min(desiredY,maxY))}px`;
  }

  summary.addEventListener("pointerdown", event => {
    if (activePointer !== null || !event.isPrimary || event.button !== 0) return;
    const rect = panel.getBoundingClientRect();
    activePointer = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    originX = rect.left;
    originY = rect.top;
    dragging = false;
    summary.setPointerCapture(event.pointerId);
  }, {signal:events.signal});

  summary.addEventListener("pointermove", event => {
    if (event.pointerId !== activePointer) return;
    const dx = event.clientX-startX;
    const dy = event.clientY-startY;
    if (!dragging && Math.hypot(dx,dy) < 5) return;
    dragging = true;
    positioned = true;
    panel.dataset.dragging = "";
    desiredX = originX+dx;
    desiredY = originY+dy;
    place();
  }, {signal:events.signal});

  function finish(event) {
    if (event.pointerId !== activePointer) return;
    if (dragging) {
      desiredX = originX+event.clientX-startX;
      desiredY = originY+event.clientY-startY;
      place();
      ignoreClick = true;
      clearTimeout(clearClickTimer);
      clearClickTimer = setTimeout(() => { ignoreClick = false; }, 0);
    }
    delete panel.dataset.dragging;
    dragging = false;
    activePointer = null;
    if (summary.hasPointerCapture(event.pointerId)) summary.releasePointerCapture(event.pointerId);
  }
  summary.addEventListener("pointerup",finish,{signal:events.signal});
  summary.addEventListener("pointercancel",finish,{signal:events.signal});
  summary.addEventListener("click",event => {
    if (!ignoreClick || event.detail === 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    ignoreClick = false;
  }, {capture:true,signal:events.signal});
  panel.addEventListener("toggle",place,{signal:events.signal});
  window.addEventListener("resize",place,{signal:events.signal});

  return () => {
    clearTimeout(clearClickTimer);
    events.abort();
    if (activePointer !== null && summary.hasPointerCapture(activePointer)) summary.releasePointerCapture(activePointer);
    delete panel.dataset.dragging;
  };
}
