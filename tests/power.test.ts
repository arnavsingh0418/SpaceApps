import { expect, it } from "vitest";
import { createOutpost, initialAllocation, runSol } from "../client/src/power";
import { applyDustStorm, budgetForSol, launchBattery } from "../client/src/solar";

it("requires the extra panel for a larger power plan", () => {
  const state = createOutpost();
  const plan = { ...initialAllocation, air: 4, light: 4 };
  expect(runSol(state, plan, budgetForSol())).toBe(false);
  expect(state).toEqual(createOutpost());
  expect(runSol(state, plan, budgetForSol({ clean: 1, covered: false }))).toBe(true);
  expect(state).toMatchObject({ sol: 2, air: 90, food: 100, dose: 2, signal: 0 });
});

it("uses air and food during shortages and stops after supplies run out", () => {
  const state = createOutpost();
  state.air = 11;
  const plan = { air: 0, light: 0, radio: 0, heat: 0 };
  expect(runSol(state, plan, budgetForSol())).toBe(true);
  expect(state).toMatchObject({ air: 0, food: 85, complete: true });
  expect(runSol(state, initialAllocation, budgetForSol())).toBe(false);
});

it("finishes on Sol 15", () => {
  const state = createOutpost();
  for (let i = 0; i < 15; i++) {
    const response = state.sol % 3 === 0 ? "shelter" : undefined;
    expect(runSol(state, initialAllocation, budgetForSol(), response, { ice: 0, shelter: true })).toBe(true);
  }
  expect(state).toMatchObject({ sol: 15, signal: 0, complete: true });
});

it("requires an available flare response and spends ice only on a valid plan", () => {
  const state = { ...createOutpost(), sol: 3 };
  const supplies = { ice: 2, shelter: false };
  const budget = budgetForSol();
  expect(runSol(state, initialAllocation, budget)).toBe(false);
  expect(runSol(state, initialAllocation, budget, "shelter", supplies)).toBe(false);
  expect(runSol(state, { ...initialAllocation, heat: 6 }, budget, "ice", supplies)).toBe(false);
  expect(supplies.ice).toBe(2);
  expect(runSol(state, initialAllocation, budget, "ice", supplies)).toBe(true);
  expect(supplies.ice).toBe(0);
  expect(state).toMatchObject({ sol: 4, shield: 1, dose: 19 });
});

it("charges food for shelter and limits flare exposure", () => {
  const state = { ...createOutpost(), sol: 3 };
  expect(runSol(state, initialAllocation, budgetForSol(), "shelter", { ice: 0, shelter: true })).toBe(true);
  expect(state).toMatchObject({ food: 87, dose: 5 });
});

it("drops output after a storm unless the panel is covered", () => {
  const panel = { clean: 1, covered: false };
  expect(budgetForSol(panel)).toBe(11);
  expect(budgetForSol(panel, true)).toBe(9);
  applyDustStorm(panel);
  expect(budgetForSol(panel)).toBe(9);
  expect(launchBattery(panel)).toBe(76);
  panel.covered = true;
  applyDustStorm(panel);
  expect(panel.clean).toBe(0.6);
  expect(budgetForSol(panel)).toBe(8);
  expect(launchBattery(panel)).toBe(65);
  panel.covered = false;
  panel.clean = 1;
  expect(launchBattery(panel)).toBe(83);
});
