import {test} from "node:test";
import assert from "node:assert/strict";
import {deriveSunlight,createSunlightRenderer} from "../js/environment/sunlight.js";
import {createEnvironment} from "../js/environment/environmentState.js";

const state={hour:8,weather:"clear",intensity:1,lightMode:"auto",brightness:1};
test("sun stays near the open edge while its elevation and warmth change", () => {
  const morning=deriveSunlight(state);
  const noon=deriveSunlight({...state,hour:12.5});
  const evening=deriveSunlight({...state,hour:17});
  assert.ok(morning.source.x<noon.source.x && noon.source.x<evening.source.x);
  assert.ok(morning.source.x<.2 && noon.source.x<.2 && evening.source.x<.2);
  assert.ok(morning.direction.x>0 && evening.direction.x>0);
  assert.ok(noon.elevation>morning.elevation && noon.elevation>evening.elevation);
  assert.ok(noon.color[2]>morning.color[2] && noon.color[2]>evening.color[2]);
  assert.ok(Math.abs(Math.hypot(morning.direction.x,morning.direction.y)-1)<1e-10);
});

test("sunlight fades continuously at dawn/dusk and vanishes at night", () => {
  for (const hour of [0,3,6,19,21,24]) {
    const sun=deriveSunlight({...state,hour});
    assert.equal(sun.intensity,0);
    assert.equal(sun.beamIntensity,0);
  }
  assert.deepEqual(deriveSunlight({...state,hour:0}),deriveSunlight({...state,hour:24}));
  let previous;
  for (let step=0;step<=24000;step++) {
    const sun=deriveSunlight({...state,hour:step/1000});
    assert.ok(Number.isFinite(sun.elevation) && Number.isFinite(sun.intensity));
    if (previous) assert.ok(Math.abs(sun.intensity-previous.intensity)<.002);
    previous=sun;
  }
});

test("weather attenuates beams more than ambient halo; manual light cannot create a night sun", () => {
  const clear=deriveSunlight(state);
  for (const weather of ["overcast","rain","snow"]) {
    const clouded=deriveSunlight({...state,weather,intensity:.8});
    assert.ok(clouded.intensity<clear.intensity);
    assert.ok(clouded.beamIntensity<clouded.intensity);
    assert.equal(deriveSunlight({...state,weather,intensity:0}).beamIntensity,clear.beamIntensity);
  }
  assert.equal(deriveSunlight({...state,lightMode:"manual",brightness:0}).intensity,0);
  assert.equal(deriveSunlight({...state,hour:23,lightMode:"manual",brightness:1.6}).intensity,0);
});

test("sunlight redraws on demand, clears at night, and releases its lifecycle resources", t => {
  const callbacks=new Map();
  let nextId=0,disconnected=false,clearCount=0,fillCount=0,masked=0;
  const document=new EventTarget();
  document.hidden=false;
  const globals={
    document,
    requestAnimationFrame:callback => {callbacks.set(++nextId,callback);return nextId;},
    cancelAnimationFrame:id => callbacks.delete(id),
    ResizeObserver:class {observe() {} disconnect() {disconnected=true;}},
  };
  for (const [key,value] of Object.entries(globals)) {
    const old=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
    t.after(() => {
      if (old) Object.defineProperty(globalThis,key,old);
      else delete globalThis[key];
    });
  }
  const gradient=() => ({addColorStop() {}});
  const context={
    clearRect() {clearCount++;},fillRect() {fillCount++;},fill() {fillCount++;},
    setTransform() {},save() {},restore() {},translate() {},rotate() {},
    createRadialGradient:gradient,createLinearGradient:gradient,
    beginPath() {},moveTo() {},lineTo() {},closePath() {},
  };
  const canvas={dataset:{},getContext:() => context,getBoundingClientRect:() => ({width:1440,height:900})};
  const environment=createEnvironment();
  const renderer=createSunlightRenderer(canvas,environment,{drawOcclusionMask() {masked++;}});
  t.after(() => renderer.dispose());
  function draw() {
    const [id,callback]=callbacks.entries().next().value;
    callbacks.delete(id);
    callback();
  }
  renderer.start();
  environment.update({timeMode:"manual",hour:8});
  environment.update({hour:9});
  assert.equal(callbacks.size,1,"input events are coalesced into one frame");
  draw();
  assert.ok(fillCount>0);
  assert.equal(masked,1,"future occlusion hook runs after atmospheric light");
  assert.equal(callbacks.size,0,"no perpetual animation loop");
  assert.ok(canvas.width*canvas.height<755000);
  const before=fillCount;
  environment.update({hour:0});
  draw();
  assert.equal(fillCount,before,"night frame only clears");
  assert.ok(clearCount>=2);
  document.hidden=true;
  document.dispatchEvent(new Event("visibilitychange"));
  environment.update({hour:8});
  assert.equal(callbacks.size,0);
  document.hidden=false;
  document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(callbacks.size,1);
  renderer.dispose();
  assert.equal(callbacks.size,0);
  assert.equal(disconnected,true);
  environment.update({hour:12});
  assert.equal(callbacks.size,0,"disposed subscription stays inactive");
});
