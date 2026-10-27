// Independent sky motion: layered clouds advect continuously, while each
// star has its own slow drift and twinkle. Nothing here depends on a scene.
function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value,1664525)+1013904223) >>> 0;
    return value/4294967296;
  };
}

function localDay() {
  const date = new Date();
  return date.getFullYear()*10000+(date.getMonth()+1)*100+date.getDate();
}

export function createSkyMotion(starCanvas,environment) {
  const context = starCanvas.getContext("2d",{alpha:true});
  const events = new AbortController();
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let width=0,height=0,ratio=1,stars=[],clouds=[],day=0,state;
  let running=false,frameId=null,lastFrame=0,elapsed=0;

  function renewStars() {
    const today=localDay();
    if (today===day) return;
    day=today;
    const random=seededRandom(today);
    stars=Array.from({length:96},(_,index) => ({
      x:index<11 ? .04+random()*.33 : random(),
      y:index<11 ? .18+random()*.24 : random()*.63,
      size:.7+random()*1.4,
      period:1.7+random()*4.8,
      phase:random()*Math.PI*2,
      drift:(random()-.5)*.000018,
      hue:random()*.3,
      rank:random(),
    }));
    clouds=Array.from({length:2},(_,index) => ({
      x:.12+index*.49+random()*.08,y:.055+random()*.095,
      size:.16+random()*.055,speed:.0017+random()*.0006,
      phase:random()*Math.PI*2,
      lobes:Array.from({length:7},(_,part) => ({x:(part-3)/3+(random()-.5)*.22,
        y:(random()-.5)*.9,size:.2+random()*.25,phase:random()*Math.PI*2})),
    }));
  }

  function resize() {
    const bounds=starCanvas.getBoundingClientRect();
    width=bounds.width; height=bounds.height;
    ratio=Math.min(devicePixelRatio||1,1.5,Math.sqrt(1200000/Math.max(1,width*height)));
    starCanvas.width=Math.max(1,Math.round(width*ratio));
    starCanvas.height=Math.max(1,Math.round(height*ratio));
    if (context) context.setTransform(ratio,0,0,ratio,0,0);
    schedule();
  }

  function drawCloudlets() {
    const coverage=state?.visual.cloudCoverage ?? .25;
    const presence=(1-(state?.visual.cloud||0))*Math.max(0,Math.min(1,(.7-coverage)*1.8));
    if (presence<.01) return;
    renewStars();
    const night=state?.visual.night||0;
    for (const cloud of clouds) {
      const span=width*cloud.size;
      const x=(((cloud.x+elapsed*cloud.speed)%1.45)+1.45)%1.45*width-width*.16;
      const y=cloud.y*height;
      const color=night>.5 ? [141,154,177] : [239,239,232];
      for (const lobe of cloud.lobes) {
        const lx=x+lobe.x*span*.46;
        const ly=y+lobe.y*span*.24+Math.sin(elapsed*.22+lobe.phase)*span*.05;
        const radius=span*lobe.size;
        const gradient=context.createRadialGradient(lx,ly,0,lx,ly,radius);
        gradient.addColorStop(0,`rgba(${color.join(",")},${presence*(night>.5?.16:.24)})`);
        gradient.addColorStop(.55,`rgba(${color.join(",")},${presence*.065})`);
        gradient.addColorStop(1,`rgba(${color.join(",")},0)`);
        context.save();
        context.translate(lx,ly);
        context.scale(1,.55);
        context.translate(-lx,-ly);
        context.fillStyle=gradient;
        context.beginPath();context.arc(lx,ly,radius,0,Math.PI*2);context.fill();
        context.restore();
      }
    }
  }

  function drawStars() {
    if (!context) return;
    context.clearRect(0,0,width,height);
    drawCloudlets();
    const depth=(state?.visual.night||0)**3;
    const visibility=depth*(1-(state?.visual.cloud||0)*.7);
    if (visibility<=0) return;
    renewStars();
    for (const star of stars) {
      if (star.rank>depth) continue;
      const x=((star.x+elapsed*star.drift)%1+1)%1*width;
      const y=star.y*height+Math.sin(elapsed*.11+star.phase)*1.5;
      const pulse=(1+Math.sin(elapsed*Math.PI*2/star.period+star.phase))/2;
      const alpha=visibility*(.08+.92*pulse*pulse);
      const radius=star.size*(.72+.28*pulse);
      context.globalAlpha=alpha;
      context.fillStyle=star.hue>.15 ? "#d9e8ff" : "#fff8e7";
      context.beginPath();
      context.moveTo(x,y-radius*1.7);
      context.lineTo(x+radius*.34,y-radius*.28);
      context.lineTo(x+radius*1.5,y);
      context.lineTo(x+radius*.34,y+radius*.28);
      context.lineTo(x,y+radius*1.7);
      context.lineTo(x-radius*.34,y+radius*.28);
      context.lineTo(x-radius*1.5,y);
      context.lineTo(x-radius*.34,y-radius*.28);
      context.closePath();
      context.fill();
    }
    context.globalAlpha=1;
  }

  function draw(time) {
    frameId=null;
    if (lastFrame && time-lastFrame<32) { schedule(); return; }
    const dt=lastFrame ? Math.min((time-lastFrame)/1000,.1) : 0;
    lastFrame=time;
    elapsed+=dt;
    drawStars();
    if (!reducedMotion.matches) schedule();
  }

  function cancel() {
    if (frameId!==null) cancelAnimationFrame(frameId);
    frameId=null; lastFrame=0;
  }
  function schedule() {
    if (!running || document.hidden || !width || !height || frameId!==null) return;
    frameId=requestAnimationFrame(draw);
  }
  const observer=new ResizeObserver(resize);
  observer.observe(starCanvas);
  resize();
  const unsubscribe=environment.subscribe(next => {state=next; schedule();});
  document.addEventListener("visibilitychange",() => {
    if (document.hidden) cancel(); else schedule();
  },{signal:events.signal});
  reducedMotion.addEventListener("change",() => {
    if (reducedMotion.matches) { cancel(); drawStars(); }
    else schedule();
  },{signal:events.signal});
  return {
    start() {running=true; schedule();},
    stop() {running=false; cancel();},
    dispose() {
      running=false; cancel(); unsubscribe(); observer.disconnect(); events.abort();
      if (context) context.clearRect(0,0,width,height);
    },
  };
}
