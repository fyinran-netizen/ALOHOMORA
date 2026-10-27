// NOAA's approximate solar equations. Returns local clock hours for the date
// and coordinates; null means the sun does not set on that date.
function solarTime(date, latitude, longitude, setting) {
  const day = Math.floor((Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())
    - Date.UTC(date.getFullYear(),0,0)) / 86400000);
  const angle = 2 * Math.PI / 365 * (day - 1 + .5);
  const equation = 229.18 * (.000075 + .001868 * Math.cos(angle) - .032077 * Math.sin(angle)
    - .014615 * Math.cos(2 * angle) - .040849 * Math.sin(2 * angle));
  const declination = .006918 - .399912 * Math.cos(angle) + .070257 * Math.sin(angle)
    - .006758 * Math.cos(2 * angle) + .000907 * Math.sin(2 * angle)
    - .002697 * Math.cos(3 * angle) + .00148 * Math.sin(3 * angle);
  const lat = latitude * Math.PI / 180;
  const cosine = (Math.cos(90.833 * Math.PI / 180) / (Math.cos(lat) * Math.cos(declination))
    - Math.tan(lat) * Math.tan(declination));
  if (cosine < -1 || cosine > 1) return null;
  const hourAngle = Math.acos(cosine) * 180 / Math.PI;
  const offset = -date.getTimezoneOffset();
  return ((720 - 4 * (longitude + (setting ? -hourAngle : hourAngle))
    - equation + offset) / 60 + 24) % 24;
}

export function localSunset(date, latitude, longitude) {
  return solarTime(date,latitude,longitude,true);
}

export function localSunrise(date, latitude, longitude) {
  return solarTime(date,latitude,longitude,false);
}

export function lampsAreOn(hour, sunset, sunrise) {
  return sunset === null ? false : hour >= sunset || hour < sunrise;
}

export function createSunSchedule(now = () => new Date()) {
  let location = null;
  let disposed = false;
  let locationStatus = "requesting";
  const listeners = new Set();
  const snapshot = () => {
    const date = now();
    const sunset = location ? localSunset(date, location.latitude, location.longitude) : 18;
    const sunrise = location ? localSunrise(date, location.latitude, location.longitude) : 6;
    const minutes = Math.round(sunset * 60) % 1440;
    return {
      sunset,
      sunrise,
      locationAvailable: Boolean(location),
      locationStatus,
      sunsetLabel: `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`,
    };
  };
  const publish = () => { for (const listener of listeners) listener(snapshot()); };
  const geolocation = globalThis.navigator?.geolocation;
  function requestLocation() {
    if (!geolocation) { locationStatus = "unavailable"; publish(); return; }
    locationStatus = "requesting";
    publish();
    geolocation.getCurrentPosition(position => {
      if (disposed) return;
      location = position.coords;
      locationStatus = "available";
      publish();
    }, () => {
      if (disposed) return;
      locationStatus = "unavailable";
      publish();
    }, { enableHighAccuracy: false, maximumAge: 86400000, timeout: 8000 });
  }
  requestLocation();
  return {
    get: snapshot,
    subscribe(listener) { listeners.add(listener); listener(snapshot()); return () => listeners.delete(listener); },
    requestLocation,
    dispose() { disposed = true; listeners.clear(); },
  };
}
