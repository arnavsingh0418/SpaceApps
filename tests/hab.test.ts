import { it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  createGame,
  addPlayer,
  dispatch,
  tick,
  removePlayer,
} from "../shared/src/sim";
import {
  HAB_LAYOUT,
  habBlocked,
  moveInHab,
  berthOwners,
  nearestHabStation,
  habRoom,
} from "../shared/src/hab";
import { habDirectory, habEquipment, habMap } from "../client/src/ui/hab";
function mission(n = 1) {
  const s = createGame(420);
  for (let i = 0; i < n; i++) addPlayer(s, String(i), "Crew " + i);
  dispatch(s, "0", {
    type: "power",
    value: { air: 3, light: 3, radio: 3, heat: 2 },
  });
  return s;
}
function enter(s: ReturnType<typeof mission>, id = "0") {
  Object.assign(s.players[id], HAB_LAYOUT.exterior);
  expect(dispatch(s, id, { type: "enterHab" })).toBeUndefined();
  expect(s.players[id].hab).toBeTruthy();
}
afterEach(() => vi.restoreAllMocks());
it("preserves old missions, assigns four distinct berths and spaces simultaneous airlock entrants", () => {
  const s = mission(4);
  for (let i = 0; i < 4; i++) enter(s, String(i));
  expect(berthOwners(s).map((p) => p?.id)).toEqual(["0", "1", "2", "3"]);
  const people = Object.values(s.players);
  for (const p of people)
    for (const q of people)
      if (p !== q)
        expect(
          Math.hypot(p.hab!.x - q.hab!.x, p.hab!.z - q.hab!.z),
        ).toBeGreaterThanOrEqual(1.2);
  const before = { ...s.players["0"].hab };
  dispatch(s, "0", { type: "enterHab" });
  expect(s.players["0"].hab).toEqual(before);
});
it("requires exterior proximity, exploration time and dismounted crew", () => {
  const s = mission();
  expect(dispatch(s, "0", { type: "enterHab" })).toMatch(/Approach/);
  Object.assign(s.players["0"], HAB_LAYOUT.exterior);
  s.rover!.driver = "0";
  expect(dispatch(s, "0", { type: "enterHab" })).toMatch(/exit the rover/);
  s.rover!.driver = null;
  s.phase = "power";
  expect(dispatch(s, "0", { type: "enterHab" })).toMatch(/exploration/);
});
it("keeps bags and surface coordinates separate; indoor crew cannot work through the walls", () => {
  const s = mission();
  s.players["0"].bag = { ice: 3, scrap: 2 };
  enter(s);
  const p = s.players["0"],
    surface = { x: p.x, z: p.z };
  for (const action of [
    { type: "pos", x: 100, z: 100 },
    { type: "move", x: 1, z: 1 },
    { type: "boardRover" },
    { type: "pick", target: s.items[0].id },
    { type: "drop", kind: "ice" },
    { type: "startBuild", target: "radio" },
  ])
    expect(dispatch(s, "0", action)).toMatch(/Leave the habitat/);
  expect(dispatch(s, "0", { type: "move", x: 0, z: 0 })).toBeUndefined();
  tick(s, 1);
  expect({ x: p.x, z: p.z }).toEqual(surface);
  expect(p.bag).toEqual({ ice: 3, scrap: 2 });
});
it("validates interior movement, prevents message-spam travel and freezes walking outside day phase", () => {
  const s = mission();
  enter(s);
  const p = s.players["0"],
    start = { ...p.hab! };
  expect(dispatch(s, "0", { type: "habPos", x: NaN, z: 0 })).toMatch(/Invalid/);
  for (let i = 0; i < 30; i++)
    dispatch(s, "0", { type: "habPos", x: 0, z: -10 });
  expect(
    Math.hypot(p.hab!.x - start.x, p.hab!.z - start.z),
  ).toBeLessThanOrEqual(1.001);
  s.phase = "summary";
  const before = { ...p.hab };
  dispatch(s, "0", { type: "habPos", x: 0, z: 0 });
  expect(p.hab).toEqual(before);
});
it("sweeps solid walls, furniture and other astronauts rather than tunneling", () => {
  expect(habBlocked(-8.65, -3.38)).toBe(true);
  expect(habBlocked(11, 0)).toBe(true);
  expect(habBlocked(NaN, 0)).toBe(true);
  const p = moveInHab({ x: -5.8, z: -3.6 }, { x: -10, z: -3.6 });
  expect(p.x).toBeGreaterThan(-6.5);
  expect(habBlocked(p.x, p.z)).toBe(false);
  const q = moveInHab({ x: 0, z: 5 }, { x: 0, z: 0 }, [{ x: 0, z: 3 }]);
  expect(q.z).toBeGreaterThanOrEqual(4.19);
  const wall = moveInHab({ x: 0, z: 0 }, { x: 30, z: 0 });
  expect(wall.x).toBeLessThan(10.2);
});
it("keeps every room reachable from the airlock with astronaut clearance", () => {
  const step = 0.25;
  const key = (x: number, z: number) => `${x},${z}`;
  const queue: [number, number][] = [[0, 32]],
    seen = new Set([key(0, 32)]);
  for (let i = 0; i < queue.length; i++) {
    const [x, z] = queue[i];
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        nz = z + dz,
        k = key(nx, nz);
      if (seen.has(k) || habBlocked(nx * step, nz * step)) continue;
      seen.add(k);
      queue.push([nx, nz]);
    }
  }
  for (const station of HAB_LAYOUT.zones) {
    expect(
      queue.some(
        ([x, z]) =>
          Math.hypot(x * step - station.x, z * step - station.z) < 1.5,
      ),
      station.id,
    ).toBe(true);
  }
});
it("uses the vestibule for exits, preserves berth and inventory and frees disconnected berths", () => {
  const s = mission(2);
  enter(s);
  enter(s, "1");
  const p = s.players["0"];
  p.bag = { battery: 1 };
  p.hab!.z = 0;
  expect(dispatch(s, "0", { type: "exitHab" })).toMatch(/airlock/);
  p.hab!.x = 0;
  p.hab!.z = 8.7;
  expect(dispatch(s, "0", { type: "exitHab" })).toBeUndefined();
  expect(p.hab).toBeUndefined();
  expect(p.habBerth).toBe(0);
  expect(p.bag).toEqual({ battery: 1 });
  enter(s);
  expect(p.habBerth).toBe(0);
  removePlayer(s, "1");
  expect(berthOwners(s)[1]).toBeUndefined();
});
it("round-trips an occupied hab through solo save data and clears it on flight", () => {
  const s = mission();
  enter(s);
  const copy = JSON.parse(JSON.stringify(s));
  expect(copy.players["0"].hab).toEqual(s.players["0"].hab);
  copy.phase = "flight";
  tick(copy, 0.1);
  expect(copy.players["0"].hab).toBeUndefined();
});
it("keeps equipment informative, escapes crew names and exposes floor-plan navigation", () => {
  const s = mission();
  enter(s);
  s.players["0"].name = "<script>bad</script>";
  expect(habDirectory(s, "0")).not.toContain("<script>");
  expect(habEquipment(s, "0", "quarter-0")).toContain("&lt;script&gt;");
  expect(habEquipment(s, "0", "eclss")).toContain("85%");
  expect(habEquipment(s, "0", "medical")).toContain(
    "not a medical measurement",
  );
  expect(habMap(s, "0")).toContain("Open habitat floor plan");
  expect(nearestHabStation({ x: 0, z: 8.7 })?.id).toBe("airlock");
  expect(habRoom({ x: 0, z: 0 })).toBe("Habitat commons");
});
it("loads the actual self-contained Blender GLB with every room and cutaway group", async () => {
  const b = readFileSync(
    new URL(
      "../client/public/mars/interiors/Mars_Hab_Interior.glb",
      import.meta.url,
    ),
  );
  const json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
  expect(json.buffers.every((v: { uri?: string }) => !v.uri)).toBe(true);
  expect(json.images || []).toHaveLength(0);
  const gltf = await new GLTFLoader().parseAsync(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
    "",
  );
  for (const name of [
    "ECLSS",
    "Command_Comms",
    "Medical",
    "Galley",
    "Hygiene",
    "Airlock",
    "Roof",
    "Shell_N",
    "Shell_S",
    "Shell_E",
    "Shell_W",
    ...Array.from({ length: 4 }, (_, i) => `Crew_Quarter_${i + 1}`),
  ])
    expect(gltf.scene.getObjectByName(name), name).toBeTruthy();
  const box = new T.Box3().setFromObject(gltf.scene),
    size = box.getSize(new T.Vector3());
  expect(size.x).toBeCloseTo(22.4, 1);
  expect(size.z).toBeCloseTo(22.4, 1);
  expect(size.y).toBeGreaterThan(4);
  const triangles = json.meshes.reduce(
    (sum: number, m: { primitives: { indices: number }[] }) =>
      sum +
      m.primitives.reduce((n, p) => n + json.accessors[p.indices].count / 3, 0),
    0,
  );
  expect(triangles).toBeLessThan(120000);
  expect(json.meshes.length).toBeLessThan(160);
});
