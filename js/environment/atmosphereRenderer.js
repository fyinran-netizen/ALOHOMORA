// Broad atmospheric cloud fields with overlapping, irregular masses.
const clamp = value => Math.max(0,Math.min(1,value));
const rgba = (color,alpha) => `rgba(${color.join(",")},${alpha})`;
const mix = (a,b,t) => a+(b-a)*t;
const mixColor = (a,b,t) => a.map((value,index) => Math.round(mix(value,b[index],t)));
const smooth = value => {const t=clamp(value); return t*t*(3-2*t);};

function targetFrom(state) {
  const hour=state.hour;
  const dawn=smooth(1-Math.abs(hour-6.5)/2.5);
  const dusk=smooth(1-Math.abs(hour-18)/3);
  const clear=state.weather==="clear";
  return {coverage:state.visual.cloudCoverage,storm:state.visual.cloud,tone:clear ? 0 : 1,
    dawn:clear ? dawn : 0,dusk:clear ? dusk : 0,
    layout:{clear:0,overcast:1,rain:2,snow:3}[state.weather] ?? 0};
}

function softEllipse(ctx,x,y,rx,ry,color,alpha) {
  if (alpha<=0) return;
  ctx.save();
  ctx.translate(x,y);
  ctx.scale(rx,ry);
  const gradient=ctx.createRadialGradient(0,-.13,0,0,0,1);
  gradient.addColorStop(0,rgba(color,alpha));
  gradient.addColorStop(.48,rgba(color,alpha*.7));
  gradient.addColorStop(1,rgba(color,0));
  ctx.fillStyle=gradient;
  ctx.beginPath();
  ctx.arc(0,0,1,0,Math.PI*2);
  ctx.fill();
  ctx.restore();
}

export function createAtmosphereRenderer(skyCanvas,environment) {
  const sky=skyCanvas.getContext("2d",{alpha:true});
  const reducedMotion=matchMedia("(prefers-reduced-motion: reduce)");
  const events=new AbortController();
  let state,display,width=0,height=0,ratio=1,elapsed=0,lastFrame=0,frameId=null,running=false;

  function resize() {
    const bounds=skyCanvas.getBoundingClientRect();
    width=bounds.width;
    height=bounds.height;
    ratio=Math.min(devicePixelRatio||1,1.5,Math.sqrt(1200000/Math.max(1,width*height)));
    skyCanvas.width=Math.max(1,Math.round(width*ratio));
    skyCanvas.height=Math.max(1,Math.round(height*ratio));
    sky?.setTransform(ratio,0,0,ratio,0,0);
    render();
  }

  function render() {
    if (!sky || !width || !height) return;
    sky.clearRect(0,0,width,height);
    if (!display) return;
    const {storm,coverage,tone,dawn,dusk,layout}=display;
    const field=smooth((coverage-.22)/.65);
    if (field<.01) return;
    const shadow=mixColor(mixColor([112,122,132],[101,79,116],dusk),[49,61,76],tone);
    const body=mixColor(mixColor([217,213,197],[206,140,157],dusk),[105,120,134],tone);
    const rim=mixColor(mixColor([255,216,151],[255,187,136],dusk),[176,190,201],tone);

    // The low sun colors the gaps and edges, while clear noon has no wash.
    if (Math.max(dawn,dusk)>.001) {
      const glow=sky.createRadialGradient(width*.77,height*.27,0,width*.77,height*.27,width*.7);
      const glowColor=mixColor([255,194,109],[255,148,132],dusk);
      glow.addColorStop(0,rgba(glowColor,Math.max(dawn,dusk)*field*(.19+.035*Math.sin(elapsed*.24))));
      glow.addColorStop(1,rgba(glowColor,0));
      sky.fillStyle=glow;
      sky.fillRect(0,0,width,height*.65);
    }

    // Interleaved masses occupy overlapping heights, instead of four rows.
    // Layout morphs between weather types and each mass moves independently.
    for (let band=0;band<4;band++) {
      const drift=reducedMotion.matches ? 0 : elapsed*[2.1,3.2,4.3,2.7][band];
      for (let i=0;i<14;i++) {
        const variation=Math.sin(i*2.43+band*3.1+layout*.37);
        const x=((i/7*width+drift+variation*width*.075)%(width*2)+width*2)%(width*2)-width*.5;
        if (x< -width*.4 || x>width*1.4) continue;
        const threshold=.22+((i*7+band*3)%9)*.022;
        const presence=smooth((coverage-threshold)/.28);
        const density=field*presence*(band===3 ? .7 : 1);
        if (density<.01) continue;
        const altitude=.015+band*.055+(.5+.5*Math.sin(i*2.73+band*4.19+layout*.83))*.18;
        const y=height*(altitude+Math.sin(i*1.67+band*1.8+elapsed*.075)*.016);
        const growth=.72+.28*presence;
        const rx=width*(.18+Math.sin(i*3.7+band)**2*.1)*growth;
        const ry=height*(.045+.025*Math.sin(i*2.2+band+elapsed*.045)**2)*growth;
        const light=.88+.12*Math.sin(elapsed*.22+i*1.9+band);
        const sunward=.7+.3*clamp(1-Math.abs(x-width*.76)/(width*.85));
        softEllipse(sky,x,y+ry*.36,rx*1.04,ry*1.17,shadow,density*(.21+storm*.24));
        softEllipse(sky,x,y,rx,ry,body,density*(.4+storm*.1));
        softEllipse(sky,x-rx*.12,y-ry*.38,rx*.75,ry*.62,rim,density*(.13+Math.max(dawn,dusk)*.28*light*sunward));
      }
    }

  }

  function schedule() {
    if (!running || document.hidden || frameId!==null || !width || !height) return;
    frameId=requestAnimationFrame(draw);
  }
  function draw(time) {
    frameId=null;
    if (lastFrame && time-lastFrame<50) { schedule(); return; }
    const dt=lastFrame ? Math.min((time-lastFrame)/1000,.1) : 0;
    elapsed+=dt;
    lastFrame=time;
    if (state && display) {
      const target=targetFrom(state);
      const amount=reducedMotion.matches ? 1 : 1-Math.exp(-dt/1.5);
      for (const key of ["coverage","storm","tone","dawn","dusk","layout"]) display[key]=mix(display[key],target[key],amount);
    }
    render();
    const target=state && targetFrom(state);
    const changing=target && Object.keys(target).some(key => Math.abs(target[key]-display[key])>.002);
    if (!reducedMotion.matches && (display?.coverage>.3 || changing)) schedule();
  }
  function cancel() {
    if (frameId!==null) cancelAnimationFrame(frameId);
    frameId=null;
    lastFrame=0;
  }
  const observer=new ResizeObserver(resize);
  observer.observe(skyCanvas);
  resize();
  const unsubscribe=environment.subscribe(next => {
    state=next;
    if (!display || reducedMotion.matches) display=targetFrom(next);
    render(); schedule();
  });
  document.addEventListener("visibilitychange",() => {
    if (document.hidden) cancel(); else schedule();
  },{signal:events.signal});
  reducedMotion.addEventListener("change",() => {
    if (reducedMotion.matches) {cancel(); if (state) display=targetFrom(state); render();} else schedule();
  },{signal:events.signal});
  return {
    start() {running=true; render(); schedule();},
    stop() {running=false; cancel();},
    dispose() {
      running=false; cancel(); unsubscribe(); observer.disconnect(); events.abort();
      sky?.clearRect(0,0,width,height);
    },
  };
}
