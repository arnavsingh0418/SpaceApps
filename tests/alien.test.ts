import { it, expect } from "vitest";
import {
  addPlayer,
  createGame,
  dispatch,
  tick,
  type Action,
} from "../shared/src/sim";
import { alienNeeds, alienProgress, alienSite } from "../shared/src/alien";
import {
  returnProgress,
  launchSite,
  shipTarget,
} from "../shared/src/returnMission";
import { recoverPart } from "../shared/src/shipRewards";
import { fieldMissions, missionSector } from "../shared/src/expedition";
import { ShipAssembly } from "../client/src/render/ship";
import * as T from "three";
const setup = () => {
  const s = createGame(42);
  addPlayer(s, "a", "Alex");
  addPlayer(s, "b", "Bea");
  dispatch(s, "a", { type: "power", value: s.allocation });
  for (const p of Object.values(s.players)) Object.assign(p, alienSite);
  return s;
};
const act = (s: ReturnType<typeof setup>, id: string, a: Action) => {
  const e = dispatch(s, id, a);
  expect(e, JSON.stringify(a)).toBeUndefined();
};
function supplies(s: ReturnType<typeof setup>) {
  act(s, "a", { type: "acceptAlien" });
  s.players.a.bag = { ice: 3, scrap: 2 };
  s.players.b.bag = { glass: 2 };
  act(s, "a", { type: "donateAlien", kind: "ice" });
  act(s, "a", { type: "donateAlien", kind: "scrap" });
  act(s, "b", { type: "donateAlien", kind: "glass" });
}
function brush(s: ReturnType<typeof setup>) {
  act(s, "b", { type: "beginAlienRepair" });
  tick(s, 2.1);
  act(s, "b", { type: "finishAlienRepair", patches: 6 });
}
it("validates day, proximity, acceptance and carried supplies", () => {
  const s = setup();
  s.players.a.x = 200;
  expect(dispatch(s, "a", { type: "acceptAlien" })).toContain("closer");
  Object.assign(s.players.a, alienSite);
  expect(dispatch(s, "a", { type: "donateAlien", kind: "ice" })).toContain(
    "accept",
  );
  act(s, "a", { type: "acceptAlien" });
  s.stock.ice = 6;
  expect(dispatch(s, "a", { type: "donateAlien", kind: "ice" })).toContain(
    "bag",
  );
  s.phase = "summary";
  expect(dispatch(s, "a", { type: "donateAlien", kind: "ice" })).toContain(
    "exploration",
  );
});
it("caps simultaneous shared deliveries, spends only carried items and rejects invalid counts", () => {
  const s = setup();
  act(s, "a", { type: "acceptAlien" });
  s.players.a.bag = { ice: 6 };
  s.players.b.bag = { ice: 6 };
  for (const count of [-1, 0, 0.5, NaN, Infinity, "3"])
    expect(
      dispatch(s, "a", { type: "donateAlien", kind: "ice", count }),
    ).toContain("whole");
  expect(dispatch(s, "a", { type: "donateAlien", kind: "battery" })).toContain(
    "needs",
  );
  act(s, "a", { type: "donateAlien", kind: "ice", count: 2 });
  act(s, "b", { type: "donateAlien", kind: "ice", count: 6 });
  expect(alienProgress(s).delivered.ice).toBe(3);
  expect(s.players.a.bag.ice).toBe(4);
  expect(s.players.b.bag.ice).toBe(5);
  expect(dispatch(s, "a", { type: "donateAlien", kind: "ice" })).toContain(
    "enough",
  );
});
it("requires cleaning time, patch count, all supplies and an evidence answer", () => {
  const s = setup();
  supplies(s);
  expect(dispatch(s, "a", { type: "alienAnswer", answer: 1 })).toContain(
    "clean",
  );
  act(s, "b", { type: "beginAlienRepair" });
  expect(dispatch(s, "b", { type: "finishAlienRepair", patches: 6 })).toContain(
    "two",
  );
  tick(s, 2.1);
  expect(dispatch(s, "b", { type: "finishAlienRepair", patches: 3 })).toContain(
    "six",
  );
  act(s, "b", { type: "finishAlienRepair", patches: 6 });
  expect(dispatch(s, "a", { type: "alienAnswer", answer: 0 })).toContain(
    "contaminants",
  );
  expect(alienProgress(s).completed).toBe(false);
  act(s, "a", { type: "alienAnswer", answer: 1 });
  expect(returnProgress(s).recovered.nav).toBe("Prototype");
});
it("rewards the crew exactly once, survives saves and installs at the ship", () => {
  let s = setup();
  supplies(s);
  brush(s);
  act(s, "a", { type: "alienAnswer", answer: 1 });
  const points = returnProgress(s).points;
  expect(points).toBe(300);
  expect(returnProgress(s).crewPoints).toEqual({ a: 150, b: 150 });
  s = JSON.parse(JSON.stringify(s));
  expect(alienProgress(s).delivered).toEqual(alienNeeds);
  expect(dispatch(s, "b", { type: "alienAnswer", answer: 1 })).toContain(
    "already",
  );
  expect(returnProgress(s).points).toBe(points);
  expect(dispatch(s, "a", { type: "installPart", part: "nav" })).toContain(
    "platform",
  );
  Object.assign(s.players.a, launchSite);
  act(s, "a", { type: "installPart", part: "nav" });
  expect(returnProgress(s).installed.nav).toBe("Prototype");
});
it("allows one explorer to perform every crew step", () => {
  const s = setup();
  act(s, "a", { type: "acceptAlien" });
  s.players.a.bag = { ...alienNeeds };
  for (const kind of Object.keys(alienNeeds))
    act(s, "a", { type: "donateAlien", kind });
  act(s, "a", { type: "beginAlienRepair" });
  tick(s, 2.1);
  act(s, "a", { type: "finishAlienRepair", patches: 8 });
  act(s, "a", { type: "alienAnswer", answer: 1 });
  expect(alienProgress(s).completed).toBe(true);
});
it("grants field hardware only after a validated investigation and never downgrades an upgrade", () => {
  const s = setup(),
    m = fieldMissions[0];
  Object.assign(s.players.a, missionSector(m));
  expect(
    dispatch(s, "a", { type: "fieldAnswer", mission: m.id, answer: m.correct }),
  ).toContain("readings");
  for (let value = 0; value < 3; value++)
    act(s, "a", { type: "fieldObserve", mission: m.id, value });
  act(s, "a", { type: "fieldAnswer", mission: m.id, answer: m.correct });
  expect(returnProgress(s).recovered.booster).toBe("Standard");
  recoverPart(s, "booster", "Prototype");
  expect(recoverPart(s, "booster", "Rare")).toBe(false);
  expect(returnProgress(s).recovered.booster).toBe("Prototype");
});
it("guides explorers to Nemi or their recovered hardware", () => {
  const s = setup();
  expect(shipTarget(s, "a", "")).toEqual(alienSite);
  recoverPart(s, "nav", "Prototype");
  expect(shipTarget(s, "a", "")).toEqual(launchSite);
});
it("shows broken components, flies replacements into slots and respects reduced motion", () => {
  const s = setup(),
    assembly = new ShipAssembly(new T.Group());
  assembly.update(s, 0, false);
  expect(
    assembly.state.slots.every((slot) => slot.broken && !slot.installed),
  ).toBe(true);
  recoverPart(s, "nav", "Prototype");
  assembly.update(s, 0.2, false);
  expect(assembly.state.slots.find((x) => x.part === "nav")?.display).toBe(
    true,
  );
  returnProgress(s).installed.nav = "Prototype";
  assembly.update(s, 1, false);
  expect(assembly.state.installing).toBe("nav");
  assembly.update(s, 3, false);
  expect(assembly.state.installing).toBe("");
  expect(assembly.state.slots.find((x) => x.part === "nav")).toMatchObject({
    broken: false,
    installed: true,
    display: false,
  });
  returnProgress(s).installed.hull = "Rare";
  assembly.update(s, 4, true);
  expect(assembly.state.installing).toBe("");
});
