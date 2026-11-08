import "@fontsource/barlow-condensed/latin-800.css";
import "@fontsource/nunito-sans/latin-700.css";
import "@fontsource/nunito-sans/latin-800.css";
import "./style.css";
import { World } from "./render/world";
import { CrewConnection } from "./net/crew";
import {
  createGame,
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
const $ = (q: string) => document.querySelector<HTMLElement>(q)!;
const ui = $("#ui"),
  root = $("#modal-root");
let game = createGame(42),
  id = "solo",
  started = false,
  connection: CrewConnection | null = null,
  phase = "",
  modal = "",
  selected = 0,
  muted = true,
  saved: Game | null = null,
  draft: Allocation = { air: 3, light: 3, radio: 3, heat: 2 };
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
addPlayer(game, id, "Explorer");
try {
  const v = JSON.parse(localStorage.getItem("outpost-save-v1") || "null");
  if (
    v?.version === 1 &&
    v.game?.players?.solo &&
    ["power", "day", "summary"].includes(v.game.phase)
  )
    saved = v.game;
} catch {}
function cue(kind: string, target?: string) {
  dispatchEvent(
    new CustomEvent("game-effect", { detail: { kind, target, id } }),
  );
  sound(kind);
}
let audio: AudioContext | null = null;
addEventListener("footstep", () => sound("step"));
function sound(kind = "click") {
  if (muted) return;
  try {
    audio ??= new AudioContext();
    void audio.resume();
    const o = audio.createOscillator(),
      g = audio.createGain(),
      t = audio.currentTime;
    o.type = kind === "step" ? "triangle" : "sine";
    o.frequency.setValueAtTime(
      (
        {
          pickup: 650,
          scan: 820,
          build: 180,
          power: 240,
          success: 900,
          step: 90,
        } as Record<string, number>
      )[kind] || 400,
      t,
    );
    o.frequency.exponentialRampToValueAtTime(
      kind === "step" ? 55 : 900,
      t + 0.14,
    );
    g.gain.setValueAtTime(kind === "step" ? 0.015 : 0.04, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g);
    g.connect(audio.destination);
    o.start();
    o.stop(t + 0.2);
  } catch {}
}
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
function open(kind: string, title: string, body: string, closable = true) {
  const alreadyOpen=modal===kind;
  modal = kind;
  act({ type: "move", x: 0, z: 0 });
  root.innerHTML = Modal(title, body, closable);
  if(alreadyOpen){const panel=root.querySelector<HTMLElement>('.modal');if(panel)panel.style.animation='none';}
  root
    .querySelector<HTMLElement>('button:not([data-do="close"]),input')
    ?.focus();
  validateCopy(root);
}
function close() {
  modal = "";
  root.innerHTML = "";
  hudSignature = "";
}
function menu() {
  pendingBuild=null;pendingScan=null;pendingLock=null;
  started = false;
  world.menu = true;
  close();
  ui.innerHTML = screens.titleScreen(!!saved);
}
function start(resume = false) {
  pendingBuild=null;pendingScan=null;pendingLock=null;
  connection?.close();
  connection = null;
  game =
    resume && saved
      ? structuredClone(saved)
      : createGame(Math.floor(Math.random() * 2147483647));
  if (!game.players.solo) addPlayer(game, "solo", "Explorer");
  game.players.solo.move = { x: 0, z: 0 };
  id = "solo";
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
  const f = facts.find((f) => f.id === key)!;
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
  open("map", "FIELD MAP", screens.fieldMap(game, id));
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
  open("pause", "PAUSED", screens.pauseScreen(game, id, muted, !!connection));
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
    game.stock,
    game.players[id].bag,
    game.messages,
    game.panels.map((p) => [p.covered, p.clean]),
    model,
  ]);
  if (sig !== hudSignature && !document.activeElement?.matches("#ui select")) {
    const active=document.activeElement as HTMLElement|null;
    const focused=active?.closest('#ui')&&active.dataset.do?`[data-do="${active.dataset.do}"]${active.dataset.gauge?`[data-gauge="${active.dataset.gauge}"]`:active.dataset.index?`[data-index="${active.dataset.index}"]`:''}`:null;
    ui.innerHTML = hud(game, id, model);
    if(focused)ui.querySelector<HTMLElement>(focused)?.focus({preventScroll:true});
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
      open("ended", "", screens.endScreen(game), false);
      root.querySelector("h2")?.remove();
      root.querySelector(".modal")?.classList.add("fullscreen");
      try {
        localStorage.removeItem("outpost-save-v1");
        saved = null;
      } catch {}
    }
  }
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
    conn.onError = toast;
    conn.onState = (s) => (game = s);
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
    case "solo":
    case "retry":
      start();
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
      open("help", "CONTROLS", screens.controls());
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
    case "chat":
      chatOpen = !chatOpen;
      unread = 0;
      hudSignature = "";
      break;
    case "quick":
      act({ type: "chat", index: Number(d.index) });
      break;
    case "map":
      mapScreen();
      break;
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
      if (
        Number(d.answer) === f.correct &&
        act({ type: "learn", fact: d.fact, answer: Number(d.answer) })
      ) {
        cue("success");
        close();
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
      } else toast("Try again. Check the science note.");
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
  if ((e.target as HTMLElement).matches("input,select,textarea")) return;
  if (
    ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key) ||
    (e.key === "Tab" && !modal)
  )
    e.preventDefault();
  keys.add(e.key.toLowerCase());
  if(e.key==="Escape"&&document.fullscreenElement){void document.exitFullscreen();return;}
  if (e.repeat) return;
  if (e.key === "Escape") {
    if (modal && !["power", "summary", "ended", "building"].includes(modal))
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
  lastMove = "",
  manualMode = false;
function updateTutorial() {
  if (tutorial >= 4) {
    world.objectiveTarget = !game.learned.includes("grow")
      ? stations.grow
      : !game.built.includes("greenhouse")
        ? stations.workbench
        : !game.built.includes("shelter")
          ? game.learned.includes("shield")
            ? stations.workbench
            : stations.shield
          : !game.built.includes("radio")
            ? game.learned.includes("comms")
              ? stations.workbench
              : stations.comms
            : !game.aligned
              ? stations.comms
              : null;
    return;
  }
  const p = game.players[id],
    crate = game.items.find((i) => i.kind === "scrap");
  const done =
    tutorial === 0
      ? !!crate && distance(p, crate) < 1.7
      : tutorial === 1
        ? Object.values(p.bag).some((n) => n && n > 0)
        : tutorial === 2
          ? game.learned.length > 0
          : Object.values(game.stock).some((n) => n && n > 0);
  if (done) {
    tutorial++;
    cue("success");
    toast("✓ Step complete");
    hudSignature = "";
  }
  world.objectiveTarget =
    tutorial < 2
      ? crate || null
      : tutorial === 2
        ? stations.power
        : tutorial === 3
          ? stations.workbench
          : null;
}
function update(dt: number, render = true) {
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
    const moving = modal || document.hidden ? { x: 0, z: 0 } : { x, z };
    const sig = JSON.stringify(moving);
    if (sig !== lastMove || (connection && game.elapsed - inputAt > 1)) {
      act({ type: "move", ...moving });
      lastMove = sig;
      inputAt = game.elapsed;
    }
    fixed += dt;
    while (fixed >= 0.1) {
      if (!connection && modal !== "pause" && !document.hidden) {
        if (game.phase === "day" && game.clock + 0.1 >= B.solSeconds)
          reportBefore = {
            power: game.power,
            air: game.air,
            food: game.food,
            dose: game.dose,
          };
        tick(game, 0.1);
      }
      fixed -= 0.1;
    }
    if(pendingBuild){pendingBuild.seconds=game.players[id].role==='Engineer'?B.engineerBuildSeconds:B.buildSeconds;if(!modal){modal='building';root.innerHTML=screens.buildIndicator(pendingBuild.seconds);}}
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
      try {
        saved = structuredClone(game);
        localStorage.setItem(
          "outpost-save-v1",
          JSON.stringify({ version: 1, game }),
        );
      } catch {}
      saveAt = game.elapsed;
    }
  } else game.elapsed += dt;
  tickToast();
  if (render) world.update(game, id, dt);
  else {
    world.motion.update(game, id, world.actors, dt);
    for (const [key, actor] of world.actors) {
      const p = game.players[key];
      if (p) world.motion.actor(actor, p, game, dt);
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
  world.update(game, id, 0.1);
};
window.render_game_to_text = () =>
  JSON.stringify({
    coordinates: "meters; +x right, +z toward camera; origin at hab",
    started,
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
    built: game.built,
    event: game.event,
    hudGroups: document.querySelectorAll("[data-hud]").length,
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
        y: a.position.y,
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
requestAnimationFrame(frame);
if ("serviceWorker" in navigator && import.meta.env.PROD)
  navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`)
    .catch(() => {});
