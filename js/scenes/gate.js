export const gateScene = {
  id: "gate",
  title: "Hogwarts · Castle entrance",
  assets: {
    image: "assets/source/hogwarts_castle_master.png",
    clouds: [
      "assets/scenes/gate/cloud_cluster_a.png", "assets/scenes/gate/cloud_cluster_b.png",
      "assets/scenes/gate/cloud_cluster_c.png", "assets/scenes/gate/cloud_cluster_d.png",
      "assets/scenes/gate/cloud_cluster_e.png", "assets/scenes/gate/cloud_cluster_f.png",
      "assets/scenes/gate/cloud_cluster_h.png",
    ],
  },
  framing: {
    // Wide screens prioritize the facade and entrance, allowing high towers
    // above the viewport. Portrait uses an entrance-centered close view.
    // Place the door threshold at 65% height instead of anchoring the source
    // bottom. This restores the gable/facade and removes excess paved foreground.
    landscape: {fit:"width", scale:1, x:0, y:0, anchorX:1, sourceY:.75, screenY:.65},
    // Keep the highest spire in view while covering the viewport and retaining
    // the main stairs plus a narrow strip of stone foreground.
    portrait: {fit:"height", scale:1.12, x:0, y:-3.5, sourceX:.5, screenX:.5, sourceY:0, screenY:0, cover:true},
  },
  mountFraming,
  hotspots: {},
  environment: { kind: "outdoor", exposure: 1 },
};

// Scene-owned code configuration. X/Y are viewport-relative percentage offsets.
// Fit the original aspect ratio on one axis; viewport clipping is intentional
// for the wide facade view, with no image masks or alpha manipulation.
export function fitCastle(viewport, source, framing) {
  const fit = framing.fit === "width" ? viewport.width/source.width : viewport.height/source.height;
  let width = source.width*fit*framing.scale;
  let height = source.height*fit*framing.scale;
  if (framing.cover && framing.sourceX !== undefined) {
    const screenX = framing.screenX+framing.x/100;
    const minimumWidth = Math.max(
      viewport.width*screenX/framing.sourceX,
      viewport.width*(1-screenX)/(1-framing.sourceX),
    );
    if (width < minimumWidth) {
      width = minimumWidth;
      height = width*source.height/source.width;
    }
  }
  const left = framing.sourceX === undefined ? (viewport.width-width)*framing.anchorX
    : viewport.width*framing.screenX-width*framing.sourceX;
  const top = framing.sourceY === undefined ? viewport.height-height
    : viewport.height*framing.screenY-height*framing.sourceY;
  return {width,height,left:left+viewport.width*framing.x/100,
    top:top+viewport.height*framing.y/100};
}

function mountFraming(frame,image) {
  const events = new AbortController();
  const reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
  const aura=frame.querySelector("#gate-aura");
  const lights=frame.querySelector("#gate-lights");
  function moveWithPointer(event) {
    const bounds=frame.getBoundingClientRect();
    const x=(event.clientX-bounds.left)/bounds.width-.5;
    const y=(event.clientY-bounds.top)/bounds.height-.5;
    if (!reducedMotion?.matches) {
      frame.style.setProperty("--sky-parallax-x",`${-x*9}px`);
      frame.style.setProperty("--sky-parallax-y",`${-y*7}px`);
      frame.style.setProperty("--castle-parallax-x",`${x*4}px`);
      frame.style.setProperty("--castle-parallax-y",`${y*3}px`);
    }
    if (aura) {
      const door=aura.getBoundingClientRect();
      const dx=Math.max(door.left-event.clientX,0,event.clientX-door.right);
      const dy=Math.max(door.top-event.clientY,0,event.clientY-door.bottom);
      const distance=Math.hypot(dx,dy),radius=Math.max(42,Math.min(door.width*.8,door.height*.32));
      const proximity=Math.max(0,1-distance/radius);
      frame.style.setProperty("--gate-hover",String(proximity*proximity*(3-2*proximity)));
      if(proximity>.02){
        const localX=Math.max(0,Math.min(door.width,event.clientX-door.left));
        const localY=Math.max(0,Math.min(door.height,event.clientY-door.top));
        frame.style.setProperty("--gate-warp-x",`${localX/door.width*100}%`);
        frame.style.setProperty("--gate-warp-y",`${localY/door.height*100}%`);
      }else{
        frame.style.setProperty("--gate-warp-x","50%");
        frame.style.setProperty("--gate-warp-y","50%");
      }
      frame.classList.toggle("is-gate-hover",proximity>.04);
    }
  }
  function resetParallax() {
    if (!frame.style?.setProperty) return;
    for (const name of ["--sky-parallax-x","--sky-parallax-y","--castle-parallax-x","--castle-parallax-y"]) {
      frame.style.setProperty(name,"0px");
    }
    frame.style.setProperty("--gate-hover","0");
    frame.style.setProperty("--gate-warp-x","50%");
    frame.style.setProperty("--gate-warp-y","50%");
    frame.classList.remove("is-gate-hover");
  }
  if (reducedMotion && !reducedMotion.matches && matchMedia("(hover: hover) and (pointer: fine)").matches) {
    frame.addEventListener("pointermove",moveWithPointer,{signal:events.signal});
    frame.addEventListener("pointerleave",resetParallax,{signal:events.signal});
    reducedMotion.addEventListener("change",event => {if(event.matches) resetParallax();},{signal:events.signal});
  }
  function render() {
    const viewport = {width:frame.clientWidth,height:frame.clientHeight};
    const orientation = viewport.width/viewport.height < .8 ? "portrait" : "landscape";
    if (image.naturalWidth && image.naturalHeight) {
      const rect = fitCastle(viewport,{width:image.naturalWidth,height:image.naturalHeight},gateScene.framing[orientation]);
      for (const [key,value] of Object.entries(rect)) image.style[key] = value+"px";
      if (lights) for (const [key,value] of Object.entries(rect)) lights.style[key] = value+"px";
      if (aura) {
        const sourceWidth=image.naturalWidth,sourceHeight=image.naturalHeight;
        aura.style.left=rect.left+566/sourceWidth*rect.width+"px";
        aura.style.top=rect.top+951/sourceHeight*rect.height+"px";
        aura.style.width=116/sourceWidth*rect.width+"px";
        aura.style.height=217/sourceHeight*rect.height+"px";
        aura.style.visibility="visible";
      }
      image.style.visibility = "visible";
    }
  }
  const observer = new ResizeObserver(render);
  observer.observe(frame);
  image.addEventListener("load",render,{signal:events.signal});
  render();
  return {
    dispose() { observer.disconnect(); resetParallax(); events.abort(); },
  };
}
