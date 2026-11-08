import * as THREE from "three";
import { B, stations, type Game } from "../../../shared/src/sim";
import { ParticlePool } from "./particles";
export class WorldMotion {
  time = 0;
  reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  particles: ParticlePool;
  smoke: ParticlePool;
  nextSmoke = 0;
  nextBeacon = 0;
  nextWind = 0;
  storm = 0;
  lastDose = 0;
  shake = 0;
  flights: {
    obj: THREE.Object3D;
    start: THREE.Vector3;
    end: THREE.Vector3;
    age: number;
  }[] = [];
  scans: { beam: THREE.Mesh; ring: THREE.Mesh; age: number }[] = [];
  constructor(public scene: THREE.Scene) {
    this.particles = new ParticlePool(scene, 192);
    this.smoke = new ParticlePool(scene, 28, true);
    matchMedia("(prefers-reduced-motion: reduce)").addEventListener(
      "change",
      (e) => (this.reduced = e.matches),
    );
  }
  cue(
    kind: string,
    target: string | undefined,
    id: string,
    actors: Map<string, THREE.Group>,
    items: Map<string, THREE.Object3D>,
  ) {
    const actor = actors.get(id);
    if (!actor) return;
    if (kind === "pickup" && target && items.get(target)) {
      const o = items.get(target)!;
      const gain = document.createElement("div");
      gain.className = "gain-floater";
      gain.textContent = `+${o.userData.count || 1}`;
      document.body.append(gain);
      setTimeout(() => gain.remove(), 800);
      actor.userData.crouch = this.time + 0.5;
      if (!this.reduced) {
        const mesh = (o.children[0] as THREE.Mesh).clone();
        mesh.geometry = mesh.geometry.clone();
        mesh.material = (mesh.material as THREE.Material).clone();
        mesh.position.copy(o.position);
        mesh.position.y = 0.5;
        this.scene.add(mesh);
        this.flights.push({
          obj: mesh,
          start: mesh.position.clone(),
          end: actor.position.clone().add(new THREE.Vector3(0, 1.8, 0)),
          age: 0,
        });
      }
      this.particles.emit(o.position.x, 0.4, o.position.z, 0xffc83d, 8, 0.07);
    }
    if (kind === "scan" && target && target in stations) {
      const pos = stations[target as keyof typeof stations],
        from = actor.position.clone().add(new THREE.Vector3(0, 2.4, 0)),
        to = new THREE.Vector3(pos.x, 1.3, pos.z);
      const dir = to.clone().sub(from);
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, dir.length(), 6),
        new THREE.MeshBasicMaterial({
          color: 0x39e6e0,
          transparent: true,
          opacity: 0.6,
          depthWrite: false,
        }),
      );
      beam.position.copy(from.clone().add(to).multiplyScalar(0.5));
      beam.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        dir.normalize(),
      );
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.5, 0.035, 4, 24),
        new THREE.MeshBasicMaterial({
          color: 0x39e6e0,
          transparent: true,
          opacity: 1,
          depthWrite: false,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(pos.x, 0.1, pos.z);
      this.scene.add(beam, ring);
      this.scans.push({ beam, ring, age: 0 });
    }
    if (kind === "clean" && target) {
      const index = Number(target.split("-")[1]);
      this.particles.emit(-8 + index * 3, 1.2, 7, 0xfff4e6, 18, 0.09, 1);
    }
    if (kind === "dose" || kind === "flare") {
      document.body.classList.add("dose-hit");
      setTimeout(() => document.body.classList.remove("dose-hit"), 800);
      this.shake = 0.5;
      const el = document.createElement("div");
      el.className = kind === "flare" ? "flare-flash" : "damage-flash";
      document.body.append(el);
      setTimeout(() => el.remove(), 600);
    }
  }
  actor(g: THREE.Group, p: Game["players"][string], s: Game, dt: number) {
    const dx = g.position.x - Number(g.userData.px ?? g.position.x),
      dz = g.position.z - Number(g.userData.pz ?? g.position.z),
      traveled = Math.hypot(dx, dz);
    g.userData.px = g.position.x;
    g.userData.pz = g.position.z;
    const moving = Math.hypot(p.move.x, p.move.z) > 0.01 && traveled > 0.0001;
    const stride = 1.05;
    const gait =
      Number(g.userData.gait || 0) + (moving ? traveled / stride : 0);
    g.userData.gait = gait;
    if (Math.hypot(p.move.x, p.move.z) > 0.01) {
      const angle = Math.atan2(p.move.x, p.move.z);
      g.rotation.y +=
        Math.atan2(
          Math.sin(angle - g.rotation.y),
          Math.cos(angle - g.rotation.y),
        ) *
        (1 - Math.exp(-8 * dt));
    }
    const swing =
      moving && !this.reduced
        ? Math.sin(gait * Math.PI) * 0.46
        : moving
          ? Math.sin(gait * Math.PI) * 0.16
          : 0;
    for (const [part, sign] of [
      ["armL", 1],
      ["armR", -1],
      ["legL", -1],
      ["legR", 1],
    ] as const) {
      const limb = g.getObjectByName(part);
      if (!limb) continue;
      const leg = part.startsWith("leg");
      limb.rotation.x = moving
        ? swing * sign * (leg ? 1 : 0.72)
        : THREE.MathUtils.damp(limb.rotation.x, 0, 8, dt);
    }
    const bob =
      this.reduced || !moving ? 0 : Math.sin(gait * Math.PI) ** 2 * 0.045;
    g.position.y = moving
      ? bob
      : THREE.MathUtils.damp(g.position.y, 0, 8, dt);
    g.rotation.x = THREE.MathUtils.damp(
      g.rotation.x,
      moving && !this.reduced ? 0.04 : 0,
      6,
      dt,
    );
    g.rotation.z = THREE.MathUtils.damp(
      g.rotation.z,
      moving && !this.reduced ? Math.cos(gait * Math.PI) * 0.025 : 0,
      8,
      dt,
    );
    const crouch = Number(g.userData.crouch || 0) - this.time;
    const breathing =
      this.reduced || moving ? 0 : 0.02 * Math.sin(this.time * Math.PI);
    g.scale.set(
      1.35,
      1.35 *
        (1 +
          breathing -
          (crouch > 0 ? 0.22 * Math.sin((crouch / 0.5) * Math.PI) : 0)),
      1.35,
    );
    const visor = g.getObjectByName("visor") as THREE.Mesh<
      THREE.SphereGeometry,
      THREE.MeshStandardMaterial
    >;
    if (visor)
      visor.material.emissiveIntensity =
        0.6 + Math.pow(Math.max(0, Math.sin(this.time * 1.2)), 24) * 0.8;
    const carry = g.getObjectByName("carried");
    if (carry) {
      carry.visible = Object.values(p.bag).some((n) => n && n > 0);
      if (carry.visible) {
        const armL = g.getObjectByName("armL"),
          armR = g.getObjectByName("armR");
        if (armL) armL.rotation.x = -1.1 + swing * 0.12;
        if (armR) armR.rotation.x = -1.1 - swing * 0.12;
      }
    }
    const building = p.task?.kind === "build",
      tool = g.getObjectByName("wrench");
    if (tool) tool.visible = building;
    if (building) {
      const arm = g.getObjectByName("armR");
      if (arm) arm.rotation.x = -1.2 + Math.sin(this.time * 14) * 0.5;
      if (!this.reduced && this.time > Number(g.userData.sparkAt || 0)) {
        this.particles.emit(p.x, 0.9, p.z + 0.8, 0xffc83d, 3, 0.035, 0.45);
        g.userData.sparkAt = this.time + 0.15;
      }
    }
    if (
      moving &&
      !this.reduced &&
      traveled < 1.2 &&
      Math.floor(gait) !== Math.floor(gait - traveled / stride)
    ) {
      this.particles.emit(
        g.position.x,
        0.08,
        g.position.z,
        0xe0a982,
        3,
        0.09,
        0.5,
        0,
        0.35,
      );
      dispatchEvent(new CustomEvent("footstep"));
    }
  }
  update(s: Game, id: string, actors: Map<string, THREE.Group>, dt: number) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt);
    const activeStorm = s.event?.kind === "storm" && s.clock >= s.event.at;
    this.storm = THREE.MathUtils.clamp(
      this.storm + (activeStorm ? dt / 5 : -dt / 5),
      0,
      1,
    );
    if (s.dose > this.lastDose)
      this.cue("dose", undefined, id, actors, new Map());
    this.lastDose = s.dose;
    if (!this.reduced) {
      if (this.time > this.nextSmoke) {
        this.smoke.emit(-10, 2.2, -13, 0xb8aca4, 1, 0.8, 6, 0.4, 1.1, 0.15);
        this.nextSmoke = this.time + 0.3;
      }
      if (this.time > this.nextBeacon) {
        for (const [key, p] of Object.entries(stations))
          if (key !== "workbench")
            this.particles.emit(p.x, 1.4, p.z, 0x39e6e0, 1, 0.035, 1.3, 0, 0.5);
        this.nextBeacon = this.time + 0.65;
      }
      if (this.time > this.nextWind) {
        if (this.storm > 0.1) {
          const p = s.players[id];
          for (let i = 0; i < 8; i++)
            this.particles.emit(
              p.x - 8,
              Math.random() * 5,
              p.z + (Math.random() - 0.5) * 20,
              0xe3c9ad,
              1,
              0.04,
              1.4,
              12,
              0,
              1,
            );
        }
        this.particles.emit(
          s.devil.x + (Math.random() - 0.5) * 2,
          0.3,
          s.devil.z + (Math.random() - 0.5) * 2,
          0xe0a982,
          2,
          0.08,
          1.4,
          0,
          2,
        );
        this.nextWind = this.time + 0.15;
      }
    }
    this.particles.update(dt);
    this.smoke.update(dt, true);
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const f = this.flights[i];
      f.age += dt;
      const t = Math.min(1, f.age / 0.5);
      f.obj.position.lerpVectors(f.start, f.end, t);
      f.obj.position.y += Math.sin(t * Math.PI) * 2;
      f.obj.scale.setScalar(1 - t * 0.6);
      if (t >= 1) {
        this.scene.remove(f.obj);
        (f.obj as THREE.Mesh).geometry.dispose();
        ((f.obj as THREE.Mesh).material as THREE.Material).dispose();
        this.flights.splice(i, 1);
      }
    }
    for (let i = this.scans.length - 1; i >= 0; i--) {
      const f = this.scans[i];
      f.age += dt;
      const t = Math.min(1, f.age / 0.8);
      f.ring.scale.setScalar(this.reduced ? 1 : 1 + t * 4);
      (f.beam.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.6;
      (f.ring.material as THREE.MeshBasicMaterial).opacity = 1 - t;
      if (t >= 1) {
        for (const o of [f.beam, f.ring]) {
          this.scene.remove(o);
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
        this.scans.splice(i, 1);
      }
    }
  }
  get particleCount() {
    return this.particles.active + this.smoke.active;
  }
}
