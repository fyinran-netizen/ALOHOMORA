import { gateScene } from "../scenes/gate.js";

// Add a scene here once. Existing scenes should not need to know about it.
export const sceneRegistry = new Map([
  [gateScene.id, gateScene],
]);

export function getScene(sceneId) {
  const scene = sceneRegistry.get(sceneId);
  if (!scene) throw new Error(`Unknown scene: ${sceneId}`);
  return scene;
}
