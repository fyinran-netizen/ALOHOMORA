// Sky bodies sit behind the atmospheric clouds and the castle.
const clamp = value => Math.max(0,Math.min(1,value));
const smooth = value => {const t=clamp(value);return t*t*(3-2*t);};

export function deriveCelestial(state) {
  const hour=((state.hour%24)+24)%24;
  const night=hour<6 ? 6-hour : hour>19 ? hour-19 : 0;
  const moonlight=smooth(night/1.5);
  const cover=state.visual.cloudCoverage;
  const weather=state.visual.cloud;
  return {
    sun:{...state.visual.sun,visibility:state.visual.sun.intensity*(1-.65*cover)},
    // The castle fills the right side of the landscape view; keep the moon
    // in the open western sky with only a small, slow drift.
    moon:{x:.1+.015*Math.sin((hour-2)*Math.PI/12),y:.205+.012*Math.cos((hour-2)*Math.PI/12),
      visibility:moonlight*(1-.78*weather)*(1-.32*cover)},
  };
}

export function createCelestialRenderer(canvas,environment) {
  const context=canvas.getContext("2d",{alpha:true});
  if (!context) return {start() {},stop() {},dispose() {}};
  const events=new AbortController();
  let width=0,height=0,ratio=1,state,frameId=null,running=false;
  function cancel() {if (frameId!==null) cancelAnimationFrame(frameId);frameId=null;}
  function schedule() {if (running && !document.hidden && frameId===null) frameId=requestAnimationFrame(render);}
  function glow(x,y,r,color,alpha) {
    const gradient=context.createRadialGradient(x,y,0,x,y,r);
    gradient.addColorStop(0,`rgba(${color},${alpha})`);
    gradient.addColorStop(.32,`rgba(${color},${alpha*.34})`);
    gradient.addColorStop(1,`rgba(${color},0)`);
    context.fillStyle=gradient;
    context.fillRect(x-r,y-r,r*2,r*2);
  }
  function render() {
    frameId=null;
    context.clearRect(0,0,width,height);
    if (!state || !width || !height) return;
    const {sun,moon}=deriveCelestial(state);
    const size=Math.min(width,height);
    if (sun.visibility>.001) {
      const x=sun.source.x*width,y=sun.source.y*height;
      const warm=sun.color.map(Math.round).join(",");
      glow(x,y,size*.43,warm,.24*sun.visibility);
      glow(x,y,size*.12,"255,250,229",.16*sun.visibility);
    }
    if (moon.visibility<.001) return;
    const x=moon.x*width,y=moon.y*height;
    const radius=Math.max(8,Math.min(31,size*.037));
    glow(x,y,radius*5,"182,205,227",.2*moon.visibility);
    const disc=context.createRadialGradient(x-radius*.28,y-radius*.3,0,x,y,radius);
    disc.addColorStop(0,`rgba(241,245,239,${.9*moon.visibility})`);
    disc.addColorStop(.72,`rgba(213,226,231,${.82*moon.visibility})`);
    disc.addColorStop(1,"rgba(194,211,226,0)");
    context.fillStyle=disc;
    context.beginPath();context.arc(x,y,radius,0,Math.PI*2);context.fill();
    context.save();context.beginPath();context.arc(x,y,radius*.83,0,Math.PI*2);context.clip();
    // Broad, uneven maria read at a distance; tiny crater marks add texture
    // without turning the moon into a high-contrast illustrated icon.
    for (const [dx,dy,rx,ry,alpha] of [
      [-.29,-.2,.29,.2,.26],[.22,-.29,.2,.12,.2],[.33,.17,.26,.22,.25],
      [-.08,.31,.24,.14,.19],[-.42,.18,.1,.14,.15],
    ]) {
      const cx=x+dx*radius,cy=y+dy*radius;
      context.save();context.translate(cx,cy);context.scale(rx*radius,ry*radius);
      const patch=context.createRadialGradient(0,0,0,0,0,1);
      patch.addColorStop(0,`rgba(92,118,139,${alpha*moon.visibility})`);
      patch.addColorStop(1,"rgba(92,118,139,0)");
      context.fillStyle=patch;context.beginPath();context.arc(0,0,1,0,Math.PI*2);context.fill();context.restore();
    }
    context.strokeStyle=`rgba(98,125,145,${.25*moon.visibility})`;
    context.lineWidth=Math.max(.65,radius*.055);
    for (const [dx,dy,scale] of [[-.38,.03,.13],[.08,-.42,.1],[.18,.34,.12]]) {
      context.beginPath();context.arc(x+dx*radius,y+dy*radius,radius*scale,0,Math.PI*1.7);context.stroke();
    }
    context.restore();
  }
  function resize() {
    const bounds=canvas.getBoundingClientRect();width=bounds.width;height=bounds.height;
    ratio=Math.min(devicePixelRatio||1,1.5,Math.sqrt(800000/Math.max(1,width*height)));
    canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(height*ratio));
    context.setTransform(ratio,0,0,ratio,0,0);schedule();
  }
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  const unsubscribe=environment.subscribe(next => {state=next;schedule();});
  document.addEventListener("visibilitychange",() => {if (document.hidden) cancel();else schedule();},{signal:events.signal});
  return {start() {running=true;schedule();},stop() {running=false;cancel();},dispose() {
    running=false;cancel();unsubscribe();observer.disconnect();events.abort();context.clearRect(0,0,width,height);
  }};
}
