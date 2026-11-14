import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Sandstorm } from "../client/src/render/sandstorm";

const bytes = readFileSync(
  new URL("../client/public/mars/vfx/Mars_Sandstorm.glb", import.meta.url),
);
const json = JSON.parse(
  bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12)),
);
const parse = () =>
  new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );

beforeAll(() => {
  // Exercise real glTF geometry, textures and animation tracks without a GPU.
  // Only bitmap decoding is stubbed; Chrome verifies the actual alpha rendering.
  vi.stubGlobal("self", globalThis);
  vi.stubGlobal("createImageBitmap", async (blob: Blob) => {
    const png = new DataView(await blob.arrayBuffer());
    return {
      width: png.getUint32(16),
      height: png.getUint32(20),
      close: vi.fn(),
    };
  });
});
afterEach(() => vi.restoreAllMocks());
afterAll(() => vi.unstubAllGlobals());

it("ships the actual Blender animation with embedded alpha textures and a small mesh budget", () => {
  expect(bytes.toString("ascii", 0, 4)).toBe("glTF");
  expect(bytes.readUInt32LE(8)).toBe(bytes.length);
  expect(bytes.length).toBeLessThan(250_000);
  expect(json.meshes).toHaveLength(7);
  expect(json.images).toHaveLength(2);
  expect(
    json.images.every(
      (image: { bufferView?: number; uri?: string }) =>
        image.bufferView !== undefined && !image.uri,
    ),
  ).toBe(true);
  expect(json.buffers.every((buffer: { uri?: string }) => !buffer.uri)).toBe(
    true,
  );
  expect(
    json.materials.every(
      (material: { alphaMode: string; doubleSided: boolean }) =>
        material.alphaMode === "BLEND" && material.doubleSided,
    ),
  ).toBe(true);
  expect(
    json.nodes.some((node: { name: string }) =>
      /Preview|habitat/i.test(node.name),
    ),
  ).toBe(false);
  expect(json.animations).toHaveLength(1);
  expect(json.animations[0].channels).toHaveLength(14);
});

it("parses and plays every actual wind layer across a seamless 12-second loop", async () => {
  const gltf = await parse();
  expect(gltf.animations[0].duration).toBeCloseTo(12, 4);
  const mixer = new THREE.AnimationMixer(gltf.scene);
  mixer.clipAction(gltf.animations[0]).play();
  mixer.setTime(0);
  const start = gltf.scene.children[0].children.map((object) => ({
    object,
    position: object.position.clone(),
    scale: object.scale.clone(),
  }));
  expect(start).toHaveLength(7);
  mixer.setTime(3);
  expect(
    start.some(
      ({ object, position }) => object.position.distanceTo(position) > 3,
    ),
  ).toBe(true);
  mixer.setTime(12);
  for (const { object, position, scale } of start) {
    expect(object.position.distanceTo(position)).toBeLessThan(0.0001);
    expect(object.scale.distanceTo(scale)).toBeLessThan(0.0001);
  }
});

it("loads once on demand, fades, follows terrain and freezes wind for reduced motion", async () => {
  const download = vi
    .spyOn(GLTFLoader.prototype, "loadAsync")
    .mockImplementation(parse);
  const weather = new Sandstorm(new THREE.Scene());
  const origin = { x: 23, y: 8, z: -15 };
  weather.update(0.016, 0, origin);
  expect(download).not.toHaveBeenCalled();
  weather.update(0.016, 0.5, origin);
  weather.update(0.016, 0.5, origin);
  await weather.loading;
  expect(download).toHaveBeenCalledTimes(1);
  expect(weather.status).toBe("ready");
  expect(weather.group.visible).toBe(true);
  expect(weather.group.position.toArray()).toEqual([23, 8.04, -15]);
  const material = (
    weather.group.getObjectByName("Dust_Billows_1") as THREE.Mesh
  ).material as THREE.MeshBasicMaterial;
  expect(material.depthWrite).toBe(false);
  expect((material.map?.image as { width: number }).width).toBe(256);
  expect(
    new THREE.OrthographicCamera().layers.test(
      weather.group.getObjectByName("Dust_Billows_1")!.layers,
    ),
  ).toBe(false);
  const halfOpacity = material.opacity;
  weather.update(0.016, 1, origin);
  expect(material.opacity).toBeCloseTo(halfOpacity * 2);
  const time = weather.mixer!.time;
  weather.update(0.1, 1, origin, true);
  expect(weather.mixer!.time).toBe(time);
  expect(weather.group.getObjectByName("Sand_Streaks_1")!.visible).toBe(false);
  weather.update(0.1, 1, origin);
  expect(weather.mixer!.time).toBeGreaterThan(time);
  expect(weather.group.getObjectByName("Sand_Streaks_1")!.visible).toBe(true);
  weather.update(0.1, 0, origin);
  expect(weather.group.visible).toBe(false);
  weather.dispose();
});

it("keeps failure contained so procedural weather can continue", async () => {
  const download = vi
    .spyOn(GLTFLoader.prototype, "loadAsync")
    .mockRejectedValue(new Error("offline"));
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const weather = new Sandstorm(new THREE.Scene());
  weather.update(0.016, 1, { x: 0, y: 0, z: 0 });
  await weather.loading;
  expect(weather.status).toBe("failed");
  expect(weather.group.visible).toBe(false);
  for (let i = 0; i < 10; i++) weather.update(0.1, 1, { x: 0, y: 0, z: 0 });
  expect(download).toHaveBeenCalledTimes(1);
  weather.dispose();
});

it("releases owned GLB resources even when disposed during its lazy download", async () => {
  let resolve!: (value: Awaited<ReturnType<typeof parse>>) => void;
  vi.spyOn(GLTFLoader.prototype, "loadAsync").mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const scene = new THREE.Scene();
  const weather = new Sandstorm(scene);
  weather.update(0.016, 1, { x: 0, y: 0, z: 0 });
  weather.dispose();
  const gltf = await parse();
  const mesh = gltf.scene.getObjectByName("Dust_Billows_1") as THREE.Mesh;
  const geometryDisposed = vi.spyOn(mesh.geometry, "dispose");
  const textureDisposed = vi.spyOn(
    (mesh.material as THREE.MeshStandardMaterial).map!,
    "dispose",
  );
  resolve(gltf);
  await weather.loading;
  expect(geometryDisposed).toHaveBeenCalledTimes(1);
  expect(textureDisposed).toHaveBeenCalledTimes(1);
  expect(scene.children).not.toContain(weather.group);
  expect(weather.group.children).toHaveLength(0);
});

it("ramps weather only after the event starts and clears when the day ends", async () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
  }));
  const { WorldMotion } = await import("../client/src/render/motion");
  const { createGame, addPlayer } = await import("../shared/src/sim");
  const game = createGame(420);
  addPlayer(game, "solo");
  game.phase = "day";
  game.event = { kind: "storm", at: 30, resolved: false };
  const motion = new WorldMotion(new THREE.Scene());
  game.clock = 29;
  motion.update(game, "solo", new Map(), 1);
  expect(motion.storm).toBe(0);
  game.clock = 30;
  motion.update(game, "solo", new Map(), 1);
  expect(motion.storm).toBeCloseTo(0.2);
  game.phase = "summary";
  motion.update(game, "solo", new Map(), 1);
  expect(motion.storm).toBe(0);
  game.phase = "day";
  game.event.resolved = true; // The panel-damage action has resolved; dust still lasts this sol.
  motion.update(game, "solo", new Map(), 5);
  expect(motion.storm).toBe(1);
  motion.sandstorm.dispose();
});
