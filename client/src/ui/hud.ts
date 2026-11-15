import { habMap } from "./hab";
import { roverDashboard } from "./rover";
import { roverState, roverSeat } from "../../../shared/src/rover";
import { resourceArt } from "./modelArt";
import { B, budget, stations, type Game } from "../../../shared/src/sim";
import { Gauge, KeyChip, Panel, Button, escape } from "./components";
import { partNames, partSlots, installedCount, returnProgress } from "../../../shared/src/returnMission";
import { hotbar } from "./hotbar";
import { eventBanner } from "./events";
import { tutorialSteps } from "./briefing";
import { miniMap } from "./expedition";
export type HudView = {
  selected: number;
  goals: boolean;
  chat: boolean;
  tutorial: number;
  guide: boolean;
  trackedMission: string;
  trackedSalvage?: string;
  hint: string;
  prompt: string;
  deploySolar?: boolean;
  unread: number;
  bounce: boolean;
  pickupProgress: number;
  previous: { power: number; air: number; food: number; dose: number };
};
export const tutorialHints = [
  "Walk to the glowing crate",
  "Pick it up",
  "Scan the growing beacon",
  "Store items at workbench",
];
export function objective(s: Game, v: HudView) {
  if (v.tutorial < 4) return tutorialHints[v.tutorial];
  if (installedCount(s) === partSlots.length) return "Launch for Earth";
  return "Rebuild the ship";
}
export function hud(s: Game, id: string, v: HudView) {
  const p = s.players[id],
    power = s.phase === "power" ? budget(s) : s.power;
  const roverSeatIndex = roverSeat(roverState(s),id);
  const riding = roverSeatIndex>=0;
  const step = tutorialSteps[v.tutorial];
  const ship = returnProgress(s);
  const shipGoals = partSlots.map((slot) =>
    `<div class="goal-row">${ship.installed[slot] ? "✓" : "◇"} ${partNames[slot]} <span>${ship.installed[slot] ?? ship.recovered[slot] ?? "Missing"}</span></div>`,
  ).join("");
  const guide = v.guide && step ? `<aside class="field-guide field-guide-compact" aria-label="First mission guidance"><span>YOUR FIRST STEPS · ${v.tutorial + 1} / 4</span><h3>${step.title}</h3><footer><span>${step.control}</span><button data-do="help">Guide</button></footer></aside>` : "";
  return `<section class="vitals panel" data-hud="vitals"><div class="sol" title="A sol is one Mars day."><b>SOL ${s.sol}</b><span>/${B.missionSols}</span><i style="width:${(s.clock / B.solSeconds) * 100}%"></i></div>${Gauge("power", resourceArt("power"), power, 14, `Power: ${power} blocks`, v.previous.power)}${Gauge("air", resourceArt("air"), s.air, 100, `Air: ${Math.round(s.air)}%. Give air 3 blocks.`, v.previous.air)}${Gauge("food", resourceArt("food"), s.food, 100, `Food: ${Math.round(s.food)}%. Plants need light.`, v.previous.food)}${Gauge("dose", resourceArt("dose"), s.dose, 100, `Dose: radiation received. It adds up.`, v.previous.dose)}</section><section class="objective-group" data-hud="objective">${Panel(`<button class="objective" data-do="goals"><span>▶ ${escape(objective(s, v))}</span><b>${installedCount(s)}/${partSlots.length}</b></button><button class="chat-toggle" data-do="chat" aria-label="Crew chat">💬${v.unread ? `<b>${v.unread}</b>` : ""}</button>`, "objective-chip")}${Button("≡", "pause", 'aria-label="Pause menu"', true)}${v.goals ? Panel(`<div class="goal-row"><b>${ship.points} crew points</b><span>${ship.crewPoints[id] ?? 0} yours</span></div>${shipGoals}<div class="goal-row">${s.built.includes("greenhouse") ? "✅" : "⬜"} Greenhouse</div><div class="goal-row">${s.built.includes("shelter") ? "✅" : "⬜"} Shelter</div><div class="goal-row">${s.built.includes("radio") && s.aligned ? "✅" : "⬜"} Radio <span>${s.radio}/10</span></div>`, "goal-list") : ""}${s.event?.kind === "storm" && s.clock >= s.event.at && !s.event.resolved ? `<div class="storm-checks"><span>📦 ${Object.values(s.stock).reduce((a, b) => a + (b || 0), 0)} stored</span><span>🛡️ ${s.panels.filter((p) => p.covered).length}/${s.panels.length} covered</span><span>⚡ ${s.panels.filter((p) => p.clean >= 0.6).length} clean</span></div>` : ""}${
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
  }</section>${p.hab ? habMap(s,id) : miniMap(s, id, v.trackedMission, v.trackedSalvage)}${p.hab ? "" : guide}<section class="hotbar-group" data-hud="hotbar">${v.deploySolar ? `<button class="interaction solar-deploy" data-do="deploySolar">${v.prompt ? "" : KeyChip("E")} Deploy array <small>Open ground ahead</small></button>` : ""}${!riding && v.prompt ? `<button class="interaction" data-do="interact">${KeyChip("E")} ${escape(v.prompt)}</button>` : ""}${riding ? roverDashboard(s,id) : hotbar(s, id, v.selected, v.bounce, v.pickupProgress)}</section><div id="touch"><div id="joystick"><i></i></div><button data-do="interact" aria-label="Interact">E</button>${roverSeatIndex === 0 ? '<button class="rover-brake" data-do="roverBrake" aria-label="Brake rover">STOP</button>' : ""}</div>${eventBanner(s)}`;
}
