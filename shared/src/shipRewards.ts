import type { Game } from "./sim";
import {
  partNames,
  rarities,
  returnProgress,
  type Part,
  type Rarity,
} from "./returnMission";

export const fieldPartRewards: Record<string, { part: Part; rarity: Rarity }> =
  {
    blackbox: { part: "booster", rarity: "Standard" },
    "water-loop": { part: "air", rarity: "Rare" },
    "shield-test": { part: "hull", rarity: "Rare" },
    "relay-link": { part: "nav", rarity: "Rare" },
  };
export const partDetails: Record<
  Part,
  {
    color: string;
    fault: string;
    task: string;
    mission: string;
    description: string;
  }
> = {
  booster: {
    color: "#ffb36a",
    fault: "Thruster bell fractured",
    task: "Recover the flight recorder",
    mission: "blackbox",
    description: "Twin thrust chambers and a reinforced fuel manifold.",
  },
  hull: {
    color: "#d9a6ff",
    fault: "Shield tiles cracked",
    task: "Test radiation shielding",
    mission: "shield-test",
    description: "Layered ceramic petals around a thermal barrier.",
  },
  nav: {
    color: "#79f1e4",
    fault: "Guidance core burned out",
    task: "Help Nemi or tune the relay",
    mission: "relay-link",
    description: "A suspended star core inside three guidance rings.",
  },
  air: {
    color: "#9bc9ff",
    fault: "Recycling unit ruptured",
    task: "Restore the water procedure",
    mission: "water-loop",
    description: "Paired oxygen tanks, filters and a closed water loop.",
  },
};
/** Rewards upgrade a shared slot; replaying missions never duplicates or downgrades hardware. */
export function recoverPart(s: Game, part: Part, rarity: Rarity) {
  const progress = (s.returnMission ??= returnProgress(s));
  const old = progress.recovered[part];
  if (old && rarities.indexOf(old) >= rarities.indexOf(rarity)) return false;
  progress.recovered[part] = rarity;
  return true;
}
export function fieldRewardText(mission: string) {
  const reward = fieldPartRewards[mission];
  return reward ? `${reward.rarity} ${partNames[reward.part]}` : "";
}
