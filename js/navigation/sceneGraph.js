import { getScene } from "./sceneRegistry.js";

// Connections describe the world, while each scene owns the hotspot that
// presents the connection. No scene transitions are configured yet.
const connections = [];

const directed = new Map();
for (const connection of connections) {
  directed.set(`${connection.from}:${connection.to}`, connection);
  directed.set(`${connection.to}:${connection.from}`, {
    ...connection,
    from: connection.to,
    to: connection.from,
  });
}

export function getConnection(fromId, toId) {
  getScene(fromId);
  getScene(toId);
  return directed.get(`${fromId}:${toId}`) ?? null;
}

export function canNavigate(fromId, toId) {
  return Boolean(getConnection(fromId, toId));
}

export function listConnections(sceneId) {
  getScene(sceneId);
  return [...directed.values()].filter(({ from }) => from === sceneId);
}
