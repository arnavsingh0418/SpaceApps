import { expect, it } from "vitest";
import { createOutpost, initialAllocation, powerBudget, runSol } from "../client/src/power";

it("requires the extra panel for a larger power plan", () => {
  const state = createOutpost();
  const plan = { ...initialAllocation, air: 4, light: 4 };
  expect(runSol(state, plan, powerBudget(false))).toBe(false);
  expect(state).toEqual(createOutpost());
  expect(runSol(state, plan, powerBudget(true))).toBe(true);
  expect(state).toMatchObject({ sol: 2, air: 90, food: 100, dose: 2, signal: 3 });
});

it("uses air and food during shortages and stops after supplies run out", () => {
  const state = createOutpost();
  state.air = 11;
  const plan = { air: 0, light: 0, radio: 0, heat: 0 };
  expect(runSol(state, plan, powerBudget(false))).toBe(true);
  expect(state).toMatchObject({ air: 0, food: 85, complete: true });
  expect(runSol(state, initialAllocation, powerBudget(false))).toBe(false);
});

it("finishes on Sol 15", () => {
  const state = createOutpost();
  for (let i = 0; i < 15; i++) expect(runSol(state, initialAllocation, powerBudget(false))).toBe(true);
  expect(state).toMatchObject({ sol: 15, signal: 10, complete: true });
});
