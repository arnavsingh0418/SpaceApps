import { describe, it, expect } from "vitest";
import {
  createGame,
  addPlayer,
  dispatch,
  tick,
  stations,
  B,
  budget,
  panelOutput,
  total,
  recipes,
  removeStarterPanels,
  startingAllocation,
  type Game,
} from "../shared/src/sim";
import events from "../shared/src/data/events.json";
function setup(seed = 123) {
  const s = createGame(seed);
  addPlayer(s, "a", "A");
  return s;
}
function day(s: Game) {
  dispatch(s, "a", {
    type: "power",
    value: startingAllocation,
  });
}
function run(s: Game, seconds: number) {
  for (let n = 0; n < seconds * 10; n++) tick(s, 0.1);
}
function at(s: Game, pos: { x: number; z: number }) {
  Object.assign(s.players.a, pos);
}
function buildPanel(s: Game) {
  at(s, stations.workbench);
  s.learned.push("power");
  s.players.a.bag = { scrap: 2, glass: 1 };
  expect(dispatch(s, "a", { type: "beginBuild", recipe: "panel" })).toBeUndefined();
  run(s, B.engineerBuildSeconds + 0.1);
  expect(dispatch(s, "a", { type: "finishBuild" })).toBeUndefined();
}
describe("shared deterministic simulation", () => {
  it("restores solar output after brushing, while cover and airborne dust still limit power", () => {
    const s = setup();
    day(s);
    const panel = { id: "array", x: 8, z: 8, clean: 0.2, covered: false };
    s.panels.push(panel);
    at(s, panel);
    expect(budget(s)).toBe(B.batteryPower);
    dispatch(s, "a", { type: "beginTask", kind: "clean", target: panel.id });
    run(s, 2.2);
    expect(dispatch(s, "a", { type: "finishTask", value: 12 })).toMatch(/brushing/);
    expect(panel.clean).toBe(0.2);
    expect(dispatch(s, "a", { type: "finishTask", value: 18 })).toBeUndefined();
    expect(s.power).toBe(B.batteryPower + B.panelPower);
    s.event = { kind: "storm", at: 0, resolved: true };
    expect(panelOutput(s, panel)).toBeCloseTo(B.panelPower * B.stormFactor);
    panel.covered = true;
    expect(panelOutput(s, panel)).toBe(0);
  });

  it("protects air when a crew member seals a habitat leak before the deadline", () => {
    const s = setup();
    day(s);
    addPlayer(s, "b", "B");
    Object.assign(s.players.b, stations.oxygen);
    s.event = { kind: "leak", at: 0, resolved: false };
    const before = s.air;
    expect(dispatch(s, "b", { type: "beginTask", kind: "patch" })).toBeUndefined();
    run(s, 2.2);
    expect(dispatch(s, "b", { type: "finishTask", value: 3 })).toBeUndefined();
    const missed = structuredClone(s);
    missed.leakFixed = false;
    run(s, 29);
    run(missed, 29);
    expect(s.air).toBe(before);
    expect(missed.air).toBe(before - 12);
  });
  it("starts on backup power and retains only crew-built panels in old saves", () => {
    const s = setup();
    expect(s.panels).toEqual([]);
    expect(budget(s)).toBe(8);
    const built = { id: "panel-3", x: 2.2, z: 7 * B.layoutScale, clean: 0.7, covered: false };
    s.panels = [
      { ...built, id: "panel-0", x: -8 * B.layoutScale },
      built,
    ];
    removeStarterPanels(s);
    expect(s.panels).toEqual([built]);
  });
  it("replays the exact state for identical seeds and inputs", () => {
    const a = setup(37),
      b = setup(37);
    for (const s of [a, b]) {
      day(s);
      run(s, 211);
    }
    expect(a).toEqual(b);
  });
  it("uses different event patterns for different seeds", () => {
    function pattern(seed: number) {
      const s = setup(seed),
        out = [];
      for (let i = 4; i < 14; i++) {
        s.sol = i;
        s.phase = "power";
        s.event = null;
        s.panels.forEach((p) => (p.clean = 1));
        day(s);
        out.push(s.history.at(-1));
      }
      return out;
    }
    expect(pattern(7)).not.toEqual(pattern(8));
  });
  it("all decision options carry a positive visible cost", () => {
    for (const c of events.choices)
      expect(Object.values(c.cost).some((v) => v !== undefined && v > 0)).toBe(
        true,
      );
  });
  it("rejects power overspending, fractions, negatives, and NaN", () => {
    for (const v of [7, -1, 0.5, NaN]) {
      const s = setup();
      expect(
        dispatch(s, "a", {
          type: "power",
          value: { air: v, light: 6, radio: 6, heat: 6 },
        }),
      ).toBeTruthy();
      expect(s.phase).toBe("power");
    }
  });
  it("power allocation changes next-sol air and food and explains both", () => {
    const a = setup(),
      b = setup();
    for (const s of [a, b]) {
      s.built.push("greenhouse");
    }
    dispatch(a, "a", {
      type: "power",
      value: startingAllocation,
    });
    dispatch(b, "a", {
      type: "power",
      value: { air: 1, light: 0, radio: 6, heat: 1 },
    });
    run(a, 211);
    run(b, 211);
    expect(a.air).toBeGreaterThan(b.air);
    expect(a.food).toBeGreaterThan(b.food);
    expect(a.summary[0]).toContain("4 blocks");
    expect(b.summary[1]).toContain("0 light blocks");
  });
  it("limits inventory slots and stack sizes", () => {
    const s = setup();
    day(s);
    s.players.a.bag = { scrap: 6, ice: 6, soil: 4, glass: 6, seeds: 1 };
    const i = s.items.find((i) => i.kind === "antenna")!;
    at(s, i);
    expect(dispatch(s, "a", { type: "pick", target: i.id })).toContain("full");
    expect(s.items).toContain(i);
  });
  it("a shared pickup cannot be duplicated", () => {
    const s = setup();
    addPlayer(s, "b", "B");
    day(s);
    const i = s.items[0];
    at(s, i);
    Object.assign(s.players.b, i);
    dispatch(s, "a", { type: "pick", target: i.id });
    dispatch(s, "b", { type: "pick", target: i.id });
    expect((s.players.a.bag.scrap || 0) + (s.players.b.bag.scrap || 0)).toBe(6);
  });
  it("rejects distant pickups and rejects movement outside the crater", () => {
    const s = setup();
    day(s);
    expect(dispatch(s, "a", { type: "pick", target: s.items[0].id })).toContain(
      "closer",
    );
    dispatch(s, "a", { type: "move", x: 1000, z: 1000 });
    run(s, 120);
    expect(
      Math.hypot(s.players.a.x - B.worldCenterX, s.players.a.z - B.worldCenterZ),
    ).toBeLessThanOrEqual(B.worldRadius + 0.001);
  });
  it("rejects nonfinite movement", () => {
    const s = setup();
    day(s);
    dispatch(s, "a", { type: "move", x: Infinity, z: NaN });
    run(s, 1);
    expect(Number.isFinite(s.players.a.x)).toBe(true);
  });
  it("locks every important recipe behind its lesson", () => {
    for (const recipe of recipes.filter(
      (r) => r.id !== "panel" && r.id !== "oxygen",
    )) {
      const s = setup();
      day(s);
      at(s, stations.workbench);
      s.stock = {
        ice: 30,
        scrap: 30,
        soil: 30,
        glass: 30,
        seeds: 30,
        antenna: 30,
        battery: 30,
        circuit: 30,
      };
      expect(
        dispatch(s, "a", { type: "beginBuild", recipe: recipe.id }),
      ).toContain("Learn");
      expect(s.built).not.toContain(recipe.id);
    }
  });
  it("requires correct science answers at the right beacon", () => {
    const s = setup();
    day(s);
    expect(
      dispatch(s, "a", { type: "learn", fact: "shield", answer: 0 }),
    ).toContain("Scan");
    at(s, stations.shield);
    expect(
      dispatch(s, "a", { type: "learn", fact: "shield", answer: 1 }),
    ).toContain("Try again");
    dispatch(s, "a", { type: "learn", fact: "shield", answer: 0 });
    expect(s.learned).toContain("shield");
  });
  it("consumes building supplies once and requires construction time", () => {
    const s = setup();
    day(s);
    at(s, stations.workbench);
    s.learned = ["shield"];
    s.stock = { ice: 3, soil: 2, scrap: 3 };
    dispatch(s, "a", { type: "beginBuild", recipe: "shelter" });
    expect(dispatch(s, "a", { type: "finishBuild" })).toContain("Still");
    run(s, 2.1);
    dispatch(s, "a", { type: "finishBuild" });
    dispatch(s, "a", { type: "finishBuild" });
    expect(s.built).toEqual(["shelter"]);
    expect(s.stock.ice).toBe(0);
    expect(s.stock.scrap).toBe(0);
  });
  it("engineers build faster without blocking other roles", () => {
    const s = setup();
    day(s);
    at(s, stations.workbench);
    s.players.a.role = "Medic";
    s.learned = ["shield"];
    s.stock = { ice: 3, soil: 2, scrap: 3 };
    dispatch(s, "a", { type: "beginBuild", recipe: "shelter" });
    run(s, 2.1);
    expect(dispatch(s, "a", { type: "finishBuild" })).toContain("Still");
    run(s, 2);
    dispatch(s, "a", { type: "finishBuild" });
    expect(s.built).toContain("shelter");
  });
  it("storms leave stored items and covered panels safe, damage exposed ones", () => {
    const s = setup();
    day(s);
    s.items = Array.from({ length: 50 }, (_, i) => ({
      id: "s" + i,
      kind: "scrap" as const,
      count: 4,
      x: 0,
      z: 0,
      damaged: false,
    }));
    s.stock = { ice: 5 };
    buildPanel(s);
    buildPanel(s);
    s.panels[0].covered = true;
    s.event = { kind: "storm", at: 0, resolved: false };
    run(s, 36);
    expect(s.panels[0].clean).toBe(1);
    expect(s.panels[1].clean).toBeLessThan(1);
    expect(s.stock.ice).toBe(5);
    expect(s.items.length).toBeLessThan(50);
    expect(s.items.some((i) => i.damaged)).toBe(true);
  });
  it("covering has a real power trade-off", () => {
    const s = setup();
    day(s);
    buildPanel(s);
    expect(s.power).toBe(11);
    at(s, s.panels[0]);
    dispatch(s, "a", { type: "cover", target: s.panels[0].id });
    expect(s.power).toBe(8);
    expect(total(s.allocation)).toBeLessThanOrEqual(8);
  });
  it("each flare has an attributed real archived record", () => {
    const s = setup();
    s.sol = 3;
    day(s);
    expect(s.event?.flare?.classType).toMatch(/^[MX]/);
    expect(s.event?.flare?.source).toContain("NASA");
    expect(s.event?.flare?.peakTime).toMatch(/^2024/);
  });
  it("sheltering consumes food, reduces flare dose, and dose never decreases", () => {
    const s = setup();
    s.sol = 3;
    day(s);
    s.clock = s.event!.at;
    s.built = ["shelter"];
    const before = s.food;
    dispatch(s, "a", { type: "choice", choice: "shelter" });
    expect(s.food).toBe(before - 10);
    expect(s.dose).toBe(3);
    run(s, 211);
    expect(s.dose).toBeGreaterThanOrEqual(3);
  });
  it("cannot shelter without shelter or add ice shielding without ice", () => {
    const s = setup();
    s.sol = 3;
    day(s);
    s.clock = s.event!.at;
    expect(dispatch(s, "a", { type: "choice", choice: "shelter" })).toContain(
      "Build",
    );
    expect(dispatch(s, "a", { type: "choice", choice: "ice" })).toContain(
      "ice",
    );
    expect(s.dose).toBe(0);
  });
  it("automatically resolves an ignored flare with a dose cost", () => {
    const s = setup();
    s.sol = 3;
    day(s);
    run(s, 115);
    expect(s.event?.resolved).toBe(true);
    expect(s.dose).toBeGreaterThan(0);
  });
  it("delays Mission Control messages rather than claiming instant warnings", () => {
    const s = setup();
    s.sol = 3;
    day(s);
    run(s, 66);
    expect(s.pending.length).toBe(1);
    expect(s.messages.join()).not.toContain("sent 12");
    run(s, 13);
    expect(s.messages.join()).toContain("12 real minutes");
  });
  it("a dust devil only moves loose supplies", () => {
    const s = setup();
    day(s);
    s.stock = { ice: 4 };
    // Put the supply where the dust devil will be on the next tick.
    const devilX = 18 * B.layoutScale * Math.cos((s.elapsed + 0.1) * 0.045),
      devilZ = 16 * B.layoutScale * Math.sin((s.elapsed + 0.1) * 0.045);
    s.items = [
      { id: "devil", kind: "ice", count: 1, x: devilX, z: devilZ, damaged: false },
    ];
    run(s, 0.1);
    expect(s.items[0].x).not.toBe(devilX);
    expect(s.stock.ice).toBe(4);
  });
  it("task completion checks duration, location, and puzzle answer", () => {
    const s = setup();
    day(s);
    s.built = ["radio"];
    at(s, stations.comms);
    dispatch(s, "a", { type: "beginTask", kind: "align" });
    expect(dispatch(s, "a", { type: "finishTask", value: 72 })).toContain(
      "moment",
    );
    run(s, 2.1);
    expect(dispatch(s, "a", { type: "finishTask", value: 10 })).toContain(
      "green",
    );
    dispatch(s, "a", { type: "finishTask", value: 72 });
    expect(s.aligned).toBe(true);
  });
  it("leaks cost air if not repaired", () => {
    const s = setup();
    day(s);
    s.event = { kind: "leak", at: 0, resolved: false };
    run(s, 31);
    expect(s.air).toBe(B.initialAir - 12);
  });
  it("loss teaches instead of shaming", () => {
    const s = setup();
    day(s);
    s.air = 0;
    tick(s, 0.1);
    expect(s.phase).toBe("ended");
    expect(s.result).toContain("Try giving");
  });
  it("a fully built outpost still misses the return window without a launch", () => {
    const s = setup();
    day(s);
    s.sol = 15;
    s.built = ["radio", "greenhouse", "shelter"];
    s.radio = 10;
    s.aligned = true;
    s.event = null;
    run(s, 211);
    expect(s.result).toContain("return window closed");
  });
  it("unbuilt outposts cannot win just by waiting", () => {
    const s = setup();
    day(s);
    s.sol = 15;
    s.event = null;
    run(s, 211);
    expect(s.result).not.toContain("Mission complete");
    expect(s.result).toContain("install all four");
  });
  it("four players maximum and only a leader or Comms can allocate", () => {
    const s = setup();
    addPlayer(s, "b", "B");
    addPlayer(s, "c", "C");
    addPlayer(s, "d", "D");
    expect(addPlayer(s, "e", "E")).toBe(false);
    expect(dispatch(s, "b", { type: "power", value: s.allocation })).toContain(
      "leader",
    );
    dispatch(s, "b", { type: "role", role: "Comms" });
    dispatch(s, "b", { type: "power", value: s.allocation });
    expect(s.phase).toBe("day");
  });
});
