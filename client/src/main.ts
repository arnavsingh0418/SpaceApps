import { shipMoveInput } from "../../shared/src/flightLayout";
import { HAB_LAYOUT, habBlocked, moveInHab, nearestHabStation, habRoom, habSpeed } from "../../shared/src/hab";
import { habDirectory, habEquipment } from "./ui/hab";
import { RoverController } from "./render/roverController";
import { ROVER, roverState, roverSeat, roverExits, roverBlocks } from "../../shared/src/rover";
import {
  flightHUD,
  helmPanel,
  repairPanel,
  flightGuide,
} from "./ui/flightDeck";
import { equippedItem } from "../../shared/src/inventory";
import { movePastPlayers } from "../../shared/src/playerCollision";
import {
  flightStations,
  flightDuration,
  nearestFlightStation,
  type FlightStation,
} from "../../shared/src/flight";
let helmPad = { x: 0, y: 0 };
let helmPointer: number | null = null;
let deckRepair: {
  fault: string;
  kind: string;
  wires: Set<number>;
  left: number | null;
  valves: number[];
  patches: Set<number>;
} | null = null;
let deckSentAt = -1;
let lastShipAlert = 0,
  lastShipRepair = 0;
import { Sfx } from "./ui/sound";
import { AlienVoice } from "./ui/alienVoice";
import { alienScreen, alienBrush } from "./ui/alien";
import {
  alienSite,
  alienRoverSite,
  alienProgress,
  alienLine,
  alienLines,
  type AlienLine,
} from "../../shared/src/alien";
import "@fontsource/barlow-condensed/latin-800.css";
import "@fontsource/nunito-sans/latin-700.css";
import "@fontsource/nunito-sans/latin-800.css";
import "./style.css";
import { World } from "./render/world";
import { LocalController } from "./render/controller";
import { Arrival } from "./render/arrival";
import { missionBriefing, fieldManual } from "./ui/briefing";
import { expeditionMap, fieldStation, fieldDebrief } from "./ui/expedition";
import {
  fieldMissions,
  fieldProgress,
  missionAvailable,
  missionSector,
  nextFieldMission,
  sectors,
  solarRewardSite,
} from "../../shared/src/expedition";
import {
  flightTasks,
  launchSite,
  lessonTimerKey,
  returnProgress,
  salvageSites,
  shipTarget,
} from "../../shared/src/returnMission";
import { CrewConnection } from "./net/crew";
import {
  createGame,
  placeBatteryByAntenna,
  removeStarterPanels,
  startingAllocation,
  addPlayer,
  dispatch,
  tick,
  stations,
  distance,
  B,
  recipes,
  facts,
  budget,
  total,
  type Game,
  type Action,
  itemNames,
  type Item,
  type Allocation,
} from "../../shared/src/sim";
import { Modal, Button, validateCopy, escape } from "./ui/components";
import { hud, type HudView } from "./ui/hud";
import { powerPlan, powerKeys } from "./ui/powerPlan";
import { flareCard, report } from "./ui/events";
import { toast, tickToast } from "./ui/toasts";
import * as screens from "./ui/modals";
import { salvageScreen, hangar, flightScreen } from "./ui/returnMission";
import "./ui/quiz.css";
const $ = (q: string) => document.querySelector<HTMLElement>(q)!;
const ui = $("#ui"),
  root = $("#modal-root");
const crewBadge = document.createElement("button");
crewBadge.id = "crew-invite";
crewBadge.dataset.do = "copyCrewCode";
crewBadge.hidden = true;
document.body.append(crewBadge);
function syncCrewBadge() {
  crewBadge.hidden = !started || !connection;
  if (connection) {
    crewBadge.textContent = `CREW ${connection.room} · COPY`;
    crewBadge.setAttribute("aria-label", `Copy crew code ${connection.room}`);
  }
}
let game = createGame(42),
  id = "solo",
  started = false,
  introPlaying = false,
  connection: CrewConnection | null = null,
  phase = "",
  modal = "",
  selected = 0,
  muted = true,
  saved: Game | null = null,
  draft: Allocation = { ...startingAllocation };
let arrival: Arrival | null = null;
let wasBlown = false;
let crewConnecting = false;
let trackedMission = "",
  selectedMission = "";
let activeCache = "",
  activeLesson = "",
  missionPanelState = "";
let trackedSalvage = "";
let gaugeFrom = { power: B.batteryPower, air: 85, food: 95, dose: 0 },
  gaugeUntil = 0;
let tutorial = 4,
  goalsOpen = false,
  chatOpen = false,
  recipeIndex = 0,
  sourceIndex = 0,
  unread = 0,
  lastMessages = 0,
  pickupUntil = 0,
  previous = { power: B.batteryPower, air: 85, food: 95, dose: 0 },
  reportBefore = { ...previous },
  hudSignature = "",
  lastEvent = "",
  firstPlan = true;
const world = new World();
const previewScene = import.meta.env.DEV
  ? new URL(location.href).searchParams.get("qaScene")
  : null;
const soloSaveKey = previewScene === "flight-approach"
  ? "outpost-preview-flight-approach-v1"
  : previewScene === "ship-launch"
    ? "outpost-preview-ship-launch-v1"
    : "outpost-save-v1";
if (import.meta.env.DEV)
  (window as unknown as { __world: World }).__world = world; // dev-only debugging hook
addPlayer(game, id, "Explorer");
try {
  const v = JSON.parse(localStorage.getItem(soloSaveKey) || "null");
  if (
    v?.version === 1 &&
    v.game?.players?.solo &&
    ["power", "day", "summary", "flight"].includes(v.game.phase)
  ) {
    saved = v.game;
    placeBatteryByAntenna(v.game);
    removeStarterPanels(v.game);
  }
} catch {}
function cue(kind: string, target?: string) {
  dispatchEvent(
    new CustomEvent("game-effect", { detail: { kind, target, id } }),
  );
  sound(kind);
}
const sfx = new Sfx();
const alienVoice = new AlienVoice(sfx);
let alienScreenCompleted = false;
let alienPatches = new Set<number>();
let volume = 35,
  explicitMute = false;
try {
  volume = Number(localStorage.getItem("outpost-volume") || 35);
  explicitMute = localStorage.getItem("outpost-muted") !== null;
  muted = localStorage.getItem("outpost-muted") !== "false";
} catch {}
sfx.muted = muted;
sfx.volume = volume / 100;
const unlockSound = () => {
  if (!explicitMute) muted = false;
  sfx.muted = muted;
  sfx.sync();
  void sfx.unlock();
};
document.addEventListener("pointerdown", unlockSound, { once: true });
document.addEventListener("keydown", unlockSound, { once: true });
addEventListener("footstep", () => sound("step"));
function sound(kind = "click") {
  if (kind !== "build") sfx.play(kind);
}
document.addEventListener("input", (event) => {
  const coolant = event.target as HTMLInputElement;
  if (coolant.id === "coolant-flow")
    updateRepairConsole();
  const el = event.target as HTMLInputElement;
  if (el.id === "field-dial") {
    const signal = Math.max(
      0,
      100 - Math.abs(Number(el.value) - Number(el.dataset.target)),
    );
    document.querySelector("#field-signal")!.textContent = `${signal}%`;
    (document.querySelector("#field-meter") as HTMLElement).style.width =
      `${signal}%`;
  }
  if (el.id === "flight-trim")
    $("#flight-trim-value").textContent = `${el.value}%`;
  if (el.id === "master-volume") {
    volume = Number(el.value);
    sfx.volume = volume / 100;
    sfx.sync();
    try {
      localStorage.setItem("outpost-volume", String(volume));
    } catch {}
  }
});

function act(a: Action) {
  if (connection) {
    connection.send(a);
    return true;
  }
  const err = dispatch(game, id, a);
  if (err) {
    toast(err);
    return false;
  }
  return true;
}
function selectInventorySlot(slot: number) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= 5) return;
  selected = slot;
  if (game.players[id]) game.players[id].selectedSlot = slot;
  if (started) act({ type: "selectSlot", slot });
  hudSignature = "";
}
function open(
  kind: string,
  title: string,
  body: string,
  closable = true,
  cls = "",
) {
  if (modal === "helm" && kind !== "helm") act({ type: "releaseHelm" });
  if (kind !== "alien" && kind !== "alienBrush") alienVoice.stop();
  world.focus =
    kind === "alien" || kind === "alienBrush"
      ? "alien"
      : kind === "hangar"
        ? "ship"
        : null;
  const alreadyOpen = modal === kind;
  modal = kind;
  stopInput();
  world.releaseMouse();
  ui.inert = true;
  act({ type: "move", x: 0, z: 0 });
  root.innerHTML = Modal(title, body, closable, cls);
  if (alreadyOpen) {
    const panel = root.querySelector<HTMLElement>(".modal");
    if (panel) panel.style.animation = "none";
  }
  root
    .querySelector<HTMLElement>('button:not([data-do="close"]),input')
    ?.focus();
  validateCopy(root);
}
function close() {
  if (modal === "helm" && game.returnMission?.flight?.deck?.arrivalAt === undefined)
    act({ type: "releaseHelm" });
  alienVoice.stop();
  world.focus = null;
  stopInput();
  ui.inert = false;
  modal = "";
  missionPanelState = "";
  root.innerHTML = "";
  hudSignature = "";
}

