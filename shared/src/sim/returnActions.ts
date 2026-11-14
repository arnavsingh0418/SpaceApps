import { B, distance, log, random, stations, facts, type Action, type Game } from "./index";
import { fieldMissions, fieldProgress, missionAvailable, missionSector } from "../expedition";
import {
  awardPoints, fastAnswerSeconds, flightChance, flightTasks, installedCount, launchSite, lessonTimerKey, partNames,
  partSlots, quizPoints, quizSeconds, rarities, returnChance, returnProgress,
  salvageSites, type Part,
} from "../returnMission";

export function scoreLesson(s: Game, id: string, kind: string, quiz: string) {
  const progress = s.returnMission ??= returnProgress(s);
  const key = lessonTimerKey(id, kind, quiz);
  const deadline = progress.lessonTimers[key];
  awardPoints(progress, id, quizPoints(deadline === undefined ? 0 : deadline - s.elapsed));
  for (const timer of Object.keys(progress.lessonTimers))
    if (timer.endsWith(`/${kind}/${quiz}`)) delete progress.lessonTimers[timer];
}

function finishFlightStage(s: Game, passed: boolean, id?: string) {
  const flight = s.returnMission!.flight!;
  flight.passed.push(passed);
  if (passed && id) awardPoints(s.returnMission!, id, 150);
  flight.stage++;
  if (flight.stage < flightTasks.length) {
    flight.deadline += quizSeconds;
    return;
  }
  flight.chance = flightChance(flight.baseChance, flight.passed);
  flight.roll = random(s) * 100;
  s.phase = "ended";
  s.result = flight.roll < flight.chance
    ? "Mission complete! Your ship brought the crew home to Earth."
    : "The capsule missed its safe entry corridor. A rescue crew recovered the team in orbit.";
}

export function updateFlight(s: Game) {
  const flight = s.returnMission?.flight;
  if (!flight) return;
  while (s.phase === "flight" && s.elapsed >= flight.deadline) finishFlightStage(s, false);
}

export function returnAction(s: Game, id: string, a: Action): string | undefined {
  const p = s.players[id];
  const progress = s.returnMission ??= returnProgress(s);
  if (a.type === "flightTask") {
    const flight = progress.flight;
    if (s.phase !== "flight" || !flight || flight.stage !== a.step)
      return "That flight task has already ended.";
    if (s.elapsed >= flight.deadline) return "That flight task timed out.";
    const task = flightTasks[flight.stage];
    const value = a.value;
    if (typeof value !== "number" || !Number.isInteger(value)) return "Choose a valid setting.";
    if (task.control === "quiz" && (value < 0 || value >= task.quiz.answers.length))
      return "Choose a valid answer.";
    if (task.control === "trim" && (value < 0 || value > 100)) return "Choose a valid trim.";
    flight.deadline = s.elapsed;
    finishFlightStage(s, task.control === "trim" ? Math.abs(value - task.target) <= 5 : value === task.quiz.correct, id);
    return;
  }
  if (s.phase !== "day") return "Wait until exploration time.";
  if (a.type === "startLessonQuiz") {
    const quiz = String(a.quiz);
    if (a.kind === "beacon") {
      if (s.learned.includes(quiz)) return;
      if (!facts.some((f) => f.id === quiz) || distance(p, stations[quiz as keyof typeof stations]) > B.interactRadius)
        return "Move closer to the science beacon.";
    } else if (a.kind === "field") {
      const mission = fieldMissions.find((m) => m.id === quiz);
      if (!mission || !missionAvailable(s, mission) || !fieldProgress(s).surveyed.includes(quiz) ||
          distance(p, missionSector(mission)) > B.interactRadius)
        return "Collect the instrument readings first.";
    } else return "Unknown lesson.";
    const key = lessonTimerKey(id, a.kind, quiz);
    progress.lessonTimers[key] ??= s.elapsed + quizSeconds;
    return;
  }
  if (a.type === "installPart" || a.type === "launchShip") {
    if (distance(p, launchSite) > B.interactRadius) return "Go to the return platform.";
    if (a.type === "installPart") {
      if (!partSlots.includes(a.part as Part)) return "Choose a ship system.";
      const slot = a.part as Part;
      const recovered = progress.recovered[slot];
      if (!recovered) return "Recover that component from a salvage cache first.";
      progress.installed[slot] = recovered;
      return;
    }
    if (s.host !== id) return "The crew leader launches the ship.";
    if (installedCount(s) !== partSlots.length) return "Install all four ship systems first.";
    progress.flight = { stage: 0, deadline: s.elapsed + quizSeconds, passed: [], baseChance: returnChance(s) };
    for (const player of Object.values(s.players)) player.move = { x: 0, z: 0 };
    s.phase = "flight";
    return;
  }

  const site = salvageSites.find((cache) => cache.id === a.site);
  if (!site || distance(p, site) > B.interactRadius) return "Move closer to the salvage cache.";
  let run = progress.caches[site.id];
  if (a.type === "startSalvage") {
    if (run?.reward) return "This cache has already been recovered.";
    if (!run || s.elapsed >= run.deadline)
      progress.caches[site.id] = { step: 0, deadline: s.elapsed + quizSeconds, fast: 0, points: 0, contributions: {} };
    return;
  }
  if (!run || run.reward || s.elapsed >= run.deadline) return "Start a fresh cache run.";
  if (a.step !== run.step) return "The crew has already moved to the next question.";
  const quiz = site.questions[run.step];
  if (!Number.isInteger(a.answer) || Number(a.answer) < 0 || Number(a.answer) >= quiz.answers.length)
    return "Choose a valid answer.";
  if (a.answer !== quiz.correct) {
    run.feedback = "Try again. The clock is still running.";
    return;
  }
  const remaining = run.deadline - s.elapsed;
  run.fast += remaining >= quizSeconds - fastAnswerSeconds ? 1 : 0;
  const points = quizPoints(remaining);
  run.points += points;
  run.contributions[id] = (run.contributions[id] ?? 0) + points;
  run.step++;
  delete run.feedback;
  if (run.step < site.questions.length) {
    run.deadline = s.elapsed + quizSeconds;
    return;
  }
  run.reward = rarities[run.fast];
  for (const [player, score] of Object.entries(run.contributions)) awardPoints(progress, player, score);
  const previous = progress.recovered[site.part];
  if (!previous || rarities.indexOf(run.reward) > rarities.indexOf(previous))
    progress.recovered[site.part] = run.reward;
  log(s, `SALVAGE: ${run.reward} ${partNames[site.part]} recovered.`);
}
