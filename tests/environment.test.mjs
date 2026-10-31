import {test} from "node:test";
import assert from "node:assert/strict";
import {createEnvironment,deriveEnvironment} from "../js/environment/environmentState.js";

const state = {hour:0,weather:"clear",intensity:1,lightMode:"auto",brightness:1};
test("day/night interpolation is finite, continuous and wraps at midnight", () => {
  assert.deepEqual(deriveEnvironment(state),deriveEnvironment({...state,hour:24}));
  let previous;
  for (let step=0;step<=2400;step++) {
    const visual=deriveEnvironment({...state,hour:step/100});
    assert.ok(Number.isFinite(visual.brightness));
    if (previous) assert.ok(Math.abs(visual.brightness-previous.brightness)<.01);
    previous=visual;
  }
  assert.ok(deriveEnvironment({...state,hour:12}).brightness>deriveEnvironment(state).brightness);
});
test("manual light overrides weather exposure without freezing the sky", () => {
  const morning=deriveEnvironment({...state,hour:7,weather:"rain",lightMode:"manual",brightness:.8});
  const night=deriveEnvironment({...state,hour:0,weather:"rain",lightMode:"manual",brightness:.8});
  assert.equal(morning.brightness,.8);
  assert.equal(night.brightness,.8);
  assert.notEqual(morning.skyTop,night.skyTop);
  assert.ok(deriveEnvironment({...state,hour:12,weather:"rain"}).brightness<deriveEnvironment({...state,hour:12}).brightness);
});
test("clouds darken with overcast, rain and snow intensity", () => {
  const clear=deriveEnvironment({...state,hour:12}).cloudBrightness;
  for (const weather of ["overcast","rain","snow"]) {
    const clouded=deriveEnvironment({...state,hour:12,weather}).cloudBrightness;
    const zero=deriveEnvironment({...state,hour:12,weather,intensity:0}).cloudBrightness;
    assert.ok(clouded<clear);
    assert.equal(zero,clear);
  }
});
test("cloud cover is sparse at clear midday and grows at dusk or in precipitation", () => {
  const noon=deriveEnvironment({...state,hour:12}).cloudCoverage;
  const dawn=deriveEnvironment({...state,hour:6.5}).cloudCoverage;
  const dusk=deriveEnvironment({...state,hour:18}).cloudCoverage;
  assert.ok(noon<.3);
  assert.ok(dawn>noon && dawn<dusk);
  assert.ok(dusk>.8);
  for (const weather of ["overcast","rain","snow"]) {
    assert.ok(deriveEnvironment({...state,hour:12,weather}).cloudCoverage>noon);
  }
});
test("dawn and dusk cloud coverage changes continuously", () => {
  for (const weather of ["clear","overcast","rain","snow"]) {
    for (const start of [4,16]) {
      let previous=deriveEnvironment({...state,weather,hour:start}).cloudCoverage;
      for (let step=1;step<=400;step++) {
        const next=deriveEnvironment({...state,weather,hour:start+step/100}).cloudCoverage;
        assert.ok(Math.abs(next-previous)<.02);
        previous=next;
      }
    }
  }
});
test("bad weather removes sunset red from the sky", () => {
  for (const weather of ["overcast","rain","snow"]) {
    const horizon=deriveEnvironment({...state,hour:18,weather,intensity:.6}).skyHorizon;
    const [red,,blue]=horizon.match(/\d+/g).map(Number);
    assert.ok(red<blue);
  }
  const clear=deriveEnvironment({...state,hour:18,weather:"clear"}).skyHorizon;
  const [red,,blue]=clear.match(/\d+/g).map(Number);
  assert.ok(red>blue);
});
test("clear dawn is golden while clear dusk is rose tinted", () => {
  const dawn=deriveEnvironment({...state,hour:6.5}).skyHorizon.match(/\d+/g).map(Number);
  const dusk=deriveEnvironment({...state,hour:18}).skyHorizon.match(/\d+/g).map(Number);
  assert.ok(dawn[1]>dusk[1]);
  assert.ok(dawn[2]<dusk[2]);
});
test("clock modes, input bounds, subscribers and disposal", () => {
  const environment=createEnvironment(() => new Date(2026,9,18,9,30,0));
  let latest, calls=0;
  const off=environment.subscribe(value => {latest=value;calls++;});
  assert.equal(latest.timeMode,"auto");
  assert.equal(latest.hour,12);
  environment.start();
  environment.stop();
  assert.equal(latest.hour,9.5);
  environment.update({timeMode:"auto"});
  assert.equal(latest.hour,9.5);
  environment.update({timeMode:"manual",hour:24});
  assert.equal(latest.hour,24);
  environment.update({hour:99,intensity:-2,brightness:99});
  assert.equal(latest.hour,24);
  assert.equal(latest.intensity,0);
  assert.equal(latest.brightness,1.6);
  environment.update({timeMode:"auto"});
  assert.equal(latest.hour,9.5);
  const before=calls;
  off();
  environment.update({weather:"snow"});
  assert.equal(calls,before);
});
