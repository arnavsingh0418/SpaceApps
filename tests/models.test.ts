import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const parser = new GLTFLoader();
const requests = vi
  .spyOn(GLTFLoader.prototype, "loadAsync")
  .mockImplementation(async (url) => {
    const id = url.split("/").pop()!;
    const bytes = readFileSync(
      new URL(`../client/public/mars/models/${id}`, import.meta.url),
    );
    return parser.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    );
  });
const { loadModel } = await import("../client/src/render/models");
const { createBase } = await import("../client/src/render/base");

function materials(root: THREE.Object3D) {
  const result = new Set<THREE.Material>();
  root.traverse((part) => {
    if (part instanceof THREE.Mesh)
      (Array.isArray(part.material) ? part.material : [part.material]).forEach(
        (m) => result.add(m),
      );
  });
  return result;
}

describe("actual Blender model integration", () => {
  it("loads the complete outpost without failed props or invalid bounds", async () => {
    const scene = new THREE.Scene();
    const progress = vi.fn();
    const base = createBase(scene, progress);
    await base.ready;
    expect(base.state.failed).toEqual([]);
    expect(base.state.loaded).toBe(base.state.total);
    expect(base.state.loaded).toBeGreaterThan(10);
    expect(base.root.children).toHaveLength(base.state.total);
    expect(progress).toHaveBeenCalledTimes(base.state.total);
    for (const model of base.root.children) {
      const box = new THREE.Box3().setFromObject(model);
      expect(box.isEmpty(), model.name).toBe(false);
      expect(Number.isFinite(box.max.y), model.name).toBe(true);
      expect(box.min.y, model.name).toBeCloseTo(-0.035, 3);
    }
    expect(
      new Set(base.selectable.map((model) => model.userData.station)),
    ).toEqual(new Set(["habitat", "solar", "workbench"]));
  });

  it("fits rotated equipment, caches requests, and isolates instance materials", async () => {
    const before = requests.mock.calls.filter(([url]) =>
      url.includes("Workbench.glb"),
    ).length;
    const a = await loadModel("Workbench", 4, Math.PI / 2);
    const b = await loadModel("Workbench", 2);
    const sizeA = new THREE.Box3()
      .setFromObject(a)
      .getSize(new THREE.Vector3());
    const sizeB = new THREE.Box3()
      .setFromObject(b)
      .getSize(new THREE.Vector3());
    expect(Math.max(sizeA.x, sizeA.z)).toBeCloseTo(4, 3);
    expect(Math.max(sizeB.x, sizeB.z)).toBeCloseTo(2, 3);
    expect(
      requests.mock.calls.filter(([url]) => url.includes("Workbench.glb"))
        .length,
    ).toBe(before);
    const ownA = materials(a);
    const ownB = materials(b);
    expect(ownA.size).toBeGreaterThan(0);
    for (const material of ownA) expect(ownB.has(material)).toBe(false);
  });

  it("preserves the greenhouse glass while batching opaque details", async () => {
    const model = await loadModel("Greenhouse_Tunnel", 7);
    let transparent = 0;
    let opaque = 0;
    model.traverse((part) => {
      if (!(part instanceof THREE.Mesh) || Array.isArray(part.material)) return;
      if (part.material.transparent) {
        transparent++;
        expect(part.material.depthWrite).toBe(false);
        expect(part.castShadow).toBe(false);
      } else opaque++;
    });
    expect(transparent).toBeGreaterThan(0);
    expect(opaque).toBeLessThan(30);
  });

  it("reports failed downloads and allows a later retry", async () => {
    requests.mockRejectedValueOnce(new Error("temporary network failure"));
    await expect(loadModel("Rock_06", 1)).rejects.toThrow(
      "temporary network failure",
    );
    await expect(loadModel("Rock_06", 1)).resolves.toBeInstanceOf(THREE.Group);
  });
});

it("ships a complete self-contained GLB catalog and valid PNG artwork", () => {
  const rows = JSON.parse(
    readFileSync(
      new URL("../client/public/mars/manifest.json", import.meta.url),
      "utf8",
    ),
  ) as { id: string; url: string }[];
  expect(rows).toHaveLength(49);
  expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
  for (const row of rows) {
    const bytes = readFileSync(
      new URL(`../client/public/mars/${row.url}`, import.meta.url),
    );
    expect(bytes.toString("ascii", 0, 4), row.id).toBe("glTF");
    expect(bytes.readUInt32LE(4)).toBe(2);
    expect(bytes.readUInt32LE(8)).toBe(bytes.length);
    const json = JSON.parse(
      bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12)).trim(),
    );
    for (const resource of [...(json.buffers || []), ...(json.images || [])])
      expect(resource.uri).toBeUndefined();
  }
  for (const file of [
    "icons/build_shelter.png",
    "icons/build_solar_panel.png",
    "icons/scrap_metal.png",
    "portraits/Crew_Orange.png",
    "title-hero.png",
  ]) {
    const bytes = readFileSync(
      new URL(`../client/public/mars/${file}`, import.meta.url),
    );
    expect(bytes.subarray(1, 4).toString()).toBe("PNG");
    expect(bytes.readUInt32BE(16)).toBeGreaterThan(100);
    expect(bytes.readUInt32BE(20)).toBeGreaterThan(100);
  }
});
