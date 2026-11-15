import { it, expect } from "vitest";
import { createGame, addPlayer, dispatch, tick } from "../shared/src/sim";
import {
  startDeckFlight,
  flightStations,
  walkableDeck,
  flightDuration,
  startingFlightPower,
  landingChance,
  cartridgeCabinet,
} from "../shared/src/flight";
import { flightResearch } from "../shared/src/flightResearch";
import { partSlots } from "../shared/src/returnMission";
import { flyHome, runFlight, lockGuidance } from "./flight-helpers";
function setup() {
  const s = createGame(42);
  addPlayer(s, "a");
  addPlayer(s, "b");
  startDeckFlight(s);
  return s;
}
it("charges launch power from productive solar panels", () => {
  const s = createGame();
  expect(startingFlightPower(s)).toBe(65);
  const panel = { id: "panel-built-1", x: 0, z: 29, clean: 1, covered: false };
  s.panels = [panel];
  expect(startingFlightPower(s)).toBe(83);
  panel.clean = 0.5;
  expect(startingFlightPower(s)).toBe(74);
  panel.covered = true;
  expect(startingFlightPower(s)).toBe(65);
});
it("puts the crew in a connected bounded physical cabin and rejects Mars teleport actions", () => {
  const s = setup();
  expect(Object.values(s.players).every((p) => walkableDeck(p.x, p.z))).toBe(
    true,
  );
  const x = s.players.a.x;
  dispatch(s, "a", { type: "pos", x: 100, z: 100 });
  expect(s.players.a.x).toBe(x);
  Object.assign(s.players.a, { x: 0, z: 1 });
  Object.assign(s.players.b, { x: 1.5, z: 5 });
  dispatch(s, "a", { type: "flightMove", x: -1, z: 0 });
  runFlight(s, 2);
  expect(s.players.a.x).toBeLessThan(-2);
  runFlight(s, 15);
  expect(walkableDeck(s.players.a.x, s.players.a.z)).toBe(true);
  expect(s.players.a.x).toBeGreaterThan(-2.46);
  expect(dispatch(s, "a", { type: "flightMove", x: NaN, z: 0 })).toContain(
    "valid",
  );
});
it("spawns late-joining crewmates in the central passage", () => {
  const s = setup();
  expect(addPlayer(s, "late")).toBe(true);
  expect(addPlayer(s, "later")).toBe(true);
  for (const id of ["late", "later"]) {
    expect(walkableDeck(s.players[id].x, s.players[id].z)).toBe(true);
    expect(Math.abs(s.players[id].x)).toBeLessThan(2);
  }
});
it("requires a nearby exclusive pilot, valid inputs and a centered course", () => {
  const s = setup(),
    d = s.returnMission!.flight!.deck!;
  expect(dispatch(s, "a", { type: "takeHelm" })).toContain("helm");
  Object.assign(s.players.a, flightStations.helm);
  Object.assign(s.players.b, flightStations.helm);
  dispatch(s, "a", { type: "takeHelm" });
  expect(dispatch(s, "b", { type: "takeHelm" })).toContain("crewmate");
  expect(dispatch(s, "a", { type: "holdCourse" })).toContain("Center");
  expect(dispatch(s, "a", { type: "flightSteer", x: 5, y: 0 })).toContain(
    "Invalid",
  );
  dispatch(s, "a", { type: "flightSteer", x: -1, y: 1 });
  runFlight(s, 0.2);
  expect(d.course.x).toBeLessThan(0.35);
  runFlight(s, 1);
  expect(d.steer).toEqual({ x: 0, y: 0 });
  dispatch(s, "a", { type: "releaseHelm" });
  expect(dispatch(s, "b", { type: "takeHelm" })).toBeUndefined();
});
it("holds autopilot through zero steering input and frees a solo explorer for repairs", () => {
  const s = setup();
  lockGuidance(s, "a");
  const d = s.returnMission!.flight!.deck!;
  expect(d.autopilot).toBe(30);
  expect(d.guidance[0]).toBe(true);
  dispatch(s, "a", { type: "takeHelm" });
  dispatch(s, "a", { type: "flightSteer", x: 0, y: 0 });
  runFlight(s, 1);
  expect(d.autopilot).toBeGreaterThan(28);
  Object.assign(s.players.a, flightStations.power);
  runFlight(s, 1);
  expect(d.pilot).toBe("");
});
it("validates repair position, duration, puzzle and shared exactly-once credit", () => {
  const s = setup();
  runFlight(s, 18.1);
  const f = s.returnMission!.flight!.deck!.incidents[0];
  expect(
    dispatch(s, "a", { type: "beginFlightRepair", fault: f.id }),
  ).toContain("Electrical");
  Object.assign(s.players.a, flightStations.power);
  Object.assign(s.players.b, flightStations.power);
  dispatch(s, "a", { type: "beginFlightRepair", fault: f.id });
  dispatch(s, "b", { type: "beginFlightRepair", fault: f.id });
  const answer = { type: "answerFlightQuiz", fault: f.id };
  expect(dispatch(s, "a", { ...answer, answer: 0 })).toContain("NASA readings");
  expect(dispatch(s, "a", { type: "finishFlightRepair", fault: f.id, value: "0,1,2" })).toContain("science quiz");
  expect(dispatch(s, "b", { ...answer, answer: 1 })).toBeUndefined();
  dispatch(s, "a", { ...answer, answer: 1 });
  expect(s.returnMission!.crewPoints).toEqual({ b: 50 });
  expect(
    dispatch(s, "a", {
      type: "finishFlightRepair",
      fault: f.id,
      value: "0,1,2",
    }),
  ).toContain("three seconds");
  runFlight(s, 3.2);
  expect(
    dispatch(s, "a", { type: "finishFlightRepair", fault: f.id, value: "0,2" }),
  ).toContain("steps");
  expect(
    dispatch(s, "a", {
      type: "finishFlightRepair",
      fault: f.id,
      value: "0,1,2",
    }),
  ).toBeUndefined();
  expect(
    dispatch(s, "b", {
      type: "finishFlightRepair",
      fault: f.id,
      value: "0,1,2",
    }),
  ).toContain("already");
  expect(s.returnMission!.points).toBe(200);
});
it("requires a diagnostic, a cabinet visit and the carrier to replace the scrubber", () => {
  const s = setup();
  runFlight(s, 83.1);
  const fault = s.returnMission!.flight!.deck!.incidents.find((event) => event.kind === "air")!;
  const step = (id: string, step: string) =>
    dispatch(s, id, { type: "scrubberCartridge", fault: fault.id, step });
  Object.assign(s.players.a, flightStations.air);
  Object.assign(s.players.b, cartridgeCabinet);
  dispatch(s, "a", { type: "beginFlightRepair", fault: fault.id });
  expect(step("b", "take")).toContain("spent cartridge");
  expect(step("a", "remove")).toContain("quiz");
  dispatch(s, "a", { type: "answerFlightQuiz", fault: fault.id, answer: flightResearch.air.quiz!.correct });
  expect(step("a", "remove")).toBeUndefined();
  expect(step("a", "take")).toContain("supplies cabinet");
  expect(step("b", "take")).toBeUndefined();
  expect(step("b", "take")).toContain("already");
  expect(step("a", "fit")).toContain("Bring the spare");
  expect(step("b", "fit")).toContain("Life support");
  Object.assign(s.players.b, flightStations.air);
  dispatch(s, "b", { type: "beginFlightRepair", fault: fault.id });
  expect(step("b", "fit")).toBeUndefined();
  expect(fault).toMatchObject({ fixed: true, repairedBy: "b" });
  expect(s.returnMission!.crewPoints).toEqual({ a: 50, b: 150 });
});
it("runs four incidents and rolls for landing after both guidance locks", () => {
  const s = setup();
  s.rng = 42;
  flyHome(s, "a");
  const f = s.returnMission!.flight!;
  expect(s.phase).toBe("ended");
  expect(f.deck).toMatchObject({
    repaired: 4,
    missed: 0,
    arrived: true,
    outcome: "home",
    guidance: [true, true],
  });
  expect(f.chance).toBe(58);
  expect(f.roll).toBeLessThan(f.chance!);
  expect(s.result).toContain("Mission complete");
});
it("uses the installed parts and late faults to change the landing odds", () => {
  const s = setup();
  const progress = s.returnMission!;
  for (const part of partSlots) progress.installed[part] = "Standard";
  startDeckFlight(s);
  const standard = progress.flight!.baseChance;
  for (const part of partSlots) progress.installed[part] = "Prototype";
  startDeckFlight(s);
  const flight = progress.flight!;
  runFlight(s, 18.1);
  expect(landingChance(flight.baseChance, flight.deck!)).toBeGreaterThan(landingChance(standard, flight.deck!));
  const before = landingChance(flight.baseChance, flight.deck!);
  runFlight(s, 36);
  expect(landingChance(flight.baseChance, flight.deck!)).toBe(before - 9);
});
it("sends a flight-ready crew to recovery orbit when the landing roll misses", () => {
  const s = setup();
  s.rng = 1800;
  flyHome(s, "a");
  const flight = s.returnMission!.flight!;
  expect(flight.chance).toBe(58);
  expect(flight.roll).toBeGreaterThan(flight.chance!);
  expect(flight.deck).toMatchObject({
    outcome: "rescue",
    repaired: 4,
    guidance: [true, true],
  });
});
it("unattended faults damage systems and produce a rescue ending instead of a free win", () => {
  const s = setup();
  runFlight(s, flightDuration + 25);
  expect(s.phase).toBe("ended");
  expect(s.returnMission!.flight!.deck!.outcome).toBe("rescue");
  expect(s.result).toContain("rescue");
});
it("migrates an old flight save and retains deck progress across serialization", () => {
  const s = setup();
  delete s.returnMission!.flight!.deck;
  s.players.a.x = 300;
  tick(s, 0.1);
  expect(walkableDeck(s.players.a.x, s.players.a.z)).toBe(true);
  runFlight(s, 20);
  const copy = JSON.parse(JSON.stringify(s));
  expect(copy.returnMission.flight.deck.incidents).toHaveLength(1);
  tick(copy, 0.1);
  expect(copy.returnMission.flight.deck.time).toBeGreaterThan(
    s.returnMission!.flight!.deck!.time,
  );
});
