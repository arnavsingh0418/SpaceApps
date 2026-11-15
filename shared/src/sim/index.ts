import { habAction, type HabPosition } from "../hab";
import { createRover, roverState, roverSeat, roverAction, tickRover, leaveRover, type RoverState } from "../rover";
import B from "../data/balance.json";
import recipes from "../data/recipes.json";
import facts from "../data/facts.json";
import flares from "../data/donki_flares.json";
import {
  fieldMissions,
  missionAvailable,
  missionSector,
  type FieldProgress,
} from "../expedition";
import { type ReturnProgress } from "../returnMission";
import { returnAction, scoreLesson, updateFlight } from "./returnActions";
import { type AlienProgress } from "../alien";
import { alienAction } from "./alienActions";
import { fieldPartRewards, recoverPart } from "../shipRewards";
import { solarRewardSite } from "../expedition";
import { deckSpawn, flightAction, tickDeckFlight } from "../flight";
import { movePastPlayers } from "../playerCollision";
import { blowDustDevil, type Gust } from "../dustDevil";
import { resolveRoverSurface } from "../surfacePhysics";
export { B, recipes, facts, flares };
export type Role = "Engineer" | "Scientist" | "Medic" | "Comms";
export type Item =
  | "scrap"
  | "ice"
  | "soil"
  | "glass"
  | "seeds"
  | "antenna"
  | "battery"
  | "circuit"
  | "food";
export const itemNames: Record<Item, string> = {
  scrap: "Scrap",
  ice: "Ice",
  soil: "Soil bags",
  glass: "Clear panels",
  seeds: "Seeds",
  antenna: "Antenna",
  battery: "Battery",
  circuit: "Circuit",
  food: "Food crate",
};
export const icons: Record<Item, string> = {
  scrap: "🔩",
  ice: "❄️",
  soil: "🟤",
  glass: "🪟",
  seeds: "🌱",
  antenna: "📡",
  battery: "🔋",
  circuit: "🧩",
  food: "🥔",
};
export type Bag = Partial<Record<Item, number>>;
export type Point = { x: number; z: number };
export type Player = Point & {
  id: string;
  /** Separate interior coordinates; surface position stays at the hab. */
  hab?: HabPosition;
  habBerth?: number;
  name: string;
  color: number;
  role: Role;
  bag: Bag;
  selectedSlot?: number;
  gust?: Gust;
  task?: { kind: string; target: string; at: number };
  move: Point;
  joined: number;
  /** walk | sprint | crouch, set by the player's own client (Minecraft-style movement). */
  gait?: Gait;
  /** s.elapsed when this player last jumped; clients draw the arc from it. */
  jumpAt?: number;
  /** s.elapsed of the last client-reported position; the sim stops integrating while fresh. */
  posAt?: number;
};
export type Gait = "walk" | "sprint" | "crouch";
/** Speed for a gait (m/s). Cold suits (no heater power) slow everyone down. */
export function gaitSpeed(gait: Gait | undefined, cold: boolean) {
  const base = cold ? B.coldSpeed : B.speed;
  return (
    base *
    (gait === "sprint"
      ? B.sprintMultiplier
      : gait === "crouch"
        ? B.crouchMultiplier
        : 1)
  );
}
export type Pickup = Point & {
  id: string;
  kind: Item;
  count: number;
  damaged: boolean;
};
export type Panel = Point & { id: string; clean: number; covered: boolean };
export type Allocation = {
  air: number;
  light: number;
  radio: number;
  heat: number;
};
export type Game = {
  /** Optional so older saves acquire the parked rover on first use. */
  rover?: RoverState;
  seed: number;
  rng: number;
  sol: number;
  clock: number;
  elapsed: number;
  phase: "power" | "day" | "summary" | "flight" | "ended";
  air: number;
  food: number;
  dose: number;
  power: number;
  allocation: Allocation;
  players: Record<string, Player>;
  items: Pickup[];
  panels: Panel[];
  stock: Bag;
  learned: string[];
  built: string[];
  radio: number;
  aligned: boolean;
  shield: number;
  event: null | {
    kind: "storm" | "flare" | "leak" | "supply";
    at: number;
    resolved: boolean;
    flare?: (typeof flares)[number];
  };
  summary: string[];
  messages: string[];
  pending: { at: number; text: string }[];
  result: string;
  serial: number;
  host: string;
  devil: Point;
  devilDropAt: number;
  leakFixed: boolean;
  watering: boolean;
  history: string[];
  /** Optional for compatibility with pre-expedition saves and older crew rooms. */
  expedition?: FieldProgress;
  returnMission?: ReturnProgress;
  alienQuest?: AlienProgress;
};
export type Action = { type: string; [key: string]: unknown };
/** The base layout is spread out by this factor so buildings can be life-sized. */
const L: number = (B as { layoutScale?: number }).layoutScale ?? 1;
export const startingAllocation: Allocation = { air: 4, light: 3, radio: 0, heat: 1 };
export const stations = {
  workbench: { x: 0 * L, z: -2 * L },
  shield: { x: -10 * L, z: 2 * L },
  comms: { x: -9 * L, z: -7 * L },
  grow: { x: 8 * L, z: -1 * L },
  power: { x: -7 * L, z: 7 * L },
  oxygen: { x: 6 * L, z: 6 * L },
  plants: { x: 12 * L, z: -8 * L },
};
/**
 * Walkable world: a circle centred on the middle of the Blender map (game coordinates are
 * centred on the base, which sits south-west of the map centre), reaching out to just
 * inside the dust-storm wall.
 */
