import { flareEffect, type FlareResponse } from "./flare";

export const jobs = ["air", "light", "radio", "heat"] as const;
export type Allocation = Record<(typeof jobs)[number], number>;
export const initialAllocation: Allocation = { air: 3, light: 3, radio: 3, heat: 2 };
export const allocationLimit = 6;
export const lastSol = 15;
export const total = (plan: Allocation) => jobs.reduce((sum, job) => sum + plan[job], 0);
export const powerBudget = (extraPanel: boolean) => 2 + 3 * (extraPanel ? 4 : 3);

type Outpost = { sol: number; air: number; food: number; dose: number; signal: number; shield: number; complete: boolean };
export function createOutpost(): Outpost {
  return { sol: 1, air: 85, food: 95, dose: 0, signal: 0, shield: 0, complete: false };
}

export function canRunSol(state: Outpost, plan: Allocation, budget: number) {
  return !state.complete &&
    jobs.every((job) => Number.isInteger(plan[job]) && plan[job] >= 0 && plan[job] <= allocationLimit) &&
    total(plan) <= budget;
}

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export function runSol(
  state: Outpost, plan: Allocation, budget: number, response?: FlareResponse,
  supplies = { ice: 0, shelter: false },
) {
  if (!canRunSol(state, plan, budget)) return false;
  const effect = flareEffect(state.sol, response, { ...supplies, food: state.food, shield: state.shield });
  if (!effect) return false;
  supplies.ice -= effect.ice;
  state.shield = effect.shield;
  state.dose = clamp(state.dose + effect.dose);
  if (state.dose === 100) {
    state.complete = true;
    return true;
  }
  const airChange = (plan.air < 3 ? -8 : plan.air >= 4 ? 5 : 0) - (plan.heat === 0 ? 3 : 0);
  state.air = clamp(state.air + airChange);
  state.food = clamp(state.food - effect.food - 10 + 4 * plan.light);
  state.signal = Math.min(10, state.signal + plan.radio);
  state.complete = state.air === 0 || state.food === 0 || state.dose === 100 || state.sol === lastSol;
  if (!state.complete) state.sol++;
  return true;
}