function interactDeck() {
  const d = game.returnMission?.flight?.deck;
  if (!d || d.arrivalAt !== undefined) return;
  const key = nearestFlightStation(game.players[id]);
  if (!key) {
    toast("Walk closer to a ship station.");
    return;
  }
  if (key === "helm") {
    if (!act({ type: "takeHelm" })) return;
    open("helm", "STEER THE SHIP", helmPanel(game, id), true, "deck-modal");
    return;
  }
  const fault = d.incidents.find((f) => f.kind === key && !f.fixed);
  if (!fault) {
    toast(`${flightStations[key].name}: system online`);
    return;
  }
  if (!act({ type: "beginFlightRepair", fault: fault.id })) return;
  deckRepair = {
    fault: fault.id,
    kind: key,
    wires: new Set(),
    left: null,
    valves: [],
    patches: new Set(),
  };
  open(
    "flightRepair",
    "REPAIR STATION",
    repairPanel(fault),
    true,
    "deck-modal",
  );
}
function updateRepairConsole() {
  if (!deckRepair) return;
  const repair = deckRepair;
  const indicator = root.querySelector<HTMLOutputElement>("#repair-indicator");
  const submit = root.querySelector<HTMLButtonElement>('[data-do="finishFlightRepair"]');
  if (!indicator || !submit) return;
  let ready = false;
  if (repair.kind === "power") {
    ready = repair.wires.size === 3;
    indicator.textContent = ready ? "All circuits connected" : `${repair.wires.size} / 3 circuits`;
  } else if (repair.kind === "air") {
    ready = repair.valves.length === 3;
    const scrubber = root.querySelector<HTMLElement>(".scrubber-state");
    if (scrubber) scrubber.dataset.scrubberStep = String(repair.valves.length);
    const incident = game.returnMission?.flight?.deck?.incidents.find((fault) => fault.id === repair.fault);
    indicator.textContent = (incident?.research
      ? ["Rack closed", "Rack open", "Cartridge seated", "Rack sealed · airflow ready"]
      : ["Loop online", "Loop isolated", "Loop purged", "Flow restored"])[repair.valves.length];
    const count = root.querySelector("#valve-order");
    if (count) count.textContent = `${repair.valves.length} / 3 steps`;
  } else if (repair.kind === "hull") {
    ready = repair.patches.size === 4;
    indicator.textContent = ready ? "Shield ready" : `${repair.patches.size} / 4 ready`;
  } else {
    const flow = Number(root.querySelector<HTMLInputElement>("#coolant-flow")?.value);
    ready = flow >= 30 && flow <= 40;
    indicator.textContent = ready ? "Backup flow stable" : flow < 30 ? "Flow too low" : "Flow too high";
    const value = root.querySelector("#coolant-value");
    if (value) value.textContent = `${flow}%`;
  }
  indicator.classList.toggle("stable", ready);
  const begin = game.players[id]?.task?.at ?? game.elapsed;
  submit.disabled = !ready || game.elapsed - begin < 3;
}
function finishDeckRepair() {
  if (!deckRepair) return;
  const r = deckRepair,
    value =
      r.kind === "power"
        ? Array.from(r.wires).sort().join(",")
        : r.kind === "air"
          ? r.valves.join(",")
          : r.kind === "hull"
            ? Array.from(r.patches).sort().join(",")
            : Number(
                root.querySelector<HTMLInputElement>("#coolant-flow")?.value,
              );
  dispatchMission({ type: "finishFlightRepair", fault: r.fault, value });
}
function drawDeck() {
  syncCrewBadge();
  if (phase !== game.phase) {
    deckSentAt = -1;
    phase = game.phase;
    close();
    if (phase === "ended") {
      open("ended", "", screens.endScreen(game, id), false);
      root.querySelector("h2")?.remove();
      root.querySelector(".modal")?.classList.add("fullscreen");
      saved = null;
      try {
        localStorage.removeItem(soloSaveKey);
      } catch {}
    }
  }
  if (joyPointer === null) ui.innerHTML = flightHUD(game, id);
  const d = game.returnMission!.flight!.deck!;
  if (d.arrivalAt !== undefined && ["helm", "flightRepair", "flightGuide"].includes(modal)) {
    deckRepair = null;
    close();
  }
  if (modal === "helm") {
    const marker = root.querySelector<HTMLElement>("#course-marker");
    if (marker) {
      marker.style.left = `${50 + d.course.x * 40}%`;
      marker.style.top = `${50 + d.course.y * 40}%`;
    }
    const owner = root.querySelector("#helm-owner");
    if (owner)
      owner.textContent =
        d.pilot === id
          ? d.autopilot > 0
            ? `Autopilot hold: ${Math.ceil(d.autopilot)}s`
            : "You have control"
          : d.pilot
            ? `${game.players[d.pilot]?.name || "Crewmate"} has control`
            : "Helm available — close and reopen to take control";
  }
  if (modal === "flightRepair" && deckRepair) {
    const fault = d.incidents.find((f) => f.id === deckRepair!.fault);
    if (!fault || fault.fixed) {
      close();
      deckRepair = null;
      toast("Repair complete. Crew systems updated.");
      return;
    }
    if (fault.quizCleared && root.querySelector('[data-do="answerFlightQuiz"]'))
      open("flightRepair", "REPAIR STATION", repairPanel(fault), true, "deck-modal");
    const seconds = root.querySelector("#repair-seconds");
    if (seconds)
      seconds.textContent = `${Math.max(0, Math.ceil(3 - (game.elapsed - (game.players[id].task?.at ?? game.elapsed))))}s minimum work remaining`;
    const timer = root.querySelector("#fault-deadline");
    if (timer)
      timer.textContent = fault.late
        ? "Overdue — repair now"
        : `${Math.max(0, Math.ceil(fault.deadline - d.time))}s to escalation`;
    const arrival = root.querySelector("#repair-arrival");
    if (arrival) arrival.textContent = `${Math.max(0, Math.ceil(flightDuration - d.time))}s to Earth`;
    updateRepairConsole();
  }
}
function updateDeck(dt: number, render: boolean) {
  if (!game.returnMission?.flight?.deck && game.phase === "flight")
    tick(game, 0.0001);
  const d = game.returnMission!.flight!.deck!;
  if (!world.firstPerson) {
    world.yaw = 0;
    world.pitch = 0.03;
    world.releaseMouse();
  }
  world.lookAllowed = () => started && !modal && !document.hidden &&
    game.phase === "flight" && d.arrivalAt === undefined;
  const x =
    (keys.has("d") || keys.has("arrowright") ? 1 : 0) -
    (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
  const z =
    (keys.has("s") || keys.has("arrowdown") ? 1 : 0) -
    (keys.has("w") || keys.has("arrowup") ? 1 : 0);
  if (
    game.phase === "flight" &&
    !document.hidden &&
    d.arrivalAt === undefined &&
    game.elapsed - deckSentAt >= 0.08
  ) {
    if (modal === "helm" && d.pilot === id)
      act({
        type: "flightSteer",
        x: Math.max(-1, Math.min(1, x + helmPad.x)),
        y: Math.max(-1, Math.min(1, z + helmPad.y)),
      });
    const move = shipMoveInput(x + joy.x, z + joy.z, world.yaw);
    act({ type: "flightMove", x: modal ? 0 : move.x, z: modal ? 0 : move.z });
    deckSentAt = game.elapsed;
  }
  fixed += dt;
  while (fixed >= 0.1) {
    if (
      !connection &&
      !document.hidden &&
      modal !== "pause" &&
      game.phase === "flight"
    )
      tick(game, 0.1);
    fixed -= 0.1;
  }
  if (d.nextEvent !== lastShipAlert) {
    if (d.nextEvent > lastShipAlert) sound("flare");
    lastShipAlert = d.nextEvent;
  }
  if (d.repaired !== lastShipRepair) {
    if (d.repaired > lastShipRepair) sound("success");
    lastShipRepair = d.repaired;
  }
  sfx.stopLoops();
  tickToast();
  redraw += dt;
  if (render && redraw >= 0.12) {
    drawDeck();
    redraw = 0;
  }
  if (!connection && game.elapsed - saveAt > 2 && game.phase !== "ended") {
    saveSolo();
    saveAt = game.elapsed;
  }
  if (render) world.update(game, id, dt);
}
function menu() {
  crewBadge.hidden = true;
  clearIntro();
  pendingBuild = null;
  pendingScan = null;
  pendingLock = null;
  started = false;
  world.menu = true;
  close();
  ui.innerHTML = screens.titleScreen(!!saved);
}
function clearIntro() {
  arrival?.dispose();
  arrival = null;
  introPlaying = false;
}
function playLandingSequence() {
  clearIntro();
  pendingBuild = null;
  pendingScan = null;
  pendingLock = null;
  connection?.close();
  connection = null;
  started = false;
  world.menu = true;
  phase = "";
  tutorial = 4;
  close();
  introPlaying = true;
  stopInput();
  sfx.stopLoops();
  arrival = new Arrival(world.renderer, ui, () => start(), sfx, world);
}
function start(resume = false) {
  clearIntro();
  pendingBuild = null;
  pendingScan = null;
  pendingLock = null;
  connection?.close();
  connection = null;
  game =
    resume && saved
      ? structuredClone(saved)
      : createGame(Math.floor(Math.random() * 2147483647));
  placeBatteryByAntenna(game);
  if (!game.players.solo) addPlayer(game, "solo", "Explorer");
  game.players.solo.move = { x: 0, z: 0 };
  id = "solo";
  fixed = 0;
  saveAt = game.elapsed;
  inputAt = 0;
  controllerSeed = -1; // snap the movement controller to the (re)started game
  firstPlan = !resume;
  goalsOpen = chatOpen = false;
  unread = lastMessages = 0;
  lastEvent = "";
  selected = game.players[id]?.selectedSlot ?? 0;
  trackedMission = selectedMission = trackedSalvage = "";
  started = true;
  world.menu = false;
  phase = "";
  tutorial = resume ? 4 : 0;
  if (!resume) {
    dispatch(game, id, {
      type: "power",
      value: startingAllocation,
    });
    phase = "day";
  }
  close();
  previous = {
    power: game.power,
    air: game.air,
    food: game.food,
    dose: game.dose,
  };
  draw();
  if (!resume) {
    modal = "briefing";
    ui.inert = true;
    draw();
    root.innerHTML = missionBriefing();
    root
      .querySelector<HTMLElement>('[role="dialog"]')
      ?.focus({ preventScroll: true });
  }
}
function powerScreen() {
  draft = { ...game.allocation };
  while (total(draft) > budget(game)) {
    const k = (["radio", "light", "heat", "air"] as const).find(
      (k) => draft[k] > 0,
    )!;
    draft[k]--;
  }
  powerBody();
}
function powerBody() {
  if (connection && game.host !== id && game.players[id]?.role !== "Comms") {
    open(
      "power",
      "CREW CONNECTED",
      `<div data-power-wait><p>Waiting for ${escape(game.players[game.host]?.name || "the crew leader")} to set today’s power and start the mission.</p><p>Your inventory belongs to you. Use slots 1–5 to choose what you hold.</p></div>`,
      false,
    );
    return;
  }
  open("power", "POWER FOR TODAY", powerPlan(game, draft, firstPlan), false);
}
function bench() {
  open("bench", "WORKBENCH", screens.workbench(game, id, recipeIndex));
}
function showLesson(key: string) {
  activeLesson = key;
  act({ type: "startLessonQuiz", kind: "beacon", quiz: key });
  open(
    "learn",
    (
      {
        shield: "SHIELD THE CREW",
        comms: "RADIO DELAY",
        grow: "GROW FOOD",
        power: "DUST AND POWER",
        oxygen: "AIR FROM MARS",
        plants: "SPACE PLANTS",
      } as Record<string, string>
    )[key],
    screens.scienceLesson(game, key),
    true,
    "quiz-modal",
  );
}
function learn(key: string) {
  cue("scan", key);
  pendingScan = { key, at: game.elapsed + 0.7 };
  modal = "scanning";
  act({ type: "move", x: 0, z: 0 });
}
function flare() {
  open("flare", "", flareCard(game));
  root.querySelector("h2")?.remove();
}
function mapScreen() {
  open(
    "map",
    "Expedition atlas",
    expeditionMap(
      game,
      id,
      world.mapImage,
      trackedMission,
      selectedMission,
      trackedSalvage,
    ),
  );
  root.querySelector(".modal")?.classList.add("expedition-modal");
}
function openFieldMission(mission: string) {
  selectedMission = mission;
  const m = fieldMissions.find((m) => m.id === mission);
  if (!m) return;
  const surveyed = fieldProgress(game).surveyed.includes(m.id);
  if (surveyed) act({ type: "startLessonQuiz", kind: "field", quiz: m.id });
  open(
    "field",
    m.title,
    fieldStation(game, m),
    true,
    surveyed ? "field-modal quiz-modal" : "field-modal",
  );
}

function saveSolo() {
  if (connection || game.phase === "ended") return;
  try {
    saved = structuredClone(game);
    localStorage.setItem(
      soloSaveKey,
      JSON.stringify({ version: 1, game }),
    );
  } catch {}
}

function showSalvage(site: string) {
  activeCache = site;
  missionPanelState = "";
  modal = "salvage";
  syncMissionPanel();
}

function showHangar() {
  missionPanelState = "";
  modal = "hangar";
  syncMissionPanel();
}

function alienSignature() {
  return JSON.stringify([
    game.alienQuest,
    game.players[id]?.bag,
    Object.values(game.players).map((p) => [p.id, p.name]),
  ]);
}
function showAlien(line?: AlienLine, speak = true) {
  alienScreenCompleted = alienProgress(game).completed;
  open(
    "alien",
    "Nemi's refuge",
    alienScreen(game, id, line),
    true,
    "alien-modal",
  );
  missionPanelState = alienSignature();
  if (speak) void alienVoice.speak(line || alienLine(game));
}
function alienAct(a: Action, line: AlienLine) {
  if (connection) {
    connection.send(a);
    return;
  }
  const error = dispatch(game, id, a);
  if (error) {
    fieldFeedback(error);
    if (a.type === "alienAnswer") {
      const caption = root.querySelector("#alien-subtitle");
      if (caption) caption.textContent = alienLines.wrong;
      const replay = root.querySelector<HTMLElement>("[data-do=alienSpeak]");
      if (replay) replay.dataset.line = "wrong";
      void alienVoice.speak("wrong");
    }
    return;
  }
  saveSolo();
  showAlien(line);
  if (a.type === "alienAnswer") cue("success");
  draw();
}

function syncMissionPanel() {
  const progress = returnProgress(game);
  let deadline: number | undefined;
  let lesson = false;
  if (modal === "alien") {
    if (missionPanelState !== alienSignature()) {
      const completed = alienProgress(game).completed && !alienScreenCompleted;
      showAlien(completed ? "complete" : undefined, completed);
    }
  } else if (modal === "alienBrush" && alienProgress(game).brushed) {
    showAlien("clean");
  } else if (modal === "salvage") {
    const run = progress.caches[activeCache];
    const expired = !!run && !run.reward && game.elapsed >= run.deadline;
    const signature = JSON.stringify([
      activeCache,
      run?.step,
      run?.deadline,
      run?.reward,
      expired,
    ]);
    if (missionPanelState !== signature) {
      open(
        "salvage",
        "Salvage cache",
        salvageScreen(game, activeCache),
        true,
        "quiz-modal return-modal",
      );
      missionPanelState = signature;
    }
    if (run && !run.reward && !expired) {
      deadline = run.deadline;
      const feedback = root.querySelector(".quiz-feedback");
      if (feedback && feedback.textContent !== (run.feedback ?? ""))
        feedback.textContent = run.feedback ?? "";
    }
  } else if (modal === "hangar") {
    const signature = JSON.stringify([
      progress.installed,
      progress.recovered,
      game.built,
      game.radio,
      game.aligned,
      game.host,
      game.panels.map(({ clean, covered }) => [clean, covered]),
    ]);
    if (missionPanelState !== signature) {
      open(
        "hangar",
        "REBUILD YOUR SHIP",
        hangar(game, id),
        true,
        "quiz-modal return-modal ship-modal",
      );
      missionPanelState = signature;
    }
  } else if (modal === "learn" || modal === "field") {
    lesson = true;
    deadline =
      progress.lessonTimers[
        modal === "learn"
          ? lessonTimerKey(id, "beacon", activeLesson)
          : lessonTimerKey(id, "field", selectedMission)
      ];
  }
  const clock = root.querySelector<HTMLElement>("[data-quiz-clock]");
  const bar = root.querySelector("progress");
  if (!clock || !bar || deadline === undefined) return;
  const remaining = Math.max(0, deadline - game.elapsed);
  const label =
    remaining > 0
      ? `${Math.ceil(remaining)}s left`
      : lesson
        ? "Bonus time ended · answer for 100 points"
        : "Time expired";
  if (clock.textContent !== label) clock.textContent = label;
  bar.hidden = false;
  bar.value = remaining;
}

function dispatchMission(a: Action) {
  if (connection) {
    connection.send(a);
    return;
  }
  const error = dispatch(game, id, a);
  if (error) {
    fieldFeedback(error);
    return;
  }
  saveSolo();
  draw();
}
function fieldFeedback(error: string) {
  const feedback = root.querySelector(
    ".quiz-feedback, .field-feedback, .alien-feedback, .flight-feedback",
  );
  if (feedback) feedback.textContent = error;
  else toast(error);
}

function fieldAction(action: Action, mission: string) {
  // Crew servers validate the same action; their authoritative state drives the next redraw.
  if (connection) {
    connection.send(action);
    return;
  }
  const error = dispatch(game, id, action);
  if (error) {
    fieldFeedback(error);
    return;
  }
  const m = fieldMissions.find((m) => m.id === mission)!;
  saveSolo();
  if (action.type === "fieldAnswer") {
    cue("success");
    open(
      "fieldDebrief",
      "Investigation complete",
      fieldDebrief(game, m),
      true,
      "field-modal quiz-modal",
    );
    hudSignature = "";
  } else openFieldMission(mission);
}
function sources() {
  open("sources", "NASA DATA", screens.dataSources(sourceIndex));
}
function crewScreen() {
  open("crew", "PLAY WITH FRIENDS", screens.crewLobby());
}
function pause() {
  if (game.phase === "flight") {
    open(
      "pause",
      "FLIGHT PAUSED",
      `<p>${connection ? "The crew flight keeps running." : "Solo flight paused."}</p>${Button("RESUME", "close")}${Button("CREW PLAN", "flightGuide", "", true)}${Button("MAIN MENU", "menu", "", true)}`,
    );
    return;
  }
  open(
    "pause",
    "PAUSED",
    screens.pauseScreen(game, id, muted, !!connection, volume),
  );
  const select = $("#role-select") as HTMLSelectElement;
  select.onchange = () => act({ type: "role", role: select.value });
}
type Nearby = {
  type: string;
  target: string;
  pos: { x: number; z: number };
  text: string;
};
function nearest(): Nearby | null {
  const p = game.players[id];
  if (!p) return null;
  if (game.phase === "flight") {
    const key = nearestFlightStation(p);
    return key
      ? {
          type: "shipStation",
          target: key,
          pos: flightStations[key],
          text: `Use ${flightStations[key].name}`,
        }
      : null;
  }
  if (p.hab) {
    const station = nearestHabStation({x:controller.x,z:controller.z});
    return station ? {type: "habStation", target: station.id, pos: p.hab, text: station.id === "airlock" ? "Cycle airlock · go outside" : `Inspect ${station.name}`} : null;
  }
  const r = roverState(game);
  if (roverSeat(r, id) >= 0) return { type: "rover", target: "rover", pos: r, text: Math.abs(r.speed) > .5 ? "Brake before exiting" : "Exit rover" };
  const all: Nearby[] = [];
  if (distance(p,HAB_LAYOUT.exterior)<3.1) all.push({type:"habEnter",target:"hab",pos:HAB_LAYOUT.exterior,text:"Enter habitat airlock"});
  if (!r.locked && distance(p, r) <= ROVER.boardRadius && Math.abs(r.speed) < .5)
    all.push({ type: "rover", target: "rover", pos: r, text: r.driver ? "Ride rover" : "Drive rover" });
  all.push({
    type: "alien",
    target: "nemi",
    pos: alienSite,
    text: "Talk to Nemi",
  });
  for (const site of sectors) {
    const m = fieldMissions.find(
      (m) => m.sector === site.id && missionAvailable(game, m),
    );
    all.push({
      type: m ? "field" : "fieldInfo",
      target: m?.id || site.id,
      pos: site,
      text: m ? `Investigate: ${m.title}` : `Inspect ${site.name}`,
    });
  }
  for (const site of salvageSites) {
    if (!returnProgress(game).caches[site.id]?.reward)
      all.push({
        type: "salvage",
        target: site.id,
        pos: site,
        text: "Open salvage cache",
      });
  }
  all.push({
    type: "hangar",
    target: "return",
    pos: launchSite,
    text: "Repair crashed ship",
  });
  for (const i of game.items)
    all.push({
      type: "pick",
      target: i.id,
      pos: i,
      text: `Pick up ${itemNames[i.kind].toLowerCase()}`,
    });
  for (const [k, pos] of Object.entries(stations))
    all.push({
      type: k === "workbench" ? "bench" : "learn",
      target: k,
      pos,
      text: k === "workbench" ? "Use workbench" : "Scan beacon",
    });
  for (const p of game.panels)
    all.push({ type: "panel", target: p.id, pos: p, text: "Use solar panel" });
  return (
    all
      .filter((n) => distance(p, n.pos) < (n.type === "rover" ? ROVER.boardRadius : B.interactRadius))
      .sort((a, b) => distance(p, a.pos) - distance(p, b.pos))[0] || null
  );
}
function canDeploySolar() {
  const player = game.players[id];
  return !!player && game.phase === "day" && !modal && !player.hab && !player.gust &&
    roverSeat(roverState(game), id) < 0 && equippedItem(player) === "solarKit";
}
function deploySolar() {
  if (!canDeploySolar()) return;
  if (!world.terrain.ready) return toast("Wait for the terrain to load.");
  const player = game.players[id];
  const x = player.x - Math.sin(world.yaw) * 4, z = player.z - Math.cos(world.yaw) * 4;
  const height = world.terrain.groundAt(x, z);
  for (const dx of [-2.6, 0, 2.6]) {
    for (const dz of [-1.6, 0, 1.6]) {
      const ground = world.terrain.groundAt(x + dx, z + dz);
      if (Math.abs(ground - height) > 0.65 || world.terrain.collides(x + dx, z + dz, ground, 0.45, 3))
        return toast("Aim at clear, level ground ahead.");
    }
  }
  if (act({ type: "deploySolar", x, z }) && !connection) toast("Solar array online");
  draw();
}
function interact() {
  if (modal) return;
  if (game.phase === "flight") {
    interactDeck();
    return;
  }
  if (game.phase !== "day") return;
  const n = nearest();
  if (!n) {
    if (canDeploySolar()) return deploySolar();
    toast("Move closer to an object.");
    return;
  }
  if (n.type === "habEnter") {
    if (act({type:"enterHab"})) { hudSignature = ""; world.releaseMouse(); }
    return;
  }
  if (n.type === "habStation") {
    open("habEquipment", "HABITAT", habEquipment(game,id,n.target));
    hudSignature = "";
    return;
  }
  if (n.type === "rover") {
    const r = roverState(game);
    if (roverSeat(r, id) < 0) {
      if (act({ type: "boardRover" })) { world.cameraFollow = null; hudSignature = ""; }
    } else {
      if (Math.abs(r.speed) > .5) { toast("Hold Space or Brake to stop before exiting."); return; }
      const ground = world.terrain.heightAt(r.x, r.z);
      const exit = roverExits(r).find((p) => {
        const y = world.terrain.heightAt(p.x, p.z, ground);
        return Math.abs(y-ground) < 1.4 && !world.terrain.collides(p.x,p.z,y) && !roverBlocks(r,p.x,p.z);
      });
      if (!exit) { toast("No safe exit here. Park in an open area."); return; }
      if (act({ type: "exitRover", ...exit })) { world.cameraFollow = null; hudSignature = ""; }
    }
    return;
  }
  if (n.type === "pick") {
    const isSolarKit = game.items.find(item => item.id === n.target)?.kind === "solarKit";
    if (act({ type: "pick", target: n.target })) {
      cue("pickup", n.target);
      pickupUntil = game.elapsed + 0.7;
      toast(isSolarKit ? "Array packed. Deploy on level ground." : "Supplies collected");
    }
  }
  if (n.type === "bench") bench();
  if (n.type === "field") openFieldMission(n.target);
  if (n.type === "salvage") showSalvage(n.target);
  if (n.type === "hangar") showHangar();
  if (n.type === "alien") showAlien();
  if (n.type === "fieldInfo") {
    selectedMission =
      fieldMissions.find(
        (m) =>
          m.sector === n.target &&
          !fieldProgress(game).completed.includes(m.id),
      )?.id || fieldMissions.find((m) => m.sector === n.target)!.id;
    mapScreen();
  }
  if (n.type === "learn") learn(n.target);
  if (n.type === "panel")
    open(
      "panel",
      "SOLAR PANEL",
      screens.panelMenu(
        !!game.panels.find((p) => p.id === n.target)?.covered,
        n.target,
      ),
    );
}
function draw() {
  syncCrewBadge();
  if (
    started &&
    game.returnMission?.flight?.deck &&
    ["flight", "ended"].includes(game.phase)
  ) {
    drawDeck();
    return;
  }
  if (!started || !game.players[id]) return;
  const n = nearest();
  const current = {
    power: game.power,
    air: game.air,
    food: game.food,
    dose: game.dose,
  };
  if (
    Object.keys(current).some(
      (k) =>
        current[k as keyof typeof current] !==
        previous[k as keyof typeof previous],
    )
  ) {
    gaugeFrom = { ...previous };
    gaugeUntil = game.elapsed + 0.8;
  }
  const model: HudView = {
    selected,
    goals: goalsOpen,
    chat: chatOpen,
    tutorial,
    guide: !modal,
    trackedMission,
    trackedSalvage,
    hint: "",
    prompt: !modal && game.phase === "day" ? n?.text || "" : "",
    deploySolar: canDeploySolar(),
    unread,
    bounce: game.elapsed < pickupUntil,
    previous: game.elapsed < gaugeUntil ? gaugeFrom : current,
    pickupProgress: Math.min(1, 1 - (pickupUntil - game.elapsed) / 0.7),
  };
  const sig = JSON.stringify([
    game.sol,
    game.phase,
    Math.ceil(game.clock),
    game.power,
    game.air,
    game.food,
    game.dose,
    game.radio,
    game.aligned,
    game.built,
    game.expedition,
    game.returnMission?.points,
    game.returnMission?.installed,
    game.returnMission?.recovered,
    Math.round(game.players[id].x),
    Math.round(game.players[id].z),
    game.stock,
    game.players[id].bag,
    game.players[id].hab && [Math.round(game.players[id].hab!.x),Math.round(game.players[id].hab!.z),game.players[id].habBerth],
    game.rover && [game.rover.driver, game.rover.passengers, Math.round(game.rover.speed * 3.6), Math.round(game.rover.odometer)],
    game.messages,
    game.panels.map((p) => [p.covered, p.clean]),
    model,
  ]);
  if (sig !== hudSignature && !document.activeElement?.matches("#ui select")) {
    const active = document.activeElement as HTMLElement | null;
    const focused =
      active?.closest("#ui") && active.dataset.do
        ? `[data-do="${active.dataset.do}"]${active.dataset.gauge ? `[data-gauge="${active.dataset.gauge}"]` : active.dataset.index ? `[data-index="${active.dataset.index}"]` : ""}`
        : null;
    ui.innerHTML = hud(game, id, model);
    if (focused)
      ui.querySelector<HTMLElement>(focused)?.focus({ preventScroll: true });
    hudSignature = sig;
    validateCopy(ui);
  }
  if (game.messages.length !== lastMessages) {
    unread = chatOpen ? 0 : Math.min(9, unread + 1);
    lastMessages = game.messages.length;
  }
  if (phase !== game.phase) {
    phase = game.phase;
    close();
    if (phase === "power") powerScreen();
    if (phase === "summary")
      open("summary", "SOL COMPLETE", report(game, reportBefore, id), false);
    if (phase === "ended") {
      open("ended", "", screens.endScreen(game, id), false);
      root.querySelector("h2")?.remove();
      root.querySelector(".modal")?.classList.add("fullscreen");
      try {
        localStorage.removeItem(soloSaveKey);
        saved = null;
      } catch {}
    }
  }
  syncMissionPanel();
  if (modal === "flare") {
    const bar = root.querySelector<HTMLElement>(".countdown");
    if (bar && game.event)
      bar.style.setProperty(
        "--remaining",
        `${Math.max(0, ((game.event.at + 45 - game.clock) / 45) * 100)}%`,
      );
    if (game.event?.resolved) close();
  }
  previous = {
    power: game.power,
    air: game.air,
    food: game.food,
    dose: game.dose,
  };
  const event =
    game.event && game.clock >= game.event.at
      ? `${game.sol}:${game.event.kind}`
      : "";
  if (event && event !== lastEvent) {
    lastEvent = event;
    cue(game.event!.kind);
    if (game.event!.kind === "storm")
      toast(
        "Dust blocks sunlight. Flying heavy crates are a game exaggeration; real Mars air is very thin.",
        true,
        game.sol,
      );
  }
}
let pendingScan: { key: string; at: number } | null = null;
let pendingLock: { at: number; value: Allocation } | null = null;
let taskState: {
    kind: string;
    target: string;
    start: number;
    count: number;
    wires: number[];
    left: number | null;
  } | null = null,
  pendingBuild: { at: number; seconds: number } | null = null;
function task(kind: string, target = "") {
  if (!act({ type: "beginTask", kind, target })) return;
  taskState = {
    kind,
    target,
    start: game.elapsed,
    count: 0,
    wires: [],
    left: null,
  };
  open("task", screens.taskTitles[kind], screens.miniTask(kind));
}
function finishTask() {
  if (!taskState) return;
  let value: unknown = taskState.count;
  if (taskState.kind === "align")
    value = Number(($("#needle") as HTMLInputElement).value);
  if (taskState.kind === "wire") value = [...taskState.wires].sort().join(",");
  if (
    taskState.kind === "water" &&
    Number(($("#water") as HTMLInputElement).value) < 90
  ) {
    toast("Slide water to the end.");
    return;
  }
  if (game.elapsed - taskState.start < 2) {
    toast("Finish the task first.");
    return;
  }
  if (taskState.kind === "clean" && Number(value) < 18) {
    toast("Brush more dusty patches.");
    return;
  }
  if (taskState.kind === "wire" && value !== "0,1,2") {
    toast("Match all three wires.");
    return;
  }
  if (taskState.kind === "align" && Math.abs(Number(value) - 72) > 5) {
    toast("Aim inside the green zone.");
    return;
  }
  if (taskState.kind === "patch" && value !== 3) {
    toast("Patch all three holes.");
    return;
  }
  if (act({ type: "finishTask", value })) {
    cue(taskState.kind, taskState.target);
    toast("Task complete");
    close();
    taskState = null;
  }
}
async function connect(join: boolean) {
  if (crewConnecting) return;
  const name = ($("#crew-name") as HTMLInputElement).value,
    url =
      import.meta.env.VITE_CREW_SERVER ||
      `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/crew`,
    code = ($("#room-code") as HTMLInputElement).value.trim(),
    role = ($("#lobby-role") as HTMLSelectElement).value;
  if (join && !/^[1-9][0-9]{4}$/.test(code)) {
    $("#crew-error").textContent = "Enter your friend’s five-digit crew code.";
    return;
  }
  crewConnecting = true;
  const buttons = root.querySelectorAll<HTMLButtonElement>(
    "[data-do=create],[data-do=join]",
  );
  buttons.forEach((b) => (b.disabled = true));
  $("#crew-error").textContent = join
    ? "Connecting to your friend’s crew…"
    : "Creating your crew…";
  try {
    if (!/^wss?:\/\//.test(url)) throw Error("Use a ws:// or wss:// address.");
    const conn = new CrewConnection(url);
    conn.onError = (error) =>
      [
        "alien",
        "alienBrush",
        "helm",
        "flightRepair",
        "field",
        "learn",
        "salvage",
        "hangar",
        "flight",
      ].includes(modal)
        ? fieldFeedback(error)
        : toast(error);
    conn.onState = (s) => {
      const old = JSON.stringify(game.expedition);
      const oldLearned = game.learned.includes(activeLesson);
      game = s;
      if (started && modal === "power" && s.phase === "power") {
        const wait = game.host !== id && game.players[id]?.role !== "Comms";
        if (wait !== !!root.querySelector("[data-power-wait]")) powerBody();
      }
      if (
        modal === "learn" &&
        !oldLearned &&
        s.learned.includes(activeLesson)
      ) {
        cue("success");
        close();
        toast("Science learned by the crew.");
      }
      if (
        modal === "field" &&
        selectedMission &&
        old !== JSON.stringify(s.expedition)
      ) {
        const m = fieldMissions.find((m) => m.id === selectedMission)!;
        if (fieldProgress(s).completed.includes(m.id)) {
          open(
            "fieldDebrief",
            "Investigation complete",
            fieldDebrief(s, m),
            true,
            "field-modal quiz-modal",
          );
        } else openFieldMission(m.id);
      }
    };
    const lobbyStatus = $("#crew-error");
    await conn.join(
      name,
      join ? code : undefined,
      Math.floor(Math.random() * 1e6),
    );
    if (!lobbyStatus.isConnected) {
      conn.close();
      return;
    }
    connection?.close();
    connection = conn;
    id = conn.id;
    selected = game.players[id]?.selectedSlot ?? 0;
    started = true;
    world.menu = false;
    phase = "";
    tutorial = 4;
    close();
    act({ type: "role", role });
    draw();
    toast(`Crew code: ${conn.room}`);

    conn.onClose = () => {
      started = false;
      crewBadge.hidden = true;
      open(
        "disconnected",
        "CONNECTION LOST",
        Button("PLAY SOLO", "solo") + Button("RECONNECT", "crew", "", true),
        false,
      );
    };
  } catch (e) {
    const el = document.querySelector("#crew-error");
    if (el) el.textContent = (e as Error).message;
    else toast((e as Error).message);
  } finally {
    crewConnecting = false;
    buttons.forEach((b) => (b.disabled = false));
  }
}
document.addEventListener("click", (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>("[data-do]");
  if (!el || el.hasAttribute("disabled")) return;
  const d = el.dataset;
  sound();
  switch (d.do) {
    case "copyCrewCode":
      if (connection)
        navigator.clipboard
          ?.writeText(connection.room)
          .then(() => toast("Crew code copied. Send it to your friends."))
          .catch(() => toast(`Your crew code: ${connection!.room}`));
      break;
    case "flightGuide":
      open(
        "flightGuide",
        "CREW FLIGHT PLAN",
        flightGuide(),
        true,
        "deck-modal",
      );
      break;
    case "holdCourse":
      dispatchMission({ type: "holdCourse" });
      break;
    case "finishFlightRepair":
      finishDeckRepair();
      break;
    case "answerFlightQuiz":
      if (modal === "flightRepair" && d.fault === deckRepair?.fault)
        dispatchMission({ type: "answerFlightQuiz", fault: d.fault, answer: Number(d.answer) });
      break;
    case "alienSpeak":
      if (d.line) void alienVoice.speak(d.line as AlienLine);
      break;
    case "acceptAlien":
      alienAct({ type: "acceptAlien" }, "accepted");
      break;
    case "donateAlien":
      alienAct({ type: "donateAlien", kind: d.kind }, "delivery");
      break;
    case "beginAlienRepair":
      if (act({ type: "beginAlienRepair" })) {
        alienPatches.clear();
        open(
          "alienBrush",
          "Clean the collector",
          alienBrush(),
          true,
          "alien-modal",
        );
      }
      break;
    case "finishAlienRepair":
      alienAct(
        { type: "finishAlienRepair", patches: alienPatches.size },
        "clean",
      );
      break;
    case "alienAnswer":
      alienAct({ type: "alienAnswer", answer: Number(d.answer) }, "complete");
      break;
    case "solo":
      playLandingSequence();
      break;
    case "retry":
      start();
      break;
    case "beginExplore":
      close();
      draw();
      break;
    case "resume":
      start(true);
      break;
    case "close":
      close();
      break;
    case "crew":
      crewScreen();
      break;
    case "create":
      void connect(false);
      break;
    case "join":
      void connect(true);
      break;
    case "help":
      open("help", "YOUR FIELD GUIDE", fieldManual());
      break;
    case "sources":
      sources();
      break;
    case "sourcePage":
      sourceIndex = Number(d.index);
      sources();
      break;
    case "pause":
      pause();
      break;
    case "mute":
      muted = !muted;
      explicitMute = true;
      sfx.muted = muted;
      sfx.sync();
      try {
        localStorage.setItem("outpost-muted", String(muted));
      } catch {}
      pause();
      break;
    case "menu":
      connection?.close();
      connection = null;
      menu();
      break;
    case "goals":
      goalsOpen = !goalsOpen;
      hudSignature = "";
      break;
    case "startSalvage":
      dispatchMission({ type: "startSalvage", site: d.site });
      break;
    case "salvageAnswer":
      dispatchMission({
        type: "salvageAnswer",
        site: d.site,
        step: Number(d.step),
        answer: Number(d.answer),
      });
      break;
    case "leaveSalvage":
      close();
      break;
    case "installPart":
      dispatchMission({ type: "installPart", part: d.part });
      break;
    case "launchShip":
      dispatchMission({ type: "launchShip" });
      break;
    case "flightTask":
      dispatchMission({
        type: "flightTask",
        step: Number(d.step),
        value: Number(
          d.answer ??
            root.querySelector<HTMLInputElement>("#flight-trim")?.value,
        ),
      });
      break;
    case "chat":
      chatOpen = !chatOpen;
      unread = 0;
      hudSignature = "";
      break;
    case "quick":
      act({ type: "chat", index: Number(d.index) });
      break;
    case "map":
      if (modal === "fieldDebrief")
        selectedMission =
          nextFieldMission(game, trackedMission)?.id || selectedMission;
      mapScreen();
      break;
    case "selectSite": {
      selectedMission =
        fieldMissions.find(
          (m) => m.sector === d.site && missionAvailable(game, m),
        )?.id || fieldMissions.find((m) => m.sector === d.site)!.id;
      mapScreen();
      break;
    }
    case "selectMission":
      selectedMission = d.mission!;
      mapScreen();
      break;
    case "trackMission":
      trackedMission = d.mission!;
      trackedSalvage = "";
      tutorial = 4;
      close();
      draw();
      break;
    case "trackSalvage":
      trackedSalvage = d.site!;
      trackedMission = "";
      tutorial = 4;
      close();
      draw();
      break;
    case "fieldObserve":
    case "fieldReset":
    case "fieldAnswer":
    case "fieldTune": {
      selectedMission = d.mission!;
      fieldAction(
        {
          type: d.do === "fieldTune" ? "fieldObserve" : d.do,
          mission: d.mission,
          value:
            d.do === "fieldTune"
              ? Number(
                  (document.querySelector("#field-dial") as HTMLInputElement)
                    .value,
                )
              : Number(d.value),
          answer: Number(d.answer),
        },
        d.mission!,
      );
      break;
    }
    case "skip":
      tutorial = 4;
      world.objectiveTarget = null;
      close();
      break;
    case "gauge":
      toast(el.getAttribute("aria-label") || "");
      break;
    case "pip": {
      const k = d.k as keyof Allocation,
        v = Number(d.v);
      if (total(draft) - draft[k] + v <= budget(game)) {
        draft[k] = v;
        powerBody();
        root.querySelector<HTMLElement>(`[data-row="${k}"]`)?.focus();
      } else toast("Take a block from another job.");
      break;
    }
    case "lock": {
      if (id !== game.host && game.players[id].role !== "Comms") {
        toast("Crew leader or Comms locks power.");
        break;
      }
      root.querySelector(".modal")?.classList.add("power-lock");
      pendingLock = { at: game.elapsed + 0.3, value: { ...draft } };
      cue("power");
      break;
    }
    case "next":
      reportBefore = { ...previous };
      act({ type: "next" });
      break;
    case "habExit":
      if (act({type:"exitHab"})) close();
      hudSignature = "";
      break;
    case "habDirectory":
      open("habDirectory", "HABITAT FLOOR PLAN", habDirectory(game,id));
      break;
    case "takeRover":
      act({ type: "takeRover" });
      hudSignature = "";
      break;
    case "roverBrake":
      break;
    case "interact":
      interact();
      break;
    case "slot":
      selectInventorySlot(Number(d.index));
      break;
    case "answer": {
      const f = facts.find((f) => f.id === d.fact)!;
      const answer = Number(d.answer);
      if (answer !== f.correct) {
        root.querySelector(".quiz-feedback")!.textContent =
          "Try again. Check the science note.";
        break;
      }
      if (act({ type: "learn", fact: d.fact, answer })) {
        cue("success");
        close();
        saveSolo();
        toast(
          (
            {
              shield:
                "Water and soil help shield the crew. They do not stop every particle.",
              comms:
                "Radio signals take time to reach Mars. Earth cannot answer instantly.",
              grow: "Plants need light, water, and warmth. Raw Mars soil contains harmful salts.",
              power:
                "Dust blocks sunlight. Cleaning panels helps them make more electricity.",
              oxygen:
                "MOXIE made oxygen from Mars air. Melting ice provides water.",
              plants:
                "Radiation changed repair instructions in tiny plants. OSD-658 helps scientists study space crops.",
            } as Record<string, string>
          )[f.id],
          true,
          game.sol,
        );
      }
      break;
    }
    case "recipe":
      recipeIndex = Number(d.index);
      bench();
      break;
    case "store":
      act({ type: "store" });
      bench();
      break;
    case "build": {
      if (act({ type: "beginBuild", recipe: d.recipe })) {
        const seconds =
          game.players[id].role === "Engineer"
            ? B.engineerBuildSeconds
            : B.buildSeconds;
        pendingBuild = { at: game.elapsed, seconds };
        modal = "building";
        root.innerHTML = screens.buildIndicator(seconds);
        act({ type: "move", x: 0, z: 0 });
        cue("build", String(d.recipe));
      }
      break;
    }
    case "clean":
      task("clean", d.target);
      break;
    case "deploySolar":
      deploySolar();
      break;
    case "cover":
      act({ type: "cover", target: d.target });
      close();
      break;
    case "task":
      task(d.kind!);
      break;
    case "finishTask":
      finishTask();
      break;
    case "choice":
      if (act({ type: "choice", choice: d.choice })) {
        close();
        cue("dose");
      }
      break;
    case "event":
      if (game.event?.kind === "flare") flare();
      else if (game.event?.kind === "leak")
        toast("Repair pipes at the oxygen beacon.");
      else {
        goalsOpen = true;
        toast("Store items. Cover solar panels.");
      }
      break;
  }
});
function clearPatch(el: HTMLElement) {
  if (!taskState || el.classList.contains("cleared")) return;
  el.classList.add("cleared");
  taskState.count++;
}
document.addEventListener("click", (e) => {
  const patch = (e.target as HTMLElement).closest<HTMLElement>(
    "[data-alien-dust]",
  );
  if (patch && modal === "alienBrush") {
    alienPatches.add(Number(patch.dataset.alienDust));
    patch.classList.add("cleared");
    $("#alien-brush-count").textContent = `${alienPatches.size} / 6 patches`;
  }
  const el = (e.target as HTMLElement).closest<HTMLElement>(
    "[data-wire],[data-hole],[data-dust]",
  );
  if (!el || !taskState || el.classList.contains("cleared")) return;
  if (el.dataset.hole !== undefined || el.dataset.dust !== undefined)
    clearPatch(el);
  else if (el.dataset.side === "0") {
    taskState.left = Number(el.dataset.wire);
    document
      .querySelectorAll('[data-side="0"]')
      .forEach((b) => b.classList.remove("active"));
    el.classList.add("active");
  } else if (taskState.left === Number(el.dataset.wire)) {
    const n = Number(el.dataset.wire);
    if (!taskState.wires.includes(n)) taskState.wires.push(n);
    document
      .querySelectorAll(`[data-wire="${n}"]`)
      .forEach((b) => b.classList.add("cleared"));
    taskState.left = null;
  } else toast("Match its color and shape.");
});
const keys = new Set<string>();
let brakePointer: number | null = null;
let joy = { x: 0, z: 0 },
  joyPointer: number | null = null,
  scrubbing = false;
addEventListener("keydown", (e) => {
  if (introPlaying && arrival) {
    if (e.key === "Escape") {
      e.preventDefault();
      arrival.complete();
    } else if (
      e.code === "Space" &&
      !(e.target as HTMLElement).matches("button")
    ) {
      e.preventDefault();
      if (!e.repeat) arrival.togglePause();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (!e.repeat) arrival.next();
    }
    return;
  }
  if ((e.target as HTMLElement).matches("input,select,textarea")) return;
  if (
    e.code === "Space" &&
    (e.target as HTMLElement).closest(".quiz-modal button")
  )
    return;
  if (
    ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key) ||
    (e.key === "Tab" && !modal && started)
  )
    e.preventDefault();
  keys.add(e.key.toLowerCase());
  if (e.key === "Escape" && document.fullscreenElement) {
    void document.exitFullscreen();
    return;
  }
  if (e.repeat) return;
  if (e.key === "Escape") {
    if (
      modal &&
      !["power", "summary", "flight", "ended", "building", "briefing"].includes(
        modal,
      )
    )
      close();
    else if (!modal && started) pause();
  }
  if (modal === "power" && ["+", "=", "-"].includes(e.key)) {
    const row =
      ((document.activeElement as HTMLElement)?.closest<HTMLElement>(
        "[data-row]",
      )?.dataset.row as keyof Allocation) || "air";
    const v = Math.max(0, Math.min(6, draft[row] + (e.key === "-" ? -1 : 1)));
    if (total(draft) - draft[row] + v <= budget(game)) {
      draft[row] = v;
      powerBody();
      root.querySelector<HTMLElement>(`[data-row="${row}"]`)?.focus();
    }
    return;
  }
  if (!started) return;
  if (e.key.toLowerCase() === "f") {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  }
  if (["map", "habDirectory"].includes(modal) && e.key.toLowerCase() === "q") {
    close();
    return;
  }
  if (modal) return;
  if (game.players[id]?.hab && ["b","g"].includes(e.key.toLowerCase())) { toast("Use the airlock to return to outdoor equipment."); return; }
  if (game.players[id]?.hab && e.key.toLowerCase() === "q") { open("habDirectory","HABITAT FLOOR PLAN",habDirectory(game,id)); return; }
  if (roverSeat(roverState(game),id)>=0 && ["b","g"].includes(e.key.toLowerCase())) { toast("Exit the rover to use field equipment."); return; }
  if (e.key === "Tab") {
    goalsOpen = !goalsOpen;
    hudSignature = "";
  }
  if (e.key.toLowerCase() === "t") {
    chatOpen = !chatOpen;
    unread = 0;
    hudSignature = "";
  }
  if (e.key.toLowerCase() === "e") interact();
  if (e.key.toLowerCase() === "q") {
    if (game.phase === "flight")
      open(
        "flightGuide",
        "CREW FLIGHT PLAN",
        flightGuide(),
        true,
        "deck-modal",
      );
    else mapScreen();
  }
  if (e.key.toLowerCase() === "b") {
    if (distance(game.players[id], stations.workbench) <= B.interactRadius)
      bench();
    else toast("Build at the workbench.");
  }
  if (e.key.toLowerCase() === "g") {
    const bag = Object.entries(game.players[id].bag).filter(
      ([, n]) => n && n > 0,
    );
    if (bag[selected]) act({ type: "drop", kind: bag[selected][0] });
  }
  if (/^[1-5]$/.test(e.key)) {
    selectInventorySlot(Number(e.key) - 1);
  }
});
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
function stopInput() {
  sfx.stopLoops();
  keys.clear();
  roverBrake = false;
  joy = { x: 0, z: 0 };
  helmPad = { x: 0, y: 0 };
  if (started)
    act({ type: game.phase === "flight" ? "flightMove" : "move", x: 0, z: 0 });
  if (started && document.hidden && game.phase === "flight")
    act({ type: "releaseHelm" });
}
addEventListener("blur", stopInput);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopInput();
});
document.addEventListener("pointerdown", (e) => {
  if ((e.target as HTMLElement).closest("#scrub")) scrubbing = true;
  if ((e.target as HTMLElement).closest("#joystick")) {
    joyPointer = e.pointerId;
    joystick(e);
  }
});
document.addEventListener("pointermove", (e) => {
  if (scrubbing && taskState?.kind === "clean") {
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
    if (el?.dataset.dust !== undefined) clearPatch(el);
  }
  if (e.pointerId === joyPointer) joystick(e);
});
document.addEventListener("pointerdown", (e) => {
  if ((e.target as HTMLElement).closest('[data-do="roverBrake"]')) { roverBrake = true; brakePointer = e.pointerId; e.preventDefault(); }
});
document.addEventListener("pointercancel", () => { roverBrake = false; brakePointer = null; });
document.addEventListener("pointerup", (e) => {
  if (e.pointerId === brakePointer) { roverBrake = false; brakePointer = null; }
  scrubbing = false;
  if (e.pointerId === joyPointer) {
    joyPointer = null;
    joy = { x: 0, z: 0 };
  }
});
function joystick(e: PointerEvent) {
  const r = document.querySelector("#joystick")?.getBoundingClientRect();
  if (r)
    joy = {
      x: Math.max(-1, Math.min(1, (e.clientX - r.left - r.width / 2) / 40)),
      z: Math.max(-1, Math.min(1, (e.clientY - r.top - r.height / 2) / 40)),
    };
}
let last = performance.now(),
  fixed = 0,
  redraw = 0,
  saveAt = 0,
  inputAt = 0,
  manualMode = false,
  controllerSeed = -1,
  jumpTipShown = false;
