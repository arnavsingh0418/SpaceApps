import { flyHome } from "./flight-helpers";
import { expect, it } from "vitest";
import {
  addPlayer,
  createGame,
  dispatch,
  stations,
  tick,
} from "../shared/src/sim";
import {
  flightTasks,
  launchSite,
  partSlots,
  quizSeconds,
  returnChance,
  returnProgress,
  salvageSites,
} from "../shared/src/returnMission";

function crew() {
  const s = createGame(44);
  addPlayer(s, "pilot");
  addPlayer(s, "scientist");
  dispatch(s, "pilot", { type: "power", value: s.allocation });
  return s;
}

it("shares salvage questions and awards points to the crew members who answered", () => {
  const s = crew(),
    site = salvageSites[0];
  const start = { type: "startSalvage", site: site.id };
  const answer = (step: number) => ({
    type: "salvageAnswer",
    site: site.id,
    step,
    answer: site.questions[step].correct,
  });
  expect(dispatch(s, "pilot", start)).toMatch(/closer/);
  Object.assign(s.players.pilot, site);
  Object.assign(s.players.scientist, site);
  dispatch(s, "pilot", start);
  dispatch(s, "pilot", answer(0));
  tick(s, quizSeconds);
  expect(dispatch(s, "scientist", answer(1))).toMatch(/fresh/);
  expect(returnProgress(s).points).toBe(0);
  dispatch(s, "scientist", start);
  dispatch(s, "pilot", answer(0));
  expect(dispatch(s, "scientist", answer(0))).toMatch(/next question/);
  tick(s, 15);
  dispatch(s, "scientist", answer(1));
  expect(returnProgress(s)).toMatchObject({
    points: 325,
    crewPoints: { pilot: 200, scientist: 125 },
    recovered: { booster: "Rare" },
  });
  expect(dispatch(s, "pilot", start)).toMatch(/already/);
});

it("scores lesson speed once and lets players finish after bonus time", () => {
  const s = crew();
  Object.assign(s.players.pilot, stations.shield);
  dispatch(s, "pilot", {
    type: "startLessonQuiz",
    kind: "beacon",
    quiz: "shield",
  });
  tick(s, 10, false);
  dispatch(s, "pilot", {
    type: "startLessonQuiz",
    kind: "beacon",
    quiz: "shield",
  });
  tick(s, 11, false);
  dispatch(s, "pilot", { type: "learn", fact: "shield", answer: 0 });
  dispatch(s, "pilot", { type: "learn", fact: "shield", answer: 0 });
  expect(returnProgress(s).points).toBe(100);
  expect(s.clock).toBe(0);
});

it("validates assembly and launch permissions, then flies the crew home", () => {
  const s = crew();
  for (const player of Object.values(s.players))
    Object.assign(player, launchSite);
  expect(dispatch(s, "pilot", { type: "launchShip" })).toMatch(/four/);
  const progress = s.returnMission!;
  for (const part of partSlots) progress.recovered[part] = "Standard";
  for (const part of partSlots)
    dispatch(s, "scientist", { type: "installPart", part });
  const standard = returnChance(s);
  progress.recovered.booster = "Prototype";
  dispatch(s, "pilot", { type: "installPart", part: "booster" });
  expect(returnChance(s)).toBe(standard + 6);
  expect(dispatch(s, "scientist", { type: "launchShip" })).toMatch(/leader/);
  dispatch(s, "pilot", { type: "launchShip" });
  expect(s.phase).toBe("flight");
  expect(
    dispatch(s, "pilot", { type: "flightTask", step: 0, value: 68 }),
  ).toContain("physical");
  flyHome(s, "pilot");
  expect(s.phase).toBe("ended");
  expect(progress.flight?.deck?.outcome).toBe("home");
  expect(progress.flight?.roll).toBeUndefined();
  expect(s.result).toContain("Mission complete");
});
