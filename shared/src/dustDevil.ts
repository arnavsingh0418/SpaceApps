import type { Point } from "./sim";

export type Gust = { vx: number; vz: number; height: number; vy: number };

/** Fictional vortex physics. Gusts grow toward the center and keep acting until you escape. */
export function blowDustDevil(
  body: Point & { gust?: Gust },
  center: Point,
  time: number,
  dt: number,
  rover = false,
) {
  const dx = body.x - center.x,
    dz = body.z - center.z;
  const distance = Math.hypot(dx, dz);
  const strength = Math.max(0, 1 - distance / 18) ** 1.3;
  if (!strength && !body.gust) return;
  const gust = (body.gust ??= { vx: 0, vz: 0, height: 0, vy: 0 });
  const angle = distance > 0.2 ? Math.atan2(dz, dx) : time * 2;
  const pulse = 0.8 + 0.2 * Math.sin(time * 5);
  const spin = strength * (rover ? 14 : 19) * pulse;
  const shove = strength * (rover ? 8 : 10);
  const blend = 1 - Math.exp(-dt * (strength ? 3 : 1.6));
  gust.vx +=
    (-Math.sin(angle) * spin + Math.cos(angle) * shove - gust.vx) * blend;
  gust.vz +=
    (Math.cos(angle) * spin + Math.sin(angle) * shove - gust.vz) * blend;
  body.x += gust.vx * dt;
  body.z += gust.vz * dt;
  const ceiling =
    strength * (rover ? 4 : 6) * (0.66 + 0.34 * Math.sin(time * 3.2));
  gust.vy +=
    ((ceiling - gust.height) * 11 - gust.vy * 4 - (strength ? 0 : 3.72)) * dt;
  gust.height = Math.max(0, gust.height + gust.vy * dt);
  if (gust.height === 0) gust.vy = Math.max(0, gust.vy);
  if (!strength && gust.height === 0 && Math.hypot(gust.vx, gust.vz) < 0.35)
    delete body.gust;
}
