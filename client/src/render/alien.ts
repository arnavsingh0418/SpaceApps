import * as T from "three";
import { alienProgress, alienSite } from "../../../shared/src/alien";
import type { Game } from "../../../shared/src/sim";
import type { Terrain } from "./terrain";
import { shipPartModel } from "./ship";

export class Nemi {
  group = new T.Group();
  actor = new T.Group();
  private head = new T.Group();
  private arm = new T.Group();
  private mouth: T.Mesh;
  private eyes: T.Mesh[] = [];
  private water: T.Mesh;
  private collector: T.Mesh;
  private gift = shipPartModel("nav");
  private placed = false;
  speaking = false;
  private time = 0;
  constructor(scene: T.Scene) {
    const skin = new T.MeshStandardMaterial({
      color: 0x90d5b1,
      roughness: 0.65,
    });
    const coat = new T.MeshStandardMaterial({
      color: 0x8872bc,
      roughness: 0.8,
    });
    const dark = new T.MeshStandardMaterial({
      color: 0x162f42,
      roughness: 0.25,
    });
    const metal = new T.MeshStandardMaterial({
      color: 0x73939d,
      metalness: 0.4,
      roughness: 0.5,
    });
    const part = (
      parent: T.Object3D,
      geo: T.BufferGeometry,
      mat: T.Material,
      x = 0,
      y = 0,
      z = 0,
    ) => {
      const m = new T.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      parent.add(m);
      return m;
    };
    this.group.position.set(alienSite.x, 0, alienSite.z);
    scene.add(this.group);
    part(this.group, new T.CylinderGeometry(4.2, 4.4, 0.2, 20), metal, 0, 0.05);
    this.actor.position.set(0, 0, 0);
    this.group.add(this.actor);
    part(this.actor, new T.CapsuleGeometry(0.55, 0.65, 5, 16), coat, 0, 1.15);
    for (const x of [-0.32, 0.32]) {
      part(this.actor, new T.CapsuleGeometry(0.17, 0.4, 4, 10), skin, x, 0.4);
      part(this.actor, new T.SphereGeometry(0.22, 10, 8), dark, x, 0.1, 0.1);
    }
    this.head.position.set(0, 2.1, 0);
    this.actor.add(this.head);
    const skull = part(this.head, new T.SphereGeometry(0.75, 20, 14), skin);
    skull.scale.set(1.1, 0.85, 0.85);
    for (const side of [-1, 1]) {
      const ear = part(
        this.head,
        new T.ConeGeometry(0.25, 0.85, 8),
        skin,
        side * 0.8,
        0.03,
      );
      ear.rotation.z = -side * 1.15;
      const eye = part(
        this.head,
        new T.SphereGeometry(0.24, 16, 12),
        dark,
        side * 0.31,
        0.04,
        0.52,
      );
      eye.scale.set(0.85, 1.3, 0.55);
      eye.rotation.z = side * 0.23;
      this.eyes.push(eye);
      part(
        this.head,
        new T.SphereGeometry(0.06, 8, 6),
        new T.MeshBasicMaterial({ color: 0xebfff4 }),
        side * 0.31 - 0.035,
        0.14,
        0.66,
      );
      const limb = new T.Group();
      limb.position.set(side * 0.58, 1.5, 0);
      this.actor.add(limb);
      part(limb, new T.CapsuleGeometry(0.14, 0.5, 4, 10), coat, 0, -0.25);
      part(limb, new T.SphereGeometry(0.18, 10, 8), skin, 0, -0.6);
      if (side === 1) this.arm = limb;
    }
    this.mouth = part(
      this.head,
      new T.SphereGeometry(0.13, 10, 8),
      dark,
      0,
      -0.27,
      0.59,
    );
    this.mouth.scale.set(1, 0.22, 0.3);
    const badge = part(
      this.actor,
      new T.OctahedronGeometry(0.17),
      new T.MeshBasicMaterial({ color: 0xdad1ff }),
      0,
      1.3,
      0.57,
    );
    badge.rotation.z = 0.5;
    part(
      this.group,
      new T.CylinderGeometry(0.55, 0.7, 2.3, 12, 1, true),
      new T.MeshStandardMaterial({ color: 0xa1d7d6, transparent: true, opacity: 0.22, roughness: 0.2, depthWrite: false, side: T.DoubleSide }),
      2.4,
      1.15,
      -1.2,
    );
    this.water = part(
      this.group,
      new T.CylinderGeometry(0.49, 0.49, 1.8, 12),
      new T.MeshStandardMaterial({
        color: 0x62dce7,
        transparent: true,
        opacity: 0.75,
        emissive: 0x126778,
      }),
      2.4,
      1.1,
      -1.2,
    );
    this.water.scale.y = 0.15;
    const collectorStand = part(
      this.group,
      new T.CylinderGeometry(0.1, 0.2, 1.6, 8),
      metal,
      -2.4,
      0.8,
      -1.7,
    );
    this.collector = part(
      this.group,
      new T.BoxGeometry(2.4, 0.12, 1.65),
      new T.MeshStandardMaterial({ color: 0x9f744f, roughness: 0.8 }),
      -2.4,
      1.7,
      -1.7,
    );
    this.collector.rotation.x = -0.35;
    for (let i = 0; i < 5; i++)
      part(
        this.collector,
        new T.BoxGeometry(0.025, 0.025, 1.6),
        metal,
        -1 + i * 0.5,
        0.08,
      );
    part(
      this.group,
      new T.CylinderGeometry(0.75, 0.9, 0.4, 12),
      metal,
      2.4,
      0.2,
      1.8,
    );
    this.gift.position.set(2.4, 1.6, 1.8);
    this.gift.scale.setScalar(0.7);
    this.group.add(this.gift);
    const flag = part(
      this.group,
      new T.BoxGeometry(1.8, 0.75, 0.06),
      coat,
      -2,
      3.8,
      -2.5,
    );
    part(
      this.group,
      new T.CylinderGeometry(0.04, 0.07, 4, 6),
      metal,
      -2.8,
      2,
      -2.5,
    );
    part(
      flag,
      new T.OctahedronGeometry(0.2),
      new T.MeshBasicMaterial({ color: 0x9ff6d7 }),
      0,
      0,
      0.08,
    );
    void collectorStand;
    addEventListener(
      "alien-voice",
      (e) => (this.speaking = !!(e as CustomEvent).detail.speaking),
    );
  }
  update(
    s: Game,
    terrain: Terrain,
    dt: number,
    reduced: boolean,
    player?: { x: number; z: number },
  ) {
    this.time += dt;
    if (terrain.ready && !this.placed) {
      this.group.position.y = terrain.heightAt(alienSite.x, alienSite.z);
      this.placed = true;
    }
    const q = alienProgress(s),
      t = this.time;
    if (
      player &&
      Math.hypot(player.x - alienSite.x, player.z - alienSite.z) < 12
    )
      this.actor.rotation.y = Math.atan2(
        player.x - alienSite.x,
        player.z - alienSite.z,
      );
    this.head.rotation.z = reduced
      ? 0
      : Math.sin(t * (this.speaking ? 3.5 : 1.2)) *
        (this.speaking ? 0.045 : 0.025);
    this.actor.position.y = reduced ? 0 : Math.sin(t * 1.8) * 0.025;
    this.arm.rotation.x = reduced
      ? -0.2
      : this.speaking
        ? -0.8 + Math.sin(t * 4) * 0.2
        : Math.sin(t * 1.8) * 0.04;
    this.arm.rotation.z = this.speaking ? -0.35 : 0;
    this.mouth.scale.y =
      this.speaking && !reduced
        ? 0.25 + Math.abs(Math.sin(t * 13)) * 0.65
        : 0.22;
    const blink = !reduced && t % 4.3 < 0.12;
    this.eyes.forEach((eye) => (eye.scale.y = blink ? 0.1 : 1.3));
    this.collector.material = this.collector.material as T.MeshStandardMaterial;
    (this.collector.material as T.MeshStandardMaterial).color.lerp(
      new T.Color(q.brushed ? 0x2a739f : 0x9f744f),
      1 - Math.exp(-dt * 4),
    );
    this.water.scale.y = T.MathUtils.damp(
      this.water.scale.y,
      q.completed ? 1 : 0.15,
      2,
      dt,
    );
    this.water.position.y = this.water.scale.y * 0.9 + 0.2;
    this.gift.visible = !q.completed;
    this.gift.rotation.y = reduced ? 0.3 : t * 0.6;
    this.gift.position.y = 1.6 + (reduced ? 0 : Math.sin(t * 2) * 0.12);
  }
  get state() {
    return {
      speaking: this.speaking,
      mouth: this.mouth.scale.y,
      water: this.water.scale.y,
    };
  }
}
