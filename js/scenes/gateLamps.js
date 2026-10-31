import {lampsAreOn} from "../environment/sunset.js";

// The two transparent images match the castle master's natural dimensions.
// gate.js positions their shared layer; this controller sets night visibility.
export function mountGateLamps(artwork,environment,castleImage,sunSchedule) {
  const events=new AbortController();
  let state,running=false;
  const aura=artwork.parentElement?.querySelector("#gate-aura");
  const windowImage=artwork.querySelector(".window-lights");
  const lampImage=artwork.querySelector(".lamp-glow");
  let windowControls=artwork.querySelector(".window-controls");
  if (!windowControls) {windowControls=document.createElement("div");windowControls.className="window-controls";windowControls.setAttribute("aria-label","Castle windows");artwork.append(windowControls);}
  const controls=artwork.querySelector(".lantern-controls");
  const reducedMotion=matchMedia("(prefers-reduced-motion: reduce)");
  let windowMask;
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
  function buildWindowControls() {
    if (!windowImage?.naturalWidth) return;
    const canvas=document.createElement("canvas");
    canvas.width=windowImage.naturalWidth;canvas.height=windowImage.naturalHeight;
    const context=canvas.getContext("2d",{willReadFrequently:true});
    if (!context) return;
    context.drawImage(windowImage,0,0);
    windowMask={data:context.getImageData(0,0,canvas.width,canvas.height).data,width:canvas.width,height:canvas.height};
  }
  function flashWindow(event) {
    if(reducedMotion.matches||!windowMask)return;
    const bounds=windowControls.getBoundingClientRect();
    const x=Math.floor((event.clientX-bounds.left)/bounds.width*windowMask.width);
    const y=Math.floor((event.clientY-bounds.top)/bounds.height*windowMask.height);
    if(x<0||y<0||x>=windowMask.width||y>=windowMask.height)return;
    let minX,maxX,minY,maxY;
    const windowGroups=[
      {minX:.55,maxX:.70,minY:.46,maxY:.59}, // central pointed window
      {minX:.35,maxX:.425,minY:.53,maxY:.65}, // first left window group
      {minX:.425,maxX:.50,minY:.53,maxY:.65}, // second left window group
    ].map(group=>({minX:Math.round(windowMask.width*group.minX),maxX:Math.round(windowMask.width*group.maxX),minY:Math.round(windowMask.height*group.minY),maxY:Math.round(windowMask.height*group.maxY)}));
    const windowGroup=windowGroups.find(group=>x>=group.minX&&x<=group.maxX&&y>=group.minY&&y<=group.maxY);
    if(windowGroup){({minX,maxX,minY,maxY}=windowGroup);}
    else {
      const alphaAt=(px,py)=>windowMask.data[(py*windowMask.width+px)*4+3];
      let start=y*windowMask.width+x;
      if(alphaAt(x,y)<8){
        let nearby=-1;
        for(let radius=1;radius<=3&&nearby<0;radius++) for(let dy=-radius;dy<=radius&&nearby<0;dy++) for(let dx=-radius;dx<=radius;dx++) {
          const px=x+dx,py=y+dy;
          if(px>=0&&py>=0&&px<windowMask.width&&py<windowMask.height&&alphaAt(px,py)>=8){nearby=py*windowMask.width+px;break;}
        }
        if(nearby<0)return;
        start=nearby;
      }
      const queue=[start],visited=new Set(queue);let head=0;
      minX=maxX=start%windowMask.width;minY=maxY=Math.floor(start/windowMask.width);
      while(head<queue.length&&queue.length<12000){
        const p=queue[head++],px=p%windowMask.width,py=Math.floor(p/windowMask.width);
        minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py);
        for(const n of [p-1,p+1,p-windowMask.width,p+windowMask.width]){
          if(n<0||n>=windowMask.width*windowMask.height||visited.has(n)||windowMask.data[n*4+3]<8)continue;
          const nx=n%windowMask.width,ny=Math.floor(n/windowMask.width);
          if(Math.abs(nx-px)>1||Math.abs(ny-py)>1)continue;
          visited.add(n);queue.push(n);
        }
      }
    }
    const left=minX/windowMask.width*100,top=minY/windowMask.height*100;
    const right=100-(maxX+1)/windowMask.width*100,bottom=100-(maxY+1)/windowMask.height*100;
    windowControls.querySelectorAll(".window-hotspot").forEach(previous=>previous.remove());
    const hotspot=document.createElement("img");hotspot.className="window-hotspot is-flashing";
    hotspot.src=windowImage.currentSrc||windowImage.src;
    hotspot.alt="";hotspot.draggable=false;hotspot.setAttribute("aria-hidden","true");
    hotspot.style.clipPath=`inset(${top}% ${right}% ${bottom}% ${left}%)`;
    windowControls.append(hotspot);
    hotspot.addEventListener("animationend",()=>hotspot.remove(),{once:true,signal:events.signal});
  }
  windowControls.addEventListener("click",flashWindow,{signal:events.signal});
  lampImage?.addEventListener("load",buildLanternControls,{signal:events.signal});
  buildLanternControls();
  windowImage?.addEventListener("load",buildWindowControls,{signal:events.signal});
  buildWindowControls();
  let prepared=false;

  function prepareWindowGlass() {
    if (prepared) {
      windowImage.style.visibility="visible";
      windowImage.style.animationPlayState=artwork.dataset.lit==="true" ? "running" : "paused";
      return;
    }
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
      // Shift the windows to a restrained warm yellow while preserving the
      // painted brightness variation and stained-glass texture.
      const luminance=light[i]*.25+light[i+1]*.55+light[i+2]*.2;
      glazing.data[i]=Math.round(242);
      glazing.data[i+1]=Math.round(194+luminance*.04);
      glazing.data[i+2]=Math.round(112+luminance*.04);
      glazing.data[i+3]=Math.min(255,Math.round(light[i+3]*3.1*strength*texture));
    }
    context.putImageData(glazing,0,0);
    prepared=true;
    // Begin the flutter from its dim keyframe when the generated glass image
    // finishes loading, rather than revealing it halfway through a cycle.
    windowImage.style.animationPlayState="paused";
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
    if (prepared && windowImage) windowImage.style.animationPlayState=lit ? "running" : "paused";
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
