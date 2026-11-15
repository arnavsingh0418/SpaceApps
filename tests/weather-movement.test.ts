import { expect, it } from "vitest";
import { blowDustDevil } from "../shared/src/dustDevil";
import { createGame, addPlayer, dispatch, tick, B } from "../shared/src/sim";
import { roverState } from "../shared/src/rover";
import { LocalController } from "../client/src/render/controller";

it("starts the dust devil on its orbit without a first-tick teleport", () => {
  const game = createGame(42);
  addPlayer(game, "a");
  dispatch(game, "a", {
    type: "power",
    value: { air: 4, light: 3, radio: 0, heat: 1 },
  });
  const before = { ...game.devil };
  tick(game, 0.1);
  expect(
    Math.hypot(game.devil.x - before.x, game.devil.z - before.z),
  ).toBeLessThan(1);
});

it("accelerates and lifts both bodies continuously, with stronger wind in the core", () => {
  const center = { x: 0, z: 0 };
  for (const rover of [false, true]) {
    const near = { x: 2, z: 0 },
      edge = { x: 12, z: 0 },
      safe = { x: 24, z: 0 };
    for (let i = 0; i < 8; i++) {
      blowDustDevil(near, center, i * 0.1, 0.1, rover);
      blowDustDevil(edge, center, i * 0.1, 0.1, rover);
      blowDustDevil(safe, center, i * 0.1, 0.1, rover);
    }
    expect(Math.hypot(near.x - 2, near.z)).toBeGreaterThan(2.5);
    expect(Math.hypot(near.x - 2, near.z)).toBeGreaterThan(
      Math.hypot(edge.x - 12, edge.z),
    );
    expect(safe).toEqual({ x: 24, z: 0 });
  }
});

it("keeps rover occupants with a thrown rover and rejects position overwrites during a gust", () => {
  const game = createGame(42);
  addPlayer(game, "driver");
  addPlayer(game, "walker");
  dispatch(game, "driver", {
    type: "power",
    value: { air: 4, light: 3, radio: 0, heat: 1 },
  });
  const rover = roverState(game);
  rover.locked = false;
  rover.x = 18 * B.layoutScale;
  rover.z = 0;
  rover.driver = "driver";
  Object.assign(game.players.walker, { x: rover.x - 2, z: 0 });
  for (let i = 0; i < 6; i++) tick(game, 0.1);
  expect(rover.gust?.height).toBeGreaterThan(0.6);
  expect(game.players.walker.gust?.height).toBeGreaterThan(0.6);
  expect(game.players.driver.x).toBe(rover.x);
  const x = game.players.walker.x;
  dispatch(game, "walker", { type: "pos", x: x - 12, z: 0 });
  expect(game.players.walker.x).toBe(x);
});

it("walks up gradual terrain and stops at both a sharp ledge and a steep continuous slope", () => {
  const run = (ground: (x: number) => number) => {
    const controller = new LocalController();
    controller.reset(0, 0, ground(0));
    for (let i = 0; i < 120; i++)
      controller.update(
        1 / 60,
        { x: 1, z: 0, sprint: true, crouch: false, jump: false },
        false,
        ground,
      );
    return controller;
  };
  expect(run((x) => x * 0.24).x).toBeGreaterThan(6);
  expect(run((x) => (x < 2 ? 0 : 8)).x).toBeLessThan(2);
  expect(run((x) => Math.max(0, x - 2) * 2.2).x).toBeLessThan(2.3);
});
