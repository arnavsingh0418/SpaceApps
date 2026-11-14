import type { Game } from "../../../shared/src/sim";
import {
  fastAnswerSeconds, flightChance, flightTasks, partNames, partSlots, quizSeconds, returnChance, returnProgress, salvageSites,
} from "../../../shared/src/returnMission";
import { Button, escape } from "./components";
import { countdown, quizQuestion } from "./quiz";

export function salvageScreen(s: Game, siteId: string) {
  const site = salvageSites.find((cache) => cache.id === siteId)!;
  const run = returnProgress(s).caches[site.id];
  if (run?.reward) {
    return `<div class="return-result"><small>PART RECOVERED · +${run.points} POINTS</small><h3>${run.reward} ${partNames[site.part]}</h3><p>Shared with the crew. Install it at the return platform.</p></div>${Button("KEEP EXPLORING", "leaveSalvage")}`;
  }
  if (!run || s.elapsed >= run.deadline) {
    return `<p>Recover a ${partNames[site.part].toLowerCase()} by answering two questions. Each has a ${quizSeconds}-second timer. Correct answers in the first ${fastAnswerSeconds} seconds improve the part's rarity.</p><p>Fast on both earns Prototype. Fast on one earns Rare. Finish both in time for Standard.</p>${Button(run ? "RETRY CACHE" : "START QUIZ", "startSalvage", `data-site="${site.id}"`)}<p class="quiz-feedback" role="status">${run ? "Time ran out. Try a fresh run." : ""}</p>`;
  }
  const quiz = site.questions[run.step];
  return `<div class="return-meta">QUESTION ${run.step + 1} / ${site.questions.length} <span>${run.points} POINTS</span></div>${quizQuestion(quiz.question, quiz.answers.map((text, index) => ({ text, index })), { site: site.id, step: run.step })}`;
}

export function hangar(s: Game, id: string) {
  const progress = returnProgress(s);
  const ready = partSlots.every((slot) => progress.installed[slot]);
  const upgrade = partSlots.some((slot) => progress.recovered[slot] && progress.recovered[slot] !== progress.installed[slot]);
  return `<div class="return-meta">${Object.values(progress.installed).length} / ${partSlots.length} INSTALLED <span>${returnChance(s)}% BASE CHANCE</span></div><p>Install parts recovered from the marked salvage caches. Better hardware, a working outpost, and flight tasks improve your odds.</p>
    <div class="ship-parts">${partSlots.map((slot) => {
      const installed = progress.installed[slot], recovered = progress.recovered[slot];
      return `<div class="ship-part"><div><b>${partNames[slot]}</b><small>${installed ? `${installed} installed` : "Empty"}${recovered && recovered !== installed ? ` · ${recovered} available` : ""}</small></div>${recovered && recovered !== installed ? Button(installed ? "UPGRADE" : "INSTALL", "installPart", `data-part="${slot}"`) : ""}</div>`;
    }).join("")}</div>
    ${ready ? id === s.host ? Button(upgrade ? "LAUNCH WITH CURRENT PARTS" : "LAUNCH FOR EARTH", "launchShip") : "<p>The crew leader starts the flight.</p>" : Button("VIEW SALVAGE MAP", "map", "", true)}
    <p class="quiz-feedback" role="status"></p>`;
}

export function flightScreen(s: Game) {
  const flight = returnProgress(s).flight!;
  const task = flightTasks[flight.stage];
  const previous = flight.passed.at(-1);
  return `<div class="return-meta">FLIGHT STAGE ${flight.stage + 1} / ${flightTasks.length} <span>${flightChance(flight.baseChance, flight.passed)}% CURRENT ODDS</span></div>
    ${previous === undefined ? "" : `<div class="flight-readout">${previous ? "Last task passed · +4 percentage points" : "Last task missed · −9 percentage points"}</div>`}
    <p>${task.instruction}</p>
    ${task.control === "quiz"
      ? quizQuestion(task.quiz.question, task.quiz.answers.map((text, index) => ({ text, index })), { flight: flight.stage })
      : `${countdown()}<div class="flight-trim"><label for="flight-trim">Target trim <b>${task.target}%</b> <span>±5%</span></label><input id="flight-trim" type="range" min="0" max="100" value="50" aria-label="Flight trim"><output id="flight-trim-value" for="flight-trim">50%</output></div>${Button("CONFIRM TRIM", "flightTask", `data-step="${flight.stage}"`)}<p class="quiz-feedback" role="status"></p>`}`;
}

export function returnReport(s: Game, id: string) {
  const progress = returnProgress(s);
  const flight = progress.flight;
  return `<div class="return-result"><p>${escape(s.result)}</p><p><b>${progress.points} crew points</b> · ${progress.crewPoints[id] ?? 0} contributed by you</p>${flight?.chance === undefined ? "" : `<p>Final success chance <b>${flight.chance}%</b> · Flight tasks passed <b>${flight.passed.filter(Boolean).length} / ${flightTasks.length}</b></p><p>${partSlots.map((slot) => `${progress.installed[slot]} ${partNames[slot].toLowerCase()}`).join(" · ")}</p>`}</div>`;
}
