import type { Point } from "./sim";
export const playerRadius = 0.6;
/** Sweep in short steps so even a fast position report cannot cross another astronaut. */
export function movePastPlayers(
  from: Point,
  to: Point,
  others: Point[],
  diameter = playerRadius * 2,
): Point {
  let p = { x: from.x, z: from.z };
  const steps = Math.max(
    1,
    Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 0.2),
  );
  const dx = (to.x - from.x) / steps,
    dz = (to.z - from.z) / steps;
  let blocked = false;
  for (let i = 0; i < steps; i++) {
    const valid = (q: Point) =>
      others.every((o) => {
        const before = Math.hypot(p.x - o.x, p.z - o.z),
          after = Math.hypot(q.x - o.x, q.z - o.z);
        return (
          after >= diameter - 1e-6 ||
          (before < diameter && after > before + 1e-6)
        );
      });
    const next = { x: p.x + dx, z: p.z + dz };
    if (valid(next)) p = next;
    else {
      blocked = true;
      if (valid({ x: next.x, z: p.z })) p.x = next.x;
      else if (valid({ x: p.x, z: next.z })) p.z = next.z;
    }
  }
  return blocked ? p : { x: to.x, z: to.z };
}
