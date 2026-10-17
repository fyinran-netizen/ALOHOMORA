// Shared state boundary for future time/weather/light systems. Rendering
// parameters remain scene-owned until a concrete effect needs to be shared.
export const environmentState = {
  timeOfDay: "night",
  weather: "snow",
};

export function getEnvironment(scene) {
  return {
    ...environmentState,
    ...scene.environment,
  };
}
