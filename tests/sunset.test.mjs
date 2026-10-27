import {test} from "node:test";
import assert from "node:assert/strict";
import {localSunrise,localSunset,lampsAreOn} from "../js/environment/sunset.js";

test("sunset follows the season and lanterns stay on overnight", () => {
  const winter=new Date(2026,6,15);
  const summer=new Date(2026,0,15);
  // Sydney's winter sunset is earlier in local clock time than summer's.
  const winterSunset=localSunset(winter,-33.87,151.21);
  const summerSunset=localSunset(summer,-33.87,151.21);
  assert.ok(winterSunset<summerSunset);
  const sunrise=localSunrise(winter,-33.87,151.21);
  assert.ok(sunrise<12 && winterSunset>12);
  assert.equal(lampsAreOn(winterSunset-.01,winterSunset,sunrise),false);
  assert.equal(lampsAreOn(winterSunset,winterSunset,sunrise),true);
  assert.equal(lampsAreOn(2,winterSunset,sunrise),true);
  assert.equal(lampsAreOn(sunrise,winterSunset,sunrise),false);
});
