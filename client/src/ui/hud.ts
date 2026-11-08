import { B, budget, stations, type Game } from "../../../shared/src/sim";
import { Gauge, KeyChip, Panel, Button, goalCount, escape } from "./components";
import { hotbar } from "./hotbar";
import { eventBanner } from "./events";
export type HudView = {
  selected: number;
  goals: boolean;
  chat: boolean;
  tutorial: number;
  hint: string;
  prompt: string;
  controls: boolean;
  unread: number;
  bounce: boolean;
  pickupProgress: number;
  previous: { power: number; air: number; food: number; dose: number };
};
export const tutorialHints = [
  "Walk to the glowing crate",
  "Pick it up",
  "Scan the cyan beacon",
  "Store items at workbench",
];
export function objective(s: Game, v: HudView) {
  if (v.tutorial < 4) return tutorialHints[v.tutorial];
  if (!s.learned.includes("grow")) return "Scan growing beacon";
  if (!s.built.includes("greenhouse")) return "Build greenhouse";
  if (!s.built.includes("shelter"))
    return s.learned.includes("shield")
      ? "Build shelter"
      : "Scan shielding beacon";
  if (!s.built.includes("radio"))
    return s.learned.includes("comms") ? "Repair radio" : "Scan radio beacon";
  if (!s.aligned) return "Align radio dish";
  return "Keep crew safe";
}
export function hud(s: Game, id: string, v: HudView) {
  const p = s.players[id],
    power = s.phase === "power" ? budget(s) : s.power;
  return `<section class="vitals panel" data-hud="vitals"><div class="sol" title="A sol is one Mars day."><b>SOL ${s.sol}</b><span>/${B.missionSols}</span><i style="width:${(s.clock / B.solSeconds) * 100}%"></i></div>${Gauge("power", "⚡", power, 14, `Power: ${power} blocks`, v.previous.power)}${Gauge("air", "💨", s.air, 100, `Air: ${Math.round(s.air)}%. Give air 3 blocks.`, v.previous.air)}${Gauge("food", "🥔", s.food, 100, `Food: ${Math.round(s.food)}%. Plants need light.`, v.previous.food)}${Gauge("dose", "☢️", s.dose, 100, `Dose: radiation received. It adds up.`, v.previous.dose)}</section><section class="objective-group" data-hud="objective">${Panel(`<button class="objective" data-do="goals"><span>▶ ${escape(objective(s, v))}</span><b>${goalCount(s)}/3</b></button><button class="chat-toggle" data-do="chat" aria-label="Crew chat">💬${v.unread ? `<b>${v.unread}</b>` : ""}</button>`, "objective-chip")}${Button("≡", "pause", 'aria-label="Pause menu"', true)}${v.goals ? Panel(`<div class="goal-row">${s.built.includes("greenhouse") ? "✅" : "⬜"} Greenhouse</div><div class="goal-row">${s.built.includes("shelter") ? "✅" : "⬜"} Shelter</div><div class="goal-row">${s.built.includes("radio") && s.aligned ? "✅" : "⬜"} Radio <span>${s.radio}/10</span></div>`, "goal-list") : ""}${s.event?.kind === "storm" && s.clock >= s.event.at && !s.event.resolved ? `<div class="storm-checks"><span>📦 ${Object.values(s.stock).reduce((a, b) => a + (b || 0), 0)} stored</span><span>🛡️ ${s.panels.filter((p) => p.covered).length}/${s.panels.length} covered</span><span>⚡ ${s.panels.filter((p) => p.clean >= 0.6).length} clean</span></div>` : ""}${
    v.chat
      ? Panel(
          `<div class="chat-messages">${s.messages
            .slice(-3)
            .map(
              (m) =>
                `<p>${escape(
                  m
                    .replace(/^MISSION CONTROL.*?:/, "Earth:")
                    .split(" ")
                    .slice(0, 12)
                    .join(" "),
                )}</p>`,
            )
            .join(
              "",
            )}</div><div class="quick-chat">${Button("Found ice", "quick", 'data-index="0"', true)}${Button("Meet here", "quick", 'data-index="1"', true)}</div>`,
          "chat-drawer",
        )
      : ""
  }</section><section class="hotbar-group" data-hud="hotbar">${v.prompt ? `<button class="interaction" data-do="interact">${KeyChip("E")} ${escape(v.prompt)}</button>` : ""}${hotbar(s, id, v.selected, v.bounce, v.pickupProgress)}${v.tutorial < 4 ? `<div class="tutorial-hint">${KeyChip(v.tutorial === 0 ? "WASD" : "E")} ${tutorialHints[v.tutorial]}</div>` : v.controls ? `<div class="controls-hint">${KeyChip("WASD")} Walk ${KeyChip("E")} Use ${KeyChip("G")} Drop ${KeyChip("Tab")} Goals</div>` : ""}</section><div id="touch"><div id="joystick"><i></i></div><button data-do="interact" aria-label="Interact">E</button></div>${eventBanner(s)}`;
}
