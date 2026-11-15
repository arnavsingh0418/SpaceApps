/** Offline terrain check: parse the shipped GLB and flood-fill walkable surface samples. */
import { readFileSync } from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { Terrain, SPAWN_BLENDER } from "../client/src/render/terrain";
import { sectors, solarRewardSite } from "../shared/src/expedition";
import { alienSite, alienRoverSite } from "../shared/src/alien";
import { launchSite, salvageSites } from "../shared/src/returnMission";
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const data = readFileSync("client/public/models/mars_map.glb");
const gltf = await loader.parseAsync(
  data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
  "",
);
const root = gltf.scene;
root.updateMatrixWorld(true);
const terrain = new Terrain(),
  raw = new Terrain();
// Invoke the same indexing and pad preprocessing that the runtime uses, without a browser or GPU.
const access = (t: Terrain) =>
  t as unknown as {
    index: (o: T.Object3D, x?: number, y?: number, z?: number) => void;
    rawAt: (x: number, z: number) => number;
    flattenPad: (m: T.Mesh, r: T.Object3D) => void;
    clearPad: (m: T.Mesh, r: T.Object3D) => void;
  };
access(raw).index(
  root.getObjectByName("MARS_Terrain")!,
  -SPAWN_BLENDER.x,
  0,
  SPAWN_BLENDER.y,
);
root.position.set(-SPAWN_BLENDER.x, -access(raw).rawAt(0, 0), SPAWN_BLENDER.y);
root.updateMatrixWorld(true);
root.traverse((o) => {
  if (!(o instanceof T.Mesh)) return;
  if (/Terrain/i.test(o.name)) access(terrain).flattenPad(o, root);
  if (/Boulder/i.test(o.name)) access(terrain).clearPad(o, root);
});
root.updateMatrixWorld(true);
root.traverse((o) => {
  if (o instanceof T.Mesh && !/Storm/i.test(o.name)) access(terrain).index(o);
});
terrain.ready = true;
const step = 3,
  key = (x: number, z: number) => `${x},${z}`;
const queue: [number, number][] = [[0, 0]],
  visited = new Set([key(0, 0)]),
  heights = new Map<string, number>();
const height = (x: number, z: number) => {
  const k = key(x, z);
  if (!heights.has(k)) heights.set(k, terrain.heightAt(x, z));
  return heights.get(k)!;
};
for (let i = 0; i < queue.length; i++) {
  const [x, z] = queue[i],
    y = height(x, z);
  for (const [dx, dz] of [
    [step, 0],
    [-step, 0],
    [0, step],
    [0, -step],
  ]) {
    const nx = x + dx,
      nz = z + dz,
      k = key(nx, nz);
    if (visited.has(k) || nx < -180 || nx > 330 || nz < -310 || nz > 140)
      continue;
    const ny = height(nx, nz);
    if (Math.abs(ny - y) > 1.5 || terrain.collides(nx, nz, ny)) continue;
    if (terrain.collides(x + dx / 2, z + dz / 2, (y + ny) / 2)) continue;
    visited.add(k);
    queue.push([nx, nz]);
  }
}
let failed = false;
for (const s of [
  ...sectors,
  alienSite,
  { ...alienRoverSite, name: "Wayfarer rover" },
  { ...solarRewardSite, name: "Sunward solar array" },
  ...salvageSites.map((site) => ({ ...site, name: `${site.name} salvage` })),
  { ...launchSite, name: "Return vehicle" },
]) {
  const nearest = queue.reduce(
    (best, [x, z]) => Math.min(best, Math.hypot(x - s.x, z - s.z)),
    Infinity,
  );
  console.log(
    `${s.name}: ${nearest.toFixed(1)}m to reachable terrain, height ${height(s.x, s.z).toFixed(1)}m`,
  );
  if (nearest > 4.4) failed = true;
}
console.log(
  `${visited.size} connected terrain samples checked. Buildings and exact foot placement still require browser QA.`,
);
if (failed) process.exitCode = 1;
