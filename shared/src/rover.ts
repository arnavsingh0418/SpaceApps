import type { Game, Action } from "./sim";

export const ROVER = {
  spawn: { x: 14, z: -17 },
  maxSpeed: 18,
  reverseSpeed: 5,
  halfWidth: 2.45,
  halfLength: 3.7,
  height: 5.15,
  wheelbase: 4.5,
  wheelRadius: 0.85,
  boardRadius: 5.7,
};
export type RoverState = {
  x: number;
  z: number;
  heading: number;
  speed: number;
  driver: string | null;
  passengers: string[];
  odometer: number;
  reportAt: number;
  credit: number;
};
export const createRover = (): RoverState => ({
  ...ROVER.spawn,
  heading: 0,
  speed: 0,
  driver: null,
  passengers: [],
  odometer: 0,
  reportAt: 0,
  credit: 0.8,
});
export const roverState = (s: Game) => (s.rover ??= createRover());
export function roverSeat(r: RoverState, id: string) {
  if (r.driver === id) return 0;
  const n = r.passengers.indexOf(id);
  return n < 0 ? -1 : n + 1;
}
export function roverPoint(
  r: { x: number; z: number; heading: number },
  x: number,
  z: number,
) {
  const c = Math.cos(r.heading),
    s = Math.sin(r.heading);
  return { x: r.x + x * c + z * s, z: r.z - x * s + z * c };
}
export function roverBlocks(
  r: { x: number; z: number; heading: number },
  x: number,
  z: number,
  radius = 0.6,
) {
  const dx = x - r.x,
    dz = z - r.z,
    c = Math.cos(r.heading),
    s = Math.sin(r.heading);
  return (
    Math.abs(dx * c - dz * s) < ROVER.halfWidth + radius &&
    Math.abs(dx * s + dz * c) < ROVER.halfLength + radius
  );
}
export function roverExits(r: RoverState) {
  return [
    [3.7, 0],
    [-3.7, 0],
    [3.7, 2],
    [-3.7, 2],
    [0, 5.2],
    [0, -5.2],
  ].map(([x, z]) => roverPoint(r, x, z));
}
export const angleDelta = (a: number, b: number) =>
  Math.atan2(Math.sin(a - b), Math.cos(a - b));
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
type Bounds = { x: number; z: number; r: number };
export function roverAction(
  s: Game,
  id: string,
  a: Action,
  bounds: Bounds,
): string | undefined {
  const r = roverState(s),
    p = s.players[id];
  if (s.phase !== "day") return "Use the rover during exploration.";
  const seat = roverSeat(r, id);
  if (a.type === "boardRover") {
    if (seat >= 0) return;
    if (Math.hypot(p.x - r.x, p.z - r.z) > ROVER.boardRadius)
      return "Move closer to the rover.";
    if (Math.abs(r.speed) > 0.5) return "Wait for the rover to stop.";
    if (!r.driver) {
      r.driver = id;
      r.credit = 0.8;
      r.reportAt = s.elapsed;
    } else if (r.passengers.length < 3) r.passengers.push(id);
    else return "All four rover seats are occupied.";
    delete p.task;
    syncRiders(s);
    return;
  }
  if (a.type === "takeRover") {
    if (seat < 0) return "Board the rover first.";
    if (r.driver && r.driver !== id) return "Another explorer is driving.";
    if (Math.abs(r.speed) > 0.5) return "Stop before changing seats.";
    r.passengers = r.passengers.filter((p) => p !== id);
    r.driver = id;
    r.reportAt = s.elapsed;
    r.credit = 0.8;
    return;
  }
  if (a.type === "exitRover") {
    if (seat < 0) return;
    if (Math.abs(r.speed) > 0.5) return "Brake to a stop before exiting.";
    const x = Number(a.x),
      z = Number(a.z);
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(z) ||
      Math.hypot(x - r.x, z - r.z) > 7 ||
      roverBlocks(r, x, z) ||
      Math.hypot(x - bounds.x, z - bounds.z) > bounds.r
    )
      return "Choose a safe spot beside the parked rover.";
    if (r.driver === id) r.driver = null;
    r.passengers = r.passengers.filter((p) => p !== id);
    p.x = x;
    p.z = z;
    p.move = { x: 0, z: 0 };
    p.posAt = s.elapsed;
    return;
  }
  if (a.type === "driveRover") {
    if (r.driver !== id) return "Only the rover driver can steer.";
    const x = Number(a.x),
      z = Number(a.z),
      heading = Number(a.heading),
      speed = Number(a.speed);
    if (![x, z, heading, speed].every(Number.isFinite))
      return "Invalid rover movement.";
    // Accumulated travel allowance prevents repeated messages in one server tick
    // from manufacturing movement credit. No per-message teleport allowance.
    const elapsed = Math.max(0, Math.min(0.5, s.elapsed - r.reportAt));
    r.credit = Math.min(
      ROVER.maxSpeed * 0.5 + 0.8,
      r.credit + elapsed * ROVER.maxSpeed,
    );
    r.reportAt = s.elapsed;
    let dx = x - r.x,
      dz = z - r.z,
      d = Math.hypot(dx, dz);
    if (d > r.credit) {
      const k = r.credit / (d || 1);
      dx *= k;
      dz *= k;
      d = r.credit;
    }
    const nx = r.x + dx,
      nz = r.z + dz;
    if (Math.hypot(nx - bounds.x, nz - bounds.z) > bounds.r - 5) {
      r.speed = 0;
      return;
    }
    r.x = nx;
    r.z = nz;
    r.credit = Math.max(0, r.credit - d);
    r.odometer += d;
    const turn = (d / ROVER.wheelbase) * 0.8;
    r.heading += clamp(angleDelta(heading, r.heading), -turn, turn);
    r.heading = angleDelta(r.heading, 0);
    r.speed = clamp(speed, -ROVER.reverseSpeed, ROVER.maxSpeed);
    syncRiders(s);
    return;
  }
}
function syncRiders(s: Game) {
  const r = roverState(s);
  for (const id of [r.driver, ...r.passengers]) {
    const p = id && s.players[id];
    if (p) {
      p.x = r.x;
      p.z = r.z;
      p.move = { x: 0, z: 0 };
      p.gait = "walk";
      p.posAt = s.elapsed;
    }
  }
}
export function leaveRover(s: Game, id: string) {
  const r = s.rover;
  if (!r) return;
  if (r.driver === id) {
    r.driver = null;
    r.speed = 0;
  }
  r.passengers = r.passengers.filter((p) => p !== id);
}
export function tickRover(s: Game) {
  const r = s.rover;
  if (!r) return;
  if (r.driver && !s.players[r.driver]) {
    r.driver = null;
    r.speed = 0;
  }
  r.passengers = r.passengers.filter((p) => !!s.players[p]);
  if (s.phase !== "day" || s.elapsed - r.reportAt > 0.4) r.speed = 0;
  if (s.phase === "flight" || s.phase === "ended") {
    r.driver = null;
    r.passengers = [];
    return;
  }
  syncRiders(s);
}
