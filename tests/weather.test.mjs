import {test} from "node:test";
import assert from "node:assert/strict";
import {createWeatherRenderer} from "../js/environment/weatherRenderer.js";
import {createEnvironment} from "../js/environment/environmentState.js";

test("weather overlay responds to density, viewport, wind and lifecycle", t => {
  const callbacks = new Map();
  let nextId=0, resizeCallback, disposed=false;
  const document = new EventTarget();
  document.hidden=false;
  const globals = {
    document, devicePixelRatio:3,
    matchMedia:() => ({matches:false}),
    requestAnimationFrame:callback => {callbacks.set(++nextId,callback);return nextId;},
    cancelAnimationFrame:id => callbacks.delete(id),
    ResizeObserver:class {
      constructor(callback) {resizeCallback=callback;}
      observe() {}
      disconnect() {disposed=true;}
    },
  };
  for (const [key,value] of Object.entries(globals)) {
    const old=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
    t.after(() => {
      if (old) Object.defineProperty(globalThis,key,old);
      else delete globalThis[key];
    });
  }
  let bounds={width:1000,height:800}, lines=[], snowflakes=0;
  const context={
    setTransform() {}, clearRect() {}, beginPath() {}, stroke() {}, fill() {},
    moveTo(x,y) {lines.push([x,y]);},
    lineTo(x,y) {lines.at(-1).push(x,y);},
    arc() {snowflakes++;},
  };
  const canvas={dataset:{},getContext:() => context,getBoundingClientRect:() => bounds};
  const environment=createEnvironment();
  const renderer=createWeatherRenderer(canvas,environment);
  t.after(() => renderer.dispose());
  function draw(time) {
    const [id,callback]=callbacks.entries().next().value;
    callbacks.delete(id);
    callback(time);
  }
  renderer.start();
  assert.equal(callbacks.size,0,"clear weather has no animation loop");
  environment.update({weather:"rain",intensity:1,wind:-1});
  assert.equal(Number(canvas.dataset.particleCount),384);
  assert.equal(callbacks.size,1);
  draw(100);
  assert.ok(lines.length>0);
  assert.ok(lines.every(([x,y,endX,endY]) => endX>x && endY<y),"rain trails follow leftward wind");
  environment.update({intensity:.5});
  assert.equal(Number(canvas.dataset.particleCount),192);
  environment.update({intensity:0});
  assert.equal(Number(canvas.dataset.particleCount),0);
  assert.equal(callbacks.size,0);
  environment.update({weather:"snow",intensity:1});
  draw(200);
  assert.ok(snowflakes>0);
  bounds={width:390,height:844};
  resizeCallback();
  assert.equal(Number(canvas.dataset.particleCount),72);
  assert.equal(canvas.width,780,"pixel ratio is capped at two");
  assert.equal(canvas.height,1688);
  document.hidden=true;
  document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(callbacks.size,0);
  document.hidden=false;
  document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(callbacks.size,1);
  renderer.stop();
  assert.equal(callbacks.size,0);
  renderer.start();
  assert.equal(callbacks.size,1);
  renderer.dispose();
  assert.equal(disposed,true);
  assert.equal(callbacks.size,0);
  environment.update({weather:"rain"});
  assert.equal(callbacks.size,0,"disposed renderer has unsubscribed");
});

test("weather control inputs stay within supported ranges", () => {
  const environment=createEnvironment();
  let state;
  environment.subscribe(value => {state=value;});
  environment.update({speed:10,wind:-10});
  assert.equal(state.speed,2);
  assert.equal(state.wind,-1);
  environment.update({speed:-1,wind:10});
  assert.equal(state.speed,.25);
  assert.equal(state.wind,1);
});
