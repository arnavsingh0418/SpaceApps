import { expect, it } from "vitest";
import { createConstruction } from "../client/src/construction";

it("requires both the quiz and supplies, then spends the recipe cost once", () => {
  const game = createConstruction();
  expect(game.build("shelter")).toBe(false);
  game.learned.add("habitat");
  expect(game.build("shelter")).toBe(false);
  expect(game.collect("metal")).toBe(true);
  expect(game.collect("metal")).toBe(false);
  expect(game.build("shelter")).toBe(false);
  expect(game.stock.scrap).toBe(5);
  expect(game.collect("soil")).toBe(true);
  expect(game.build("shelter")).toBe(true);
  expect(game.build("shelter")).toBe(false);
  expect(game.stock).toEqual({ ice: 0, soil: 0, scrap: 2, glass: 1 });
  expect(game.build("panel")).toBe(false);
  game.learned.add("solar");
  expect(game.build("panel")).toBe(true);
  expect(game.stock).toEqual({ ice: 0, soil: 0, scrap: 0, glass: 0 });
});
