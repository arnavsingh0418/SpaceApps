import type { Allocation, Game } from "../../../shared/src/sim";
import { budget, total } from "../../../shared/src/sim";
import { Button, Tooltip } from "./components";
export const powerKeys = ["air", "light", "radio", "heat"] as const;
export function powerPlan(s: Game, draft: Allocation, first = false) {
  const cap = budget(s),
    left = cap - total(draft);
  return `<div class="battery ${left ? "shake" : ""}">🔋 <b>${cap} ⚡</b><span>${left} left</span></div><div class="power-rows">${powerKeys.map((k, i) => `<div class="power-row" data-row="${k}" tabindex="0" aria-label="${k} power; plus or minus to adjust"><strong>${["💨 Air", "🌱 Plants", "📡 Radio", "🔥 Heat"][i]}</strong><div class="pips"><button data-do="pip" data-k="${k}" data-v="${Math.max(0, draft[k] - 1)}" aria-label="Less ${k} power">−</button>${[1, 2, 3, 4, 5, 6].map((v) => `<button class="pip ${v <= draft[k] ? "on" : ""}" style="--i:${v}" data-do="pip" data-k="${k}" data-v="${v}" aria-label="${v} blocks to ${k}"></button>`).join("")}<button data-do="pip" data-k="${k}" data-v="${Math.min(6, draft[k] + 1)}" aria-label="More ${k} power">+</button></div><span class="effect-chip">${k === "air" ? (draft.air < 3 ? "air −8" : draft.air >= 4 ? "air +5" : "air steady") : k === "light" ? `+${s.built.includes("greenhouse") ? draft.light * 4 : 0} food` : k === "radio" ? `radio +${s.built.includes("radio") ? draft.radio : 0}` : draft.heat ? "warm crew" : "cold crew"}</span></div>`).join("")}</div>${first ? '<p class="plan-tip">Give one job more; another gets less.</p>' : ""}${Button("LOCK IN", "lock")}<span class="power-total">${total(draft)}/${cap} allocated</span>`;
}
