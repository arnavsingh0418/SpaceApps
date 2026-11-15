import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  SHIP_LAYOUT,
  walkableShip,
  moveOnShip,
  shipMoveInput,
} from "../shared/src/flightLayout";
import { setFlightView } from "../client/src/render/flightCabin";
import { createGame, addPlayer, tick } from "../shared/src/sim";
import {
  startDeckFlight,
  ensureFlightLayout,
  flightStations,
} from "../shared/src/flight";
it("places four crew safely inside a single enclosed corridor and cockpit", () => {
  const s = createGame(42);
  for (let i = 0; i < 4; i++) addPlayer(s, String(i));
  startDeckFlight(s);
  const crew = Object.values(s.players);
  expect(crew.every((p) => walkableShip(p.x, p.z))).toBe(true);
  for (const p of crew)
    for (const q of crew)
      if (p !== q)
        expect(Math.hypot(p.x - q.x, p.z - q.z)).toBeGreaterThanOrEqual(1.2);
  for (const station of Object.values(flightStations))
    expect(walkableShip(station.x, station.z), station.name).toBe(true);
});
it("connects every repair station and the helm through the actual corridor at crew clearance", () => {
  const step = 0.25,
    key = (x: number, z: number) => `${x},${z}`,
    queue: [number, number][] = [[0, 32]],
    seen = new Set([key(0, 32)]);
  for (let i = 0; i < queue.length; i++)
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = queue[i][0] + dx,
        nz = queue[i][1] + dz,
        k = key(nx, nz);
      if (seen.has(k) || !walkableShip(nx * step, nz * step)) continue;
      seen.add(k);
      queue.push([nx, nz]);
    }
  for (const station of Object.values(flightStations))
    expect(
      queue.some(
        ([x, z]) =>
          Math.hypot(x * step - station.x, z * step - station.z) < 0.6,
      ),
      station.name,
    ).toBe(true);
  expect(walkableShip(0, -15.2)).toBe(true);
});
it("blocks walls, cabinets and console with swept movement", () => {
  expect(walkableShip(20, 0)).toBe(false);
  expect(walkableShip(-2.4, -2)).toBe(false);
  expect(walkableShip(0, -25.4)).toBe(false);
  const p = moveOnShip({ x: 0, z: 0 }, { x: -10, z: 0 });
  expect(p.x).toBeGreaterThan(-2.5);
  expect(walkableShip(p.x, p.z)).toBe(true);
  const q = moveOnShip({ x: 0, z: -23.7 }, { x: 0, z: -30 });
  expect(q.z).toBeGreaterThan(-24.31);
  expect(walkableShip(q.x, q.z)).toBe(true);
});
it("walks in the camera direction, normalizes diagonal input and allows looking up/down", () => {
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const camera = new T.PerspectiveCamera(78, 1, 0.08, 300);
    setFlightView(camera, { x: 1, z: 7 }, yaw, 0);
    const dir = camera.getWorldDirection(new T.Vector3()),
      input = shipMoveInput(0, -1, yaw);
    expect(dir.x).toBeCloseTo(input.x);
    expect(dir.z).toBeCloseTo(input.z);
    expect(camera.position.y).toBe(SHIP_LAYOUT.eyeHeight);
  }
  const diagonal = shipMoveInput(1, -1, 0.7);
  expect(Math.hypot(diagonal.x, diagonal.z)).toBeCloseTo(1);
  const camera = new T.PerspectiveCamera();
  setFlightView(camera, { x: 0, z: 0 }, 0, -10);
  expect(camera.getWorldDirection(new T.Vector3()).y).toBeGreaterThan(0.8);
  setFlightView(camera, { x: 0, z: 0 }, 0, 10);
  expect(camera.getWorldDirection(new T.Vector3()).y).toBeLessThan(-0.8);
});
it("migrates occupied cutaway saves without resetting journey systems, incidents or repair credit", () => {
  const s = createGame(42);
  addPlayer(s, "a");
  startDeckFlight(s);
  tick(s, 19);
  const d = s.returnMission!.flight!.deck!;
  delete d.layoutVersion;
  d.hull = 63;
  d.repaired = 2;
  d.pilot = "a";
  s.players.a.x = 8;
  s.players.a.z = 7;
  s.players.a.bag = { ice: 2 };
  const time = d.time,
    incidents = JSON.stringify(d.incidents);
  ensureFlightLayout(s);
  expect(walkableShip(s.players.a.x, s.players.a.z)).toBe(true);
  expect(d.layoutVersion).toBe(2);
  expect(d.time).toBe(time);
  expect(d.hull).toBe(63);
  expect(d.repaired).toBe(2);
  expect(JSON.stringify(d.incidents)).toBe(incidents);
  expect(s.players.a.bag).toEqual({ ice: 2 });
  expect(d.pilot).toBe("");
  s.players.a.z = 3;
  ensureFlightLayout(s);
  expect(s.players.a.z).toBe(3);
});
it("loads the actual enclosed Blender model, all station groups and separate indicator sockets", async () => {
  const bytes = readFileSync(
    new URL(
      "../client/public/mars/interiors/Mars_Return_Ship_Interior.glb",
      import.meta.url,
    ),
  );
  const json = JSON.parse(
    bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString(),
  );
  expect(json.buffers.every((b: { uri?: string }) => !b.uri)).toBe(true);
  expect(json.images || []).toHaveLength(0);
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
  for (const key of Object.keys(flightStations)) {
    expect(gltf.scene.getObjectByName(`Station_${key}`)).toBeTruthy();
    expect(gltf.scene.getObjectByName(`Indicator_${key}`)).toBeTruthy();
  }
  expect(gltf.scene.getObjectByName("Ceiling")!.visible).toBe(true);
  const bounds = new T.Box3()
    .setFromObject(gltf.scene)
    .getSize(new T.Vector3());
  expect(bounds.z).toBeGreaterThan(37);
  expect(bounds.y).toBeGreaterThan(3.8);
  expect(bounds.x).toBeGreaterThan(8);
  expect(json.meshes.length).toBeLessThan(140);
  const triangles = json.meshes.reduce(
    (n: number, m: { primitives: { indices: number }[] }) =>
      n +
      m.primitives.reduce((n, p) => n + json.accessors[p.indices].count / 3, 0),
    0,
  );
  expect(triangles).toBeLessThan(80000);
});
