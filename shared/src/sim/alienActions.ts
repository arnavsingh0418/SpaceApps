import { B, distance, log, type Action, type Game, type Item } from "./index";
import {
  alienNeeds,
  alienProgress,
  alienSite,
  alienSupplied,
  type AlienSupply,
} from "../alien";
import { recoverPart } from "../shipRewards";
import { awardPoints, returnProgress } from "../returnMission";

export function alienAction(
  s: Game,
  id: string,
  a: Action,
): string | undefined {
  const p = s.players[id];
  if (s.phase !== "day") return "Visit Nemi during exploration time.";
  if (distance(p, alienSite) > B.interactRadius)
    return "Move closer to Nemi's refuge.";
  const q = (s.alienQuest ??= alienProgress(s));
  if (q.completed)
    return "Nemi's water loop is already repaired. Your crew has the core.";
  if (a.type === "acceptAlien") {
    q.accepted = true;
    return;
  }
  if (!q.accepted) return "Talk to Nemi and accept the repair first.";
  if (a.type === "donateAlien") {
    const kind = a.kind as AlienSupply;
    if (!Object.hasOwn(alienNeeds, kind))
      return "Nemi needs ice, clear panels and scrap.";
    const requested = a.count === undefined ? alienNeeds[kind] : a.count;
    if (!Number.isInteger(requested) || Number(requested) <= 0)
      return "Choose a positive whole supply count.";
    const left = alienNeeds[kind] - (q.delivered[kind] ?? 0);
    if (left <= 0) return "The crew has delivered enough of that supply.";
    const count = Math.min(Number(requested), left, p.bag[kind] ?? 0);
    if (count <= 0) return "Carry that supply to Nemi in your bag.";
    p.bag[kind] = (p.bag[kind] ?? 0) - count;
    q.delivered[kind] = (q.delivered[kind] ?? 0) + count;
    const contribution = (q.contributions[id] ??= {});
    contribution[kind] = (contribution[kind] ?? 0) + count;
    log(
      s,
      `${p.name} delivered ${count} ${kind} to Nemi. Shared crew repair updated.`,
    );
    return;
  }
  if (a.type === "beginAlienRepair") {
    if (q.brushed) return "The collector is already clean.";
    p.task = { kind: "alienBrush", target: "nemi", at: s.elapsed };
    return;
  }
  if (a.type === "finishAlienRepair") {
    if (q.brushed) return "The collector is already clean.";
    if (
      p.task?.kind !== "alienBrush" ||
      s.elapsed - p.task.at < B.minTaskSeconds
    )
      return "Keep brushing for two seconds.";
    if (
      !Number.isInteger(a.patches) ||
      Number(a.patches) < 6 ||
      Number(a.patches) > 8
    )
      return "Brush at least six dusty patches.";
    q.brushed = true;
    p.task = undefined;
    q.contributions[id] ??= {};
    return;
  }
  if (a.type === "alienAnswer") {
    if (!alienSupplied(s) || !q.brushed)
      return "Deliver the supplies and clean the collector first.";
    if (a.answer !== 1)
      return "Melted ice can still contain contaminants. Treat it, then test it before use.";
    q.completed = true;
    q.completedAt = s.elapsed;
    recoverPart(s, "nav", "Prototype");
    const progress = (s.returnMission ??= returnProgress(s));
    for (const helper of Object.keys(q.contributions))
      awardPoints(progress, helper, 150);
    log(
      s,
      "NEMI: Water loop restored! Prototype navigation core recovered for the whole crew.",
    );
  }
}
