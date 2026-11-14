import flares from "./flares.json";

const doses: Record<string, number> = { C: 15, M: 22, X: 30 };
const baseline = 2;
export const flareResponses = ["shelter", "ice", "work"] as const;
export type FlareResponse = (typeof flareResponses)[number];
type Supplies = { food: number; ice: number; shield: number; shelter: boolean };

export function flareForSol(sol: number) {
  if (sol < 3 || sol % 3 !== 0) return undefined;
  return flares[(sol / 3 - 1) % flares.length];
}

export function flareEffect(sol: number, response: FlareResponse | undefined, supplies: Supplies) {
  const flare = flareForSol(sol);
  if (!flare) return response ? undefined : { dose: baseline, food: 0, ice: 0, shield: supplies.shield };
  if (response === "shelter" && supplies.shelter && supplies.food >= 10)
    return { dose: baseline + 3, food: 10, ice: 0, shield: supplies.shield };
  const exposure = doses[flare.classType[0]];
  if (response === "ice" && supplies.ice >= 2) {
    const shield = Math.min(3, supplies.shield + 1);
    return { dose: baseline + Math.max(5, exposure - 10 - shield * 3), food: 0, ice: 2, shield };
  }
  if (response === "work")
    return { dose: baseline + Math.max(5, exposure - supplies.shield * 3), food: 0, ice: 0, shield: supplies.shield };
  return undefined;
}
