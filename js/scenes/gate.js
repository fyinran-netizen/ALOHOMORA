export const gateScene = {
  id: "gate",
  title: "Hogwarts entrance",
  assets: {
    image: "assets/scenes/gate/hogwarts_gate.png",
    openImage: "assets/scenes/gate/hogwarts_gate_open.png",
  },
  hotspots: {
    enterHall: { target: "great_hall", label: "Enter the Great Hall" },
  },
  environment: { kind: "outdoor", weather: "snowy_night" },
};
