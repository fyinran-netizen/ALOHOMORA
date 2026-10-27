const clamp = value => Math.max(0,Math.min(1,value));
const smooth = value => { const t=clamp(value); return t*t*(3-2*t); };

// An art-directed solar arc in local clock time, not a geographic ephemeris.
// The separate night arc makes elevation continuous through midnight.
export function deriveSunlight(state) {
  const hour=((state.hour%24)+24)%24;
  const progress=clamp((hour-6)/13);
  const phase=hour<6 ? Math.PI+(hour+5)/11*Math.PI
    : hour>19 ? Math.PI+(hour-19)/11*Math.PI : progress*Math.PI;
  const elevation=Math.sin(phase);
  const height=Math.max(0,elevation);
  const daylight=hour>6 && hour<19 ? smooth(height/.18)*(.4+.6*height) : 0;
  const cloud=state.weather==="clear" ? 0 : clamp(state.intensity);
  const attenuation={clear:0,overcast:.7,rain:.9,snow:.84}[state.weather];
  const beamPower={clear:1,overcast:2,rain:3,snow:2.6}[state.weather];
  const gain=state.lightMode==="manual" ? Math.max(0,Math.min(1.2,state.brightness)) : 1;
  const warmth=(1-height)**2;
  const color=[255,248-58*warmth,233-123*warmth];
  // This camera faces the castle, so the sun stays near the open edge of the
  // frame or beyond it instead of traversing the whole picture like an icon.
  const source={x:-.13+.3*progress,y:.44-.7*height};
  const dx=.5-source.x,dy=.9-source.y;
  const length=Math.hypot(dx,dy);
  return {
    elevation:elevation*65,
    azimuth:hour<6 ? (270+(hour+5)/11*180)%360
      : hour>19 ? (270+(hour-19)/11*180)%360 : 90+180*progress,
    source,
    direction:{x:dx/length,y:dy/length},
    color,
    intensity:daylight*(1-attenuation*cloud)*gain,
    beamIntensity:daylight*(1-cloud)**beamPower*gain,
    softness:cloud,
  };
}

// Atmosphere only: bounded screen blending, no architectural relighting.
// Optional drawOcclusionMask(ctx,{width,height,sun}) can later remove light
// using a scene's exact mask. No mask or source-image processing is done here.
export function createSunlightRenderer(canvas,environment,{drawOcclusionMask}={}) {
  const context=canvas.getContext("2d",{alpha:true});
  if (!context) return {start() {},stop() {},dispose() {}};
  const events=new AbortController();
  let width=0,height=0,ratio=1,sun,frameId=null,running=false;

  function cancel() {
    if (frameId!==null) cancelAnimationFrame(frameId);
    frameId=null;
  }
  function schedule() {
    if (running && !document.hidden && frameId===null) frameId=requestAnimationFrame(draw);
  }
  function draw() {
    frameId=null;
    context.clearRect(0,0,width,height);
    if (!sun || !width || !height || sun.intensity<=0) return;
    const [r,g,b]=sun.color.map(Math.round);
    const tint=alpha => `rgba(${r},${g},${b},${alpha})`;
    const sx=sun.source.x*width,sy=sun.source.y*height;
    const radius=Math.max(Math.min(width,height)*.7,width*.32);
    context.save();
    // No bright solar disc. A low-opacity, local halo softens the entry point.
    const halo=context.createRadialGradient(sx,sy,0,sx,sy,radius);
    halo.addColorStop(0,tint(.19*sun.intensity));
    halo.addColorStop(.22,tint(.10*sun.intensity));
    halo.addColorStop(.65,tint(.025*sun.intensity));
    halo.addColorStop(1,tint(0));
    context.fillStyle=halo;
    context.fillRect(0,0,width,height);

    const dx=sun.direction.x*width,dy=sun.direction.y*height;
    const angle=Math.atan2(dy,dx)-Math.PI/2;
    const length=Math.hypot(width,height)*1.45;
    // Fixed uneven spacing avoids flicker or random changes while scrubbing.
    const beams=[[-.19,.055,.72],[-.075,.026,1],[.045,.043,.84],[.18,.065,.55]];
    context.translate(sx,sy);
    for (const [offset,spread,power] of beams) {
      context.save();
      context.rotate(angle+offset);
      context.filter=`blur(${24+sun.softness*22}px)`;
      const alpha=.105*sun.beamIntensity*power;
      const beam=context.createLinearGradient(0,0,0,length);
      beam.addColorStop(0,tint(0));
      beam.addColorStop(.16,tint(alpha));
      beam.addColorStop(.4,tint(alpha*.5));
      beam.addColorStop(.8,tint(alpha*.12));
      beam.addColorStop(1,tint(0));
      context.fillStyle=beam;
      context.beginPath();
      context.moveTo(-3,0);
      context.lineTo(3,0);
      context.lineTo(length*spread,length);
      context.lineTo(-length*spread,length);
      context.closePath();
      context.fill();
      context.restore();
    }
    context.restore();
    if (drawOcclusionMask) {
      context.save();
      context.globalCompositeOperation="destination-out";
      drawOcclusionMask(context,{width,height,sun});
      context.restore();
    }
  }
  function resize() {
    const bounds=canvas.getBoundingClientRect();
    width=bounds.width; height=bounds.height;
    // Soft light needs no retina resolution or full-resolution blur buffers.
    ratio=Math.min(1,Math.sqrt(750000/Math.max(1,width*height)));
    canvas.width=Math.max(1,Math.round(width*ratio));
    canvas.height=Math.max(1,Math.round(height*ratio));
    context.setTransform(ratio,0,0,ratio,0,0);
    schedule();
  }
  const observer=new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  const unsubscribe=environment.subscribe(state => {
    sun=state.visual.sun;
    canvas.dataset.elevation=sun.elevation.toFixed(2);
    canvas.dataset.azimuth=sun.azimuth.toFixed(2);
    canvas.dataset.intensity=sun.intensity.toFixed(4);
    canvas.dataset.beamIntensity=sun.beamIntensity.toFixed(4);
    schedule();
  });
  document.addEventListener("visibilitychange",() => {
    if (document.hidden) cancel();
    else schedule();
  },{signal:events.signal});
  return {
    start() {running=true; schedule();},
    stop() {running=false; cancel();},
    dispose() {
      running=false; cancel(); unsubscribe(); observer.disconnect(); events.abort();
      context.clearRect(0,0,width,height);
    },
  };
}
