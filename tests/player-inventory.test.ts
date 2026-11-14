import { it, expect } from "vitest";
import { createGame, addPlayer, dispatch, tick } from "../shared/src/sim";
import { equippedItem } from "../shared/src/inventory";
import { movePastPlayers, playerRadius } from "../shared/src/playerCollision";
function setup() {
  const s = createGame(42);
  addPlayer(s, "a");
  addPlayer(s, "b");
  dispatch(s, "a", {
    type: "power",
    value: { air: 4, light: 3, radio: 3, heat: 1 },
  });
  return s;
}
it("keeps pickups and equipped slots owned by each player, including empty slots", () => {
  const s = setup(),
    scrap = s.items.find((i) => i.kind === "scrap")!,
    ice = s.items.find((i) => i.kind === "ice")!;
  Object.assign(s.players.a, { x: scrap.x, z: scrap.z });
  dispatch(s, "a", { type: "pick", target: scrap.id });
  Object.assign(s.players.b, { x: ice.x, z: ice.z });
  dispatch(s, "b", { type: "pick", target: ice.id });
  expect(s.players.a.bag.ice || 0).toBe(0);
  expect(s.players.b.bag.scrap || 0).toBe(0);
  expect(equippedItem(s.players.a)).toBe("scrap");
  expect(equippedItem(s.players.b)).toBe("ice");
  dispatch(s, "a", { type: "selectSlot", slot: 4 });
  expect(equippedItem(s.players.a)).toBeUndefined();
  expect(equippedItem(s.players.b)).toBe("ice");
  expect(dispatch(s, "a", { type: "selectSlot", slot: 5 })).toContain("slot");
  expect(s.players.a.selectedSlot).toBe(4);
  expect(JSON.parse(JSON.stringify(s)).players.a.selectedSlot).toBe(4);
});
it("blocks walking and fast position reports through another player", () => {
  const s = setup();
  Object.assign(s.players.a, { x: 0, z: 0 });
  Object.assign(s.players.b, { x: 2, z: 0 });
  dispatch(s, "a", { type: "move", x: 1, z: 0 });
  for (let i = 0; i < 20; i++) tick(s, 0.1);
  expect(s.players.a.x).toBeLessThanOrEqual(2 - playerRadius * 2 + 0.001);
  expect(s.players.b.x).toBe(2);
  dispatch(s, "a", { type: "pos", x: 6, z: 0, mx: 0, mz: 0 });
  expect(s.players.a.x).toBeLessThan(2);
});
it("allows walking around a crewmate and escaping an old overlapping spawn", () => {
  const blocked = movePastPlayers({ x: 0, z: 0 }, { x: 6, z: 0 }, [
    { x: 2, z: 0 },
  ]);
  expect(blocked.x).toBeLessThan(1);
  const side = movePastPlayers(blocked, { x: blocked.x, z: 2 }, [
    { x: 2, z: 0 },
  ]);
  const around = movePastPlayers(side, { x: 6, z: 2 }, [{ x: 2, z: 0 }]);
  expect(around.x).toBeCloseTo(6);
  expect(
    movePastPlayers({ x: 0, z: 0 }, { x: -2, z: 0 }, [{ x: 0.2, z: 0 }]).x,
  ).toBeCloseTo(-2);
});
