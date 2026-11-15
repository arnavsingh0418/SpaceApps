import { beforeAll, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  createModel,
  installAstronaut,
  replaceVisual,
  updateRoleBadge,
  updatePanelModel,
  disposeModel,
} from "../client/src/render/modelAssets";
import { itemArt, resourceArt, buildingArt } from "../client/src/ui/modelArt";

beforeAll(() => {
  vi.spyOn(GLTFLoader.prototype, "loadAsync").mockImplementation(
    async (url) => {
      const id = String(url).split("/").pop()!;
      const bytes = readFileSync(
        new URL(`../client/public/mars/models/${id}`, import.meta.url),
      );
      const data = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      );
      return new GLTFLoader().parseAsync(data, "");
    },
  );
});

it.each([
  ["Orange", 0xf97316],
  ["Blue", 0x3b82f6],
  ["Green", 0x22c55e],
  ["Yellow", 0xeab308],
] as const)(
  "retargets the actual %s GLB, including Blender suffixes, without changing its wrapper",
  async (suit, color) => {
    const actor = new T.Group();
    actor.position.set(12, 0, -15);
    actor.scale.setScalar(1.35);
    const fallback = new T.Mesh(
      new T.BoxGeometry(),
      new T.MeshStandardMaterial(),
    );
    actor.add(fallback);
    installAstronaut(actor, color);
    await actor.userData.marsPromise;
    expect(actor.userData.marsModel).toBe(`Astronaut_${suit}`);
    expect(actor.position.toArray()).toEqual([12, 0, -15]);
    expect(actor.scale.x).toBe(1.35);
    for (const name of [
      "hips",
      "upper",
      "head",
      "armL",
      "armR",
      "elbowL",
      "elbowR",
      "legL",
      "legR",
      "kneeL",
      "kneeR",
      "visor",
    ])
      expect(actor.getObjectByName(name), name).toBeTruthy();
    const size = new T.Box3().setFromObject(actor).getSize(new T.Vector3());
    expect(size.y).toBeGreaterThan(2.4);
    expect(size.y).toBeLessThan(3.2);
    expect(actor.getObjectByName("kneeL")!.children.length).toBeGreaterThan(0);
    updateRoleBadge(actor, "Medic");
    await new Promise((r) => setTimeout(r, 10));
    expect(actor.userData.marsRole).toBe("Medic");
  },
);

it("fits a real static asset, batches its opaque geometry, and keeps the gameplay wrapper", async () => {
  const target = new T.Group();
  target.position.set(8, 0, 9);
  const fallback = new T.Mesh(
    new T.BoxGeometry(),
    new T.MeshStandardMaterial(),
  );
  target.add(fallback);
  await replaceVisual(target, "Workbench", { width: 3.2, batch: true });
  expect(target.userData.marsModel).toBe("Workbench");
  expect(fallback.visible).toBe(false);
  const visual = target.userData.marsVisual as T.Group;
  const box = new T.Box3().setFromObject(visual);
  expect(box.max.x - box.min.x).toBeCloseTo(3.2, 2);
  expect(box.min.y).toBeCloseTo(0, 2);
  expect(target.position.toArray()).toEqual([8, 0, 9]);
});

it("drives authored dust and cover state without modifying another solar instance", async () => {
  const a = new T.Group(),
    b = new T.Group();
  await Promise.all([
    replaceVisual(a, "Solar_Panels_Dusty", { width: 5.3 }),
    replaceVisual(b, "Solar_Panels_Dusty", { width: 5.3 }),
  ]);
  updatePanelModel(a, 1, false);
  updatePanelModel(b, 0.1, true);
  const dust = (g: T.Group) => {
    const result: T.Mesh[] = [];
    g.traverse((o) => {
      if (o instanceof T.Mesh && o.name.startsWith("Regolith")) result.push(o);
    });
    return result;
  };
  expect(dust(a).length).toBeGreaterThan(0);
  expect(dust(a).every((m) => !m.visible)).toBe(true);
  expect(dust(b).some((m) => m.visible)).toBe(true);
  expect(a.getObjectByName("Storm cover")!.visible).toBe(false);
  expect(b.getObjectByName("Storm cover")!.visible).toBe(true);
  const geometry = dust(b)[0].geometry;
  const dispose = vi.spyOn(geometry, "dispose");
  disposeModel(a);
  expect(dispose).not.toHaveBeenCalled();
});

it("uses bundled art URLs, with a text fallback for the existing clear-panel item", () => {
  expect(itemArt("scrap")).toContain("icons/scrap_metal.png");
  expect(itemArt("glass")).toBe("🪟");
  expect(resourceArt("dose")).toContain("resource_radiation.png");
  expect(buildingArt("radio", "x")).toContain("build_radio.png");
});

it("every imported GLB is self contained and the 256px artwork has real alpha", () => {
  const manifest = JSON.parse(
    readFileSync(
      new URL("../client/public/mars/manifest.json", import.meta.url),
      "utf8",
    ),
  );
  expect(manifest).toHaveLength(49);
  for (const row of manifest) {
    const bytes = readFileSync(
      new URL(`../client/public/mars/${row.url}`, import.meta.url),
    );
    expect(bytes.toString("ascii", 0, 4)).toBe("glTF");
    expect(bytes.readUInt32LE(8)).toBe(bytes.length);
    const gltf = JSON.parse(
      bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12)),
    );
    expect(gltf.meshes.length).toBeGreaterThan(0);
    expect(gltf.buffers.every((b: { uri?: string }) => !b.uri)).toBe(true);
  }
  for (const name of ["scrap_metal", "resource_power", "build_radio"]) {
    const bytes = readFileSync(
      new URL(`../client/public/mars/icons/${name}.png`, import.meta.url),
    );
    expect(bytes.readUInt32BE(16)).toBe(256);
    expect(bytes.readUInt32BE(20)).toBe(256);
    expect(bytes[25]).toBe(6);
  }
});