export const WORLD = { x: B.worldCenterX, z: B.worldCenterZ, r: B.worldRadius };
/** Pull a point back inside the world circle. Returns true if it was outside. */
export function clampToWorld(p: Point) {
  const dx = p.x - WORLD.x,
    dz = p.z - WORLD.z,
    d = Math.hypot(dx, dz);
  if (d <= WORLD.r) return false;
  p.x = WORLD.x + (dx / d) * WORLD.r;
  p.z = WORLD.z + (dz / d) * WORLD.r;
  return true;
}
export const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (v: number, max = 100) => Math.min(max, Math.max(0, v));
export function random(s: Game) {
  s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0;
  return s.rng / 4294967296;
}
export function log(s: Game, t: string) {
  s.messages.push(t);
  s.messages = s.messages.slice(-8);
}
function spawn(s: Game, kind: Item, count: number, x: number, z: number) {
  const item = {
    id: `item-${++s.serial}`,
    kind,
    count,
    x,
    z,
    damaged: false,
  };
  s.items.push(item);
  return item;
}
export function createGame(seed = 42): Game {
  const s: Game = {
    rover: { ...createRover(), locked: true },
    seed,
    rng: seed >>> 0,
    sol: 1,
    clock: 0,
    elapsed: 0,
    phase: "power",
    air: B.initialAir,
    food: B.initialFood,
    dose: 0,
    power: B.batteryPower,
    allocation: { ...startingAllocation },
    players: {},
    items: [],
    panels: [],
    stock: {},
    learned: [],
    built: [],
    radio: 0,
    aligned: false,
    shield: 0,
    event: null,
    summary: [],
    messages: [
      "MISSION CONTROL: Recover scattered ship parts, rebuild the return vehicle, and fly home.",
    ],
    pending: [],
    result: "",
    serial: 0,
    host: "",
    devil: { x: 18 * L, z: 0 },
    devilDropAt: 0,
    leakFixed: false,
    watering: false,
    history: [],
    expedition: { completed: [], surveyed: [], observations: {} },
  };
  const supplies: [Item, number, number, number][] = [
    ["scrap", 6, -3, 4],
    ["ice", 6, 10, 6],
    ["soil", 4, -12, 3],
    ["glass", 6, 7, -5],
    ["seeds", 1, 11, -2],
    ["antenna", 1, -14, -7],
    ["circuit", 2, 3, -9],
    ["scrap", 6, 13, 10],
    ["ice", 6, -15, 10],
    ["food", 2, 16, -5],
  ];
  supplies.forEach(([k, n, x, z]) => spawn(s, k, n, x * L, z * L));
  placeBatteryByAntenna(s);
  return s;
}
/** One battery sits beside the antenna until it is carried, stored, or built into the radio. */
export function removeStarterPanels(s: Game) {
  const starterX = [-8, -5, -2];
  const panels = s.panels.filter((p) =>
    !starterX.some((x, index) => p.id === `panel-${index}` && p.x === x * L && p.z === 7 * L),
  );
  if (panels.length === s.panels.length) return;
  s.panels = panels;
  enforcePower(s);
}

