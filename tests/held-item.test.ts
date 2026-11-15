import { it, expect, vi, beforeEach } from "vitest";
import * as T from "three";
import { createGame, addPlayer } from "../shared/src/sim";
vi.mock("../client/src/render/modelAssets", () => ({
  createModel: vi.fn(),
  disposeModel: vi.fn(),
}));
import { createModel, disposeModel } from "../client/src/render/modelAssets";
import { updateHeldItem } from "../client/src/render/heldItem";
beforeEach(() => vi.clearAllMocks());
function actor() {
  const root = new T.Group(),
    held = new T.Group();
  held.name = "carried";
  root.add(held);
  return { root, held };
}
it("shows each player’s own item and clears hands on an empty selected slot", async () => {
  vi.mocked(createModel).mockImplementation(() => new Promise(() => {}));
  const s = createGame(42);
  addPlayer(s, "a");
  addPlayer(s, "b");
  s.players.a.bag = { scrap: 6 };
  const a = actor(),
    b = actor();
  updateHeldItem(a.root, s.players.a);
  updateHeldItem(b.root, s.players.b);
  expect(a.held.visible).toBe(true);
  expect(a.held.userData.heldItem).toBe("scrap");
  expect(b.held.visible).toBe(false);
  s.players.b.bag = { ice: 6 };
  updateHeldItem(b.root, s.players.b);
  expect(b.held.userData.heldItem).toBe("ice");
  expect(a.held.children[0]).not.toBe(b.held.children[0]);
  s.players.a.selectedSlot = 4;
  updateHeldItem(a.root, s.players.a);
  expect(a.held.visible).toBe(false);
  expect(a.held.children).toHaveLength(0);
  expect(b.held.visible).toBe(true);
});
it("discards a late old model after the player changes slots", async () => {
  const pending: ((g: T.Group) => void)[] = [];
  vi.mocked(createModel).mockImplementation(
    () => new Promise((resolve) => pending.push(resolve)),
  );
  const s = createGame(42);
  addPlayer(s, "a");
  const p = s.players.a;
  p.bag = { scrap: 1, ice: 1 };
  const a = actor();
  updateHeldItem(a.root, p);
  p.selectedSlot = 1;
  updateHeldItem(a.root, p);
  const stale = new T.Group();
  pending[0](stale);
  await Promise.resolve();
  expect(disposeModel).toHaveBeenCalledWith(stale);
  expect(stale.parent).toBeNull();
  const ice = new T.Group();
  pending[1](ice);
  await Promise.resolve();
  expect(a.held.children).toEqual([ice]);
  expect(a.held.userData.heldItem).toBe("ice");
});
