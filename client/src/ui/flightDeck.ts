import type { Game } from "../../../shared/src/sim";
import {
  flightStations,
  flightDuration,
  nearestFlightStation,
  type FlightIncident,
} from "../../../shared/src/flight";
import { Button, escape } from "./components";
import "./flightDeck.css";

export function flightHUD(s: Game, id: string) {
  const d = s.returnMission!.flight!.deck!,
    station = nearestFlightStation(s.players[id]),
    arrival = d.arrivalAt !== undefined;
  const faults = d.incidents.filter((i) => !i.fixed),
    leg =
      d.time < 60
        ? "MARS DEPARTURE"
        : d.time < 120
          ? "EARTHBOUND CRUISE"
          : "EARTH APPROACH";
  const meters = [
    ["Hull", d.hull],
    ["O₂", d.oxygen],
    ["Power", d.power],
    ["Heat", d.heat],
  ] as const;
  return `<header class="flight-top" data-hud="flight-route"><div><small>OUTPOST DOWN / THE WAY HOME</small><h1>${arrival ? (d.outcome === "home" ? "EARTH. AT LAST." : "RECOVERY ORBIT") : leg}</h1></div><button data-do="pause" aria-label="Pause flight">Ⅱ</button><div class="flight-route"><span>MARS</span><progress max="${flightDuration}" value="${Math.min(flightDuration, d.time)}" aria-label="Journey to Earth"></progress><span>EARTH</span></div><small class="flight-time">${arrival ? "Crew secured · arrival in progress" : `${Math.max(0, Math.ceil(flightDuration - d.time))}s to arrival · compressed journey`}</small></header>
  <aside class="flight-meters" data-hud="flight-systems">${meters.map(([label, value]) => `<div class="${label === "Heat" ? (value > 70 ? "critical" : "") : value < 35 ? "critical" : ""}"><span>${label}</span><b>${Math.round(value)}${label === "Heat" ? "°" : "%"}</b><progress max="100" value="${value}" aria-label="${label}"></progress></div>`).join("")}</aside>
  ${!arrival ? `<aside class="flight-jobs" data-hud="flight-jobs"><header><b>${faults.length ? "SHIP ALERTS" : "SYSTEMS ONLINE"}</b><span>${d.repaired} repairs</span></header>${faults.length ? faults.map((f) => `<div class="flight-job ${f.late ? "late" : ""}"><span>●</span><div><b>${escape(f.title)}</b><small>${flightStations[f.kind].name} · ${f.late ? "Overdue — repair now" : `${Math.max(0, Math.ceil(f.deadline - d.time))}s`}</small></div></div>`).join("") : `<p>Keep the course centered. Watch for faults.</p>`}<div class="flight-pilot"><b>${d.autopilot > 0 ? `Autopilot hold · ${Math.ceil(d.autopilot)}s` : d.pilot ? `${escape(s.players[d.pilot]?.name || "Pilot")} at helm` : "Helm available"}</b><span>Course error ${Math.round(Math.hypot(d.course.x, d.course.y) * 100)}%</span><span>Guidance ${d.guidance[0] ? "✓" : "○"} departure · ${d.guidance[1] ? "✓" : "○"} entry</span></div><button data-do="flightGuide">Crew plan / controls ↗</button></aside>` : ""}
  ${!arrival ? `<section class="flight-bottom">${station ? `<button class="interaction" data-do="interact"><kbd>E</kbd> ${station === "helm" ? "Take the helm" : `Use ${flightStations[station].name}`}</button>` : ""}<div class="flight-controls"><kbd>WASD</kbd> Walk <span class="flight-look-hint">· Mouse / drag to look</span> <kbd>E</kbd> Use station <kbd>Esc</kbd> Pause</div></section><div id="touch"><div id="joystick"><i></i></div><button data-do="interact" aria-label="Use ship station">E</button></div>` : `<div class="arrival-message">${d.outcome === "home" ? "You kept the crew together. Welcome home." : "The rescue team is approaching. Your crew is safe."}</div>`}`;
}
export function helmPanel(s: Game, id: string) {
  const d = s.returnMission!.flight!.deck!;
  return `<p>Use WASD, arrow keys or the buttons to move the gold marker into the center ring.</p><div class="helm-target"><div class="helm-ring"></div><span id="course-marker" style="left:${50 + d.course.x * 40}%;top:${50 + d.course.y * 40}%"></span><i>COURSE / CENTER TO LOCK</i></div><div class="helm-pad"><button data-steer-x="0" data-steer-y="-1" aria-label="Steer up">↑</button><button data-steer-x="-1" data-steer-y="0" aria-label="Steer left">←</button><button data-steer-x="0" data-steer-y="1" aria-label="Steer down">↓</button><button data-steer-x="1" data-steer-y="0" aria-label="Steer right">→</button></div><p class="helm-owner" id="helm-owner">${d.pilot === id ? "You have control" : d.pilot ? escape(s.players[d.pilot]?.name || "Crewmate") + " has control" : "Requesting helm…"}</p>${Button("HOLD COURSE FOR 30s", "holdCourse")}<p>Center first. Autopilot needs working electrical power. Lock departure guidance now and entry guidance after 120s. Hold course to leave the helm and make repairs.</p><p class="flight-feedback" role="status"></p>`;
}
export function repairPanel(f: FlightIncident) {
  const puzzle =
    f.kind === "power"
      ? `<p>Match all three circuits by color and shape.</p><div class="deck-wires">${[0, 1].map((side) => `<div>${(side ? [2, 0, 1] : [0, 1, 2]).map((i) => `<button data-flight-wire="${i}" data-side="${side}" class="circuit-${i}" aria-label="Circuit ${i + 1} ${side ? "right" : "left"}">${["◆", "●", "▲"][i]} ━</button>`).join("")}</div>`).join("")}</div>`
      : f.kind === "air"
        ? `<p>Reset the air loop in order: isolate → purge → reopen.</p><div class="deck-valves">${["PURGE", "REOPEN", "ISOLATE"].map((t, i) => `<button data-flight-valve="${i}">${t}</button>`).join("")}</div><output id="valve-order">0 / 3 valves</output>`
        : f.kind === "hull"
          ? `<p>Seal all four pressure leaks.</p><div class="deck-leaks">${[0, 1, 2, 3].map((i) => `<button data-flight-patch="${i}" aria-label="Seal leak ${i + 1}">✦</button>`).join("")}</div>`
          : `<p>Set the coolant flow inside the safe band: 35 ± 5.</p><label class="coolant-flow">COOLANT FLOW <output id="coolant-value">70</output><input id="coolant-flow" type="range" min="0" max="100" value="70" aria-label="Coolant flow"></label>`;
  return `<small class="flight-task-eyebrow">${flightStations[f.kind].name.toUpperCase()} / CREW REPAIR</small><h3>${escape(f.title)}</h3>${puzzle}<div class="repair-timing"><span id="repair-seconds">Work for at least 3 seconds</span><span id="fault-deadline"></span></div>${Button("CONFIRM REPAIR", "finishFlightRepair", `data-fault="${f.id}"`)}<p class="flight-feedback" role="status"></p>`;
}
export function flightGuide() {
  return `<div class="flight-guide"><h3>One ship. One crew.</h3><p>Walk through the service corridor to a station and press E. Click the view to capture the mouse, or drag to look around. W follows the direction you face. The journey keeps running while you steer or repair.</p><ul><li><b>Helm · front:</b> center the course marker and lock departure guidance. Lock again during Earth approach (after 120s). A 30-second autopilot hold lets you leave.</li><li><b>Electrical · left corridor:</b> match circuits when power fails.</li><li><b>Life support · aft left:</b> isolate, purge, reopen the valves.</li><li><b>Hull · middle right:</b> seal leaking panels.</li><li><b>Engine · forward left:</b> cool the overheating pump.</li></ul><p>Split the jobs with friends, or use autopilot and do them yourself. Your actions and ship condition decide the ending. Solo pauses only in Pause; co-op keeps going.</p><p>This is a compressed fictional flight, not a real spacecraft simulator.</p></div>`;
}
