import * as T from "three";
import { replaceVisual } from "./modelAssets";
import {
  sectors,
  fieldMissions,
  fieldProgress,
  missionAvailable,
} from "../../../shared/src/expedition";
import { WORLD, type Game } from "../../../shared/src/sim";
import type { Terrain } from "./terrain";
import {
  launchSite,
  returnProgress,
  salvageSites,
  type Part,
} from "../../../shared/src/returnMission";

import { ShipAssembly, shipPartModel } from "./ship";

export class FieldSites {
  groups = new Map<string, T.Group>();
  salvage = new Map<string, T.Group>();
  private lights = new Map<string, T.Mesh>();
  ship!: ShipAssembly;
  private placed = false;
  constructor(scene: T.Scene) {
    for (const site of sectors) {
      const g = new T.Group();
      g.position.set(site.x, 0, site.z);
      let partParent = g;
      const part = (
        geo: T.BufferGeometry,
        color: number | string,
        x: number,
        y: number,
        z: number,
        glow = false,
      ) => {
        const m = new T.Mesh(
          geo,
          new T.MeshStandardMaterial({
            color,
            roughness: 0.65,
            metalness: 0.2,
            emissive: glow ? color : 0,
            emissiveIntensity: glow ? 0.8 : 0,
          }),
        );
        m.position.set(x, y, z);
        m.castShadow = true;
        m.receiveShadow = true;
        partParent.add(m);
        return m;
      };
      part(new T.CylinderGeometry(2.5, 2.8, 0.18, 12), 0x29383b, 0, 0.09, 0);
      part(new T.BoxGeometry(1.5, 0.9, 0.85), 0xd2c4ae, 0, 1.1, 0);
      part(new T.CylinderGeometry(0.13, 0.2, 1.2, 8), 0x5c6a6a, 0, 0.6, 0);
      const screen = part(
        new T.BoxGeometry(1.2, 0.5, 0.06),
        site.color,
        0,
        1.25,
        0.46,
        true,
      );
      this.lights.set(site.id, screen);
      part(new T.CylinderGeometry(0.045, 0.08, 7, 6), 0xb5ad97, -2, 3.5, -1);
      part(new T.BoxGeometry(1.6, 0.8, 0.04), site.color, -1.25, 6.4, -1, true);
      const beacon = part(
        new T.OctahedronGeometry(0.4),
        site.color,
        -2,
        7.3,
        -1,
        true,
      );
      beacon.name = "field-beacon";
      const prop = new T.Group();prop.name = `Field equipment ${site.id}`;
      g.add(prop);partParent = prop;
      if (site.prop === "ice") {
        for (let i = 0; i < 6; i++) {
          const m = part(
            new T.ConeGeometry(0.65, 2 + (i % 3), 5),
            0x90cdd7,
            -5 + i,
            0.7,
            -4 - (i % 2),
          );
          m.rotation.z = (i - 3) * 0.12;
        }
        part(new T.CylinderGeometry(0.25, 0.4, 2, 8), 0xe9d8ba, 3.5, 1, -3);
      } else if (site.prop === "solar") {
        for (let i = 0; i < 3; i++) {
          part(
            new T.BoxGeometry(0.16, 1.4, 0.16),
            0xb8baa8,
            i * 3.8 - 3,
            0.7,
            -5,
          );
          const p = part(
            new T.BoxGeometry(3.2, 0.15, 2.1),
            0x224c70,
            i * 3.8 - 3,
            1.6,
            -5,
          );
          p.rotation.x = -0.25;
          for (let j = 0; j < 5; j++)
            part(
              new T.BoxGeometry(0.025, 0.04, 2.05),
              0x7ba7bd,
              i * 3.8 - 4.4 + j * 0.6,
              1.72,
              -5,
            );
        }
      } else if (site.prop === "rocks") {
        for (let i = 0; i < 6; i++)
          part(
            new T.CylinderGeometry(3.7 - i * 0.24, 4 - i * 0.24, 0.5, 7),
            i % 2 ? 0xc4835d : 0x805341,
            -3,
            0.25 + i * 0.5,
            -6,
          );
      } else if (site.prop === "shield") {
        for (let i = 0; i < 3; i++)
          part(
            new T.BoxGeometry(1.3, 1.6 + i * 0.35, 0.6 + i * 0.7),
            [0xb2d9d7, 0x5b7480, 0x98765e][i],
            -3 + i * 3,
            0.8 + i * 0.175,
            -5,
          );
        part(new T.CylinderGeometry(0.7, 0.7, 2.5, 12), 0xded4bf, 5, 1.3, -3);
      } else if (site.prop === "dish") {
        part(new T.CylinderGeometry(0.3, 0.6, 4, 8), 0x687e83, 0, 2, -6);
        const dish = part(
          new T.SphereGeometry(3, 20, 10, 0, Math.PI * 2, 0, 0.65),
          0xd9d1bb,
          0,
          3.3,
          -6,
        );
        dish.rotation.x = 0.6;
        part(
          new T.CylinderGeometry(0.05, 0.08, 3.5, 6),
          0x93d9dc,
          0,
          5.5,
          -5.5,
        );
      } else if (site.prop === "rocket") {
        part(new T.CylinderGeometry(6, 6.5, 0.4, 12), 0x697174, 0, 0.2, -9);
        part(new T.CylinderGeometry(1.5, 2.1, 9, 14), 0xe4d7bf, 0, 5, -9);
        part(new T.ConeGeometry(1.5, 3, 14), 0xe4d7bf, 0, 11, -9);
        this.ship = new ShipAssembly(g);
      } else {
        const recorder = part(
          new T.BoxGeometry(2.5, 1.6, 1.5),
          0xe48d40,
          -4,
          0.8,
          -4,
        );
        recorder.rotation.z = 0.13;
        for (let i = 0; i < 4; i++) {
          const m = part(
            new T.BoxGeometry(0.8, 0.15, 2),
            0x959c9c,
            i - 1,
            0.2,
            -4 - i,
          );
          m.rotation.y = i * 1.1;
        }
      }
      const authored = {
        ice: ["Ice_Chunk", 7, -3, -4],
        solar: ["Solar_Panels_Clean", 11, 0, -5],
        rocks: ["Cliff_01", 8, -3, -6],
        shield: ["Storm_Shelter", 8, 0, -6],
        dish: ["Radio_Dish_Fixed", 6, 0, -6],
        rocket: ["Rocket_Return", 12, 0, -9],
        wreck: ["Robotic_Lander_Wreck", 6, -3, -4],
      }[site.prop] as [string, number, number, number];
      void replaceVisual(prop, authored[0], {
        ...(site.prop === "rocket" ? {height: authored[1]} : {size: authored[1]}),
        offset: {x:authored[2],z:authored[3]},
        batch: site.prop !== "dish",
      });
      scene.add(g);
      this.groups.set(site.id, g);
    }
    for (const site of [...salvageSites, { id: "return", ...launchSite }]) {
      const g = new T.Group();
      g.position.set(site.x, 0, site.z);
      const launch = site.id === "return";
      const shell = new T.Mesh(
        new T.BoxGeometry(1.5, 0.85, 1.1),
        new T.MeshStandardMaterial({
          color: launch ? 0x9bdee9 : 0xda884c,
          roughness: 0.55,
        }),
      );
      shell.position.y = 0.44;
      shell.castShadow = true;
      const signal = new T.Mesh(
        new T.OctahedronGeometry(0.28),
        new T.MeshStandardMaterial({
          color: launch ? 0x9bdee9 : 0xffc286,
          emissive: launch ? 0x65bad1 : 0xd57937,
        }),
      );
      signal.position.y = 1.3;
      const shellHolder = new T.Group();shellHolder.add(shell);
      g.add(shellHolder, signal);
      if (!launch) void replaceVisual(shellHolder, "Supply_Crate", {width:1.5,batch:true});
      if (!launch) {
        const model = shipPartModel(
          salvageSites.find((cache) => cache.id === site.id)!.part,
        );
        model.scale.setScalar(0.42);
        model.position.y = 1.65;
        g.add(model);
      }
      scene.add(g);
      this.salvage.set(site.id, g);
    }
  }
  update(s: Game, terrain: Terrain, time: number, reduced = false) {
    if (terrain.ready && !this.placed) {
      for (const g of [...this.groups.values(), ...this.salvage.values()])
        g.position.y = terrain.heightAt(g.position.x, g.position.z);
      this.placed = true;
    }
    const { caches, installed } = returnProgress(s);
    this.ship.update(s, time, reduced);
    for (const [id, marker] of this.salvage) {
      marker.visible = !caches[id]?.reward;
      marker.children[1].rotation.y = reduced ? 0 : time;
      if (marker.children[2])
        marker.children[2].rotation.y = reduced ? 0.3 : time * 0.4;
    }
    for (const site of sectors) {
      const missions = fieldMissions.filter((m) => m.sector === site.id);
      const done = missions.every((m) =>
        fieldProgress(s).completed.includes(m.id),
      );
      const available = missions.some((m) => missionAvailable(s, m));
      const screen = this.lights.get(site.id)!;
      (screen.material as T.MeshStandardMaterial).emissiveIntensity = done
        ? 0.15
        : available
          ? 0.8
          : 0.2;
      const marker = this.groups.get(site.id)!.getObjectByName("field-beacon")!;
      marker.rotation.y = time * 0.35;
    }
  }
}

/** Actual terrain rendered north-up, not a decorative or guessed background. */
export function captureFieldMap(renderer: T.WebGLRenderer, scene: T.Scene) {
  const size = 768,
    target = new T.WebGLRenderTarget(size, size);
  const cam = new T.OrthographicCamera(
    -WORLD.r,
    WORLD.r,
    WORLD.r,
    -WORLD.r,
    1,
    1800,
  );
  cam.position.set(WORLD.x, 900, WORLD.z);
  cam.up.set(0, 0, -1);
  cam.lookAt(WORLD.x, 0, WORLD.z);
  const fog = scene.fog,
    previous = renderer.getRenderTarget();
  scene.fog = null;
  const pixels = new Uint8Array(size * size * 4);
  try {
    renderer.setRenderTarget(target);
    renderer.render(scene, cam);
    renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels);
  } finally {
    renderer.setRenderTarget(previous);
    scene.fog = fog;
    target.dispose();
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!,
    data = ctx.createImageData(size, size);
  for (let row = 0; row < size; row++)
    data.data.set(
      pixels.subarray(row * size * 4, (row + 1) * size * 4),
      (size - row - 1) * size * 4,
    );
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL("image/png");
}
