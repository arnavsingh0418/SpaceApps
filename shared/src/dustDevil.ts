import type { Point } from "./sim";
import { MARS_GRAVITY } from "./surfacePhysics";
export const VORTEX = { radius: 18, core: 5, height: 18 };
export type Gust = { vx: number; vz: number; height: number; vy: number; lifted?: boolean };
export function vortexField(x: number, z: number, center: Point) {
  const dx = x - center.x,
    dz = z - center.z,
    r = Math.hypot(dx, dz),
    t = Math.min(1, r / VORTEX.radius);
  const strength = 1 - t * t * (3 - 2 * t),
    nx = r > 0.001 ? dx / r : 1,
    nz = r > 0.001 ? dz / r : 0;
  // Finite core, smooth outer falloff; no discontinuous angle or random pulse.
  const spin =
      (22 * strength * r) / Math.sqrt(r * r + VORTEX.core * VORTEX.core),
    out = 9 * strength;
  return { strength, vx: -nz * spin + nx * out, vz: nx * spin + nz * out };
}
export type GustContact = (from: Point, to: Point, gust: Gust) => Point;
/** Fictional gameplay updraft; bounded forces, fixed substeps and real Mars gravity on descent. */
export function blowDustDevil(
  body: Point & { gust?: Gust },
  center: Point,
  _time: number,
  dt: number,
  rover = false,
  contact?: GustContact,
) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  if (
    !body.gust &&
    vortexField(body.x, body.z, center).strength < (rover ? 0.35 : 0.12)
  )
    return;
  const g = (body.gust ??= { vx: 0, vz: 0, height: 0, vy: 0 });
  if (![g.vx, g.vz, g.height, g.vy].every(Number.isFinite)) {
    delete body.gust;
    return;
  }
  const duration = Math.min(dt, 0.5),
    steps = Math.ceil(duration * 120),
    h = duration / steps;
  for (let i = 0; i < steps; i++) {
    const f = vortexField(body.x, body.z, center),
      weight = rover ? 0.72 : 1;
    // The inflow draws an approaching body under the updraft. Once airborne,
    // it keeps the outward flow until it clears the vortex and lands.
    if (g.height > 0.5) g.lifted = true;
    const radius = Math.hypot(body.x - center.x, body.z - center.z);
    if (!g.lifted && radius > 0.001) {
      f.vx -= 18 * f.strength * (body.x - center.x) / radius;
      f.vz -= 18 * f.strength * (body.z - center.z) / radius;
    }
    const drag = f.strength > 0.02 ? 2.8 : g.height > 0.02 ? 0.25 : 3.8;
    const k = 1 - Math.exp(-drag * h);
    g.vx += (f.vx * weight - g.vx) * k;
    g.vz += (f.vz * weight - g.vz) * k;
    const before = { x: body.x, z: body.z },
      to = { x: body.x + g.vx * h, z: body.z + g.vz * h };
    Object.assign(body, contact ? contact(before, to, g) : to);
    const lift = (rover ? 14 : 20) * f.strength * f.strength;
    g.vy +=
      (lift -
        MARS_GRAVITY -
        g.height * f.strength * 1.8 -
        g.vy * (f.strength * 1.8 + 0.08)) *
      h;
    g.height += g.vy * h;
    if (g.height <= 0) {
      g.height = 0;
      g.vy = 0;
    }
  }
  const field = vortexField(body.x, body.z, center);
  if (field.strength < 0.12 && g.height === 0 && Math.hypot(g.vx, g.vz) < 0.4)
    delete body.gust;
}
