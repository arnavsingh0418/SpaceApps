import balance from "./data/balance.json";
export const MARS_GRAVITY = 3.71;
export const SURFACE_BOUNDS = {
  x: balance.worldCenterX,
  z: balance.worldCenterZ,
  r: balance.worldRadius,
};
export type Pose = { x: number; z: number; heading: number };
export type Contact = {
  x: number;
  z: number;
  nx: number;
  nz: number;
  hit: boolean;
};
const width = 2.45,
  length = 3.7;
/** Exact clearance of the four hull corners against the circular map perimeter. */
export function containRover(p: Pose, bounds = SURFACE_BOUNDS): Contact {
  const dx = p.x - bounds.x,
    dz = p.z - bounds.z,
    d = Math.hypot(dx, dz),
    nx = dx / (d || 1),
    nz = dz / (d || 1);
  const c = Math.cos(p.heading),
    s = Math.sin(p.heading);
  let limit = bounds.r;
  for (const x of [-width, width])
    for (const z of [-length, length]) {
      const ox = x * c + z * s,
        oz = -x * s + z * c,
        dot = nx * ox + nz * oz;
      limit = Math.min(
        limit,
        -dot +
          Math.sqrt(
            Math.max(0, dot * dot + bounds.r * bounds.r - ox * ox - oz * oz),
          ) -
          0.02,
      );
    }
  return {
    x: bounds.x + nx * Math.min(d, limit),
    z: bounds.z + nz * Math.min(d, limit),
    nx,
    nz,
    hit: d > limit + 1e-7,
  };
}
/** Shared hab footprint matches the 12.4 m wide Blender foundation, including its vestibule. */
export const HAB_FOOTPRINT = { x: 0, z: -17, r: 6.2 };
export function separateHab(p: Pose): Contact {
  const c = Math.cos(p.heading),
    s = Math.sin(p.heading),
    dx = HAB_FOOTPRINT.x - p.x,
    dz = HAB_FOOTPRINT.z - p.z;
  const lx = dx * c - dz * s,
    lz = dx * s + dz * c;
  const qx = Math.max(-width, Math.min(width, lx)),
    qz = Math.max(-length, Math.min(length, lz));
  let ax = qx - lx,
    az = qz - lz,
    dist = Math.hypot(ax, az),
    depth = HAB_FOOTPRINT.r - dist;
  if (depth <= 0) return { ...p, nx: 0, nz: 0, hit: false };
  if (dist < 1e-7) {
    // An old save can already have the hab centre inside the hull.
    if (width - Math.abs(lx) < length - Math.abs(lz)) {
      ax = lx > 0 ? -1 : 1;
      az = 0;
      depth = HAB_FOOTPRINT.r + width - Math.abs(lx);
    } else {
      ax = 0;
      az = lz > 0 ? -1 : 1;
      depth = HAB_FOOTPRINT.r + length - Math.abs(lz);
    }
    dist = 1;
  }
  const nx = (ax * c + az * s) / dist,
    nz = (-ax * s + az * c) / dist;
  return {
    x: p.x + nx * (depth + 0.015),
    z: p.z + nz * (depth + 0.015),
    nx,
    nz,
    hit: true,
  };
}
/** Remove just velocity entering a surface, retaining tangent motion and a soft rebound. */
export function deflect(
  v: { vx: number; vz: number },
  nx: number,
  nz: number,
  restitution = 0.12,
) {
  const vn = v.vx * nx + v.vz * nz;
  if (vn < 0) {
    v.vx -= (1 + restitution) * vn * nx;
    v.vz -= (1 + restitution) * vn * nz;
  }
}
/** SAT contact for the hab vestibule, using the visible Blender dimensions. */
export function separateVestibule(p: Pose): Contact {
  const c = Math.cos(p.heading),
    s = Math.sin(p.heading),
    right = { x: c, z: -s },
    forward = { x: s, z: c };
  const dx = p.x,
    dz = p.z + 10.88052;
  let depth = Infinity,
    nx = 0,
    nz = 0;
  for (const a of [{ x: 1, z: 0 }, { x: 0, z: 1 }, right, forward]) {
    const distance = dx * a.x + dz * a.z;
    const reach =
      width * Math.abs(right.x * a.x + right.z * a.z) +
      length * Math.abs(forward.x * a.x + forward.z * a.z) +
      1.651 * Math.abs(a.x) +
      1.892 * Math.abs(a.z);
    const overlap = reach - Math.abs(distance);
    if (overlap <= 0) return { ...p, nx: 0, nz: 0, hit: false };
    if (overlap < depth) {
      depth = overlap;
      const sign = distance < 0 ? -1 : 1;
      nx = a.x * sign;
      nz = a.z * sign;
    }
  }
  return {
    x: p.x + nx * (depth + 0.015),
    z: p.z + nz * (depth + 0.015),
    nx,
    nz,
    hit: true,
  };
}
export function resolveRoverSurface(
  p: Pose,
  v?: { vx: number; vz: number },
  bounds = SURFACE_BOUNDS,
) {
  let at = { ...p };
  for (let i = 0; i < 2; i++)
    for (const solve of [separateHab, separateVestibule]) {
      const hit = solve(at);
      if (hit.hit) {
        at.x = hit.x;
        at.z = hit.z;
        if (v) deflect(v, hit.nx, hit.nz);
      }
    }
  const edge = containRover(at, bounds);
  if (edge.hit) {
    at.x = edge.x;
    at.z = edge.z;
    if (v) deflect(v, -edge.nx, -edge.nz);
  }
  return { x: at.x, z: at.z };
}
