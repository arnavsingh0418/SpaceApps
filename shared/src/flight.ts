import { SHIP_LAYOUT, walkableShip, moveOnShip } from "./flightLayout";
import type { Action, Game, Player } from "./sim";
import { movePastPlayers } from "./playerCollision";
import { awardPoints, returnChance, returnProgress } from "./returnMission";

export const flightDuration = 180;
export const arrivalDuration = 12;
export const deckSpeed = 4;
export const deckRooms = SHIP_LAYOUT.rooms;
export const flightStations = SHIP_LAYOUT.stations;
export type FlightStation = keyof typeof flightStations;
export type FailureKind = Exclude<FlightStation, "helm">;
export const flightEvents: { at: number; kind: FailureKind; title: string }[] =
  [
    { at: 18, kind: "power", title: "Power relay shorted" },
    { at: 47, kind: "air", title: "Oxygen valve stuck" },
    { at: 79, kind: "hull", title: "Cabin seal leaking" },
    { at: 112, kind: "engine", title: "Coolant pump overheated" },
    { at: 145, kind: "power", title: "Backup circuit tripped" },
  ];
export type FlightIncident = {
  id: string;
  kind: FailureKind;
  title: string;
  at: number;
  deadline: number;
  fixed: boolean;
  late: boolean;
  repairedBy?: string;
};
export type DeckFlight = {
  /** Versioned so occupied cutaway saves can migrate without losing systems progress. */
  layoutVersion?: number;
  time: number;
  hull: number;
  oxygen: number;
  power: number;
  heat: number;
  course: { x: number; y: number };
  steer: { x: number; y: number };
  pilot: string;
  pilotAt: number;
  autopilot: number;
  guidance: [boolean, boolean];
  incidents: FlightIncident[];
  nextEvent: number;
  repaired: number;
  missed: number;
  arrivalAt?: number;
  arrived?: boolean;
  outcome?: "home" | "rescue";
};
const clamp = (v: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, v));
export const walkableDeck = walkableShip;
/** Move an old occupied deck into the new corridor while retaining the ongoing flight. */
export function ensureFlightLayout(s: Game) {
  const d = s.returnMission?.flight?.deck;
  if (!d || d.layoutVersion === SHIP_LAYOUT.version) return;
  d.layoutVersion = SHIP_LAYOUT.version;
  d.pilot = "";
  d.steer = { x: 0, y: 0 };
  Object.values(s.players).forEach((p, i) => {
    Object.assign(p, deckSpawn(i));
    p.move = { x: 0, z: 0 };
    delete p.task;
    delete p.posAt;
  });
}
export function deckNear(p: { x: number; z: number }, station: FlightStation) {
  const pos = flightStations[station];
  return Math.hypot(p.x - pos.x, p.z - pos.z) <= 2.1;
}
export function nearestFlightStation(p: {
  x: number;
  z: number;
}): FlightStation | undefined {
  return (Object.keys(flightStations) as FlightStation[])
    .filter((k) => deckNear(p, k))
    .sort(
      (a, b) =>
        Math.hypot(p.x - flightStations[a].x, p.z - flightStations[a].z) -
        Math.hypot(p.x - flightStations[b].x, p.z - flightStations[b].z),
    )[0];
}
export function startingHull(s: Game) {
  return clamp(78 + (returnChance(s) - 50) * 0.4, 70, 96);
}
export function deckSpawn(index: number) {
  return { ...SHIP_LAYOUT.spawns[index % SHIP_LAYOUT.spawns.length] };
}
export function startDeckFlight(s: Game) {
  const progress = (s.returnMission ??= returnProgress(s));
  progress.flight = {
    stage: 0,
    deadline: s.elapsed + flightDuration,
    passed: [],
    baseChance: returnChance(s),
    deck: {
      layoutVersion: SHIP_LAYOUT.version,
      time: 0,
      hull: startingHull(s),
      oxygen: 100,
      power: 100,
      heat: 25,
      course: { x: 0.35, y: -0.2 },
      steer: { x: 0, y: 0 },
      pilot: "",
      pilotAt: 0,
      autopilot: 0,
      guidance: [false, false],
      incidents: [],
      nextEvent: 0,
      repaired: 0,
      missed: 0,
    },
  };
  Object.values(s.players).forEach((p, i) => {
    Object.assign(p, deckSpawn(i));
    p.move = { x: 0, z: 0 };
    delete p.task;
    delete p.posAt;
  });
  s.phase = "flight";
}
function finish(s: Game, home: boolean) {
  const f = s.returnMission!.flight!,
    d = f.deck!;
  d.arrived = true;
  d.outcome = home ? "home" : "rescue";
  s.phase = "ended";
  s.result = home
    ? "Mission complete! You steered the ship home and brought the crew back to Earth."
    : "The crew reached a recovery orbit. Mission Control sent a rescue craft. Repair faults sooner and keep the course centered next time.";
  for (const p of Object.values(s.players)) p.move = { x: 0, z: 0 };
}
/** Fixed-step, server-owned cabin simulation; no random final success roll. */
export function tickDeckFlight(s: Game, dt: number) {
  if (dt > 0.10001) {
    for (let remaining = dt; remaining > 1e-8; remaining -= 0.1)
      tickDeckFlight(s, Math.min(0.1, remaining));
    return;
  }
  if (!s.returnMission?.flight?.deck) startDeckFlight(s); // migrate an older in-flight save
  ensureFlightLayout(s);
  const f = s.returnMission!.flight!,
    d = f.deck!;
  if (d.arrived) return;
  if (d.arrivalAt !== undefined) {
    d.time += dt;
    if (d.time - d.arrivalAt >= arrivalDuration)
      finish(s, d.outcome === "home");
    return;
  }
  d.time += dt;
  for (const p of Object.values(s.players)) {
    const before = { x: p.x, z: p.z };
    const nx = p.x + p.move.x * deckSpeed * dt,
      nz = p.z + p.move.z * deckSpeed * dt;
    Object.assign(p, moveOnShip(before, { x: nx, z: nz }));
    const next = movePastPlayers(
      before,
      p,
      Object.values(s.players).filter((other) => other.id !== p.id),
    );
    if (walkableDeck(next.x, next.z)) Object.assign(p, next);
    else Object.assign(p, before);
  }
  if (
    d.pilot &&
    (!s.players[d.pilot] || !deckNear(s.players[d.pilot], "helm"))
  ) {
    d.pilot = "";
    d.steer = { x: 0, y: 0 };
  }
  if (s.elapsed - d.pilotAt > 0.35) d.steer = { x: 0, y: 0 };
  d.autopilot = Math.max(0, d.autopilot - dt);
  if (d.autopilot > 0) {
    d.course.x *= Math.exp(-dt * 2);
    d.course.y *= Math.exp(-dt * 2);
  } else {
    d.course.x = clamp(
      d.course.x + (Math.sin(d.time * 0.08) * 0.007 + d.steer.x * 0.45) * dt,
      -1,
      1,
    );
    d.course.y = clamp(
      d.course.y + (Math.cos(d.time * 0.06) * 0.006 + d.steer.y * 0.45) * dt,
      -1,
      1,
    );
  }
  while (
    d.nextEvent < flightEvents.length &&
    d.time >= flightEvents[d.nextEvent].at
  ) {
    const event = flightEvents[d.nextEvent++];
    d.incidents.push({
      ...event,
      id: `fault-${d.nextEvent}`,
      deadline: event.at + 36,
      fixed: false,
      late: false,
    });
    s.messages.push(
      `SHIP ALERT: ${event.title}. Go to ${flightStations[event.kind].name}.`,
    );
    s.messages = s.messages.slice(-8);
  }
  for (const fault of d.incidents.filter((i) => !i.fixed)) {
    if (!fault.late && d.time >= fault.deadline) {
      fault.late = true;
      d.missed++;
      d.hull -= 7;
    }
    if (fault.kind === "power") d.power -= dt * 0.7;
    if (fault.kind === "air") d.oxygen -= dt * 0.65;
    if (fault.kind === "hull") d.hull -= dt * 0.5;
    if (fault.kind === "engine") d.heat += dt * 0.75;
  }
  if (!d.incidents.some((i) => !i.fixed && i.kind === "power"))
    d.power = clamp(d.power + dt * 0.14);
  if (!d.incidents.some((i) => !i.fixed && i.kind === "engine"))
    d.heat = Math.max(25, d.heat - dt * 0.2);
  if (d.power < 20) d.oxygen -= dt * 0.15;
  if (Math.hypot(d.course.x, d.course.y) > 0.7) d.hull -= dt * 0.06;
  d.hull = clamp(d.hull);
  d.oxygen = clamp(d.oxygen);
  d.power = clamp(d.power);
  d.heat = clamp(d.heat);
  f.stage = Math.min(2, Math.floor(d.time / 60));
  const emergency = d.hull <= 0 || d.oxygen <= 0 || d.heat >= 100;
  if (emergency || d.time >= flightDuration) {
    d.outcome =
      !emergency &&
      d.hull > 20 &&
      d.oxygen > 20 &&
      d.heat < 90 &&
      Math.hypot(d.course.x, d.course.y) < 0.7 &&
      d.guidance.every(Boolean)
        ? "home"
        : "rescue";
    d.arrivalAt = d.time;
    d.pilot = "";
    d.steer = { x: 0, y: 0 };
    for (const p of Object.values(s.players)) p.move = { x: 0, z: 0 };
    f.passed = [
      d.hull > 20,
      d.oxygen > 20,
      Math.hypot(d.course.x, d.course.y) < 0.7,
    ];
  }
}
export function flightAction(
  s: Game,
  id: string,
  a: Action,
): string | undefined {
  ensureFlightLayout(s);
  const d = s.returnMission?.flight?.deck,
    p = s.players[id];
  if (s.phase !== "flight" || !d) return "The ship is not in flight.";
  if (d.arrivalAt !== undefined) return "Arrival sequence in progress.";
  if (a.type === "flightMove") {
    const x = Number(a.x),
      z = Number(a.z);
    if (!Number.isFinite(x) || !Number.isFinite(z))
      return "Choose a valid movement.";
    const length = Math.max(1, Math.hypot(x, z));
    p.move = { x: x / length, z: z / length };
    return;
  }
  if (a.type === "releaseHelm") {
    if (d.pilot === id) {
      d.pilot = "";
      d.steer = { x: 0, y: 0 };
    }
    return;
  }
  if (["takeHelm", "flightSteer", "holdCourse"].includes(a.type)) {
    if (!deckNear(p, "helm")) return "Go to the helm to steer.";
    if (d.pilot && d.pilot !== id && s.players[d.pilot])
      return "A crewmate is at the helm.";
    if (a.type === "takeHelm") {
      d.pilot = id;
      d.steer = { x: 0, y: 0 };
      p.move = { x: 0, z: 0 };
      return;
    }
    if (d.pilot !== id) return "Take the helm first.";
    if (a.type === "holdCourse") {
      if (Math.hypot(d.course.x, d.course.y) > 0.22)
        return "Center the course marker inside the target first.";
      if (
        d.power < 20 ||
        d.incidents.some((i) => !i.fixed && i.kind === "power")
      )
        return "Restore electrical power before locking autopilot.";
      d.autopilot = 30;
      d.guidance[d.time >= 120 ? 1 : 0] = true;
      return;
    }
    const x = Number(a.x),
      y = Number(a.y);
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      Math.abs(x) > 1 ||
      Math.abs(y) > 1
    )
      return "Invalid steering input.";
    d.steer = { x, y };
    d.pilotAt = s.elapsed;
    if (x || y) d.autopilot = 0;
    return;
  }
  const incident = d.incidents.find((i) => i.id === a.fault && !i.fixed);
  if (!incident) return "That fault is already repaired or unavailable.";
  if (!deckNear(p, incident.kind))
    return `Go to ${flightStations[incident.kind].name} to repair this fault.`;
  if (a.type === "beginFlightRepair") {
    p.task = { kind: "flightRepair", target: incident.id, at: s.elapsed };
    return;
  }
  if (a.type !== "finishFlightRepair") return "Unknown ship action.";
  if (
    p.task?.kind !== "flightRepair" ||
    p.task.target !== incident.id ||
    s.elapsed - p.task.at < 3
  )
    return "Finish the repair at this station; it takes at least three seconds.";
  const valid =
    incident.kind === "power"
      ? a.value === "0,1,2"
      : incident.kind === "air"
        ? a.value === "2,0,1"
        : incident.kind === "hull"
          ? a.value === "0,1,2,3"
          : typeof a.value === "number" &&
            Number.isFinite(a.value) &&
            Math.abs(a.value - 35) <= 5;
  if (!valid) return "Check the repair steps before confirming.";
  incident.fixed = true;
  incident.repairedBy = id;
  d.repaired++;
  delete p.task;
  if (incident.kind === "power") d.power = clamp(d.power + 28);
  if (incident.kind === "air") d.oxygen = clamp(d.oxygen + 25);
  if (incident.kind === "hull") d.hull = clamp(d.hull + 12);
  if (incident.kind === "engine") d.heat = Math.max(25, d.heat - 40);
  awardPoints(s.returnMission!, id, 150);
  s.messages.push(`${p.name} repaired ${flightStations[incident.kind].name}.`);
  s.messages = s.messages.slice(-8);
}
