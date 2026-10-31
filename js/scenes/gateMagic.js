export function createGateMagicRenderer(canvas,frame,door,castleImage,environment) {
  const context=canvas.getContext("2d",{alpha:true});
  const warpCanvas=document.createElement("canvas");
  const warpContext=warpCanvas.getContext("2d",{willReadFrequently:true});
  const events=new AbortController();
  const reducedMotion=matchMedia("(prefers-reduced-motion: reduce)");
  let width=0,height=0,ratio=1,state,running=false,frameId=null,lastTime=0,elapsed=0;

  function draw(time) {
    frameId=null;
    if(!running||document.hidden||!context)return;
    const dt=lastTime?Math.min((time-lastTime)/1000,.08):0;
    lastTime=time;
    if(!reducedMotion.matches)elapsed+=dt;
    context.clearRect(0,0,width,height);
    if(!state||!warpContext||!castleImage.naturalWidth||!door.getClientRects().length){schedule();return;}

    const frameRect=frame.getBoundingClientRect();
    const doorRect=door.getBoundingClientRect();
    const imageRect=castleImage.getBoundingClientRect();
    const bounds={x:doorRect.left-frameRect.left,y:doorRect.top-frameRect.top,width:doorRect.width,height:doorRect.height};
    const patchWidth=bounds.width*1.72,patchHeight=bounds.height*1.34;
    const patchX=bounds.x+bounds.width*.5-patchWidth*.5;
    const patchY=bounds.y+bounds.height*.5-patchHeight*.5;
    const pixelWidth=Math.max(1,Math.round(patchWidth*ratio));
    const pixelHeight=Math.max(1,Math.round(patchHeight*ratio));
    if(warpCanvas.width!==pixelWidth||warpCanvas.height!==pixelHeight){warpCanvas.width=pixelWidth;warpCanvas.height=pixelHeight;}

    // Sample the untouched castle artwork behind the doorway. The warped copy
    // fades to transparent at its edge so the original painting stays seamless.
    const sourceX=(frameRect.left+patchX-imageRect.left)/imageRect.width*castleImage.naturalWidth;
    const sourceY=(frameRect.top+patchY-imageRect.top)/imageRect.height*castleImage.naturalHeight;
    const sourceWidth=patchWidth/imageRect.width*castleImage.naturalWidth;
    const sourceHeight=patchHeight/imageRect.height*castleImage.naturalHeight;
    warpContext.clearRect(0,0,pixelWidth,pixelHeight);
    warpContext.filter=getComputedStyle(castleImage).filter;
    warpContext.drawImage(castleImage,sourceX,sourceY,sourceWidth,sourceHeight,0,0,pixelWidth,pixelHeight);
    warpContext.filter="none";
    // Put the door seam light into the same source surface before warping it.
    // Its glow follows the same displacement as the wood and stone around it.
    const auraRect=door.getBoundingClientRect();
    const auraX=(auraRect.left-(frameRect.left+patchX))/patchWidth*pixelWidth;
    const auraY=(auraRect.top-(frameRect.top+patchY))/patchHeight*pixelHeight;
    const auraWidth=auraRect.width/patchWidth*pixelWidth;
    const auraHeight=auraRect.height/patchHeight*pixelHeight;
    const night=Math.max(0,Math.min(1,state.visual.night||0));
    const hover=Math.max(0,Math.min(1,Number.parseFloat(frame.style.getPropertyValue("--gate-hover"))||0));
    const now=reducedMotion.matches?0:elapsed;
    const warpPercentX=Number.parseFloat(frame.style.getPropertyValue("--gate-warp-x"))||50;
    const warpPercentY=Number.parseFloat(frame.style.getPropertyValue("--gate-warp-y"))||50;
    const centerX=(doorRect.left-frameRect.left+doorRect.width*warpPercentX/100-patchX)/patchWidth*pixelWidth;
    const centerY=(doorRect.top-frameRect.top+doorRect.height*warpPercentY/100-patchY)/patchHeight*pixelHeight;
    // Match the old visible breathing range while keeping the light core narrow.
    const seamFlicker=.28+.72*(.5+.5*Math.sin(now*Math.PI*2/3.2));
    if(night>0&&!frame.classList.contains("is-gate-hover")){
      // At rest, a faint warm reflection follows the inner arch. Hide this
      // contour on hover so the door deformation and seam stay unobstructed.
      const left=auraX-auraWidth*.16,right=auraX+auraWidth*1.16;
      const apexY=auraY-auraHeight*.035,springY=auraY+auraHeight*.27,bottomY=auraY+auraHeight*.9;
      const middle=(left+right)*.5;
      const glowStrength=night*.13;
      warpContext.save();
      warpContext.globalCompositeOperation="screen";
      warpContext.globalAlpha=glowStrength;
      warpContext.strokeStyle="rgb(255,211,139)";
      warpContext.lineWidth=Math.max(1,auraWidth*.018);
      warpContext.shadowColor="rgba(255,196,105,.8)";
      warpContext.shadowBlur=Math.max(3,auraWidth*.09);
      warpContext.beginPath();
      warpContext.moveTo(left,bottomY);
      warpContext.quadraticCurveTo(left,springY,middle,apexY);
      warpContext.quadraticCurveTo(right,springY,right,bottomY);
      warpContext.stroke();

      if(!reducedMotion.matches){
        const travel=(now*.16)%2;
        const onLeft=travel<=1;
        const t=onLeft?travel:travel-1;
        const p0=onLeft?{x:left,y:bottomY}:{x:middle,y:apexY};
        const p1=onLeft?{x:left,y:springY}:{x:right,y:springY};
        const p2=onLeft?{x:middle,y:apexY}:{x:right,y:bottomY};
        const inverse=1-t;
        const px=inverse*inverse*p0.x+2*inverse*t*p1.x+t*t*p2.x;
        const py=inverse*inverse*p0.y+2*inverse*t*p1.y+t*t*p2.y;
        const radius=Math.max(2,auraWidth*.035);
        const glint=warpContext.createRadialGradient(px,py,0,px,py,radius);
        glint.addColorStop(0,`rgba(255,239,194,${.85*night})`);
        glint.addColorStop(.28,`rgba(255,205,125,${.4*night})`);
        glint.addColorStop(1,"rgba(255,190,100,0)");
        warpContext.globalAlpha=night*.46;
        warpContext.fillStyle=glint;
        warpContext.beginPath();
        warpContext.arc(px,py,radius,0,Math.PI*2);
        warpContext.fill();
      }
      warpContext.restore();
    }
    if(hover>.08){
      // A hover flare is painted onto the door surface before the warp, so it
      // reads as warm light on the wood instead of a floating cursor marker.
      const radius=auraWidth*(.16+hover*.07);
      warpContext.save();
      warpContext.globalCompositeOperation="screen";
      warpContext.globalAlpha=hover*(.3+night*.42);
      warpContext.translate(centerX,centerY);
      warpContext.scale(1,1.45);
      const spill=warpContext.createRadialGradient(0,0,0,0,0,radius);
      spill.addColorStop(0,"rgba(255,239,194,.82)");
      spill.addColorStop(.24,"rgba(255,205,125,.42)");
      spill.addColorStop(1,"rgba(255,170,78,0)");
      warpContext.fillStyle=spill;
      warpContext.beginPath();
      warpContext.arc(0,0,radius,0,Math.PI*2);
      warpContext.fill();
      warpContext.restore();
    }
    if(night>0){
      const light=warpContext.createLinearGradient(auraX+auraWidth*.5,auraY,auraX+auraWidth*.5,auraY+auraHeight);
      light.addColorStop(0,"rgba(255,220,157,0)");
      light.addColorStop(.12,`rgba(255,218,151,${(.2+hover*.14)*night})`);
      light.addColorStop(.48,`rgba(255,250,228,${(.48+hover*.38)*night})`);
      light.addColorStop(.88,`rgba(255,218,151,${(.18+hover*.14)*night})`);
      light.addColorStop(1,"rgba(255,220,157,0)");
      warpContext.save();
      warpContext.globalCompositeOperation="screen";
      warpContext.globalAlpha=Math.min(1,night*seamFlicker*(1+hover*1.8));
      warpContext.shadowColor=`rgba(255,223,164,${Math.min(1,.68*night*seamFlicker*(1+hover*1.5))})`;
      warpContext.shadowBlur=(Math.max(3,auraWidth*.065)+hover*8*ratio);
      warpContext.fillStyle=light;
      const seamWidth=Math.max(1,auraWidth*.018);
      warpContext.fillRect(auraX+(auraWidth-seamWidth)*.5,auraY,seamWidth,auraHeight);
      warpContext.restore();
    }
    const original=warpContext.getImageData(0,0,pixelWidth,pixelHeight);
    const source=original.data;
    const result=warpContext.createImageData(pixelWidth,pixelHeight);
    const output=result.data;
    const maxDisplacement=(1.15+hover*8.5)*ratio;
    const fadeWidth=.17;

    for(let y=0;y<pixelHeight;y++){
      const ny=(y-centerY)/(pixelHeight*.5);
      for(let x=0;x<pixelWidth;x++){
        const nx=(x-centerX)/(pixelWidth*.5);
        const radius=Math.hypot(nx,ny);
        if(radius>=1)continue;
        const edge=Math.max(0,Math.min(1,(1-radius)/fadeWidth));
        const edgeAlpha=edge*edge*(3-2*edge);
        const envelope=Math.sin(radius*Math.PI)*(1-radius)*1.2;
        const wave=Math.sin(radius*22-now*4.5)+.24*Math.sin(radius*39-now*6.2);
        const angle=Math.atan2(ny,nx)+now*.22+wave*(.1+hover*.2);
        const bend=maxDisplacement*envelope;
        const sampleX=Math.max(0,Math.min(pixelWidth-1,x+Math.cos(angle)*bend));
        const sampleY=Math.max(0,Math.min(pixelHeight-1,y+Math.sin(angle)*bend));
        const x0=Math.floor(sampleX),y0=Math.floor(sampleY);
        const x1=Math.min(pixelWidth-1,x0+1),y1=Math.min(pixelHeight-1,y0+1);
        const fx=sampleX-x0,fy=sampleY-y0;
        const i00=(y0*pixelWidth+x0)*4,i10=(y0*pixelWidth+x1)*4;
        const i01=(y1*pixelWidth+x0)*4,i11=(y1*pixelWidth+x1)*4;
        const target=(y*pixelWidth+x)*4;
        for(let channel=0;channel<3;channel++){
          const top=source[i00+channel]*(1-fx)+source[i10+channel]*fx;
          const bottom=source[i01+channel]*(1-fx)+source[i11+channel]*fx;
          output[target+channel]=Math.round(top*(1-fy)+bottom*fy);
        }
        output[target+3]=Math.round(source[i00+3]*edgeAlpha);
      }
    }
    warpContext.putImageData(result,0,0);
    context.drawImage(warpCanvas,patchX,patchY,patchWidth,patchHeight);
    if(!reducedMotion.matches)schedule();
  }

  function schedule(){if(running&&!document.hidden&&frameId===null)frameId=requestAnimationFrame(draw);}
  function cancel(){if(frameId!==null)cancelAnimationFrame(frameId);frameId=null;lastTime=0;}
  function resize(){
    const bounds=canvas.getBoundingClientRect();width=bounds.width;height=bounds.height;
    ratio=Math.min(devicePixelRatio||1,1.5,Math.sqrt(1200000/Math.max(1,width*height)));
    canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(height*ratio));
    context?.setTransform(ratio,0,0,ratio,0,0);
    if(reducedMotion.matches)draw(performance.now());else schedule();
  }
  function sync(next){state=next;if(running){if(reducedMotion.matches)draw(performance.now());else schedule();}}
  const unsubscribe=environment.subscribe(sync);
  const observer=new ResizeObserver(resize);observer.observe(frame);resize();
  castleImage.addEventListener("load",()=>{if(reducedMotion.matches)draw(performance.now());else schedule();},{signal:events.signal});
  document.addEventListener("visibilitychange",()=>{if(document.hidden)cancel();else if(reducedMotion.matches)draw(performance.now());else schedule();},{signal:events.signal});
  reducedMotion.addEventListener("change",()=>{cancel();if(reducedMotion.matches)draw(performance.now());else schedule();},{signal:events.signal});
  return {
    start(){running=true;if(reducedMotion.matches)draw(performance.now());else schedule();},
    stop(){running=false;cancel();context?.clearRect(0,0,width,height);},
    dispose(){running=false;cancel();unsubscribe();observer.disconnect();events.abort();context?.clearRect(0,0,width,height);},
  };
}
