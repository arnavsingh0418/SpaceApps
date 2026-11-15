import { crewPortrait } from "./modelArt";
import type { Game } from "../../../shared/src/sim";
import {
  fastAnswerSeconds,
  flightChance,
  flightTasks,
  partNames,
  partSlots,
  quizSeconds,
  returnProgress,
  salvageSites,
} from "../../../shared/src/returnMission";
import { startingFlightPower, startingHull } from "../../../shared/src/flight";
import { flightResearch } from "../../../shared/src/flightResearch";
import { Button, escape } from "./components";
import { countdown, quizQuestion } from "./quiz";
import { partArt, partReward } from "./shipParts";
import { partDetails } from "../../../shared/src/shipRewards";
import "./alien.css";

export function salvageScreen(s: Game, siteId: string) {
  const site = salvageSites.find((cache) => cache.id === siteId)!;
  const run = returnProgress(s).caches[site.id];
  if (run?.reward) {
    return `${partReward(site.part, run.reward)}<p>+${run.points} crew points</p>${Button("PIN RETURN SHIP", "trackSalvage", 'data-site="return"')}${Button("KEEP EXPLORING", "leaveSalvage")}`;
  }
  if (!run || s.elapsed >= run.deadline) {
    return `<p>Recover a ${partNames[site.part].toLowerCase()} by answering two questions. Each has a ${quizSeconds}-second timer. Correct answers in the first ${fastAnswerSeconds} seconds improve the part's rarity.</p><p>Fast on both earns Prototype. Fast on one earns Rare. Finish both in time for Standard.</p>${Button(run ? "RETRY CACHE" : "START QUIZ", "startSalvage", `data-site="${site.id}"`)}<p class="quiz-feedback" role="status">${run ? "Time ran out. Try a fresh run." : ""}</p>`;
  }
  const quiz = site.questions[run.step];
  return `<div class="return-meta">QUESTION ${run.step + 1} / ${site.questions.length} <span>${run.points} POINTS</span></div>${quizQuestion(
    quiz.question,
    quiz.answers.map((text, index) => ({ text, index })),
    { site: site.id, step: run.step },
  )}`;
}

export function hangar(s: Game, id: string) {
  const progress = returnProgress(s);
  const ready = partSlots.every((slot) => progress.installed[slot]);
  const upgrade = partSlots.some(
    (slot) =>
      progress.recovered[slot] &&
      progress.recovered[slot] !== progress.installed[slot],
  );
  return `<div class="ship-overview"><b>CRASHED SHIP / REPAIRS</b><span>${Object.values(progress.installed).length} / 4 REPAIRED</span></div><progress class="ship-progress" max="4" value="${Object.values(progress.installed).length}" aria-label="Ship systems repaired"></progress><p class="ship-hint">${ready ? "All four systems online. After launch, head to the helm and lock departure guidance." : "Recover hardware through field tasks, salvage or Nemi's repair. Install each replacement here."}</p>
    <div class="ship-part-roster">${partSlots
      .map((slot) => {
        const installed = progress.installed[slot],
          recovered = progress.recovered[slot],
          details = partDetails[slot];
        return `<article class="ship-part-card ${installed ? "installed" : ""}">${partArt(slot, installed ? "installed" : recovered ? "available" : "damaged")}<div><h3>${partNames[slot]}</h3><small>${installed ? installed + " installed" : recovered ? recovered + " ready to fit" : details.fault}</small><p>${installed ? "System online" : recovered ? details.description : details.task}</p>${recovered && recovered !== installed ? Button(installed ? "UPGRADE PART" : "INSTALL PART", "installPart", `data-part="${slot}"`) : !recovered ? Button("FIND REPLACEMENT", slot === "nav" ? "trackSalvage" : "trackMission", slot === "nav" ? 'data-site="nemi"' : `data-mission="${details.mission}"`, true) : ""}</div></article>`;
      })
      .join(
        "",
    )}</div><p class="ship-hint">${Math.round(startingHull(s))}% starting hull · ${Math.round(startingFlightPower(s))}% launch battery. Build and clean solar panels to charge the ship before launch.</p>
    ${ready ? (id === s.host ? Button(upgrade ? "LAUNCH WITH CURRENT PARTS" : "LAUNCH FOR EARTH", "launchShip") : "<p>The crew leader starts the flight.</p>") : Button("VIEW REPAIR MAP", "map", "", true)}
    <p class="quiz-feedback" role="status"></p>`;
}

export function flightScreen(s: Game) {
  const flight = returnProgress(s).flight!;
  const task = flightTasks[flight.stage];
  const previous = flight.passed.at(-1);
  return `<div class="return-meta">FLIGHT STAGE ${flight.stage + 1} / ${flightTasks.length} <span>${flightChance(flight.baseChance, flight.passed)}% CURRENT ODDS</span></div>
    ${previous === undefined ? "" : `<div class="flight-readout">${previous ? "Last task passed · +4 percentage points" : "Last task missed · −9 percentage points"}</div>`}
    <p>${task.instruction}</p>
    ${
      task.control === "quiz"
        ? quizQuestion(
            task.quiz.question,
            task.quiz.answers.map((text, index) => ({ text, index })),
            { flight: flight.stage },
          )
        : `${countdown()}<div class="flight-trim"><label for="flight-trim">Target trim <b>${task.target}%</b> <span>±5%</span></label><input id="flight-trim" type="range" min="0" max="100" value="50" aria-label="Flight trim"><output id="flight-trim-value" for="flight-trim">50%</output></div>${Button("CONFIRM TRIM", "flightTask", `data-step="${flight.stage}"`)}<p class="quiz-feedback" role="status"></p>`
    }`;
}

export function returnReport(s: Game, id: string) {
  const progress = returnProgress(s);
  const flight = progress.flight;
  const crew = `<div class="return-crew">${Object.values(s.players)
    .map(
      (p) =>
        `<figure>${crewPortrait(p.role)}<figcaption>${escape(p.name)}</figcaption></figure>`,
    )
    .join("")}</div>`;
  if (flight?.deck) {
    const d = flight.deck;
    const odds = flight.chance === undefined ? "" : flight.roll === undefined
      ? "<p>Landing readiness was lost. The capsule entered recovery orbit.</p>"
      : `<p>Final landing odds <b>${flight.chance}%</b> · Flight roll ${flight.roll.toFixed(2)} / 100</p>`;
    const sources = d.incidents.filter((fault) => fault.research).map(({ kind }) => flightResearch[kind]);
    return `${crew}<div class="return-result"><p>${escape(s.result)}</p><p><b>${d.repaired} systems repaired</b> · ${d.missed} escalations · guidance ${d.guidance.filter(Boolean).length}/2</p><p>Hull ${Math.round(d.hull)}% · ${d.research ? "Air" : "Oxygen"} ${Math.round(d.oxygen)}% · ${progress.points} crew points</p>${odds}${sources.length ? `<details><summary>NASA flight references</summary><ul>${sources.map((source) => `<li><a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">${escape(source.name)} ↗</a></li>`).join("")}</ul></details>` : ""}</div>`;
  }
  return `${crew}<div class="return-result"><p>${escape(s.result)}</p><p><b>${progress.points} crew points</b> · ${progress.crewPoints[id] ?? 0} contributed by you</p>${flight?.chance === undefined ? "" : `<p>Final success chance <b>${flight.chance}%</b> · Flight tasks passed <b>${flight.passed.filter(Boolean).length} / ${flightTasks.length}</b></p><p>${partSlots.map((slot) => `${progress.installed[slot]} ${partNames[slot].toLowerCase()}`).join(" · ")}</p>`}</div>`;
}
