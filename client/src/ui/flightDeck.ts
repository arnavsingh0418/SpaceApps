import type { Game } from "../../../shared/src/sim";
import {
  flightStations,
  flightDuration,
  flightEvents,
  landingChance,
  nearestFlightStation,
  type DeckFlight,
  type FailureKind,
  type FlightIncident,
} from "../../../shared/src/flight";
import { flightResearch } from "../../../shared/src/flightResearch";
import { Button, escape } from "./components";
import "./flightDeck.css";

export function flightHUD(s: Game, id: string) {
  const flight = s.returnMission!.flight!,
    d = flight.deck!,
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
    [d.research ? "Air" : "O₂", d.oxygen],
    ["Power", d.power],
    ["Heat", d.heat],
  ] as const;
  return `<header class="flight-top" data-hud="flight-route"><div><small>OUTPOST DOWN / THE WAY HOME</small><h1>${arrival ? (d.outcome === "home" ? "EARTH. AT LAST." : "RECOVERY ORBIT") : leg}</h1></div><button data-do="pause" aria-label="Pause flight">Ⅱ</button><div class="flight-route"><span>MARS</span><progress max="${flightDuration}" value="${Math.min(flightDuration, d.time)}" aria-label="Journey to Earth"></progress><span>EARTH</span></div><small class="flight-time">${arrival ? "Crew secured · arrival in progress" : `${Math.max(0, Math.ceil(flightDuration - d.time))}s to Earth${d.research ? ` · ${landingChance(flight.baseChance, d)}% landing odds if flight-ready` : ""}`}</small></header>
  <aside class="flight-meters" data-hud="flight-systems">${meters.map(([label, value]) => `<div class="${label === "Heat" ? (value > 70 ? "critical" : "") : value < 35 ? "critical" : ""}"><span>${label}</span><b>${Math.round(value)}${label === "Heat" ? "°" : "%"}</b><progress max="100" value="${value}" aria-label="${label}"></progress></div>`).join("")}</aside>
  ${!arrival ? `<aside class="flight-jobs" data-hud="flight-jobs"><header><b>${faults.length ? "SHIP ALERTS" : "SYSTEMS ONLINE"}</b><span>${d.repaired} repairs</span></header>${faults.length ? faults.map((f) => `<div class="flight-job ${f.late ? "late" : ""}"><span>●</span><div><b>${escape(f.title)}</b><small>${flightStations[f.kind].name} · ${f.late ? "Overdue — repair now" : `${Math.max(0, Math.ceil(f.deadline - d.time))}s`}</small></div></div>`).join("") : `<p>Keep the course centered. Watch for faults.</p>`}<div class="flight-pilot"><b>${d.autopilot > 0 ? `Autopilot hold · ${Math.ceil(d.autopilot)}s` : d.pilot ? `${escape(s.players[d.pilot]?.name || "Pilot")} at helm` : "Helm available"}</b><span>Course error ${Math.round(Math.hypot(d.course.x, d.course.y) * 100)}%</span><span>Guidance ${d.guidance[0] ? "✓" : "○"} departure · ${d.guidance[1] ? "✓" : "○"} entry</span><small>${!d.guidance[0] && d.time < 120 ? "Lock departure at the helm before Earth approach." : d.time >= 120 && !d.guidance[1] ? "Earth approach: lock entry guidance at the helm." : ""}</small></div><button data-do="flightGuide">Crew plan / controls ↗</button></aside>` : ""}
  ${!arrival ? `<section class="flight-bottom">${station ? `<button class="interaction" data-do="interact"><kbd>E</kbd> ${station === "helm" ? "Take the helm" : `Use ${flightStations[station].name}`}</button>` : ""}<div class="flight-controls"><kbd>WASD</kbd> Walk <span class="flight-look-hint">· Mouse / drag to look</span> <kbd>E</kbd> Use station <kbd>Esc</kbd> Pause</div></section><div id="touch"><div id="joystick"><i></i></div><button data-do="interact" aria-label="Use ship station">E</button></div>` : `<div class="arrival-message">${d.outcome === "home" ? "You kept the crew together. Welcome home." : "The rescue team is approaching. Your crew is safe."}</div>`}`;
}
export function helmPanel(s: Game, id: string) {
  const d = s.returnMission!.flight!.deck!;
  return `<p>Use WASD, arrow keys or the buttons to move the gold marker into the center ring.</p><div class="helm-target"><div class="helm-ring"></div><span id="course-marker" style="left:${50 + d.course.x * 40}%;top:${50 + d.course.y * 40}%"></span><i>COURSE / CENTER TO LOCK</i></div><div class="helm-pad"><button data-steer-x="0" data-steer-y="-1" aria-label="Steer up">↑</button><button data-steer-x="-1" data-steer-y="0" aria-label="Steer left">←</button><button data-steer-x="0" data-steer-y="1" aria-label="Steer down">↓</button><button data-steer-x="1" data-steer-y="0" aria-label="Steer right">→</button></div><p class="helm-owner" id="helm-owner">${d.pilot === id ? "You have control" : d.pilot ? escape(s.players[d.pilot]?.name || "Crewmate") + " has control" : "Requesting helm…"}</p>${Button("HOLD COURSE FOR 30s", "holdCourse")}<p>Center first. Autopilot needs working electrical power. Lock departure guidance now and entry guidance after 120s. Hold course to leave the helm and make repairs.</p><p class="flight-feedback" role="status"></p>`;
}
export function flightRepairReading(kind: FailureKind, deck: DeckFlight) {
  if (kind === "power") return `Ship power ${Math.round(deck.power)}%`;
  if (kind === "air") return `Crew air ${Math.round(deck.oxygen)}%`;
  if (kind === "hull") return `Hull integrity ${Math.round(deck.hull)}%`;
  return `Ship heat ${Math.round(deck.heat)}°`;
}
export function repairPanel(f: FlightIncident, deck: DeckFlight) {
  const research = f.research ? flightResearch[f.kind] : undefined;
  const quiz = research?.quiz && !f.quizCleared ? research.quiz : undefined;
  const researchCard = research
    ? `<section class="flight-research"><a href="${escape(research.url)}" target="_blank" rel="noopener noreferrer">${escape(research.name)} ↗</a><dl>${research.readings.map(([label, value]) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join("")}</dl><p>${escape(research.note)}</p><details><summary>${escape(research.term)} · ${escape(research.role)}</summary><p>${escape(research.definition)}</p><p>${escape(research.model)}</p></details></section>`
    : "";
  const circuits = ["Main bus", "Guidance", "Life support"];
  const directions = ["Forward left", "Forward right", "Aft left", "Aft right"];
  const scrubberSteps = f.research
    ? ["Fit cartridge", "Latch rack", "Open rack"]
    : ["Purge loop", "Reopen loop", "Isolate loop"];
  const puzzle =
    f.kind === "power"
      ? `<p>Reconnect each supply lead to its labeled return port. Drag a lead across, or select both ends.</p>
        <div class="repair-instrument"><div class="repair-instrument-head"><span>POWER DISTRIBUTION</span><output id="repair-indicator">0 / 3 circuits</output></div>
        <div class="deck-wires"><div>${circuits.map((name, i) => `<button draggable="true" data-flight-wire="${i}" data-side="0" class="circuit-${i}" aria-label="Supply lead: ${name}">${name}<i aria-hidden="true"></i></button>`).join("")}</div>
        <div class="wire-traces" aria-hidden="true">${[0, 1, 2].map((i) => `<span data-wire-trace="${i}" class="circuit-${i}"></span>`).join("")}</div>
        <div>${[2, 0, 1].map(i => `<button data-flight-wire="${i}" data-side="1" class="circuit-${i}" aria-label="Return port: ${circuits[i]}"><i aria-hidden="true"></i>${circuits[i]}</button>`).join("")}</div></div></div>`
      : f.kind === "air"
        ? `<p>${f.research ? "Open the rack, fit the backup cartridge, then latch it to restore airflow." : "Isolate the loop, purge it, then reopen the valve."}</p>
          <div class="repair-instrument"><div class="repair-instrument-head"><span>${f.research ? "CO₂ SCRUBBER" : "AIR LOOP"}</span><output id="repair-indicator">${f.research ? "Rack closed" : "Loop online"}</output></div>
          <div class="scrubber-state" data-scrubber-step="0" aria-hidden="true"><i></i><b></b></div>
          <div class="deck-valves">${scrubberSteps.map((t, i) => `<button data-flight-valve="${i}">${t}</button>`).join("")}</div><output id="valve-order">0 / 3 steps</output></div>`
        : f.kind === "hull"
          ? `<p>${f.research ? "Bring each shield segment onto the backup circuit." : "Seal each of the four pressure leaks."}</p>
            <div class="repair-instrument"><div class="repair-instrument-head"><span>SHIELD SEGMENTS</span><output id="repair-indicator">0 / 4 ready</output></div><div class="deck-leaks">${directions.map((label, i) => `<button data-flight-patch="${i}" aria-pressed="false"><span>${label}</span><small>${f.research ? "Backup offline" : "Pressure leak"}</small></button>`).join("")}</div></div>`
          : `<p>Throttle the backup coolant loop into its operating band.</p><div class="coolant-flow"><div class="repair-instrument-head"><span>COOLANT FLOW</span><output id="coolant-value">70%</output></div><input id="coolant-flow" type="range" min="0" max="100" value="70" aria-label="Coolant flow percentage" aria-describedby="repair-indicator"><div class="coolant-scale"><span>0%</span><span>Backup band 30–40%</span><span>100%</span></div><output id="repair-indicator">Flow too high</output></div>`;
  const controls = quiz
    ? `<section class="repair-instrument diagnostic-console"><div class="repair-instrument-head"><span>DIAGNOSTIC</span><span>CHECK REQUIRED</span></div><p>${escape(quiz.question)}</p><div class="diagnostic-options">${quiz.answers.map((answer, i) => Button(escape(answer), "answerFlightQuiz", `data-fault="${f.id}" data-answer="${i}"`, true)).join("")}</div></section><p class="flight-feedback" role="status"></p>`
    : `${puzzle}${Button("RETURN SYSTEM TO SERVICE", "finishFlightRepair", `data-fault="${f.id}" disabled`)}<p class="flight-feedback" role="status"></p>`;
  return `<small class="flight-task-eyebrow">${flightStations[f.kind].name.toUpperCase()} / CREW REPAIR</small><h3>${escape(f.title)}</h3><div class="repair-timing"><span id="repair-seconds">Work for at least 3 seconds</span><span id="fault-deadline"></span><span id="repair-arrival"></span></div><p class="flight-reading"><b id="flight-repair-reading">${flightRepairReading(f.kind, deck)}</b><small>Live game reading</small></p>${researchCard}${controls}`;
}
export function flightGuide() {
  return `<div class="flight-guide"><h3>Get the crew home</h3><p>Walk to a station and press E. Click the view or drag to look around. The three-minute journey keeps running while you steer or repair.</p><ul><li><b>Helm · front</b> — Center the marker and lock departure guidance. Lock it again after 120 seconds for Earth entry.</li><li><b>Electrical · left corridor</b> — Check the flare log and reconnect the supply leads.</li><li><b>Life support · aft left</b> — Read CO₂ levels and swap the scrubber.</li><li><b>Hull · middle right</b> — Activate the backup shield panels.</li><li><b>Engine · forward left</b> — Move the coolant slider into the backup band.</li></ul><p>Expect up to ${flightEvents.length} alerts. Rarer installed parts and on-time repairs improve the game's landing odds. Missed alerts lower them. A ship that arrives without safe systems or both guidance locks goes to rescue orbit.</p><p>Split jobs with friends, or lock autopilot before leaving the helm. Solo pauses only in Pause. Co-op keeps going.</p></div>`;
}
