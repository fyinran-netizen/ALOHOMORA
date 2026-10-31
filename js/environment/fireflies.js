function seededRandom(seed) {
  let value=seed>>>0;
  return () => {value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};
}

export function createFireflyRenderer(canvas,environment) {
  const context=canvas.getContext("2d",{alpha:true});
  const events=new AbortController();
  const reducedMotion=matchMedia("(prefers-reduced-motion: reduce)");
  let width=0,height=0,ratio=1,state,flies=[],running=false,frameId=null,lastFrame=0,elapsed=0,wanderRandom;

  function populate() {
    const random=seededRandom(284921);
    wanderRandom=random;
    flies=Array.from({length:30},() => ({x:random(),y:.32+random()*.62,
      phase:random()*Math.PI*2,heading:random()*Math.PI*2,turnIn:.3+random()*2.8,
      speed:4+random()*7,radius:1.45+random()*.55,hue:random()<.52?48:116,twinkle:1.2+random()*2.6}));
  }
  function resize() {
    const bounds=canvas.getBoundingClientRect();width=bounds.width;height=bounds.height;
    ratio=Math.min(devicePixelRatio||1,1.5,Math.sqrt(1200000/Math.max(1,width*height)));
    canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(height*ratio));
    context?.setTransform(ratio,0,0,ratio,0,0);schedule();
  }
  function active() {return state?.weather==="clear"&&(state.visual.night||0)>.42;}
  function draw(time) {
    frameId=null;
    if(lastFrame&&time-lastFrame<32){schedule();return;}
    const dt=lastFrame?Math.min((time-lastFrame)/1000,.08):0;lastFrame=time;elapsed+=dt;
    context?.clearRect(0,0,width,height);
    if(!active()){lastFrame=0;return;}
    const night=Math.min(1,Math.max(0,((state.visual.night||0)-.42)/.58));
    for(const fly of flies){
      if(dt>0){
        fly.turnIn-=dt;
        if(fly.turnIn<=0){fly.heading+=(wanderRandom()-.5)*2.4;fly.turnIn=.35+wanderRandom()*2.5;}
        fly.x=(fly.x+Math.cos(fly.heading)*fly.speed*dt/Math.max(1,width)+1)%1;
        fly.y=Math.max(.28,Math.min(.97,fly.y+Math.sin(fly.heading)*fly.speed*dt/Math.max(1,height)));
      }
      const x=fly.x*width;
      const y=fly.y*height;
      const pulse=(.5+.5*Math.sin(elapsed*fly.twinkle+fly.phase))**2;
      const alpha=night*(.3+.62*pulse);
      const color=fly.hue===48?"#e1c991":"#bfce9a";
      context.globalAlpha=alpha;context.fillStyle=color;context.shadowColor=color;context.shadowBlur=2;
      context.beginPath();context.arc(x,y,1.9,0,Math.PI*2);context.fill();
      context.shadowBlur=0;
    }
    context.globalAlpha=1;
    if(!reducedMotion.matches)schedule();
  }
  function cancel(){if(frameId!==null)cancelAnimationFrame(frameId);frameId=null;lastFrame=0;}
  function schedule(){if(!running||document.hidden||!width||!height||frameId!==null)return;frameId=requestAnimationFrame(draw);}
  function sync(){if(active()){if(!flies.length)populate();schedule();}else{cancel();context?.clearRect(0,0,width,height);}}
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  const unsubscribe=environment.subscribe(next=>{state=next;sync();});
  document.addEventListener("visibilitychange",()=>{if(document.hidden)cancel();else sync();},{signal:events.signal});
  reducedMotion.addEventListener("change",()=>{if(reducedMotion.matches){cancel();draw(performance.now());}else schedule();});
  return {start(){running=true;sync();},stop(){running=false;cancel();},dispose(){running=false;cancel();unsubscribe();observer.disconnect();events.abort();context?.clearRect(0,0,width,height);}};
}
