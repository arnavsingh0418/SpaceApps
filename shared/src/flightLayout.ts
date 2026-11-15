import layout from "./data/flight-layout.json";
import type { Point } from "./sim";
export const SHIP_LAYOUT = layout;
/** A circle can cross the open corridor/bridge join while staying inside the combined floor. */
export function walkableShip(x: number, z: number, radius = 0.55) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  const floor = (x: number, z: number) =>
    layout.rooms.some(
      (r) => Math.abs(x - r.x) <= r.w / 2 && Math.abs(z - r.z) <= r.d / 2,
    );
  if (
    ![
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [0.707, 0.707],
      [-0.707, 0.707],
      [0.707, -0.707],
      [-0.707, -0.707],
    ].every(([dx, dz]) => floor(x + dx * radius, z + dz * radius))
  )
    return false;
  return !layout.colliders.some((r) => {
    const dx = Math.max(0, Math.abs(x - r.x) - r.w / 2),
      dz = Math.max(0, Math.abs(z - r.z) - r.d / 2);
    return dx * dx + dz * dz < radius * radius - 1e-8;
  });
}
export function moveOnShip(from: Point, to: Point) {
  const p = { x: from.x, z: from.z },
    steps = Math.max(
      1,
      Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 0.15),
    ),
    dx = (to.x - from.x) / steps,
    dz = (to.z - from.z) / steps;
  for (let i = 0; i < steps; i++) {
    if (walkableShip(p.x + dx, p.z + dz)) {
      p.x += dx;
      p.z += dz;
    } else if (walkableShip(p.x + dx, p.z)) p.x += dx;
    else if (walkableShip(p.x, p.z + dz)) p.z += dz;
  }
  return p;
}
/** Same yaw convention as the surface camera: W faces -Z at yaw zero. */
export function shipMoveInput(x: number, z: number, yaw: number) {
  const n = Math.max(1, Math.hypot(x, z));
  return {
    x: (x * Math.cos(yaw) + z * Math.sin(yaw)) / n,
    z: (-x * Math.sin(yaw) + z * Math.cos(yaw)) / n,
  };
}