const controller = new LocalController();
const roverController = new RoverController();
let roverDriverKey = "", wasRiding = false, roverBrake = false, wasInHab = false;
function updateTutorial() {
  if (tutorial >= 4) {
    const field = trackedMission && nextFieldMission(game, trackedMission);
    world.objectiveTarget = field
      ? missionSector(field)
      : shipTarget(game, id, trackedSalvage);
    return;
  }
  const p = game.players[id],
    crate = game.items.find((i) => i.kind === "scrap");
  const done =
    tutorial === 0
      ? (!!crate && distance(p, crate) < B.interactRadius) ||
        Object.values(p.bag).some((n) => n && n > 0)
      : tutorial === 1
        ? Object.values(p.bag).some((n) => n && n > 0)
        : tutorial === 2
          ? game.learned.includes("grow")
          : Object.values(game.stock).some((n) => n && n > 0);
  if (done) {
    tutorial++;
    if (tutorial === 3)
      recipeIndex = recipes.findIndex((r) => r.id === "greenhouse");
    cue("success");
    toast("✓ Step complete");
    hudSignature = "";
  }
  world.objectiveTarget =
    tutorial < 2
      ? crate || null
      : tutorial === 2
        ? stations.grow
        : tutorial === 3
          ? stations.workbench
          : null;
}
function update(dt: number, render = true) {
  if (
    started &&
    game.returnMission?.flight &&
    ["flight", "ended"].includes(game.phase)
  ) {
    updateDeck(dt, render);
    return;
  }
  if (arrival) {
    arrival.update(dt, render);
    return;
  }
  if (started) {
    if (!game.players[id]?.hab) updateTutorial();
    if (pendingScan && game.elapsed >= pendingScan.at) {
      const key = pendingScan.key;
      pendingScan = null;
      showLesson(key);
    }
    if (pendingLock && game.elapsed >= pendingLock.at) {
      const a = pendingLock.value;
      pendingLock = null;
      if (act({ type: "power", value: a })) {
        firstPlan = false;
        close();
      }
    }
    const x =
        (keys.has("d") || keys.has("arrowright") ? 1 : 0) -
        (keys.has("a") || keys.has("arrowleft") ? 1 : 0) +
        joy.x,
      z =
        (keys.has("s") || keys.has("arrowdown") ? 1 : 0) -
        (keys.has("w") || keys.has("arrowup") ? 1 : 0) +
        joy.z;
    // Minecraft-style movement runs locally every frame; the sim just receives positions.
    const me = game.players[id];
    const rover = roverState(game);
    const riding = roverSeat(rover, id) >= 0;
    const canMove = !modal && !document.hidden && game.phase === "day" && !!me;
    // Movement is relative to where the camera looks (W = away from the camera).
    const cy = Math.cos(world.yaw),
      sy = Math.sin(world.yaw);
    const input = canMove
      ? {
          x: x * cy + z * sy,
          z: -x * sy + z * cy,
          forward: z < -0.3,
          sprint: keys.has("shift"),
          crouch: keys.has("c"),
          jump: keys.has(" "),
        }
      : { x: 0, z: 0, sprint: false, crouch: false, jump: false };
    if (modal) world.releaseMouse();
    if (riding && !wasRiding) { world.yaw = rover.heading + .25; world.cameraFollow = null; }
    if (me?.hab) {
      if (!wasInHab || controllerSeed !== game.seed || Math.hypot(controller.x-me.hab.x,controller.z-me.hab.z)>3) {
        controller.reset(me.hab.x,me.hab.z,0);controllerSeed=game.seed;
        if (!wasInHab) { world.yaw=0;world.pitch=.75;world.zoom=14;world.habInterior.resetCamera();world.releaseMouse(); }
      }
      const before={x:controller.x,z:controller.z};
      const len=Math.max(1,Math.hypot(input.x,input.z));
      const to={x:before.x+input.x/len*habSpeed*dt,z:before.z+input.z/len*habSpeed*dt};
      const next=moveInHab(before,to,Object.values(game.players).filter(p=>p.id!==id&&p.hab).map(p=>p.hab!));
      controller.x=next.x;controller.z=next.z;controller.y=0;controller.vx=(next.x-before.x)/Math.max(.001,dt);controller.vz=(next.z-before.z)/Math.max(.001,dt);
      if (controller.speed>.05) controller.heading=Math.atan2(controller.vx,controller.vz);
      if (game.phase==="day" && (!connection || game.elapsed-inputAt>.05)) { act({type:"habPos",x:next.x,z:next.z});inputAt=game.elapsed; }
    } else if (me && riding && rover.gust) {
      roverDriverKey = "";
    } else if (me && riding) {
      if (rover.driver === id) {
        const canDrive = canMove && world.terrain.ready;
        const key = `${game.seed}/${rover.driver}`;
        if (roverDriverKey !== key || Math.hypot(roverController.x-rover.x,roverController.z-rover.z)>6) {
          roverController.reset(rover, (x,z) => world.terrain.groundAt(x,z));
          roverDriverKey = key;
        }
        if (!canDrive) roverController.speed = 0;
        roverController.update(dt, { throttle: canDrive ? -z : 0, steer: canDrive ? x : 0, brake: !canDrive || keys.has(" ") || roverBrake },
          (x,z,y) => world.terrain.groundAt(x,z,y),
          (x,z,y) => world.terrain.collides(x,z,y,.6,ROVER.height,.65) || Object.values(game.players).some((p) => !p.hab && roverSeat(rover,p.id)<0 && Math.hypot(p.x-x,p.z-z)<1.7),
        );
        if (game.phase === "day" && (!connection || game.elapsed-inputAt>.05)) {
          act({type:"driveRover",x:roverController.x,z:roverController.z,heading:roverController.heading,speed:roverController.speed});
          inputAt = game.elapsed;
        }
      } else roverDriverKey = "";
    } else if (me && !me.gust) {
      if (wasInHab) {controller.reset(me.x,me.z,world.terrain.heightAt(me.x,me.z));world.cameraFollow=null;world.pitch=.36;world.zoom=9;}
      if (wasRiding || wasBlown) {
        controller.reset(me.x, me.z, world.terrain.heightAt(me.x,me.z));
        if (wasBlown) controller.heading = world.actors.get(id)?.rotation.y ?? controller.heading;
      }
      roverDriverKey = "";
      const drift = Math.hypot(me.x - controller.x, me.z - controller.z);
      if (controllerSeed !== game.seed || drift > (connection ? 6 : 4)) {
        controller.reset(me.x, me.z, world.terrain.heightAt(me.x, me.z));
        controllerSeed = game.seed;
      }
      const before = { x: controller.x, z: controller.z };
      const jumped = controller.update(
        dt,
        input,
        game.allocation.heat < 1,
        (px, pz, py) => world.terrain.heightAt(px, pz, py),
        (px, pz, py) => world.terrain.collides(px, pz, py) || roverBlocks(rover,px,pz),
      );
      const safe = movePastPlayers(
        before,
        controller,
        Object.values(game.players).filter((p) => p.id !== id && !p.hab),
      );
      if (
        (safe.x !== controller.x || safe.z !== controller.z) &&
        world.terrain.collides(safe.x, safe.z, controller.y)
      ) {
        safe.x = before.x;
        safe.z = before.z;
      }
      if (Math.abs(safe.x - controller.x) > 0.001) controller.vx = 0;
      if (Math.abs(safe.z - controller.z) > 0.001) controller.vz = 0;
      controller.x = safe.x;
      controller.z = safe.z;
      if (controller.grounded && (safe.x !== before.x || safe.z !== before.z))
        controller.y = world.terrain.heightAt(safe.x, safe.z, controller.y);
      if (jumped) {
        act({ type: "jump" });
        if (!jumpTipShown) {
          jumpTipShown = true;
          toast("Mars gravity is 38% of Earth's: big jumps!");
        }
      }
      if (
        game.phase === "day" &&
        (!connection || game.elapsed - inputAt > 0.05 || jumped)
      ) {
        act({
          type: "pos",
          x: controller.x,
          z: controller.z,
          mx: controller.vx,
          mz: controller.vz,
          gait: controller.gait,
        });
        inputAt = game.elapsed;
      }
    }
    world.local = started && !riding && !me?.gust ? controller : null;
    world.localRover = riding && rover.driver === id && !rover.gust ? roverController : null;
    wasBlown = !!me?.gust;
    wasRiding = riding;
    wasInHab = !!me?.hab;
    world.lookAllowed = () =>
      started && !modal && !arrival && game.phase === "day";
    fixed += dt;
    while (fixed >= 0.1) {
      if (!connection && !document.hidden) {
        const paused = [
          "pause",
          "briefing",
          "help",
          "sources",
          "map",
          "fieldDebrief",
          "hangar",
          "alien",
          "habDirectory",
          "habEquipment",
        ].includes(modal);
        const quiz =
          ["learn", "salvage"].includes(modal) ||
          (modal === "field" &&
            fieldProgress(game).surveyed.includes(selectedMission));
        if (game.phase === "day" && game.clock + 0.1 >= B.solSeconds)
          reportBefore = {
            power: game.power,
            air: game.air,
            food: game.food,
            dose: game.dose,
          };
        if (!paused && (modal !== "field" || quiz)) tick(game, 0.1, !quiz);
      }
      fixed -= 0.1;
    }
    world.predictMovement = !connection;
    world.stepRemainder = connection ? 0 : fixed;
    if (pendingBuild) {
      pendingBuild.seconds =
        game.players[id].role === "Engineer"
          ? B.engineerBuildSeconds
          : B.buildSeconds;
      if (!modal) {
        modal = "building";
        root.innerHTML = screens.buildIndicator(pendingBuild.seconds);
      }
    }
    if (pendingBuild) {
      const el = root.querySelector<HTMLElement>(".build-progress i");
      if (el) {
        el.style.animation = "none";
        el.style.width = `${Math.min(100, ((game.elapsed - pendingBuild.at) / pendingBuild.seconds) * 100)}%`;
      }
    }
    if (
      pendingBuild &&
      game.elapsed - pendingBuild.at >= pendingBuild.seconds + 0.1
    ) {
      act({ type: "finishBuild" });
      pendingBuild = null;
      close();
      cue("built");
    }
    redraw += dt;
    if (render && redraw >= 0.2) {
      if (joyPointer === null && brakePointer === null) draw();
      else {
        const speed = ui.querySelector("[data-rover-speed]");
        const travelled = ui.querySelector("[data-rover-distance]");
        if (speed) speed.textContent = String(Math.round(Math.abs(roverState(game).speed)*3.6));
        if (travelled) travelled.textContent = String(Math.round(roverState(game).odometer));
      }
      redraw = 0;
    }
    if (!connection && game.elapsed - saveAt > 2 && game.phase !== "ended") {
      saveSolo();
      saveAt = game.elapsed;
    }
  } else game.elapsed += dt;
  sfx.loop("build", started && !!pendingBuild && modal !== "pause");
  sfx.loop(
    "storm",
    started &&
      game.phase === "day" &&
      game.event?.kind === "storm" &&
      game.clock >= game.event.at &&
      (modal !== "pause" || !!connection),
  );
  tickToast();
  if (render) world.update(game, id, dt);
  else {
    world.motion.update(game, id, world.actors, dt);
    for (const [key, actor] of world.actors) {
      const p = game.players[key];
      if (p)
        world.motion.actor(actor, p, game, dt, {
          speed: Math.hypot(p.move.x, p.move.z) * B.speed,
          gait: p.gait || "walk",
          grounded: true,
          vy: 0,
          landAgo: 99,
          landImpact: 0,
        });
    }
  }
}
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!manualMode) update(dt);
  requestAnimationFrame(frame);
}
window.advanceTime = (ms) => {
  manualMode = true;
  const step = ms > 1000 ? 0.1 : 1 / 60;
  for (let i = 0; i < Math.ceil(ms / (1000 * step)); i++) update(step, false);
  if (started) draw();
  if (arrival) arrival.update(0);
  else world.update(game, id, 0.1);
};
window.render_game_to_text = () =>
  JSON.stringify({
    coordinates: game.returnMission?.flight?.deck
      ? `ship deck meters; +x starboard, +z aft; helm at (${flightStations.helm.x},${flightStations.helm.z})`
      : "meters; +x right, +z toward camera; origin at hab",
    cabin: world.cabin?.state || null,
    weather: { devil: game.devil, screenDust: world.screenDust.intensity, tracks: world.tracks.state },
    started,
    arrival: arrival?.state || null,
    modal,
    tutorial,
    sol: game.sol,
    phase: game.phase,
    seconds: Math.round(game.clock),
    player: game.players[id],
    hab: { inside: !!game.players[id].hab, position: game.players[id].hab, berth: game.players[id].habBerth, room: game.players[id].hab && habRoom(game.players[id].hab!), model: world.habInterior.status },
    rover: { ...roverState(game), seat: roverSeat(roverState(game),id), model: world.rover.status, local: world.localRover && { x: roverController.x, z: roverController.z, speed: roverController.speed, y: roverController.y, vy: roverController.vy, grounded: roverController.grounded, recoveries: roverController.recoveries, impact: roverController.impact } },
    crew: Object.values(game.players).map((p) => ({
      id: p.id,
      name: p.name,
      x: p.x,
      z: p.z,
      bag: p.bag,
      selectedSlot: p.selectedSlot ?? 0,
      held: equippedItem(p) ?? null,
    })),
    nearby: game.items.filter((o) => distance(o, game.players[id]) < 6),
    resources: {
      power: game.power,
      air: game.air,
      food: game.food,
      dose: game.dose,
    },
    learned: game.learned,
    expedition: fieldProgress(game),
    alienQuest: alienProgress(game),
    alienVoice: { speaking: alienVoice.speaking, mode: alienVoice.mode },
    nemi: world.nemi.state,
    shipAssembly: world.fieldSites.ship.state,
    returnMission: returnProgress(game),
    trackedMission: nextFieldMission(game, trackedMission)?.id,
    built: game.built,
    event: game.event,
    hudGroups: document.querySelectorAll("[data-hud]").length,
    nearest: nearest(),
    stock: game.stock,
    panels: game.panels,
    radio: game.radio,
    aligned: game.aligned,
    watering: game.watering,
    leakFixed: game.leakFixed,
    audio: {
      muted,
      volume,
      ready: sfx.ready,
      loops: Array.from(sfx.loops.keys()),
    },
    motion: {
      dustDevil: world.dustDevil.state,
      storm: world.motion.storm,
      sandstorm: {
        status: world.motion.sandstorm.status,
        visible: world.motion.sandstorm.group.visible,
        clipTime: world.motion.sandstorm.mixer?.time || 0,
      },
      structures: Array.from(world.buildings.entries()).map(([key, o]) => ({
        key,
        scale: o.scale.x,
      })),
      particles: world.motion.particleCount,
      reduced: world.motion.reduced,
      scans: world.motion.scans.length,
      flights: world.motion.flights.length,
      actors: Array.from(world.actors.entries()).map(([key, a]) => ({
        id: key,
        x: a.position.x,
        y: a.position.y,
        z: a.position.z,
        scaleY: a.scale.y,
        arm: a.getObjectByName("armL")?.rotation.x,
        leg: a.getObjectByName("legL")?.rotation.x,
        heading: a.rotation.y,
        carrying: a.getObjectByName("carried")?.visible,
      })),
    },
    render: {
      drawCalls: world.renderer.info.render.calls,
      triangles: world.renderer.info.render.triangles,
      stepFps: Math.round(world.fps),
      frameMs: Math.round(world.frameMs * 10) / 10,
    },
  });