export function placeBatteryByAntenna(s: Game) {
  if (s.built.includes("radio")) return;
  if ((s.stock.battery || 0) > 0) return;
  if (Object.values(s.players).some((p) => (p.bag.battery || 0) > 0)) return;
  let loose = s.items.find((i) => i.kind === "battery");
  if (!loose) loose = spawn(s, "battery", 1, -12 * L, -7 * L);
  loose.x = -12 * L;
  loose.z = -7 * L;
  loose.damaged = false;
  loose.count = Math.max(1, loose.count);
}
export function addPlayer(s: Game, id: string, name = "Explorer") {
  if (Object.keys(s.players).length >= B.maxPlayers || s.players[id])
    return false;
  const i = Object.keys(s.players).length;
  s.players[id] = {
    id,
    name: name.replace(/[^a-zA-Z0-9 _-]/g, "").slice(0, 16) || "Explorer",
    ...(s.phase === "flight" || s.returnMission?.flight?.deck
      ? deckSpawn(i)
      : { x: (1 + i * 1.2) * L, z: 3 * L }),
    color: [0xf97316, 0x3b82f6, 0x22c55e, 0xeab308][i],
    role: "Engineer",
    bag: {},
    move: { x: 0, z: 0 },
    joined: s.elapsed,
  };
  if (!s.host) s.host = id;
  return true;
}
export function removePlayer(s: Game, id: string) {
  leaveRover(s, id);
  const p = s.players[id];
  if (!p) return;
  for (const [k, v] of Object.entries(p.bag))
    if (v) spawn(s, k as Item, v, p.x, p.z);
  delete s.players[id];
  if (s.returnMission) {
    for (const key of Object.keys(s.returnMission.lessonTimers))
      if (key.startsWith(`${id}/`)) delete s.returnMission.lessonTimers[key];
  }
  if (s.host === id) s.host = Object.keys(s.players)[0] || "";
}
export function budget(s: Game) {
  return Math.floor(
    s.panels.reduce((n, p) => n + (p.covered ? 0 : B.panelPower * p.clean), 0) *
      (s.event?.kind === "storm" && s.event.resolved ? B.stormFactor : 1) +
      B.batteryPower,
  );
}
export const total = (a: Allocation) => a.air + a.light + a.radio + a.heat;
const close = (p: Player, pos: Point) => distance(p, pos) <= B.interactRadius;
const count = (s: Game, p: Player, k: Item) =>
  (s.stock[k] || 0) + (p.bag[k] || 0);
