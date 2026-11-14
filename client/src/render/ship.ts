import * as T from "three";
import {
  partSlots,
  returnProgress,
  type Part,
} from "../../../shared/src/returnMission";
import { partDetails } from "../../../shared/src/shipRewards";
import type { Game } from "../../../shared/src/sim";

/** The same four recognizable components are shown on caches, plinths and the ship. */
export function shipPartModel(slot: Part, broken = false) {
  const g = new T.Group();
  const color = broken ? 0x79554d : new T.Color(partDetails[slot].color);
  const material = new T.MeshStandardMaterial({
    color,
    roughness: 0.42,
    metalness: 0.55,
  });
  const dark = new T.MeshStandardMaterial({
    color: broken ? 0x382e2b : 0x243f53,
    roughness: 0.6,
    metalness: 0.4,
  });
  const glow = new T.MeshStandardMaterial({
    color: broken ? 0xe56d50 : color,
    emissive: broken ? 0xa62e24 : color,
    emissiveIntensity: broken ? 0.25 : 0.75,
    roughness: 0.3,
  });
  const part = (
    geo: T.BufferGeometry,
    mat: T.Material,
    x = 0,
    y = 0,
    z = 0,
  ) => {
    const m = new T.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  if (slot === "booster") {
    for (const x of [-1.5, 1.5]) {
      part(new T.CylinderGeometry(0.32, 0.5, 1.3, 12), material, x, 0.1);
      part(new T.CylinderGeometry(0.52, 0.6, 0.55, 12, 1, true), dark, x, -0.8);
      const rim = part(new T.TorusGeometry(0.58, 0.065, 5, 16), glow, x, -1.05);
      rim.rotation.x = Math.PI / 2;
      part(new T.BoxGeometry(0.6, 0.18, 0.7), glow, x, 0.7);
    }
    part(new T.BoxGeometry(3.7, 0.2, 0.35), dark, 0, 0.35);
  } else if (slot === "hull") {
    const shield = part(new T.CylinderGeometry(1.5, 1.7, 0.35, 8), material);
    shield.rotation.y = Math.PI / 8;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const tile = part(
        new T.BoxGeometry(0.65, 0.12, 0.55),
        i % 2 ? dark : glow,
        Math.sin(a) * 1.1,
        0.24,
        Math.cos(a) * 1.1,
      );
      tile.rotation.y = a;
    }
    part(new T.CylinderGeometry(0.4, 0.4, 0.15, 8), dark, 0, 0.28);
  } else if (slot === "nav") {
    const core = part(new T.OctahedronGeometry(0.55), glow);
    core.name = "star-core";
    for (let i = 0; i < 3; i++) {
      const ring = part(
        new T.TorusGeometry(0.92, 0.045, 6, 32),
        i === 1 ? glow : material,
      );
      ring.rotation.set(i * 0.9, 0.4 + i * 0.8, 0.3);
      ring.name = `guidance-ring-${i}`;
    }
    part(new T.CylinderGeometry(0.6, 0.8, 0.2, 8), dark, 0, -1.05);
  } else {
    for (const x of [-0.48, 0.48]) {
      part(new T.CapsuleGeometry(0.29, 0.95, 4, 12), material, x);
      for (const y of [-0.35, 0.35])
        part(new T.CylinderGeometry(0.31, 0.31, 0.12, 12), dark, x, y);
      part(new T.CylinderGeometry(0.1, 0.1, 0.23, 8), glow, x, 0.85);
    }
    part(new T.BoxGeometry(0.32, 0.75, 0.45), dark, 0, 0, 0.08);
    part(new T.BoxGeometry(0.15, 0.25, 0.08), glow, 0, 0.12, 0.35);
    part(new T.TorusGeometry(0.5, 0.065, 5, 20, Math.PI), glow, 0, 0.7);
  }
  if (broken) {
    g.rotation.z = 0.17;
    g.rotation.x = 0.12;
  }
  return g;
}

