// A scene-independent Canvas overlay. Coordinates and velocities use CSS pixels,
// not device pixels; depth changes size, opacity, drift and fall speed together.
export function createWeatherRenderer(canvas, environment) {
  const context = canvas.getContext("2d", {alpha:true});
  if (!context) return {start() {}, stop() {}, dispose() {}};
  const particles = [];
  const events = new AbortController();
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let state, width = 0, height = 0, frameId = null, lastTime = 0;
  let running = false, elapsed = 0;

  function makeParticle() {
    const depth = [.3,.6,1][Math.floor(Math.random()*3)];
    return {x:Math.random()*width, y:Math.random()*height, depth,
      variation:.75+Math.random()*.5, phase:Math.random()*Math.PI*2,
      snowSize:.7+Math.random()*.65,
      snowOpacity:.55+Math.random()*.45,
      snowSpeed:.65+Math.random()*.7};
  }
  function syncDensity() {
    const raining = state.weather === "rain";
    const active = raining || state.weather === "snow";
    const density = raining ? .00048 : .00022;
    // Linear intensity response, with an absolute cap on very large displays.
    const count = active ? Math.round(Math.min(1000,width*height*density)*state.intensity) : 0;
    particles.length = Math.min(particles.length,count);
    while (particles.length < count) particles.push(makeParticle());
    canvas.dataset.particleCount = String(count);
  }
  function resize() {
    const bounds = canvas.getBoundingClientRect();
    const oldWidth = width, oldHeight = height;
    width = bounds.width; height = bounds.height;
    const ratio = Math.min(devicePixelRatio || 1,2,Math.sqrt(4000000/Math.max(1,width*height)));
    canvas.width = Math.max(1,Math.round(width*ratio));
    canvas.height = Math.max(1,Math.round(height*ratio));
    context.setTransform(ratio,0,0,ratio,0,0);
    for (const p of particles) {
      p.x *= width/Math.max(1,oldWidth);
      p.y *= height/Math.max(1,oldHeight);
    }
    if (state) { syncDensity(); schedule(); }
  }
  function cancel() {
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null; lastTime = 0;
  }
  function schedule() {
    if (running && !document.hidden && width && height && particles.length && frameId === null) {
      frameId = requestAnimationFrame(draw);
    }
  }
  function draw(time) {
    frameId = null;
    const dt = lastTime ? Math.min((time-lastTime)/1000,.05) : 1/60;
    lastTime = time;
    elapsed += dt;
    context.clearRect(0,0,width,height);
    const rain = state.weather === "rain";
    const motionScale = motion.matches ? .4 : 1;
    for (const p of particles) {
      const speed = (rain ? (460+680*p.depth)*p.variation
        : (18+48*p.depth)*p.snowSpeed)*state.speed*motionScale;
      const drift = rain ? 0 : Math.sin(elapsed*.7+p.phase)*16*p.depth;
      const vx = state.wind*(rain ? 240 : 70)*(.35+p.depth)*state.speed*motionScale+drift;
      p.x += vx*dt; p.y += speed*dt;
      // Wrap both axes independently, so wind never empties one side.
      if (p.y > height+20) p.y = -20;
      if (p.x > width+20) p.x = -20;
      if (p.x < -20) p.x = width+20;
      context.globalAlpha = rain ? .09+.19*p.depth : (.25+.6*p.depth)*p.snowOpacity;
      if (rain) {
        const length = (8+17*p.depth)*state.speed;
        context.strokeStyle = "#c8dfef";
        context.lineWidth = .45+.65*p.depth;
        context.beginPath();
        context.moveTo(p.x,p.y);
        context.lineTo(p.x-vx/speed*length,p.y-length);
        context.stroke();
      } else {
        context.fillStyle = "#edf5ff";
        context.beginPath();
        // Keep distant flakes tiny; the nearest layer has a 3–6 px radius.
        const radius = (.65+3.8*p.depth*p.depth)*p.snowSize;
        const core = p.depth > .6 ? radius*.36 : radius*.7;
        context.arc(p.x,p.y,core,0,Math.PI*2);
        context.fill();
        if (p.depth > .6) {
          context.strokeStyle = "#edf5ff";
          context.lineWidth = Math.max(.4,radius*.16);
          for (let arm=0;arm<3;arm++) {
            const angle=p.phase+arm*Math.PI/3;
            const vx=Math.cos(angle)*radius, vy=Math.sin(angle)*radius;
            context.beginPath();
            context.moveTo(p.x-vx,p.y-vy);
            context.lineTo(p.x+vx,p.y+vy);
            context.stroke();
          }
        }
      }
    }
    context.globalAlpha = 1;
    schedule();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  const unsubscribe = environment.subscribe(next => {
    const changed = state?.weather !== next.weather;
    state = next;
    if (changed) particles.length = 0;
    syncDensity();
    if (!particles.length || changed) {
      cancel();
      context.clearRect(0,0,width,height);
    }
    schedule();
  });
  document.addEventListener("visibilitychange",() => {
    if (document.hidden) cancel();
    else schedule();
  },{signal:events.signal});
  return {
    start() { running = true; schedule(); },
    stop() { running = false; cancel(); },
    dispose() {
      running = false; cancel(); unsubscribe(); observer.disconnect(); events.abort();
      context.clearRect(0,0,width,height);
      particles.length = 0;
    },
  };
}