if (import.meta.env.DEV)
  window.__stageScene = (name) => {
    clearIntro();
    pendingScan = null;
    pendingBuild = null;
    world.lastSeed = -1;
    world.local = null;world.localRover = null;world.cameraFollow = null;
    controllerSeed = -1;roverDriverKey = "";
    world.motion.storm = 0;
    world.motion.lastDose = 0;
    world.motion.particles.life.fill(0);
    world.motion.smoke.life.fill(0);
    world.objectiveTarget = null;
    goalsOpen = false;
    chatOpen = false;
    unread = 0;
    lastEvent = "";
    game = createGame(420);
    id = "solo";
    connection?.close();
    connection = null;
    addPlayer(game, id, "Explorer");
    started = true;
    world.menu = false;
    phase = "";
    tutorial = 4;
    close();
    if (name === "title") {
      menu();
      return;
    }
    if (name === "power") {
      draw();
      return;
    }
    dispatch(game, id, {
      type: "power",
      value: startingAllocation,
    });
    phase = "day";
    roverState(game).locked = false;
    function stagePanels(count: number) {
      const player = game.players[id];
      const position = { x: player.x, z: player.z };
      Object.assign(player, stations.workbench);
      game.learned.push("power");
      game.stock = { scrap: 2 * count, glass: count };
      for (let i = 0; i < count; i++) {
        dispatch(game, id, { type: "beginBuild", recipe: "panel" });
        game.elapsed += B.engineerBuildSeconds;
        dispatch(game, id, { type: "finishBuild" });
      }
      Object.assign(player, position);
    }
    if (name === "intro") {
      tutorial = 0;
      world.objectiveTarget = game.items[0];
    }
    if (name === "alien" || name === "alien-reward") {
      Object.assign(game.players[id], { x: alienSite.x, z: alienSite.z + 3 });
      game.players[id].bag = { ice: 3, glass: 2, scrap: 2 };
      if (name === "alien-reward") {
        game.alienQuest = {
          accepted: true,
          delivered: { ice: 3, glass: 2, scrap: 2 },
          contributions: { solo: { ice: 3, glass: 2, scrap: 2 } },
          brushed: true,
          completed: true,
          completedAt: game.elapsed,
        };
        game.returnMission = {
          ...returnProgress(game),
          recovered: { nav: "Prototype" },
        };
      }
      showAlien();
    }
    if (
      name === "flight" ||
      name === "flight-fault" ||
      name === "flight-arrival" ||
      name === "flight-approach" ||
      name === "flight-cockpit" ||
      name === "flight-crew"
    ) {
      game.returnMission = {
        ...returnProgress(game),
        installed: {
          booster: "Rare",
          hull: "Rare",
          nav: "Prototype",
          air: "Rare",
        },
      };
      Object.assign(game.players[id], launchSite);
      dispatch(game, id, { type: "launchShip" });
      phase = "";
      if (name === "flight-fault") {
        for (let i = 0; i < 190; i++) tick(game, 0.1);
      }
      if (name === "flight-cockpit") Object.assign(game.players[id], flightStations.helm);
      if (name === "flight-crew") {
        for (let n = 0; n < 3; n++) {
          const crewId = `ship-crew-${n}`;
          addPlayer(game, crewId, ["Imani", "Juno", "Vega"][n]);
          Object.assign(game.players[crewId],
            [flightStations.power, flightStations.air, { x: 1.5, z: -19 }][n]);
        }
      }
      if (name === "flight-approach") {
        const deck = game.returnMission.flight!.deck!;
        deck.time = 120;
        deck.nextEvent = 3;
        deck.guidance[0] = true;
        deck.repaired = 3;
        Object.assign(game.players[id], flightStations.helm);
      }
      if (name === "flight-arrival") {
        const deck = game.returnMission.flight!.deck!;
        deck.time = 180;
        deck.arrivalAt = 180;
        deck.outcome = "home";
      }
    }
    if (name === "crash-repairs") {
      Object.assign(game.players[id], launchSite);
      world.yaw = -0.42; world.pitch = 0.65; world.zoom = 32;
      game.returnMission = { ...returnProgress(game), recovered: { booster: "Rare", hull: "Rare", nav: "Prototype", air: "Rare" } };
    }
    if (name === "radio-relay") {
      const relay = sectors.find((site) => site.id === "relay")!;
      Object.assign(game.players[id], { x: relay.x + 2, z: relay.z - 3 });
      world.yaw = -0.8; world.pitch = 0.58; world.zoom = 18;
    }
    if (name === "solar-reward") {
      Object.assign(game.players[id], { x: solarRewardSite.x - 3, z: solarRewardSite.z + 2 });
      game.items.push({ id: "solar-reward-kit", kind: "solarKit", ...solarRewardSite, count: 1, damaged: false });
      world.yaw = 1.1; world.pitch = 0.48; world.zoom = 15;
    }
    if (name === "crew-rover-reward") {
      Object.assign(roverState(game), alienRoverSite);
      Object.assign(game.players[id], { x: alienRoverSite.x + 4, z: alienRoverSite.z });
      world.yaw = 1; world.pitch = 0.48; world.zoom = 16;
    }
    if (name === "ship" || name === "ship-ready" || name === "ship-launch") {
      Object.assign(game.players[id], launchSite);
      if (name !== "ship") {
        const parts = {
          booster: "Rare",
          hull: "Rare",
          air: "Rare",
          nav: "Prototype",
        } as const;
        game.returnMission = {
          ...returnProgress(game),
          recovered: name === "ship-launch" ? { ...parts } : { booster: "Rare", nav: "Prototype" },
          installed: name === "ship-launch" ? { ...parts } : {},
        };
      }
      showHangar();
    }
    if (name === "hab" || name === "hab-crew" || name === "hab-airlock") {
      Object.assign(game.players[id],HAB_LAYOUT.exterior);dispatch(game,id,{type:"enterHab"});
      if (name !== "hab-airlock") Object.assign(game.players[id].hab!,{x:0,z:1.5});
      if (name === "hab-crew") for(let n=0;n<3;n++) {
        const crewId=`hab-crew-${n}`;addPlayer(game,crewId,["Imani","Juno","Vega"][n]);
        Object.assign(game.players[crewId],HAB_LAYOUT.exterior);dispatch(game,crewId,{type:"enterHab"});
        Object.assign(game.players[crewId].hab!,{x:[-5.5,0,6][n],z:[-4.2,-6.5,-6][n]});
      }
      controllerSeed=-1;
    }
    if (name === "rover" || name === "rover-driving" || name === "rover-crew") {
      const r = roverState(game);
      Object.assign(game.players[id], { x: r.x + 3.8, z: r.z });
      roverDriverKey = "";
      world.yaw = .35; world.pitch = .38; world.zoom = 17;
      if (name !== "rover") dispatch(game,id,{type:"boardRover"});
      if (name === "rover-crew") for (const [n, role] of (["Scientist","Medic","Comms"] as const).entries()) {
        const crewId = `rover-crew-${n}`; addPlayer(game,crewId,role); game.players[crewId].role = role;
        Object.assign(game.players[crewId], { x:r.x+3.8,z:r.z }); dispatch(game,crewId,{type:"boardRover"});
      }
    }
    if (name === "rover-crew") { wasRiding = true; world.yaw = 2.4; world.pitch = .32; world.zoom = 22; }
    if (name === "rover-east") {
      const rover = roverState(game);
      rover.heading = -Math.PI / 2;
      Object.assign(game.players[id], { x: rover.x, z: rover.z });
      dispatch(game, id, { type: "boardRover" });
    }
    if (name === "models") {
      stagePanels(2);
      game.built = ["radio", "greenhouse", "shelter"];
      game.learned = ["shield", "comms", "grow", "power", "oxygen"];
      game.stock = { scrap: 6, ice: 6 };
      game.players[id].bag = {
        scrap: 2,
        ice: 1,
        seeds: 1,
        circuit: 1,
        battery: 1,
      };
      game.panels[0].clean = 0.15;
      game.panels[1].covered = true;
      for (const [n, role] of (
        ["Scientist", "Medic", "Comms"] as const
      ).entries()) {
        const crewId = `model-crew-${n}`;
        addPlayer(game, crewId, role);
        game.players[crewId].role = role;
        Object.assign(game.players[crewId], { x: -4 + n * 4, z: 3 });
      }
      world.zoom = 21;
      world.pitch = 0.6;
    }
    if (name === "tasks") {
      stagePanels(1);
      game.built = ["radio", "greenhouse"];
      game.learned = ["shield", "comms", "grow", "power", "oxygen"];
      game.stock = { scrap: 6, ice: 6 };
      game.panels[0].clean = 0.2;
      Object.assign(game.players[id], stations.workbench);
    }
    if (name === "near-item") Object.assign(game.players[id], { x: -3, z: 4 });
    if (name === "workbench") {
      Object.assign(game.players[id], stations.workbench);
      bench();
    }
    if (name === "scan") {
      Object.assign(game.players[id], stations.shield);
      learn("shield");
    }
    if (name === "storm") {
      game.event = { kind: "storm", at: 0, resolved: false };
      game.clock = 10;
      Object.assign(game.players[id], { x: 0, z: -7 });
      world.zoom = 19;
      world.pitch = 0.55;
    }
    if (name === "storm-impact") {
      game.event = { kind: "storm", at: 0, resolved: false };
      game.clock = B.stormWarningSeconds - 0.1;
    }
    if (name === "devil") {
      const center = { x: 18 * B.layoutScale, z: 0 };
      Object.assign(game.players[id], center);
      Object.assign(roverState(game), { x: center.x + 2, z: center.z });
      game.devil = center;
    }
    if (name === "devil-overview") {
      const center = {x:18*B.layoutScale,z:0};
      Object.assign(game.players[id],{x:center.x,z:24});
      Object.assign(roverState(game),{x:center.x+8,z:9});
      game.devil=center;world.yaw=0;world.pitch=.55;world.zoom=24;
    }
    if (name === "rover-recovery") {
      const r=roverState(game);
      Object.assign(game.players[id],{x:r.x+3,z:r.z});
      dispatch(game,id,{type:"boardRover"});
      Object.assign(r,{x:0,z:-17,heading:-Math.PI/2,gust:{vx:4,vz:0,height:3,vy:0}});
      Object.assign(game.players[id],{x:r.x,z:r.z});
      world.yaw=-1;world.pitch=.5;world.zoom=22;
    }
    if (name === "flare") {
      game.sol = 3;
      game.phase = "power";
      dispatch(game, id, {
        type: "power",
        value: startingAllocation,
      });
      game.clock = game.event!.at;
      flare();
    }
    if (name === "summary") {
      game.event = null;
      tick(game, B.solSeconds);
      phase = "day";
    }
    if (name === "ended") {
      game.sol = 15;
      game.built = ["radio", "shelter", "greenhouse"];
      game.aligned = true;
      game.radio = 10;
      game.dose = 32;
      game.phase = "ended";
      game.result = "Mission complete!";
    }
    draw();
    if (name === "flight-approach") pause();
    world.update(game, id, 0.016);
  };
