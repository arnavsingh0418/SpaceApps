import { describe, it, expect } from "vitest";
import { createGame, addPlayer, dispatch, tick, gaitSpeed, B } from "../shared/src/sim";

function setup() {
  const s = createGame(7);
  addPlayer(s, "a", "A");
  dispatch(s, "a", { type: "power", value: { air: 3, light: 3, radio: 3, heat: 2 } });
  return s;
}

describe("Minecraft-style movement in the shared sim", () => {
  it("sprint is faster and crouch slower than walking", () => {
    expect(gaitSpeed("sprint", false)).toBeGreaterThan(gaitSpeed("walk", false));
    expect(gaitSpeed("crouch", false)).toBeLessThan(gaitSpeed("walk", false));
    expect(gaitSpeed("walk", true)).toBeLessThan(gaitSpeed("walk", false));
  });

  it("move actions with a gait change how far the sim moves you", () => {
    const walk = setup(),
      sprint = setup();
    const x0 = walk.players.a.x;
    dispatch(walk, "a", { type: "move", x: 1, z: 0, gait: "walk" });
    dispatch(sprint, "a", { type: "move", x: 1, z: 0, gait: "sprint" });
    for (let i = 0; i < 10; i++) {
      tick(walk, 0.1);
      tick(sprint, 0.1);
    }
    expect(sprint.players.a.x - x0).toBeCloseTo(gaitSpeed("sprint", false), 1);
    expect(walk.players.a.x - x0).toBeCloseTo(gaitSpeed("walk", false), 1);
  });

  it("accepts client positions, stops sim integration while fresh, and blocks teleports", () => {
    const s = setup();
    tick(s, 0.1);
    dispatch(s, "a", { type: "pos", x: 3, z: 3, mx: 1, mz: 0, gait: "sprint" });
    expect(s.players.a.x).toBe(3);
    expect(s.players.a.gait).toBe("sprint");
    tick(s, 0.1); // fresh report: sim must not also move the player
    expect(s.players.a.x).toBe(3);
    tick(s, 0.1);
    dispatch(s, "a", { type: "pos", x: 80, z: 3 });
    expect(s.players.a.x).toBeLessThan(15);
    dispatch(s, "a", { type: "pos", x: Number.NaN, z: 0 });
    expect(Number.isFinite(s.players.a.x)).toBe(true);
  });

  it("keeps reported positions inside the world", () => {
    const s = setup();
    for (let i = 0; i < 1500; i++) {
      tick(s, 0.1);
      dispatch(s, "a", { type: "pos", x: s.players.a.x + 5, z: 0 });
    }
    expect(Math.hypot(s.players.a.x - B.worldCenterX, s.players.a.z - B.worldCenterZ)).toBeLessThanOrEqual(B.worldRadius + 1e-9);
  });

  it("records jumps with a cooldown, only during the day", () => {
    const s = createGame(7);
    addPlayer(s, "a", "A");
    dispatch(s, "a", { type: "jump" });
    expect(s.players.a.jumpAt).toBeUndefined(); // power phase
    dispatch(s, "a", { type: "power", value: { air: 3, light: 3, radio: 3, heat: 2 } });
    tick(s, 0.1);
    dispatch(s, "a", { type: "jump" });
    const first = s.players.a.jumpAt;
    expect(first).toBe(s.elapsed);
    tick(s, 0.1);
    dispatch(s, "a", { type: "jump" });
    expect(s.players.a.jumpAt).toBe(first);
  });
});
