export type SolarArray = { clean: number; covered: boolean };

export const backupPower = 8;

export function solarOutput(array?: SolarArray, storm = false) {
  if (!array || array.covered) return 0;
  return 3 * array.clean * (storm ? 0.4 : 1);
}

export function budgetForSol(array?: SolarArray, storm = false) {
  return backupPower + Math.floor(solarOutput(array, storm));
}

export function applyDustStorm(array: SolarArray) {
  if (!array.covered) array.clean = Math.max(0.1, array.clean * 0.6);
}

export function launchBattery(array?: SolarArray) {
  return 65 + Math.round(solarOutput(array) * 6);
}

export const isDustStormSol = (sol: number) => sol === 2 || sol === 8 || sol === 14;
