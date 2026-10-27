import {lampsAreOn} from "../environment/sunset.js";

// The two transparent images match the castle master's natural dimensions.
// gate.js positions their shared layer; this controller sets night visibility.
export function mountGateLamps(artwork,environment,castleImage,sunSchedule) {
  const events=new AbortController();
  let state,running=false;
  const aura=artwork.parentElement?.querySelector("#gate-aura");
  const windowImage=artwork.querySelector(".window-lights");
  const lampImage=artwork.querySelector(".lamp-glow");
  const controls=artwork.querySelector(".lantern-controls");
  const reducedMotion=matchMedia("(prefers-reduced-motion: reduce)");
  function buildLanternControls() {
    if (!lampImage?.naturalWidth || controls.childElementCount) return;
    const canvas=document.createElement("canvas");
    canvas.width=lampImage.naturalWidth; canvas.height=lampImage.naturalHeight;
    const context=canvas.getContext("2d",{willReadFrequently:true});
    if (!context) return;
    context.drawImage(lampImage,0,0);
    const {data,width,height}=context.getImageData(0,0,canvas.width,canvas.height);
    const visited=new Uint8Array(width*height), components=[];
    for (let y=0;y<height;y++) for (let x=0;x<width;x++) {
      const start=y*width+x;
      if (visited[start] || data[start*4+3]<32) continue;
      let queue=[start], head=0, minX=x,maxX=x,minY=y,maxY=y;
      visited[start]=1;
      while(head<queue.length) {
        const p=queue[head++], px=p%width, py=Math.floor(p/width);
        minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py);
        for(const n of [p-1,p+1,p-width,p+width]) {
          if(n<0||n>=width*height||visited[n]||data[n*4+3]<32) continue;
          const nx=n%width,ny=Math.floor(n/width);
          if(Math.abs(nx-px)>1||Math.abs(ny-py)>1) continue;
          visited[n]=1;queue.push(n);
        }
      }
      if(queue.length>4) components.push({minX,maxX,minY,maxY});
    }
    components.sort((a,b)=>a.minX-b.minX);
    components.forEach(({minX,maxX,minY,maxY},index) => {
      const x=(minX+maxX+1)/2/width*100, y=(minY+maxY+1)/2/height*100;
      const w=(maxX-minX+1)/width*100, h=(maxY-minY+1)/height*100;
    const button=document.createElement("button");
    button.type="button";
    button.className="lantern-hotspot";
    button.setAttribute("aria-label",`Light castle lantern ${index+1}`);
    button.style.setProperty("--x",`${x}%`);
    button.style.setProperty("--y",`${y}%`);
    button.style.setProperty("--w",`${w}%`);
    button.style.setProperty("--h",`${h}%`);
    button.style.setProperty("--delay",`${(index*-.93)%7}s`);
    button.addEventListener("click",() => {
      if (reducedMotion.matches) return;
      button.classList.remove("is-flashing");
      void button.offsetWidth;
      button.classList.add("is-flashing");
      button.addEventListener("animationend",() => button.classList.remove("is-flashing"),{once:true,signal:events.signal});
    },{signal:events.signal});
    controls.append(button);
    });
  }
  lampImage?.addEventListener("load",buildLanternControls,{signal:events.signal});
  buildLanternControls();
  let prepared=false;

  function prepareWindowGlass() {
    if (prepared) {windowImage.style.visibility="visible";return;}
    if (!castleImage.naturalWidth || !windowImage.naturalWidth) return;
    if (castleImage.naturalWidth!==windowImage.naturalWidth || castleImage.naturalHeight!==windowImage.naturalHeight) return;
    const canvas=document.createElement("canvas");
    canvas.width=castleImage.naturalWidth;
    canvas.height=castleImage.naturalHeight;
    const context=canvas.getContext("2d",{willReadFrequently:true});
    if (!context) return;
    context.drawImage(castleImage,0,0);
    const castle=context.getImageData(0,0,canvas.width,canvas.height).data;
    context.clearRect(0,0,canvas.width,canvas.height);
    context.drawImage(windowImage,0,0);
    const light=context.getImageData(0,0,canvas.width,canvas.height).data;
    const glazing=context.createImageData(canvas.width,canvas.height);
    // The supplied light PNG covers whole arches, including stone tracery.
    // Colored glass has more green or blue than red in the master; warm stone does not.
    for (let i=0;i<light.length;i+=4) {
      if (!light[i+3]) continue;
      const contrast=(Math.max(castle[i+1],castle[i+2])-castle[i]+8)/26;
      const t=Math.max(0,Math.min(1,contrast));
      const strength=t*t*(3-2*t);
      const texture=.72+.28*(castle[i]+castle[i+1]+castle[i+2])/765;
      glazing.data[i]=light[i];
      glazing.data[i+1]=light[i+1];
      glazing.data[i+2]=light[i+2];
      glazing.data[i+3]=Math.min(255,Math.round(light[i+3]*4.2*strength*texture));
    }
    context.putImageData(glazing,0,0);
    prepared=true;
    windowImage.src=canvas.toDataURL("image/png");
  }

  castleImage.addEventListener("load",prepareWindowGlass,{signal:events.signal});
  windowImage.addEventListener("load",prepareWindowGlass,{signal:events.signal});
  prepareWindowGlass();

  function update() {
    if (!state) return;
    const {sunset,sunrise}=sunSchedule.get();
    const lit=running && !document.hidden && lampsAreOn(state.hour,sunset,sunrise);
    artwork.style.opacity=lit ? "1" : "0";
    artwork.dataset.lit=String(lit);
    if (aura) aura.style.setProperty("--gate-darkness",lit ? "1" : "0");
    if (lampImage) lampImage.hidden=false;
  }

  const unsubscribe=environment.subscribe(value => {state=value;update();});
  const unsubscribeSun=sunSchedule.subscribe(update);
  document.addEventListener("visibilitychange",update,{signal:events.signal});

  return {
    start() {running=true;update();},
    stop() {running=false;update();},
    dispose() {running=false;update();unsubscribe();unsubscribeSun();events.abort();},
  };
}
