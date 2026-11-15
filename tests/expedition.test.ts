import { describe, it, expect } from "vitest";
import {
  createGame,
  addPlayer,
  dispatch,
  WORLD,
  type Game,
} from "../shared/src/sim";
import {
  fieldMissions,
  sectors,
  missionAvailable,
  missionSector,
  nextFieldMission,
  fieldProgress,
} from "../shared/src/expedition";
import {
  mapPoint,
  expeditionMap,
  fieldStation,
  miniMap,
} from "../client/src/ui/expedition";
function setup() {
  const s = createGame(42);
  addPlayer(s, "a");
  dispatch(s, "a", { type: "power", value: s.allocation });
  return s;
}
function visit(s: Game, mission: string) {
  Object.assign(
    s.players.a,
    missionSector(fieldMissions.find((m) => m.id === mission)!),
  );
}
function observe(s: Game, mission: string, value: number) {
  return dispatch(s, "a", { type: "fieldObserve", mission, value });
}
describe("field expedition", () => {
  it("follows a pinned locked investigation through its prerequisites", () => {
    const s = setup();
    expect(nextFieldMission(s, "relay-link")?.id).toBe("blackbox");
    s.expedition!.completed.push("blackbox");
    expect(nextFieldMission(s, "relay-link")?.id).toBe("solar-test");
  });
  it("has twelve reachable-in-bounds missions at seven distinct sites", () => {
    expect(fieldMissions).toHaveLength(12);
    expect(sectors).toHaveLength(7);
    expect(new Set(fieldMissions.map((m) => m.id)).size).toBe(12);
    for (const site of sectors)
      expect(Math.hypot(site.x - WORLD.x, site.z - WORLD.z)).toBeLessThan(
        WORLD.r - 20,
      );
    for (const m of fieldMissions) {
      expect(m.correct).toBeLessThan(m.answers.length);
      expect(m.source).toMatch(
        /^https:\/\/(www\.)?(science\.)?(jpl\.)?nasa.gov/,
      );
    }
  });
  it("rejects remote completion, locked missions, and conclusions without measurements", () => {
    const s = setup();
    expect(observe(s, "blackbox", 0)).toContain("Travel");
    visit(s, "ice-survey");
    expect(observe(s, "ice-survey", 0)).toContain("earlier");
    visit(s, "blackbox");
    expect(
      dispatch(s, "a", { type: "fieldAnswer", mission: "blackbox", answer: 1 }),
    ).toContain("readings");
  });
  it("requires each reading once, gives retry feedback, and grants a cache only once", () => {
    const s = setup();
    visit(s, "blackbox");
    observe(s, "blackbox", 0);
    observe(s, "blackbox", 0);
    expect(fieldProgress(s).observations.blackbox).toEqual([0]);
    observe(s, "blackbox", 1);
    observe(s, "blackbox", 2);
    expect(
      dispatch(s, "a", { type: "fieldAnswer", mission: "blackbox", answer: 0 }),
    ).toContain("evidence");
    expect(fieldProgress(s).completed).toEqual([]);
    const before = s.items.length;
    expect(
      dispatch(s, "a", { type: "fieldAnswer", mission: "blackbox", answer: 1 }),
    ).toBeUndefined();
    expect(s.items.length).toBe(before + 1);
    dispatch(s, "a", { type: "fieldAnswer", mission: "blackbox", answer: 1 });
    expect(s.items.length).toBe(before + 1);
    expect(missionAvailable(s, fieldMissions[1])).toBe(true);
  });
  it("validates tuning bounds and sequence order", () => {
    const s = setup();
    s.expedition!.completed = ["blackbox", "ice-survey"];
    visit(s, "water-loop");
    expect(observe(s, "water-loop", 0)).toContain("before");
    observe(s, "water-loop", 1);
    expect(fieldProgress(s).observations["water-loop"]).toEqual([1]);
    dispatch(s, "a", { type: "fieldReset", mission: "water-loop" });
    expect(fieldProgress(s).observations["water-loop"]).toEqual([]);
    visit(s, "solar-test");
    expect(observe(s, "solar-test", 20)).toContain("95%");
    expect(observe(s, "solar-test", NaN)).toContain("valid");
    expect(observe(s, "solar-test", 65)).toBeUndefined();
    expect(fieldProgress(s).surveyed).toContain("solar-test");
  });
  it("completes the full campaign through validated actions and survives serialization", () => {
    let s = setup();
    for (const m of fieldMissions) {
      expect(missionAvailable(s, m), m.id).toBe(true);
      visit(s, m.id);
      const values =
        m.tool === "tune" ? [m.target!] : m.order || m.samples.map((_, i) => i);
      for (const value of values)
        expect(observe(s, m.id, value), m.id).toBeUndefined();
      expect(
        dispatch(s, "a", {
          type: "fieldAnswer",
          mission: m.id,
          answer: m.correct,
        }),
        m.id,
      ).toBeUndefined();
      s = JSON.parse(JSON.stringify(s));
    }
    expect(fieldProgress(s).completed).toHaveLength(12);
    expect(nextFieldMission(s)).toBeUndefined();
    expect(s.messages.at(-1)).toContain("EXPEDITION COMPLETE");
  });
  it("migrates an old save lazily without losing survival progress", () => {
    const s = setup();
    delete s.expedition;
    s.built.push("greenhouse");
    expect(nextFieldMission(s)?.id).toBe("blackbox");
    visit(s, "blackbox");
    observe(s, "blackbox", 0);
    expect(fieldProgress(s).observations.blackbox).toEqual([0]);
    expect(s.built).toContain("greenhouse");
  });
  it("maps world coordinates consistently and exposes usable atlas buttons", () => {
    expect(mapPoint(WORLD.x, WORLD.z)).toEqual({ x: 50, y: 50 });
    expect(mapPoint(WORLD.x - WORLD.r, WORLD.z - WORLD.r)).toEqual({
      x: 0,
      y: 0,
    });
    const s = setup(),
      html = expeditionMap(s, "a", "", "blackbox");
    expect(html).toContain('data-do="trackMission"');
    expect(html).toContain("bearing, not a safe walking route");
    expect(miniMap(s, "a", "", "")).toContain(
      'aria-label="Expand expedition map"',
    );
    expect(fieldStation(s, fieldMissions[0])).not.toContain(
      'data-do="fieldAnswer"',
    );
  });
});
