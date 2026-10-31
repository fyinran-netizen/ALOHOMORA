import {getScene} from "../navigation/sceneRegistry.js";
import {createEnvironment} from "../environment/environmentState.js";
import {mountEnvironmentPanel} from "../debug/environmentPanel.js";
import {mountDraggablePanel} from "../debug/draggablePanel.js";
import {createWeatherRenderer} from "../environment/weatherRenderer.js";
import {createSunlightRenderer} from "../environment/sunlight.js";
import {createSkyMotion} from "../environment/skyMotion.js";
import {createAtmosphereRenderer} from "../environment/atmosphereRenderer.js";
import {createCelestialRenderer} from "../environment/celestialRenderer.js";
import {createFireflyRenderer} from "../environment/fireflies.js";
import {createSunSchedule} from "../environment/sunset.js";
import {mountGateLamps} from "../scenes/gateLamps.js";

const scene = getScene("gate");
const frame = document.querySelector("#scene-frame");
const image = document.querySelector("#castle-image");
const status = document.querySelector("#scene-status");
const environment = createEnvironment();
const sunSchedule = createSunSchedule();
image.src = scene.assets.image;
const framing = scene.mountFraming(frame,image);
frame.dataset.scene = scene.id;
const unsubscribe = environment.subscribe(({visual}) => {
  // Sky and architecture use separate rendering responses.
  frame.style.setProperty("--sky-top",visual.skyTop);
  frame.style.setProperty("--sky-horizon",visual.skyHorizon);
  frame.style.setProperty("--castle-brightness",visual.brightness*scene.environment.exposure);
  frame.style.setProperty("--castle-saturation",visual.saturation);
  frame.style.setProperty("--cloud-visibility",visual.cloudVisibility);
  frame.style.setProperty("--cloud-brightness",visual.cloudBrightness);
  frame.style.setProperty("--cloud-saturation",visual.cloudSaturation);
  frame.style.setProperty("--cloud-warmth",visual.cloudWarmth);
});
const panel = document.querySelector("#environment-panel");
const unmountPanel = mountEnvironmentPanel(panel,environment,sunSchedule);
const unmountDrag = mountDraggablePanel(panel);
const weather = createWeatherRenderer(document.querySelector("#weather-canvas"),environment);
const sunlight = createSunlightRenderer(document.querySelector("#sunlight-canvas"),environment);
const skyMotion = createSkyMotion(document.querySelector("#star-canvas"),environment);
const atmosphere = createAtmosphereRenderer(document.querySelector("#atmosphere-canvas"),environment);
const celestial = createCelestialRenderer(document.querySelector("#celestial-canvas"),environment);
const fireflies = createFireflyRenderer(document.querySelector("#firefly-canvas"),environment);
const lamps = mountGateLamps(document.querySelector("#gate-lights"),environment,image,sunSchedule);
const lifecycle = new AbortController();
function loaded() { frame.setAttribute("aria-busy","false"); status.hidden = true; }
image.addEventListener("load",loaded,{signal:lifecycle.signal});
image.addEventListener("error",() => {
  frame.setAttribute("aria-busy","false");
  status.textContent = "The castle image could not load. Please refresh the page.";
  status.hidden = false;
},{signal:lifecycle.signal});
if (image.complete && image.naturalWidth) loaded();
window.addEventListener("pagehide",event => {
  environment.stop();
  weather.stop();
  sunlight.stop();
  skyMotion.stop();
  atmosphere.stop();
  celestial.stop();
  fireflies.stop();
  lamps.stop();
  if (!event.persisted) { unsubscribe(); unmountPanel(); unmountDrag(); weather.dispose(); sunlight.dispose(); skyMotion.dispose(); atmosphere.dispose(); celestial.dispose(); fireflies.dispose(); lamps.dispose(); sunSchedule.dispose(); framing.dispose(); lifecycle.abort(); }
});
window.addEventListener("pageshow",() => { environment.start(); weather.start(); sunlight.start(); skyMotion.start(); atmosphere.start(); celestial.start(); fireflies.start(); lamps.start(); });
environment.start();
weather.start();
sunlight.start();
skyMotion.start();
atmosphere.start();
celestial.start();
fireflies.start();
lamps.start();
