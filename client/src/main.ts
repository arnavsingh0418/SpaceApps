import { Sfx } from "./ui/sound";
import { AlienVoice } from "./ui/alienVoice";
import { alienScreen, alienBrush } from "./ui/alien";
import {
  alienSite,
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
  type Item,
  type Allocation,
} from "../../shared/src/sim";
import { Modal, Button, validateCopy } from "./ui/components";
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
  draft: Allocation = { air: 3, light: 3, radio: 3, heat: 2 };
let arrival: Arrival | null = null;
let trackedMission = "",
  selectedMission = "";
let activeCache = "",
  activeLesson = "",
  missionPanelState = "";
let trackedSalvage = "";
let gaugeFrom = { power: 11, air: 85, food: 95, dose: 0 },
  gaugeUntil = 0;
let tutorial = 4,
  goalsOpen = false,
  chatOpen = false,
  recipeIndex = 0,
  sourceIndex = 0,
  unread = 0,
  lastMessages = 0,
  controlsUntil = 60,
  pickupUntil = 0,
  previous = { power: 11, air: 85, food: 95, dose: 0 },
  reportBefore = { ...previous },
  hudSignature = "",
  lastEvent = "",
  firstPlan = true;
const world = new World();
if (import.meta.env.DEV)
  (window as unknown as { __world: World }).__world = world; // dev-only debugging hook
