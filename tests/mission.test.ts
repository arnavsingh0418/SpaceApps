import { flyHome } from "./flight-helpers";
import { it, expect } from "vitest";
import {
  createGame,
  addPlayer,
  dispatch,
  tick,
  stations,
  recipes,
  B,
  budget,
  type Game,
  type Point,
  type Item,
} from "../shared/src/sim";
import {
  flightTasks,
  launchSite,
  partSlots,
  returnProgress,
  salvageSites,
} from "../shared/src/returnMission";
function run(s: Game, seconds: number) {
  for (let i = 0; i < Math.ceil(seconds * 10); i++) tick(s, 0.1);
}
function action(s: Game, a: Parameters<typeof dispatch>[2]) {
  const error = dispatch(s, "pilot", a);
  if (error) throw new Error(`${a.type}: ${error}`);
}
function walk(s: Game, pos: Point) {
  const p = s.players.pilot;
  let guard = 0;
  while (Math.hypot(p.x - pos.x, p.z - pos.z) > 0.4 && guard++ < 2000) {
    const dx = pos.x - p.x,
      dz = pos.z - p.z,
      r = Math.hypot(dx, dz);
    action(s, { type: "move", x: dx / r, z: dz / r });
    tick(s, 0.1);
  }
  action(s, { type: "move", x: 0, z: 0 });
}
function learn(s: Game, key: keyof typeof stations) {
  walk(s, stations[key]);
  action(s, { type: "learn", fact: key, answer: 0 });
}
function collect(s: Game, kind: Item) {
  const it = s.items.find((i) => i.kind === kind);
  if (!it) throw Error(`No ${kind} available`);
  walk(s, it);
  action(s, { type: "pick", target: it.id });
}
function store(s: Game) {
  walk(s, stations.workbench);
  action(s, { type: "store" });
}
function build(s: Game, key: string) {
  walk(s, stations.workbench);
  action(s, { type: "beginBuild", recipe: key });
  run(s, 2.1);
  action(s, { type: "finishBuild" });
}
it("the outpost supports a complete mission from gathering to Earth entry", () => {
  const s = createGame(420);
  addPlayer(s, "pilot", "Explorer");
  for (let sol = 1; sol <= B.missionSols; sol++) {
    const cap = budget(s);
    const plan = {
      air: Math.min(4, cap),
      light: Math.min(4, Math.max(0, cap - 5)),
      radio: Math.min(2, Math.max(0, cap - 9)),
      heat: cap >= 5 ? 1 : 0,
    };
    action(s, { type: "power", value: plan });
    if (sol === 1) {
      collect(s, "scrap");
      collect(s, "soil");
      learn(s, "shield");
      collect(s, "ice");
      collect(s, "glass");
      collect(s, "seeds");
      learn(s, "grow");
      store(s);
      build(s, "shelter");
      build(s, "greenhouse");
      collect(s, "antenna");
      collect(s, "battery");
      collect(s, "circuit");
      learn(s, "comms");
      store(s);
      build(s, "radio");
      walk(s, stations.comms);
      action(s, { type: "beginTask", kind: "align" });
      run(s, 2.1);
      action(s, { type: "finishTask", value: 72 });
    }
    if (sol === 5 || sol === 6) {
      for (const site of salvageSites.slice(
        sol === 5 ? 0 : 2,
        sol === 5 ? 2 : 4,
      )) {
        walk(s, site);
        action(s, { type: "startSalvage", site: site.id });
        site.questions.forEach((quiz, step) =>
          action(s, {
            type: "salvageAnswer",
            site: site.id,
            step,
            answer: quiz.correct,
          }),
        );
      }
    }
    if (sol === 7) {
      walk(s, launchSite);
      for (const part of partSlots) action(s, { type: "installPart", part });
      action(s, { type: "launchShip" });
      flyHome(s, "pilot");
      break;
    }
    while (s.phase === "day") {
      if (
        s.event?.kind === "flare" &&
        !s.event.resolved &&
        s.clock >= s.event.at
      ) {
        action(s, { type: "choice", choice: "shelter" });
      }
      if (s.event?.kind === "storm" && s.event.resolved) {
        for (const panel of s.panels) {
          if (panel.clean < 1) {
            walk(s, panel);
            action(s, { type: "beginTask", kind: "clean", target: panel.id });
            run(s, 2.1);
            action(s, { type: "finishTask", value: 24 });
          }
        }
      }
      if (s.event?.kind === "leak" && !s.leakFixed && s.clock >= s.event.at) {
        walk(s, stations.oxygen);
        action(s, { type: "beginTask", kind: "patch" });
        run(s, 2.1);
        action(s, { type: "finishTask", value: 3 });
      }
      tick(s, 0.1);
    }
    if (s.phase === "summary") action(s, { type: "next" });
  }
  expect(s.built).toEqual(
    expect.arrayContaining(["shelter", "greenhouse", "radio"]),
  );
  expect(s.aligned).toBe(true);
  expect(s.phase).toBe("ended");
  expect(returnProgress(s).flight).toMatchObject({
    deck: { outcome: "home", repaired: 4, guidance: [true, true] },
  });
  expect(s.result).toContain("Mission complete");
});