export class ShipAssembly {
  private slots = new Map<
    Part,
    {
      good: T.Group;
      broken: T.Group;
      display: T.Group;
      mount: T.Vector3;
      from: T.Vector3;
      rarity: string;
      at: number;
    }
  >();
  private sparks: T.InstancedMesh;
  private dummy = new T.Object3D();
  active = "";
  constructor(parent: T.Group) {
    const positions: Record<Part, T.Vector3> = {
      booster: new T.Vector3(0, 2.8, -9),
      hull: new T.Vector3(0, 7.2, -9),
      nav: new T.Vector3(1.8, 6, -7.3),
      air: new T.Vector3(-2.4, 4.5, -9),
    };
    partSlots.forEach((slot, i) => {
      const mount = positions[slot],
        good = shipPartModel(slot),
        broken = shipPartModel(slot, true),
        display = shipPartModel(slot);
      good.position.copy(mount);
      broken.position.copy(mount);
      good.visible = false;
      const from = new T.Vector3(
        6.5 + (i % 2) * 3,
        1.5,
        -3 - Math.floor(i / 2) * 3.2,
      );
      display.position.copy(from);
      display.scale.setScalar(0.65);
      display.visible = false;
      const pedestal = new T.Mesh(
        new T.CylinderGeometry(1.05, 1.25, 0.3, 8),
        new T.MeshStandardMaterial({
          color: 0x354955,
          metalness: 0.5,
          roughness: 0.6,
        }),
      );
      pedestal.position.copy(from).setY(0.25);
      const ring = new T.Mesh(
        new T.TorusGeometry(1.05, 0.035, 4, 24),
        new T.MeshBasicMaterial({ color: partDetails[slot].color }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(pedestal.position).setY(0.42);
      const scale = slot === "booster" ? 1.7 : slot === "hull" ? 1.04 : 0.9;
      good.userData.fullScale = scale;
      good.scale.setScalar(scale);
      broken.scale.setScalar(scale);
      parent.add(good, broken, display, pedestal, ring);
      this.slots.set(slot, {
        good,
        broken,
        display,
        mount,
        from,
        rarity: "",
        at: -100,
      });
    });
    this.sparks = new T.InstancedMesh(
      new T.OctahedronGeometry(0.06),
      new T.MeshBasicMaterial({ color: 0xffdc8a }),
      24,
    );
    this.sparks.count = 0;
    parent.add(this.sparks);
  }
  update(s: Game, time: number, reduced: boolean) {
    const progress = returnProgress(s);
    this.active = "";
    this.sparks.count = 0;
    for (const [slot, entry] of this.slots) {
      const installed = progress.installed[slot] || "";
      if (entry.rarity !== installed) {
        entry.rarity = installed;
        entry.at = time;
      }
      const t = T.MathUtils.clamp((time - entry.at) / 1.5, 0, 1),
        anim = installed && t < 1 && !reduced;
      entry.broken.visible = !installed;
      entry.broken.rotation.z =
        0.17 + (reduced ? 0 : Math.sin(time * 2) * 0.012);
      entry.good.visible = !!installed;
      entry.display.visible =
        !!progress.recovered[slot] &&
        (!installed || installed !== progress.recovered[slot]);
      entry.display.rotation.y = reduced ? 0.35 : time * 0.45;
      entry.display.position.y =
        entry.from.y + (reduced ? 0 : Math.sin(time * 2) * 0.12);
      if (anim) {
        this.active = slot;
        const ease = 1 - Math.pow(1 - t, 3);
        entry.good.position.lerpVectors(entry.from, entry.mount, ease);
        entry.good.position.y += Math.sin(t * Math.PI) * 2.5;
        entry.good.rotation.y = (1 - ease) * Math.PI * 2;
        entry.good.scale.setScalar(
          Number(entry.good.userData.fullScale) * (0.6 + ease * 0.4),
        );
        this.sparks.count = 24;
        for (let i = 0; i < 24; i++) {
          const a = i * 2.4 + time * 3,
            r = 0.4 + ((time * 2 + i * 0.13) % 1) * 1.2;
          this.dummy.position
            .copy(entry.good.position)
            .add(
              new T.Vector3(
                Math.cos(a) * r,
                Math.sin(i + time * 4) * 0.7,
                Math.sin(a) * r,
              ),
            );
          this.dummy.scale.setScalar(1 - t);
          this.dummy.updateMatrix();
          this.sparks.setMatrixAt(i, this.dummy.matrix);
        }
        this.sparks.instanceMatrix.needsUpdate = true;
      } else {
        entry.good.position.copy(entry.mount);
        entry.good.rotation.y = 0;
        entry.good.scale.setScalar(Number(entry.good.userData.fullScale));
      }
      const core = entry.good.getObjectByName("star-core");
      if (core && !reduced) core.rotation.y = time * 0.7;
    }
  }
  get state() {
    return {
      installing: this.active,
      slots: Array.from(this.slots, ([part, e]) => ({
        part,
        broken: e.broken.visible,
        installed: e.good.visible,
        display: e.display.visible,
      })),
    };
  }
}