addPlayer(game, id, "Explorer");
try {
  const v = JSON.parse(localStorage.getItem("outpost-save-v1") || "null");
  if (
    v?.version === 1 &&
    v.game?.players?.solo &&
    ["power", "day", "summary", "flight"].includes(v.game.phase)
  ) {
    saved = v.game;
    placeBatteryByAntenna(v.game);
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
function open(
  kind: string,
  title: string,
  body: string,
  closable = true,
  cls = "",
) {
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
  alienVoice.stop();
  world.focus = null;
  stopInput();
  ui.inert = false;
  modal = "";
  missionPanelState = "";
  root.innerHTML = "";
  hudSignature = "";
}
function menu() {
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
  selected = 0;
  trackedMission = selectedMission = trackedSalvage = "";
  started = true;
  world.menu = false;
  phase = "";
  tutorial = resume ? 4 : 0;
  if (!resume) {
    dispatch(game, id, {
      type: "power",
      value: { air: 4, light: 3, radio: 3, heat: 1 },
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
      "outpost-save-v1",
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
  } else if (game.phase === "flight" && progress.flight) {
    const flight = progress.flight;
    const signature = `flight-${flight.stage}`;
    if (missionPanelState !== signature) {
      open(
        "flight",
        flightTasks[flight.stage].name,
        flightScreen(game),
        false,
        "quiz-modal return-modal flight-modal",
      );
      missionPanelState = signature;
    }
    deadline = flight.deadline;
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
    ".quiz-feedback, .field-feedback, .alien-feedback",
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
  open(
    "crew",
    "JOIN YOUR CREW",
    screens.crewLobby(
      import.meta.env.VITE_CREW_SERVER ||
        localStorage.getItem("crew-url") ||
        "ws://localhost:2567",
    ),
  );
}
function pause() {
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
  const all: Nearby[] = [];
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
    text: "Rebuild return ship",
  });
  for (const i of game.items)
    all.push({
      type: "pick",
      target: i.id,
      pos: i,
      text: `Pick up ${({ scrap: "scrap", ice: "ice", soil: "soil", glass: "panels", seeds: "seeds", antenna: "antenna", battery: "battery", circuit: "circuit", food: "food" } as Record<Item, string>)[i.kind]}`,
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
      .filter((n) => distance(p, n.pos) < B.interactRadius)
      .sort((a, b) => distance(p, a.pos) - distance(p, b.pos))[0] || null
  );
}
function interact() {
  if (modal || game.phase !== "day") return;
  const n = nearest();
  if (!n) {
    toast("Move closer to an object.");
    return;
  }
  if (n.type === "pick") {
    if (act({ type: "pick", target: n.target })) {
      cue("pickup", n.target);
      pickupUntil = game.elapsed + 0.7;
      toast("Supplies collected");
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
    mapImage: world.mapImage,
    trackedMission,
    trackedSalvage,
    hint: "",
    prompt: !modal && game.phase === "day" ? n?.text || "" : "",
    controls: game.clock < controlsUntil,
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
    game.messages,
    game.panels.map((p) => [p.covered, p.clean]),
    { ...model, mapImage: !!model.mapImage },
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
        localStorage.removeItem("outpost-save-v1");
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
  const name = ($("#crew-name") as HTMLInputElement).value,
    url = ($("#server-url") as HTMLInputElement).value.trim(),
    code = ($("#room-code") as HTMLInputElement).value.trim().toUpperCase(),
    role = ($("#lobby-role") as HTMLSelectElement).value;
  if (join && !/^[A-Z]{4}$/.test(code)) {
    toast("Enter the four-letter crew code.");
    return;
  }
  try {
    if (!/^wss?:\/\//.test(url)) throw Error("Use a ws:// or wss:// address.");
    const conn = new CrewConnection(url);
    conn.onError = (error) =>
      [
        "alien",
        "alienBrush",
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
    await conn.join(
      name,
      join ? code : undefined,
      Math.floor(Math.random() * 1e6),
    );
    connection?.close();
    connection = conn;
    id = conn.id;
    started = true;
    world.menu = false;
    phase = "";
    tutorial = 4;
    close();
    act({ type: "role", role });
    draw();
    toast(`Crew code: ${conn.room}`);
    localStorage.setItem("crew-url", url);
    conn.onClose = () => {
      started = false;
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
  }
}
document.addEventListener("click", (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>("[data-do]");
  if (!el || el.hasAttribute("disabled")) return;
  const d = el.dataset;
  sound();
  switch (d.do) {
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
    case "interact":
      interact();
      break;
    case "slot":
      selected = Number(d.index);
      hudSignature = "";
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
  if (modal === "map" && e.key.toLowerCase() === "q") {
    close();
    return;
  }
  if (modal) return;
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
  if (e.key.toLowerCase() === "q") mapScreen();
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
    selected = Number(e.key) - 1;
    hudSignature = "";
  }
});
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
function stopInput() {
  sfx.stopLoops();
  keys.clear();
  joy = { x: 0, z: 0 };
  if (started) act({ type: "move", x: 0, z: 0 });
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
document.addEventListener("pointerup", (e) => {
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
  jumpTipShown = false,
  lookTipShown = false;
const controller = new LocalController();
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
  if (arrival) {
    arrival.update(dt);
    return;
  }
  if (started) {
    updateTutorial();
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
    if (me) {
      const drift = Math.hypot(me.x - controller.x, me.z - controller.z);
      if (controllerSeed !== game.seed || drift > (connection ? 6 : 4)) {
        controller.reset(me.x, me.z, world.terrain.heightAt(me.x, me.z));
        controllerSeed = game.seed;
      }
      const jumped = controller.update(
        dt,
        input,
        game.allocation.heat < 1,
        (px, pz, py) => world.terrain.heightAt(px, pz, py),
        (px, pz, py) => world.terrain.collides(px, pz, py),
      );
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
    world.local = started ? controller : null;
    world.lookAllowed = () =>
      started && !modal && !arrival && game.phase === "day";
    if (started && !modal && !lookTipShown && game.phase === "day") {
      lookTipShown = true;
      toast(
        innerWidth <= 760
          ? "Drag open space to look; use the joystick to walk."
          : "Click the game, then move mouse to look",
      );
    }
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
    if (render && redraw >= 0.2 && joyPointer === null) {
      draw();
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
    coordinates: "meters; +x right, +z toward camera; origin at hab",
    started,
    arrival: arrival?.state || null,
    modal,
    tutorial,
    sol: game.sol,
    phase: game.phase,
    seconds: Math.round(game.clock),
    player: game.players[id],
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
      storm: world.motion.storm,
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
      value: { air: 3, light: 3, radio: 3, heat: 2 },
    });
    phase = "day";
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
    if (name === "ship" || name === "ship-ready") {
      Object.assign(game.players[id], launchSite);
      if (name === "ship-ready")
        game.returnMission = {
          ...returnProgress(game),
          recovered: {
            booster: "Rare",
            hull: "Rare",
            air: "Rare",
            nav: "Prototype",
          },
        };
      showHangar();
    }
    if (name === "models") {
      game.built = ["radio", "greenhouse", "shelter"];
      game.learned = ["shield", "comms", "grow", "power", "oxygen"];
      game.stock = { scrap: 6, ice: 6 };
      game.players[id].bag = { scrap: 2, ice: 1, seeds: 1, circuit: 1, battery: 1 };
      game.panels[0].clean = .15;
      game.panels[1].covered = true;
      for (const [n, role] of (["Scientist", "Medic", "Comms"] as const).entries()) {
        const crewId = `model-crew-${n}`;
        addPlayer(game, crewId, role);
        game.players[crewId].role = role;
        Object.assign(game.players[crewId], {x: -4 + n * 4, z: 3});
      }
      world.zoom = 21;world.pitch = .60;
    }
    if (name === "tasks") {
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
    }
    if (name === "flare") {
      game.sol = 3;
      game.phase = "power";
      dispatch(game, id, {
        type: "power",
        value: { air: 3, light: 3, radio: 3, heat: 2 },
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
    world.update(game, id, 0.016);
  };
menu();
if (import.meta.env.DEV) {
  const scene = new URL(location.href).searchParams.get("qaScene");
  if (["alien", "alien-reward", "ship", "ship-ready", "models", "tasks", "workbench", "near-item", "ended", "title", "storm"].includes(scene || ""))
    window.__stageScene?.(scene!);
}
requestAnimationFrame(frame);
if ("serviceWorker" in navigator && import.meta.env.PROD)
  navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`)
    .catch(() => {});