function spend(s: Game, p: Player, cost: Bag) {
  for (const [k, v] of Object.entries(cost)) {
    const key = k as Item;
    const n = Math.min(s.stock[key] || 0, v);
    s.stock[key] = (s.stock[key] || 0) - n;
    p.bag[key] = (p.bag[key] || 0) - (v - n);
  }
}
function has(s: Game, p: Player, cost: Bag) {
  return Object.entries(cost).every(([k, v]) => count(s, p, k as Item) >= v);
}
function endCheck(s: Game) {
  if (s.air <= 0 || s.food <= 0 || s.dose >= 100) {
    s.phase = "ended";
    s.result =
      s.air <= 0
        ? "Air ran low. Try giving the air machine at least 3 blocks."
        : s.food <= 0
          ? "Food ran low. Build a greenhouse early and give it light."
          : "Radiation added up. Build shielding and take cover during flares.";
  }
}
export function dispatch(s: Game, id: string, a: Action): string | undefined {
  const p = s.players[id];
  if (!p) return "Join a crew first.";
  const fail = (text: string) => text;
  if (["enterHab", "exitHab", "habPos"].includes(a.type)) return habAction(s,p,a);
  if (p.hab && a.type === "move" && Number(a.x) === 0 && Number(a.z) === 0) return;
  if (p.hab && s.phase !== "flight" && s.phase !== "ended" && !["chat","role","selectSlot","power","next","choice"].includes(a.type))
    return "Leave the habitat through its airlock to use outdoor equipment.";
  if (a.type === "selectSlot") {
    if (
      !Number.isInteger(a.slot) ||
      Number(a.slot) < 0 ||
      Number(a.slot) >= B.maxSlots
    )
      return fail("Choose an inventory slot from 1 to 5.");
    p.selectedSlot = Number(a.slot);
    return;
  }
  const r = roverState(s);
  const riding = s.phase === "day" && roverSeat(r, id) >= 0;
  if (["boardRover", "exitRover", "takeRover", "driveRover"].includes(a.type))
    return roverAction(s, id, a, WORLD);
  if (riding && ["move", "pos", "jump"].includes(a.type)) return;
  if (p.gust && ["move", "pos", "jump"].includes(a.type)) return;
  if (riding && !["chat", "role", "power", "next"].includes(a.type))
    return "Park and exit the rover to work at a field site.";
  if (
    [
      "flightMove",
      "takeHelm",
      "releaseHelm",
      "flightSteer",
      "holdCourse",
      "beginFlightRepair",
      "finishFlightRepair",
    ].includes(a.type)
  )
    return flightAction(s, id, a);
  if (
    [
      "acceptAlien",
      "donateAlien",
      "beginAlienRepair",
      "finishAlienRepair",
      "alienAnswer",
    ].includes(a.type)
  )
    return alienAction(s, id, a);
  if (
    [
      "startLessonQuiz",
      "startSalvage",
      "salvageAnswer",
      "installPart",
      "launchShip",
      "flightTask",
    ].includes(a.type)
  )
    return returnAction(s, id, a);
  if (a.type === "move") {
    if (s.phase !== "day") return;
    const x = Number(a.x),
      z = Number(a.z);
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    const len = Math.max(1, Math.hypot(x, z));
    p.move = { x: x / len, z: z / len };
    if (a.gait === "walk" || a.gait === "sprint" || a.gait === "crouch")
      p.gait = a.gait;
    return;
  }
  if (a.type === "pos") {
    // The moving player's own client is authoritative for its position so movement feels
    // instant. Guard against teleports: accept at most one sprint second plus slack per report.
    if (s.phase !== "day") return;
    const x = Number(a.x),
      z = Number(a.z);
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    const since = Math.max(0.05, s.elapsed - (p.posAt ?? s.elapsed - 1));
    const maxStep = gaitSpeed("sprint", false) * Math.min(1, since) * 1.6 + 1.5;
    let dx = x - p.x,
      dz = z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > maxStep) {
      dx *= maxStep / d;
      dz *= maxStep / d;
    }
    Object.assign(
      p,
      movePastPlayers(
        p,
        { x: p.x + dx, z: p.z + dz },
        Object.values(s.players).filter((other) => other.id !== id && !other.hab),
      ),
    );
    clampToWorld(p);
    const mx = Number(a.mx),
      mz = Number(a.mz);
    if (Number.isFinite(mx) && Number.isFinite(mz)) {
      const len = Math.max(1, Math.hypot(mx, mz));
      p.move = { x: mx / len, z: mz / len };
    }
    if (a.gait === "walk" || a.gait === "sprint" || a.gait === "crouch")
      p.gait = a.gait;
    p.posAt = s.elapsed;
    return;
  }
  if (a.type === "jump") {
    if (s.phase !== "day") return;
    if (p.jumpAt !== undefined && s.elapsed - p.jumpAt < B.jumpCooldown) return;
    p.jumpAt = s.elapsed;
    return;
  }
  if (a.type === "role") {
    if (["Engineer", "Scientist", "Medic", "Comms"].includes(String(a.role)))
      p.role = a.role as Role;
    return;
  }
  if (a.type === "chat") {
    const quick = [
      "Found ice! ❄️",
      "Meet at the workbench 🔧",
      "Take cover! 🛡️",
      "Let’s clean the panels ⚡",
    ];
    if (Number.isInteger(a.index) && quick[Number(a.index)])
      log(s, `${p.name}: ${quick[Number(a.index)]}`);
    return;
  }
  if (a.type === "power") {
    if (s.phase !== "power" || (id !== s.host && p.role !== "Comms"))
      return fail("The crew leader or Comms officer locks in power.");
    const v = a.value as Allocation;
    if (
      !v ||
      !["air", "light", "radio", "heat"].every(
        (k) =>
          Number.isInteger(v[k as keyof Allocation]) &&
          v[k as keyof Allocation] >= 0 &&
          v[k as keyof Allocation] <= 6,
      ) ||
      total(v) > budget(s)
    )
      return fail("Use only the power blocks you have.");
    s.allocation = { ...v };
    s.power = budget(s);
    s.phase = "day";
    s.clock = 0;
    s.leakFixed = false;
    s.watering = false;
    const r = random(s);
    const kind =
      s.sol === 1
        ? "supply"
        : s.sol === 2
          ? "storm"
          : s.sol === 3
            ? "flare"
            : r < 0.38
              ? "storm"
              : r < 0.7
                ? "flare"
                : r < 0.86
                  ? "leak"
                  : "supply";
    s.event = {
      kind,
      at: B.eventAt + (p.role === "Comms" ? 10 : 0),
      resolved: false,
    };
    if (kind === "flare")
      s.event.flare = flares[Math.floor(random(s) * flares.length)];
    s.history.push(`${s.sol}:${kind}:${s.event.flare?.classType || ""}`);
    log(
      s,
      "Power locked. Explore, scan the science beacons, and bring supplies to the workbench.",
    );
    return;
  }
  if (a.type === "next") {
    if (s.phase !== "summary" || id !== s.host) return;
    s.sol++;
    s.clock = 0;
    s.event = null;
    s.panels.forEach((p) => (p.covered = false));
    s.phase = "power";
    s.power = budget(s);
    return;
  }
  if (s.phase !== "day") return fail("Wait until exploration time.");
  if (["fieldObserve", "fieldReset", "fieldAnswer"].includes(a.type)) {
    const m = fieldMissions.find((m) => m.id === a.mission);
    if (!m) return fail("Unknown field investigation.");
    if (!close(p, missionSector(m)))
      return fail("Travel to this field station first.");
    if (!missionAvailable(s, m))
      return fail(
        "This investigation is complete or needs an earlier mission.",
      );
    const f = (s.expedition ??= {
      completed: [],
      surveyed: [],
      observations: {},
    });
    if (a.type === "fieldReset") {
      if (!f.surveyed.includes(m.id)) f.observations[m.id] = [];
      return;
    }
    if (a.type === "fieldObserve") {
      if (f.surveyed.includes(m.id)) return;
      const value = Number(a.value);
      if (!Number.isFinite(value))
        return fail("Choose a valid instrument reading.");
      const observations = (f.observations[m.id] ??= []);
      if (m.tool === "tune") {
        if (value < 0 || value > 100 || Math.abs(value - m.target!) > 5)
          return fail("Tune the instrument to at least 95% signal.");
        observations.push(value);
      } else {
        if (!Number.isInteger(value) || value < 0 || value >= m.samples.length)
          return fail("Choose a valid sample.");
        if (observations.includes(value)) return;
        if (m.tool === "sequence" && m.order![observations.length] !== value)
          return fail(
            "Check the process: what needs to happen before that step?",
          );
        observations.push(value);
      }
      if (m.tool === "tune" || observations.length === m.samples.length)
        f.surveyed.push(m.id);
      return;
    }
    if (!f.surveyed.includes(m.id))
      return fail(
        "Collect the instrument readings before making a conclusion.",
      );
    if (a.answer !== m.correct)
      return fail("Recheck the evidence. " + m.explanation);
    f.completed.push(m.id);
    if (m.id === "solar-test") {
      s.panels.push({ id: "panel-field-reward", ...solarRewardSite, clean: 1, covered: false });
      s.power = budget(s);
      log(s, "Solar array online. It powers the habitat and charges the return ship.");
    }
    const partReward = fieldPartRewards[m.id];
    if (partReward) recoverPart(s, partReward.part, partReward.rarity);
    scoreLesson(s, id, "field", m.id);
    const site = missionSector(m);
    Object.entries(m.reward).forEach(([kind, count], index) => {
      spawn(s, kind as Item, count, site.x + 3, site.z + 2 + index * 2);
    });
    log(s, `FIELD JOURNAL: ${m.title}. ${m.debrief}`);
    return;
  }
  if (a.type === "pick") {
    const i = s.items.findIndex((o) => o.id === a.target);
    if (i < 0) return;
    const it = s.items[i];
    if (!close(p, it)) return fail("Move closer to pick that up.");
    if (it.kind === "food") {
      s.food = clamp(s.food + it.count * 8);
      s.items.splice(i, 1);
      log(s, "Food found! The crew shares the crate.");
      return;
    }
    if (
      !(p.bag[it.kind] || 0) &&
      Object.values(p.bag).filter((n) => n && n > 0).length >= B.maxSlots
    )
      return fail("Hotbar full. Store supplies at the workbench.");
    const take = Math.min(it.count, B.stackLimit - (p.bag[it.kind] || 0));
    if (take <= 0) return fail("That stack is full. Store it at base.");
    p.bag[it.kind] = (p.bag[it.kind] || 0) + take;
    it.count -= take;
    if (!it.count) s.items.splice(i, 1);
    return;
  }
  if (a.type === "drop") {
    const k = a.kind as Item;
    if (!((p.bag[k] || 0) > 0)) return;
    spawn(s, k, p.bag[k]!, p.x + 1.5, p.z);
    delete p.bag[k];
    return;
  }
  if (a.type === "store") {
    if (!close(p, stations.workbench))
      return fail("Bring materials to the workbench.");
    let room =
      B.storageCapacity -
      Object.values(s.stock).reduce((n, v) => n + (v || 0), 0);
    for (const [k, v] of Object.entries(p.bag)) {
      const take = Math.min(v, room);
      s.stock[k as Item] = (s.stock[k as Item] || 0) + take;
      p.bag[k as Item] = v - take;
      room -= take;
    }
    log(s, "Materials stored safely in the hab.");
    return;
  }
  if (a.type === "learn") {
    const f = facts.find((f) => f.id === a.fact);
    if (!f || !close(p, stations[f.id as keyof typeof stations]))
      return fail("Scan the nearby science beacon first.");
    if (Number(a.answer) !== f.correct)
      return fail("Try again—read the field note for a clue.");
    if (!s.learned.includes(f.id)) {
      s.learned.push(f.id);
      scoreLesson(s, id, "beacon", f.id);
      log(
        s,
        `Science learned: ${f.title}. Recipe unlocked for the whole crew!`,
      );
    }
    return;
  }
  if (a.type === "cover") {
    const panel = s.panels.find((o) => o.id === a.target);
    if (!panel || !close(p, panel))
      return fail("Move closer to the solar panel.");
    panel.covered = !panel.covered;
    enforcePower(s);
    log(
      s,
      panel.covered
        ? "Panel covered: protected from dust, but makes no power today."
        : "Panel uncovered: sunlight can reach it again.",
    );
    return;
  }
  if (a.type === "beginTask") {
    const kind = String(a.kind),
      target = String(a.target || "");
    let pos: Point | undefined;
    if (kind === "clean") pos = s.panels.find((o) => o.id === target);
    if (kind === "align") pos = stations.comms;
    if (kind === "wire") pos = stations.workbench;
    if (kind === "patch") pos = stations.oxygen;
    if (kind === "water") pos = stations.grow;
    if (!pos || !close(p, pos)) return fail("Move closer to that task.");
    p.task = { kind, target, at: s.elapsed };
    return;
  }
  if (a.type === "finishTask") {
    const t = p.task;
    if (!t || s.elapsed - t.at < B.minTaskSeconds)
      return fail("Take a moment to finish the task.");
    const pos =
      t.kind === "clean"
        ? s.panels.find((o) => o.id === t.target)
        : t.kind === "align"
          ? stations.comms
          : t.kind === "water"
            ? stations.grow
            : t.kind === "patch"
              ? stations.oxygen
              : stations.workbench;
    if (!pos || !close(p, pos)) return fail("Stay near your task.");
    if (t.kind === "align") {
      if (!s.built.includes("radio")) return fail("Build the radio first.");
      if (Math.abs(Number(a.value) - 72) > 5)
        return fail("The needle must be in the green zone.");
      s.radio = Math.min(B.radioTarget, s.radio + 3);
      s.aligned = true;
    }
    if (t.kind === "wire" && String(a.value) !== "0,1,2")
      return fail("Match all three wire colors.");
    if (t.kind === "clean") {
      if (Number(a.value) < 18) return fail("Keep brushing the panel.");
      const panel = s.panels.find((o) => o.id === t.target)!;
      panel.clean = 1;
    }
    if (t.kind === "wire") {
      if (!has(s, p, { scrap: 1 }))
        return fail("You need 1 scrap to wire a circuit.");
      if (
        !(p.bag.circuit || 0) &&
        Object.values(p.bag).filter((n) => n && n > 0).length >= B.maxSlots
      )
        return fail("Store something to make room for the circuit.");
      spend(s, p, { scrap: 1 });
      p.bag.circuit = Math.min(B.stackLimit, (p.bag.circuit || 0) + 1);
    }
    if (t.kind === "patch") {
      if (Number(a.value) !== 3) return fail("Patch all three holes.");
      s.leakFixed = true;
    }
    if (t.kind === "water") {
      if (!s.built.includes("greenhouse"))
        return fail("Build a greenhouse first.");
      if (s.watering) return fail("The plants have been watered this sol.");
      if (!has(s, p, { ice: 1 }))
        return fail("You need one ice block for water.");
      spend(s, p, { ice: 1 });
      s.watering = true;
    }
    log(s, `${p.name} completed the ${t.kind} task.`);
    p.task = undefined;
    return;
  }
  if (a.type === "beginBuild") {
    if (!close(p, stations.workbench)) return fail("Build at the workbench.");
    const r = recipes.find((r) => r.id === a.recipe);
    if (!r) return;
    if (!s.learned.includes(r.fact))
      return fail("Learn the science before crafting.");
    if (r.id !== "panel" && s.built.includes(r.id))
      return fail("Already built.");
    if (!has(s, p, r.cost as Bag))
      return fail("Gather the materials shown in the recipe.");
    p.task = { kind: "build", target: r.id, at: s.elapsed };
    return;
  }
  if (a.type === "finishBuild") {
    const t = p.task;
    if (!t || t.kind !== "build" || !close(p, stations.workbench)) return;
    const r = recipes.find((r) => r.id === t.target)!;
    if (
      s.elapsed - t.at <
      (p.role === "Engineer" ? B.engineerBuildSeconds : B.buildSeconds)
    )
      return fail("Still building…");
    if (r.id !== "panel" && s.built.includes(r.id)) return;
    if (!has(s, p, r.cost as Bag))
      return fail("Those supplies were used. Gather more.");
    spend(s, p, r.cost as Bag);
    if (r.id === "panel") {
      const index = s.panels.length;
      s.panels.push({
        id: `panel-built-${++s.serial}`,
        x: solarRewardSite.x + 7 + (index % 5) * 7,
        z: solarRewardSite.z + Math.floor(index / 5) * 6,
        clean: 1,
        covered: false,
      });
      s.power = budget(s);
    } else s.built.push(r.id);
    log(s, r.id === "panel" ? "Solar panel online. Adds base power and charges the return ship." : `${r.name} built!`);
    p.task = undefined;
    return;
  }
  if (a.type === "choice") {
    const e = s.event;
    if (!e || e.kind !== "flare" || e.resolved || s.clock < e.at)
      return fail("There is no flare to respond to yet.");
    const dose =
      B.flareDose[(e.flare?.classType[0] || "M") as keyof typeof B.flareDose];
    if (a.choice === "shelter") {
      if (!s.built.includes("shelter"))
        return fail("Build a radiation shelter first.");
      if (s.food < 10) return fail("You need 10 food for a day inside.");
      s.food -= 10;
      s.dose += B.shelteredDose;
      log(s, "The crew took shelter. Food −10, flare dose +3.");
    } else if (a.choice === "ice") {
      if (!has(s, p, { ice: 2 })) return fail("You need 2 ice blocks.");
      spend(s, p, { ice: 2 });
      s.shield = Math.min(3, s.shield + 1);
      s.dose += Math.max(5, dose - 10 - s.shield * 3);
      log(s, "Ice shielding added. Two ice blocks used; dose still rises.");
    } else if (a.choice === "work") {
      s.dose += Math.max(5, dose - s.shield * 3);
      if (s.built.includes("radio"))
        s.radio = Math.min(B.radioTarget, s.radio + 3);
      log(s, `Work continued. Dose +${Math.max(5, dose - s.shield * 3)}.`);
    } else return;
    e.resolved = true;
    endCheck(s);
    return;
  }
}
function enforcePower(s: Game) {
  s.power = budget(s);
  while (total(s.allocation) > s.power) {
    const k = (["radio", "light", "heat", "air"] as const).find(
      (k) => s.allocation[k] > 0,
    );
    if (!k) break;
    s.allocation[k]--;
  }
}
function storm(s: Game) {
  s.panels.forEach((p) => {
    if (!p.covered)
      p.clean = Math.max(
        0.1,
        p.clean *
          (1 - B.stormMinLoss - random(s) * (B.stormMaxLoss - B.stormMinLoss)),
      );
  });
  s.items = s.items.filter((it) => {
    if (random(s) > B.looseItemRisk) return true;
    if (random(s) < 0.5) return false;
    it.count = Math.ceil(it.count / 2);
    it.damaged = true;
    return true;
  });
  log(
    s,
    "Dust storm: exposed panels lost sunlight. Loose supplies were damaged or lost; stored supplies stayed safe.",
  );
}
export function tick(s: Game, dt: number, advanceSurface = true) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  s.elapsed += dt;
  tickRover(s);
  if (s.phase === "flight" || s.phase === "ended") for (const p of Object.values(s.players)) delete p.hab;
  for (const m of s.pending.filter((m) => m.at <= s.elapsed)) log(s, m.text);
  s.pending = s.pending.filter((m) => m.at > s.elapsed);
  if (s.phase === "flight") {
    tickDeckFlight(s, dt);
    return;
  }
  if (s.phase !== "day" || !advanceSurface) return;
  s.clock += dt;
  s.devil = {
    x: 18 * L * Math.cos(s.elapsed * 0.045),
    z: 16 * L * Math.sin(s.elapsed * 0.045),
  };
  const rover = s.rover;
  if (rover && !rover.locked) {
    const wasBlown = !!rover.gust;
    blowDustDevil(rover, s.devil, s.elapsed, dt, true, (_from,to,gust) =>
      resolveRoverSurface({...to,heading:rover.heading},gust));
    if (rover.gust || wasBlown) {
      // Wind translates the chassis; do not spin its collision hull independently of contacts.
      rover.speed = 0;
      rover.credit = 0.8;
      rover.reportAt = s.elapsed;
      tickRover(s);
    }
  }
  for (const p of Object.values(s.players)) {
    if (p.hab || (s.rover && roverSeat(s.rover, p.id) >= 0)) continue;
    const wasBlown = !!p.gust;
    blowDustDevil(p, s.devil, s.elapsed, dt);
    if (p.gust || wasBlown) {
      p.move = { x: 0, z: 0 };
      clampToWorld(p);
      continue;
    }
    // A client that is reporting its own position drives this player directly.
    if (p.posAt !== undefined && s.elapsed - p.posAt < 0.5) continue;
    const speed = gaitSpeed(p.gait, s.allocation.heat < 1);
    Object.assign(
      p,
      movePastPlayers(
        p,
        { x: p.x + p.move.x * speed * dt, z: p.z + p.move.z * speed * dt },
        Object.values(s.players).filter((other) => other.id !== p.id && !other.hab),
      ),
    );
    clampToWorld(p);
  }
  if (s.elapsed >= s.devilDropAt) {
    s.devilDropAt = s.elapsed + 3;
    for (const it of s.items) {
      if (distance(it, s.devil) < 2) {
        const a = random(s) * Math.PI * 2,
          r = (5 + random(s) * 15) * L;
        it.x = Math.max(-25 * L, Math.min(25 * L, s.devil.x + Math.cos(a) * r));
        it.z = Math.max(-25 * L, Math.min(25 * L, s.devil.z + Math.sin(a) * r));
        log(s, "A dust devil moved a loose supply. Stored supplies are safe.");
      }
    }
  }
  const e = s.event;
  if (e && !e.resolved && s.clock >= e.at) {
    if (e.kind === "storm" && s.clock >= e.at + B.stormWarningSeconds) {
      e.resolved = true;
      storm(s);
      enforcePower(s);
    }
    if (e.kind === "supply") {
      spawn(s, "food", 2, 12 * L, -4 * L);
      spawn(s, "ice", 3, -11 * L, 9 * L);
      spawn(s, "scrap", 3, 8 * L, 10 * L);
      e.resolved = true;
      log(s, "An old supply cache was found! Look for the glowing crates.");
    }
    if (e.kind === "leak" && s.clock >= e.at + 30) {
      if (!s.leakFixed) {
        s.air = clamp(s.air - 12);
        log(s, "The leak was not patched in time. Air −12.");
      }
      e.resolved = true;
    }
    if (e.kind === "flare" && s.clock - dt < e.at) {
      s.pending.push({
        at: s.elapsed + B.commsGameSeconds,
        text: "MISSION CONTROL (sent 12 real minutes ago; 12 seconds in-game): Solar activity spotted. Make your own safety decisions!",
      });
    }
    if (e.kind === "flare" && s.clock >= e.at + 45) {
      dispatch(s, s.host, { type: "choice", choice: "work" });
    }
  }
  if (s.clock >= B.solSeconds) {
    const prev = { air: s.air, food: s.food, dose: s.dose };
    s.air = clamp(
      s.air +
        (s.allocation.air < B.airMinimum
          ? -B.airDrain
          : s.allocation.air >= 4
            ? B.airGain
            : 0) -
        (s.allocation.heat < 1 ? B.nightAirDrain : 0) +
        (s.built.includes("oxygen") && s.allocation.air >= 3 ? 3 : 0),
    );
    const harvest = s.built.includes("greenhouse")
      ? s.allocation.light * B.foodPerLight + (s.watering ? 4 : 0)
      : 0;
    s.food = clamp(s.food - B.foodDrain + harvest);
    s.dose = clamp(s.dose + B.normalDose);
    if (s.built.includes("radio"))
      s.radio = Math.min(B.radioTarget, s.radio + s.allocation.radio);
    s.power = budget(s);
    s.summary = [
      `Air ${s.air - prev.air >= 0 ? "+" : ""}${s.air - prev.air}: the air machine received ${s.allocation.air} blocks${s.allocation.heat < 1 ? "; cold nights used extra air" : ""}.`,
      `Food ${s.food - prev.food >= 0 ? "+" : ""}${s.food - prev.food}: crew ate ${B.foodDrain}; ${s.built.includes("greenhouse") ? `greenhouse produced ${harvest} with ${s.allocation.light} light blocks` : "no greenhouse was built yet"}.`,
      `Dose +${s.dose - prev.dose}: ordinary background radiation adds up every sol.`,
      `Power tomorrow: ${s.power} blocks. Clean dirty panels to recover sunlight.`,
    ];
    Object.values(s.players).forEach((p) => (p.move = { x: 0, z: 0 }));
    s.phase = "summary";
    endCheck(s);
    if (s.phase === "summary" && s.sol >= B.missionSols) {
      s.phase = "ended";
      s.result =
        "The return window closed. Recover and install all four ship systems, then launch before the end of Sol 15.";
    }
  }
  endCheck(s);
}
