import * as THREE from "three";
import { disposeModel } from "./modelAssets";
import { B, stations, type Game } from "../../../shared/src/sim";
import { ParticlePool } from "./particles";
import { Sandstorm } from "./sandstorm";
export type ActorState = {
  speed: number; // horizontal m/s
  gait: "walk" | "sprint" | "crouch";
  grounded: boolean;
  vy: number;
  landAgo: number; // seconds since the last landing
  landImpact: number; // 0..1
  heading?: number; // set for the local player (controller decides facing)
};
export class WorldMotion {
  time = 0;
  reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  particles: ParticlePool;
  smoke: ParticlePool;
  nextSmoke = 0;
  nextBeacon = 0;
  nextWind = 0;
  storm = 0;
  sandstorm: Sandstorm;
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
    this.sandstorm = new Sandstorm(scene);
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
        const mesh = o.children[0].clone(true);
        mesh.visible = true;
        mesh.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;
          child.geometry = child.geometry.clone();
          child.geometry.userData.marsOwned = true;
          child.material = Array.isArray(child.material)
            ? child.material.map((m) => m.clone()) : child.material.clone();
        });
        mesh.position.copy(o.position);
        mesh.position.y = o.position.y + 0.9;
        this.scene.add(mesh);
        this.flights.push({
          obj: mesh,
          start: mesh.position.clone(),
          end: actor.position.clone().add(new THREE.Vector3(0, 1.8, 0)),
          age: 0,
        });
      }
      this.particles.emit(o.position.x, o.position.y + 0.6, o.position.z, 0xffc83d, 10, 0.09);
    }
    if (kind === "scan" && target && target in stations) {
      const pos = stations[target as keyof typeof stations],
        from = actor.position.clone().add(new THREE.Vector3(0, 2.4, 0)),
        to = new THREE.Vector3(pos.x, 3.0, pos.z);
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
      const index = Number(target.split("-")[1]),
        L = B.layoutScale;
      this.particles.emit((-8 + index * 3) * L, 2.6, 7 * L, 0xfff4e6, 24, 0.11, 1.2);
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
  /**
   * Pose an astronaut every frame from how it is actually moving.
   * `st` comes from the local controller for you, or is estimated for other players.
   */
  actor(
    g: THREE.Group,
    p: Game["players"][string],
    s: Game,
    dt: number,
    st: ActorState,
  ) {
    const damp = (from: number, to: number, k = 14) =>
      THREE.MathUtils.damp(from, to, k, dt);
    const get = (n: string) => g.getObjectByName(n);
    const R = this.reduced ? 0.35 : 1;
    const dx = g.position.x - Number(g.userData.px ?? g.position.x),
      dz = g.position.z - Number(g.userData.pz ?? g.position.z),
      traveled = Math.min(2, Math.hypot(dx, dz));
    g.userData.px = g.position.x;
    g.userData.pz = g.position.z;
    const moving = st.speed > 0.35;
    const sprint = st.gait === "sprint" && moving,
      crouchHeld = st.gait === "crouch",
      pickup = Number(g.userData.crouch || 0) > this.time;
    const stride = sprint ? 1.7 : crouchHeld ? 0.75 : 1.15;
    const before = Number(g.userData.gait || 0);
    const gait = before + (moving && st.grounded ? traveled / stride : 0);
    g.userData.gait = gait;
    const ph = gait * Math.PI;

    // Facing
    if (st.heading !== undefined) {
      g.rotation.y = st.heading;
    } else if (Math.hypot(p.move.x, p.move.z) > 0.01) {
      const angle = Math.atan2(p.move.x, p.move.z);
      g.rotation.y +=
        Math.atan2(Math.sin(angle - g.rotation.y), Math.cos(angle - g.rotation.y)) *
        (1 - Math.exp(-12 * dt));
    }
    g.rotation.x = 0;
    g.rotation.z = 0;

    const amp = (sprint ? 0.95 : crouchHeld ? 0.4 : 0.6) * R * Math.min(1, st.speed / 2.5);
    const sin = Math.sin(ph),
      cos = Math.cos(ph);
    // Targets (radians). Negative x = limb swings forward, positive knee = shin bends back.
    let hipL = -sin * amp,
      hipR = sin * amp,
      kneeL = Math.max(0, cos) * amp * 1.2 + 0.05,
      kneeR = Math.max(0, -cos) * amp * 1.2 + 0.05,
      armL = sin * amp * 0.85,
      armR = -sin * amp * 0.85,
      elbow = sprint ? -1.25 : moving ? -0.35 : -0.12,
      armOut = 0.12,
      lean = sprint ? 0.24 : moving ? 0.06 : 0,
      hipsY = 0.8 - (moving ? Math.abs(sin) * (sprint ? 0.07 : 0.035) * R : 0);
    if (!moving) {
      // idle: soft breathing and a relaxed stance
      const breathe = Math.sin(this.time * 2.1) * 0.012 * R;
      hipsY += breathe * 0.3;
      armL = armR = 0.04 + breathe;
      hipL = hipR = 0;
      kneeL = kneeR = 0.05;
    }
    if (crouchHeld || pickup) {
      hipsY -= 0.26;
      hipL += -0.75;
      hipR += -0.75;
      kneeL += 1.15;
      kneeR += 1.15;
      lean = 0.42;
      elbow = -0.6;
    }
    if (!st.grounded) {
      if (st.vy > 0) {
        // take-off: tuck one knee, arms up
        hipL = -0.85;
        kneeL = 1.25;
        hipR = -0.15;
        kneeR = 0.45;
        armL = armR = -2.2 * R;
        elbow = -0.5;
      } else {
        // falling: legs reach for the ground, arms out for balance
        hipL = -0.35;
        hipR = -0.05;
        kneeL = 0.5;
        kneeR = 0.2;
        armL = armR = -0.6;
        armOut = 0.9;
        elbow = -0.3;
      }
      lean = 0.1;
    }
    // landing squash
    const sinceLand = st.landAgo;
    if (st.grounded && sinceLand < 0.28) {
      const k = (1 - sinceLand / 0.28) * (0.35 + st.landImpact * 0.65) * R;
      hipsY -= 0.22 * k;
      hipL -= 0.5 * k;
      hipR -= 0.5 * k;
      kneeL += 0.9 * k;
      kneeR += 0.9 * k;
      lean += 0.25 * k;
    }
    const carry = get("carried");
    const carrying = Object.values(p.bag).some((n) => n && n > 0);
    if (carry) carry.visible = carrying;
    if (carrying && st.grounded) {
      armL = armR = -1.15 + sin * 0.08;
      elbow = -0.35;
      armOut = 0.05;
    }

    const set = (n: string, v: number, k = 18) => {
      const o = get(n);
      if (o) o.rotation.x = damp(o.rotation.x, v, k);
    };
    const air = st.grounded ? 22 : 10;
    set("legL", hipL, air);
    set("legR", hipR, air);
    set("kneeL", kneeL, air);
    set("kneeR", kneeR, air);
    set("armL", armL, air);
    set("armR", armR, air);
    set("elbowL", elbow);
    set("elbowR", elbow);
    for (const [n, sgn] of [["armL", -1], ["armR", 1]] as const) {
      const o = get(n);
      if (o) o.rotation.z = damp(o.rotation.z, sgn * armOut, 10);
    }
    const hips = get("hips"),
      upper = get("upper"),
      head = get("head");
    if (hips) hips.position.y = damp(hips.position.y, hipsY, st.grounded ? 20 : 12);
    if (upper) upper.rotation.x = damp(upper.rotation.x, lean, 10);
    if (head) head.rotation.x = damp(head.rotation.x, -lean * 0.6, 10);

    const visor = get("visor") as THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
    if (visor)
      visor.material.emissiveIntensity =
        0.5 + Math.pow(Math.max(0, Math.sin(this.time * 1.2)), 24) * 0.8;
    const light = get("packLight") as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
    if (light) light.material.color.setHex(Math.sin(this.time * 3) > 0 ? 0x7ee05a : 0x3f8a2c);

    const building = p.task?.kind === "build",
      tool = get("wrench");
    if (tool) tool.visible = building;
    if (building) {
      const arm = get("armR");
      if (arm) arm.rotation.x = -1.2 + Math.sin(this.time * 14) * 0.5;
      if (!this.reduced && this.time > Number(g.userData.sparkAt || 0)) {
        this.particles.emit(p.x, g.position.y + 0.9, p.z + 0.8, 0xffc83d, 3, 0.035, 0.45);
        g.userData.sparkAt = this.time + 0.15;
      }
    }
    // footsteps + dust, and a bigger puff on landing
    if (moving && st.grounded && !this.reduced && Math.floor(gait) !== Math.floor(before)) {
      this.particles.emit(g.position.x, g.position.y + 0.08, g.position.z, 0xe0a982, sprint ? 5 : 3, 0.09, 0.5, 0, 0.35);
      dispatchEvent(new CustomEvent("footstep"));
    }
    if (st.grounded && sinceLand < dt * 1.5 && st.landImpact > 0.05 && !this.reduced) {
      this.particles.emit(g.position.x, g.position.y + 0.1, g.position.z, 0xe0a982, 10 + Math.round(st.landImpact * 14), 0.12, 0.7, 0, 0.6);
      dispatchEvent(new CustomEvent("footstep"));
    }
  }
  update(s: Game, id: string, actors: Map<string, THREE.Group>, dt: number) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt);
    const activeStorm =
      s.phase === "day" &&
      s.event?.kind === "storm" &&
      s.clock >= s.event.at;
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
        this.smoke.emit(-18.6, 3.2, -31.3, 0xb8aca4, 1, 1.6, 8, 0.5, 1.6, 0.25); // wreck engines
        this.nextSmoke = this.time + 0.3;
      }
      if (this.time > this.nextBeacon) {
        for (const [key, p] of Object.entries(stations))
          if (key !== "workbench")
            this.particles.emit(p.x, 3.0, p.z, 0x39e6e0, 1, 0.05, 1.3, 0, 0.5);
        this.nextBeacon = this.time + 0.65;
      }
      if (this.time > this.nextWind) {
        if (this.storm > 0.1 && this.sandstorm.status !== "ready") {
          const p = s.players[id];
          for (let i = 0; p && i < 8; i++)
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
        disposeModel(f.obj);
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
