import {test} from "node:test";
import assert from "node:assert/strict";
import {fitCastle,gateScene} from "../js/scenes/gate.js";
import {deriveEnvironment} from "../js/environment/environmentState.js";

test("portrait framing keeps the spire, entrance and stairs visible without side gaps", () => {
  for (const [width,height] of [[320,568],[390,844],[600,1244],[930,1244]]) {
    const rect=fitCastle({width,height},{width:1024,height:1536},gateScene.framing.portrait);
    assert.ok(Math.abs(rect.width/rect.height-2/3)<1e-10);
    // The entrance is around 60% across the source. Allow a small horizontal
    // offset so the full image width can cover the viewport.
    const entranceX=rect.left+.6*rect.width;
    const entranceBottom=rect.top+1180/1536*rect.height;
    assert.ok(entranceX>width*.5 && entranceX<width*.7);
    assert.ok(entranceBottom>height*.7 && entranceBottom<height*.9);
    assert.ok(rect.top<0 && rect.top>-height*.05,"spire tip remains near the top edge");
    assert.ok(rect.top+1280/1536*rect.height<height,"main stairs remain visible");
    assert.ok(rect.top<0 && rect.top+rect.height>=height);
    assert.ok(rect.left<=0 && rect.left+rect.width>=width,"portrait image covers both sides");
  }
});

test("landscape shows the complete doorway gable and anchors the threshold instead of excess foreground", () => {
  for (const [width,height] of [[569,351],[844,390],[800,800],[1440,900],[1920,1080]]) {
    const rect=fitCastle({width,height},{width:1024,height:1536},gateScene.framing.landscape);
    assert.ok(Math.abs(rect.width/rect.height-2/3)<1e-10);
    assert.ok(rect.width>=width && rect.left<=0);
    assert.ok(Math.abs(rect.left+rect.width-width)<1e-8);
    // Current source: doorway gable around row 850, door leaves end near 1160.
    const entranceTop=rect.top+850/1536*rect.height;
    const entranceBottom=rect.top+1160/1536*rect.height;
    assert.ok(entranceTop>0 && entranceBottom<height);
    assert.ok(Math.abs(rect.top+.75*rect.height-height*.65)<1e-8);
    assert.ok(rect.top+rect.height>=height,"no bottom gap after reframing");
  }
});

test("code-owned composition offsets use the viewport and scaling preserves aspect ratio", () => {
  const viewport={width:390,height:844},source={width:1024,height:1536};
  const framing={...gateScene.framing.portrait,cover:false,scale:.7,x:0,y:0};
  const start=fitCastle(viewport,source,framing);
  const end=fitCastle(viewport,source,{...framing,x:10,y:-10});
  assert.equal(end.left-start.left,viewport.width*.1);
  assert.ok(Math.abs(end.top-start.top+viewport.height*.1)<1e-8);
  const normal=fitCastle(viewport,source,{...framing,scale:1});
  assert.ok(Math.abs(start.width/normal.width-.7)<1e-10);
  assert.ok(Math.abs(start.height/normal.height-.7)<1e-10);
  const shifted=fitCastle(viewport,source,{...framing,scale:1,x:10});
  assert.equal(shifted.left-normal.left,39);
});

test("automatic night lighting retains architectural detail in all weather", () => {
  for (const weather of ["clear","overcast","rain","snow"]) {
    const state={hour:0,weather,intensity:1,lightMode:"auto",brightness:1};
    const night=deriveEnvironment(state);
    assert.ok(night.brightness>=.55);
    assert.ok(night.brightness<deriveEnvironment({...state,hour:12}).brightness);
    assert.equal(deriveEnvironment({...state,lightMode:"manual",brightness:.3}).brightness,.3);
  }
});

test("night light layers follow every castle framing update, including position-only changes", () => {
  const original=globalThis.ResizeObserver;
  let render;
  globalThis.ResizeObserver=class {
    constructor(callback) {render=callback;}
    observe() {}
    disconnect() {}
  };
  try {
    const lights={style:{}};
    const frame={clientWidth:390,clientHeight:844,
      querySelector(selector) {return selector==="#gate-lights" ? lights : null;}};
    const image={naturalWidth:1024,naturalHeight:1536,style:{},addEventListener() {}};
    const mounted=gateScene.mountFraming(frame,image);
    for (const [width,height] of [[390,844],[390,700],[844,390],[1024,390]]) {
      frame.clientWidth=width;frame.clientHeight=height;render();
      for (const key of ["left","top","width","height"]) {
        assert.equal(lights.style[key],image.style[key]);
      }
    }
    mounted.dispose();
  } finally {globalThis.ResizeObserver=original;}
});
