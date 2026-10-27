export function mountEnvironmentPanel(panel, environment, sunSchedule) {
  const controls = panel.querySelector("form").elements;
  const events = new AbortController();
  panel.addEventListener("input", ({target}) => {
    if (target.name) environment.update({[target.name]:target.type === "range" ? Number(target.value) : target.value});
  }, {signal:events.signal});
  panel.querySelector("form").addEventListener("submit", event => event.preventDefault(), {signal:events.signal});
  panel.querySelector("#sunset-location").addEventListener("click", () => sunSchedule.requestLocation(), {signal:events.signal});
  function updateSunset(schedule) {
    const status=panel.querySelector("#sunset-value");
    const button=panel.querySelector("#sunset-location");
    if (schedule.locationAvailable) {
      status.textContent=`This browser's local time · Sunset ${schedule.sunsetLabel} · Lanterns switch on at sunset.`;
      button.hidden=true;
    } else if (schedule.locationStatus === "requesting") {
      status.textContent="This browser's local time · Checking location for today's sunset…";
      button.hidden=true;
    } else {
      status.textContent=`This browser's local time · Location unavailable; using ${schedule.sunsetLabel} as the sunset estimate.`;
      button.hidden=false;
    }
  }
  const unsubscribe = environment.subscribe(state => {
    for (const key of ["timeMode","hour","weather","intensity","speed","wind","lightMode","brightness"]) {
      controls.namedItem(key).value = state[key];
    }
    controls.namedItem("hour").disabled = state.timeMode === "auto";
    controls.namedItem("brightness").disabled = state.lightMode === "auto";
    if (state.lightMode === "auto") controls.namedItem("brightness").value = state.visual.brightness;
    controls.namedItem("intensity").disabled = state.weather === "clear";
    for (const key of ["speed","wind"]) controls.namedItem(key).disabled = !["rain","snow"].includes(state.weather);
    const minutes = Math.round(state.hour*60);
    panel.querySelector("#time-value").value = `${String(Math.floor(minutes/60)).padStart(2,"0")}:${String(minutes%60).padStart(2,"0")}`;
    panel.querySelector("#intensity-value").value = `${Math.round(state.intensity*100)}%`;
    panel.querySelector("#brightness-value").value = `${Math.round(state.visual.brightness*100)}%`;
    panel.querySelector("#speed-value").value = `${state.speed.toFixed(2)}×`;
    panel.querySelector("#wind-value").value = state.wind === 0 ? "Calm" : `${Math.round(Math.abs(state.wind)*100)}% ${state.wind < 0 ? "left" : "right"}`;
    const sun=state.visual.sun;
    panel.querySelector("#sun-elevation").value = sun.elevation>0 ? `${sun.elevation.toFixed(1)}°` : "Below horizon";
    panel.querySelector("#sun-strength").value = sun.elevation>0 ? `${Math.round(sun.beamIntensity*100)}%` : "Night";
    updateSunset(sunSchedule.get());
  });
  const unsubscribeSun=sunSchedule.subscribe(updateSunset);
  return () => { events.abort(); unsubscribe(); unsubscribeSun(); };
}