menu();
if (import.meta.env.DEV) {
  const scene = previewScene;
  if (
    [
      "alien",
      "alien-reward",
      "ship",
      "ship-ready",
      "crash-repairs",
      "radio-relay",
      "solar-reward",
      "crew-rover-reward",
      "ship-launch",
      "flight",
      "flight-fault",
      "flight-approach",
      "flight-arrival",
      "flight-cockpit",
      "flight-crew",
      "models",
      "hab",
      "hab-crew",
      "hab-airlock",
    "rover",
    "rover-driving",
    "rover-crew",
      "rover-east",
      "tasks",
      "workbench",
      "near-item",
      "ended",
      "title",
      "storm",
      "storm-impact",
      "devil",
      "devil-overview",
      "rover-recovery",
    ].includes(scene || "")
  )
    window.__stageScene?.(scene!);
}
requestAnimationFrame(frame);
if ("serviceWorker" in navigator && import.meta.env.PROD)
  navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`)
    .catch(() => {});

// Cabin controls stay local until a server-validated station action is submitted.
document.addEventListener("pointerdown", (e) => {
  const button = (e.target as HTMLElement).closest<HTMLElement>(
    "[data-steer-x]",
  );
  if (!button || modal !== "helm") return;
  e.preventDefault();
  helmPointer = e.pointerId;
  helmPad = {
    x: Number(button.dataset.steerX),
    y: Number(button.dataset.steerY),
  };
});
document.addEventListener("pointerup", (e) => {
  if (e.pointerId === helmPointer) {
    helmPointer = null;
    helmPad = { x: 0, y: 0 };
  }
});
document.addEventListener("pointercancel", () => {
  helmPointer = null;
  helmPad = { x: 0, y: 0 };
});
function selectRepairLead(wire: number) {
  if (!deckRepair || deckRepair.wires.has(wire)) return;
  deckRepair.left = wire;
  root.querySelectorAll(".deck-wires .selected").forEach((e) => e.classList.remove("selected"));
  root.querySelector(`[data-flight-wire="${wire}"][data-side="0"]`)?.classList.add("selected");
}

function connectRepairLead(wire: number) {
  if (!deckRepair || deckRepair.wires.has(wire)) return;
  const feedback = root.querySelector(".flight-feedback");
  if (deckRepair.left !== wire) {
    if (feedback) feedback.textContent = deckRepair.left === null
      ? "Select a supply lead on the left first."
      : "That return port goes to a different circuit.";
    return;
  }
  deckRepair.wires.add(wire);
  root.querySelectorAll(`[data-flight-wire="${wire}"]`).forEach((e) => {
    e.classList.remove("selected");
    e.classList.add("done");
  });
  root.querySelector(`[data-wire-trace="${wire}"]`)?.classList.add("connected");
  deckRepair.left = null;
  if (feedback) feedback.textContent = "";
  updateRepairConsole();
}

document.addEventListener("dragstart", (event) => {
  if (modal !== "flightRepair" || !deckRepair) return;
  const lead = (event.target as HTMLElement).closest<HTMLElement>('[data-flight-wire][data-side="0"]');
  if (!lead || lead.classList.contains("done")) return;
  selectRepairLead(Number(lead.dataset.flightWire));
  event.dataTransfer?.setData("text/plain", lead.dataset.flightWire!);
});

document.addEventListener("dragover", (event) => {
  if (modal === "flightRepair" && deckRepair?.left != null &&
    (event.target as HTMLElement).closest('[data-flight-wire][data-side="1"]')) {
    event.preventDefault();
  }
});

document.addEventListener("drop", (event) => {
  if (modal !== "flightRepair" || !deckRepair) return;
  const port = (event.target as HTMLElement).closest<HTMLElement>('[data-flight-wire][data-side="1"]');
  if (!port) return;
  event.preventDefault();
  connectRepairLead(Number(port.dataset.flightWire));
});

document.addEventListener("click", (event) => {
  if (modal !== "flightRepair" || !deckRepair) return;
  const button = (event.target as HTMLElement).closest<HTMLElement>(
    "[data-flight-wire],[data-flight-valve],[data-flight-patch]",
  );
  if (!button || button.classList.contains("done")) return;
  const repair = deckRepair;
  if (button.dataset.flightWire !== undefined) {
    const wire = Number(button.dataset.flightWire);
    if (button.dataset.side === "0") selectRepairLead(wire);
    else connectRepairLead(wire);
  } else if (button.dataset.flightPatch !== undefined) {
    repair.patches.add(Number(button.dataset.flightPatch));
    button.classList.add("done");
    button.setAttribute("aria-pressed", "true");
    const status = button.querySelector("small");
    if (status) status.textContent = "Segment secure";
  } else if (button.dataset.flightValve !== undefined) {
    const value = Number(button.dataset.flightValve);
    const expected = [2, 0, 1][repair.valves.length];
    const feedback = root.querySelector(".flight-feedback");
    if (expected !== value) {
      const next = root.querySelector(`[data-flight-valve="${expected}"]`)?.textContent;
      if (feedback) feedback.textContent = `Next step: ${next?.trim()}.`;
      return;
    }
    repair.valves.push(value);
    button.classList.add("done");
    if (feedback) feedback.textContent = "";
  }
  updateRepairConsole();
});
