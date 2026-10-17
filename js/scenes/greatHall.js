export const greatHallScene = {
  id: "great_hall",
  title: "Inside the Great Hall",
  assets: { image: "assets/scenes/great_hall/great_hall.png" },
  hotspots: {
    returnEntrance: { target: "gate", label: "Return to the entrance" },
  },
  environment: { kind: "indoor", weather: "inherited" },
};
