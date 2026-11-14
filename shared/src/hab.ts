import layout from "./data/hab-layout.json";
import type { Action, Game, Player, Point } from "./sim";
import { roverSeat, roverBlocks } from "./rover";
export const HAB_LAYOUT = layout;
export const habSpeed = 5;
export type HabPosition = Point & { at: number; credit: number };
export const habStations = layout.zones;
export function habBlocked(x: number, z: number, radius = 0.6) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return true;
  const [x0, x1, z0, z1] = layout.bounds;
  if (x < x0 + radius || x > x1 - radius || z < z0 + radius || z > z1 - radius)
    return true;
  return layout.colliders.some((r) => {
    const dx = Math.max(0, Math.abs(x - r.x) - r.w / 2);
    const dz = Math.max(0, Math.abs(z - r.z) - r.d / 2);
    return dx * dx + dz * dz < radius * radius - 1e-8;
  });
}
/** Sweep through the same footprints used to build the Blender furnishings. */
export function moveInHab(from: Point, to: Point, others: Point[] = []) {
  const p = { x: from.x, z: from.z };
  const steps = Math.max(
    1,
    Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 0.15),
  );
  const dx = (to.x - from.x) / steps,
    dz = (to.z - from.z) / steps;
  const clear = (x: number, z: number) =>
    !habBlocked(x, z) &&
    others.every((o) => {
      const before = Math.hypot(p.x - o.x, p.z - o.z),
        after = Math.hypot(x - o.x, z - o.z);
      return after >= 1.2 - 1e-6 || (before < 1.2 && after > before + 1e-6);
    });
  for (let i = 0; i < steps; i++) {
    if (clear(p.x + dx, p.z + dz)) {
      p.x += dx;
      p.z += dz;
    } else if (clear(p.x + dx, p.z)) p.x += dx;
    else if (clear(p.x, p.z + dz)) p.z += dz;
  }
  return p;
}
export function berthOwners(s: Game) {
  const result: (Player | undefined)[] = Array(4).fill(undefined);
  for (const p of Object.values(s.players))
    if (p.habBerth !== undefined && p.habBerth >= 0 && p.habBerth < 4)
      result[p.habBerth] = p;
  return result;
}
export function nearestHabStation(at: Point) {
  return habStations
    .filter((q) => Math.hypot(q.x - at.x, q.z - at.z) < 2.7)
    .sort(
      (a, b) =>
        Math.hypot(a.x - at.x, a.z - at.z) - Math.hypot(b.x - at.x, b.z - at.z),
    )[0];
}
export function habRoom(at: Point) {
  return (
    habStations.find(
      (q) =>
        at.x >= q.area[0] &&
        at.x <= q.area[1] &&
        at.z >= q.area[2] &&
        at.z <= q.area[3],
    )?.name || "Habitat commons"
  );
}
export function habAction(s: Game, p: Player, a: Action): string | undefined {
  if (s.phase === "flight" || s.phase === "ended")
    return "The surface hab is unavailable during the return flight.";
  if (a.type === "enterHab") {
    if (p.hab) return;
    if (s.phase !== "day") return "Enter the hab during exploration time.";
    if (s.rover && roverSeat(s.rover, p.id) >= 0)
      return "Park and exit the rover first.";
    if (Math.hypot(p.x - layout.exterior.x, p.z - layout.exterior.z) > 3.1)
      return "Approach the habitat airlock.";
    const others = Object.values(s.players)
      .filter((q) => q.id !== p.id && q.hab)
      .map((q) => q.hab!);
    const entry = [
      { x: -1, z: 8.1 },
      { x: 1, z: 8.1 },
      { x: -1, z: 9.7 },
      { x: 1, z: 9.7 },
    ].find(
      (q) =>
        !habBlocked(q.x, q.z) &&
        others.every((o) => Math.hypot(q.x - o.x, q.z - o.z) >= 1.2),
    );
    if (!entry) return "Wait for the crew to clear the airlock.";
    if (p.habBerth === undefined) {
      const owners = berthOwners(s);
      p.habBerth = [0, 1, 2, 3].find((i) => !owners[i]);
    }
    p.hab = { ...entry, at: s.elapsed, credit: 1 };
    p.move = { x: 0, z: 0 };
    delete p.task;
    return;
  }
  if (!p.hab) return "Enter the habitat first.";
  if (a.type === "exitHab") {
    if (Math.hypot(p.hab.x, p.hab.z - 8.7) > 3)
      return "Return to the airlock to go outside.";
    const others = Object.values(s.players).filter(
      (q) => q.id !== p.id && !q.hab,
    );
    const exit = [
      { x: 0, z: -8.5 },
      { x: 2.9, z: -8.3 },
      { x: -2.9, z: -8.3 },
      { x: 4.2, z: -8.3 },
    ].find(
      (q) =>
        (!s.rover || !roverBlocks(s.rover, q.x, q.z)) &&
        others.every((o) => Math.hypot(q.x - o.x, q.z - o.z) >= 1.2),
    );
    if (!exit) return "Clear the exterior hatch before cycling outside.";
    Object.assign(p, exit);
    delete p.hab;
    p.move = { x: 0, z: 0 };
    p.posAt = s.elapsed;
    return;
  }
  if (a.type === "habPos") {
    if (s.phase !== "day") return;
    const x = Number(a.x),
      z = Number(a.z);
    if (!Number.isFinite(x) || !Number.isFinite(z))
      return "Invalid cabin position.";
    const h = p.hab;
    h.credit = Math.min(3, h.credit + Math.max(0, s.elapsed - h.at) * habSpeed);
    h.at = s.elapsed;
    const d = Math.hypot(x - h.x, z - h.z);
    const ratio = d > 0 ? Math.min(1, h.credit / d) : 0;
    const next = moveInHab(
      h,
      { x: h.x + (x - h.x) * ratio, z: h.z + (z - h.z) * ratio },
      Object.values(s.players)
        .filter((q) => q.id !== p.id && q.hab)
        .map((q) => q.hab!),
    );
    h.credit = Math.max(0, h.credit - Math.hypot(next.x - h.x, next.z - h.z));
    Object.assign(h, next);
    return;
  }
}
