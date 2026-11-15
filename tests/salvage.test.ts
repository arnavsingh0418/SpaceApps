import { expect, it } from "vitest";
import { createSalvage, partSlots, sites } from "../client/src/salvage";

it("expires at the deadline and keeps unsuccessful runs from awarding parts or points", () => {
  const game = createSalvage();
  expect(game.start(0, 0)).toBe(true);
  expect(game.start(1, 1)).toBe(false);
  expect(game.answer(0, 0, sites[0].questions[0].correct, 20000)).toBe("expired");
  expect(game.points).toBe(0);
  expect(game.install("booster")).toBe(false);
  expect(game.start(0, 20000)).toBe(true);
});

it("requires four installed systems, rewards speed, and prevents repeat credit", () => {
  const game = createSalvage();
  for (let index = 0; index < 4; index++) {
    const site = sites[index];
    expect(game.start(index, 0)).toBe(true);
    expect(game.answer(index, 0, (site.questions[0].correct + 1) % 3, 100)).toBe("incorrect");
    expect(game.answer(index, 0, site.questions[0].correct, 1000)).toBe("next");
    expect(game.answer(index, 1, site.questions[1].correct, 2000)).toBe("complete");
    expect(game.recovered[site.part]).toBe("Prototype");
    expect(game.start(index, 3000)).toBe(false);
    expect(game.ready).toBe(false);
  }
  for (const part of partSlots) expect(game.install(part)).toBe(true);
  expect(game.points).toBe(1560);
  expect(game.ready).toBe(true);
});

it("keeps the best recovered part and allows a better one to replace an installed part", () => {
  const game = createSalvage();
  const clear = (i: number, first: number, second: number) => {
    game.start(i, 0);
    game.answer(i, 0, sites[i].questions[0].correct, first);
    game.answer(i, 1, sites[i].questions[1].correct, second);
  };
  clear(0, 9000, 18000);
  expect(game.recovered.booster).toBe("Standard");
  expect(game.install("booster")).toBe(true);
  clear(6, 1000, 2000);
  expect(game.recovered.booster).toBe("Prototype");
  expect(game.install("booster")).toBe(true);
  expect(game.installed.booster).toBe("Prototype");
  expect(game.install("booster")).toBe(false);
});
