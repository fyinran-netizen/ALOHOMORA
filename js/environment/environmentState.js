import {deriveSunlight} from "./sunlight.js";

// Shared state and pure calculations: no scene, image or DOM dependencies.
const palette = [
  [0, [8,15,35], [27,39,64], .32, .65],
  [5, [48,65,83], [128,101,77], .4, .72],
  [6.5, [128,153,167], [244,175,93], .72, .87],
  [7, [113,157,187], [249,205,141], .82, .91],
  [12, [74,142,195], [196,222,232], 1.04, 1],
  [16, [88,144,183], [220,203,179], .95, .95],
  [18, [64,80,125], [220,139,115], .7, .87],
  [20, [15,25,51], [57,63,92], .38, .7],
  [24, [8,15,35], [27,39,64], .32, .65],
];
export const weatherTypes = { clear: "Clear", overcast: "Overcast", rain: "Rain", snow: "Snow" };
const mix = (a,b,t) => a + (b-a)*t;
const smooth = value => {const t=Math.max(0,Math.min(1,value)); return t*t*(3-2*t);};
const color = (a,b,t) => a.map((v,i) => mix(v,b[i],t));
const rgb = (v) => `rgb(${v.map(Math.round).join(" ")})`;

export function deriveEnvironment(state) {
  const hour = Math.max(0, Math.min(24, state.hour));
  const i = palette.findIndex((point,index) => index > 0 && hour <= point[0]);
  const a = palette[i-1], b = palette[i];
  const fraction = (hour-a[0])/(b[0]-a[0]);
  const t = fraction*fraction*(3-2*fraction);
  const cloud = state.intensity * ({clear:0,overcast:.8,rain:1,snow:.65}[state.weather]);
  const dawn = smooth(1-Math.abs(hour-6.5)/2.5);
  const dusk = smooth(1-Math.abs(hour-18)/3);
  const goldenHour = Math.max(dawn,dusk);
  const nightDistance = Math.min(Math.abs(hour-2),24-Math.abs(hour-2));
  const clearCoverage = .24+.1*dawn+.65*dusk+.12*smooth(1-nightDistance/4);
  const cloudCoverage = Math.min(1,clearCoverage+cloud*(1-clearCoverage)*.95);
  const daylight = mix(a[3],b[3],t);
  // Lift night exposure without changing the sky/stars clock or manual control.
  const dayAmount = Math.max(0,Math.min(1,(daylight-.32)/.72));
  const weatherTint = state.weather==="clear" ? 0 : smooth(state.intensity/.25);
  const stormTop = color([18,24,35],[47,57,70],dayAmount);
  const stormHorizon = color([32,39,49],[111,120,129],dayAmount);
  const exposure = (.56+.48*dayAmount)*(1-cloud*.32*dayAmount);
  return {
    skyTop: rgb(color(color(a[1],b[1],t),stormTop,weatherTint)),
    skyHorizon: rgb(color(color(a[2],b[2],t),stormHorizon,weatherTint)),
    brightness: state.lightMode === "manual" ? state.brightness : exposure,
    saturation: mix(a[4],b[4],t)*(1-cloud*.22),
    night: Math.max(0, Math.min(1,(.8-daylight)/.48)),
    cloud,
    cloudCoverage,
    cloudVisibility:.72-.6*Math.max(0,Math.min(1,(.8-daylight)/.48))+cloud*.3,
    cloudBrightness:(.8+.48*dayAmount)*(1-cloud*.36),
    cloudSaturation:(.58+.2*(1-dayAmount))*(1-cloud*.22),
    cloudWarmth:.04+.25*goldenHour*(state.weather==="clear" ? 1 : 0),
    sun:deriveSunlight(state),
  };
}

export function createEnvironment(now = () => new Date()) {
  const state = {timeMode:"auto", hour:12, weather:"clear", intensity:.6, speed:1, wind:.2, lightMode:"auto", brightness:1};
  const listeners = new Set();
  let timer;
  function publish() {
    const value = {...state, visual:deriveEnvironment(state)};
    listeners.forEach(listener => listener(value));
  }
  function tick() {
    if (state.timeMode !== "auto") return;
    const date = now();
    state.hour = date.getHours()+date.getMinutes()/60+date.getSeconds()/3600;
    publish();
  }
  return {
    subscribe(listener) {
      listeners.add(listener);
      listener({...state, visual:deriveEnvironment(state)});
      return () => listeners.delete(listener);
    },
    update(patch) {
      for (const key of ["timeMode","lightMode"]) {
        if (["auto","manual"].includes(patch[key])) state[key] = patch[key];
      }
      if (Object.hasOwn(weatherTypes,patch.weather)) state.weather = patch.weather;
      for (const [key,min,max] of [["hour",0,24],["intensity",0,1],["brightness",0,1.6],["speed",.25,2],["wind",-1,1]]) {
        if (typeof patch[key] === "number" && Number.isFinite(patch[key])) {
          state[key] = Math.max(min,Math.min(max,patch[key]));
        }
      }
      if (state.timeMode === "auto") tick();
      else publish();
    },
    start() { if (!timer) { tick(); timer = setInterval(tick,1000); } },
    stop() { clearInterval(timer); timer = undefined; },
  };
}
