import { WorldMotion } from "./motion";
import { placeLabels } from "./labels";
import { Terrain } from "./terrain";
import * as THREE from "three";
import {
  initBuilders,
  astronaut,
  wreck,
  smoke,
  dome,
  greenhouse,
  panel,
  dish,
  crate,
  glow,
} from "./builders.js";
import {
  B,
  stations,
  icons,
  itemNames,
  type Game,
  type Player,
  type Item,
} from "../../../shared/src/sim";
const colors = {
  scrap: 0x9ca3af,
  ice: 0xbae6fd,
  soil: 0xa77b50,
  glass: 0x93c5fd,
  seeds: 0x84cc16,
  antenna: 0xd1d5db,
  battery: 0xfacc15,
  circuit: 0x34d399,
  food: 0xfca5a5,
};
export class World {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(44, innerWidth / innerHeight, 0.1, 1600);
  terrain = new Terrain();
  renderer: THREE.WebGLRenderer;
  actors = new Map<string, THREE.Group>();
  pickups = new Map<string, THREE.Object3D>();
  panels = new Map<string, THREE.Group>();
  buildings = new Map<string, THREE.Object3D>();
  labels = new Map<
    string,
    { obj: THREE.Object3D; el: HTMLElement; height: number }
  >();
  devil = new THREE.Group();
  objectiveTarget: { x: number; z: number } | null = null;
  objectiveMarker = new THREE.Group();
  hovered = "";
  nearest = "";
  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();
  motion: WorldMotion;
  zoom = 20;
  stepRemainder = 0;
  predictMovement = true;
  lastSeed = -1;
  yaw = 0;
  menu = true;
  last = 0;
  fps = 60;
  frameMs = 0;
  sun: THREE.DirectionalLight;
  sky = new THREE.Color(0xe0a982);
  constructor() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: document.querySelector("#world")!,
      antialias: true,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = this.sky;
    this.scene.fog = new THREE.Fog(0xd99a72, 110, 620);
    initBuilders(this.scene);
    this.motion = new WorldMotion(this.scene);
    addEventListener("game-effect", (event) => {
      const e = (event as CustomEvent).detail;
      this.motion.cue(e.kind, e.target, e.id, this.actors, this.pickups);
    });
    this.renderer.domElement.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        this.zoom = THREE.MathUtils.clamp(
          this.zoom + event.deltaY * 0.012,
          12,
          28,
        );
      },
      { passive: false },
    );
    const arrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.45, 5),
      new THREE.MeshBasicMaterial({ color: 0xffc83d }),
    );
    arrow.rotation.z = Math.PI;
    arrow.position.y = 3.3;
    this.objectiveMarker.add(arrow);
    const markerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.8, 0.055, 4, 28),
      new THREE.MeshBasicMaterial({ color: 0xffc83d }),
    );
    markerRing.rotation.x = -Math.PI / 2;
    markerRing.position.y = 0.04;
    this.objectiveMarker.add(markerRing);
    this.scene.add(this.objectiveMarker);
    this.scene.add(new THREE.HemisphereLight(0xfff0e0, 0x7a3a20, 1.1));
    this.sun = new THREE.DirectionalLight(0xffe2c4, 2.5);
    this.sun.position.set(-18, 30, 15);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -38,
      right: 38,
      top: 38,
      bottom: -38,
    });
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    // The Blender-made Mars map replaces the old flat plane and scattered rocks.
    this.terrain
      .load(this.scene)
      .catch((err) => console.error("Mars map failed to load", err));
    wreck(-7, -12);

    const hab = dome(0, -5.4, 2.7);
    this.buildings.set("hab", hab);
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 1.6, 0.25),
      new THREE.MeshStandardMaterial({ color: 0x302823 }),
    );
    door.position.set(0, 0.8, -2.8);
    this.scene.add(door);
    crate(-1.8, -0.1, 0x9b6e44, 0.8);
    crate(-2.7, -1, 0xa37c50, 0.65);
    const table = new THREE.Mesh(
      new THREE.BoxGeometry(2, 0.2, 1.2),
      new THREE.MeshStandardMaterial({ color: 0xcbb599 }),
    );
    table.position.set(0, 0.8, -1.6);
    table.castShadow = true;
    this.scene.add(table);
    this.addLabel("workbench", table, "🔧 WORKBENCH", 1.1);
    for (const [id, pos] of Object.entries(stations)) {
      if (id === "workbench") continue;
      const g = new THREE.Group();
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 1.1, 6),
        new THREE.MeshStandardMaterial({ color: 0xe8e4dc }),
      );
      pole.position.y = 0.55;
      g.add(pole);
      const orb = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.25),
        new THREE.MeshStandardMaterial({
          color: 0x67e8f9,
          emissive: 0x0891b2,
          emissiveIntensity: 0.7,
        }),
      );
      orb.position.y = 1.3;
      g.add(orb);
      g.position.set(pos.x, 0, pos.z);
      this.scene.add(g);
      glow(pos.x, 0.04, pos.z, 0x67e8f9);
      this.addLabel(
        id,
        g,
        `${{ shield: "🛡️ Shielding", comms: "📡 Radio science", grow: "🌱 Growing food", power: "⚡ Solar science", oxygen: "💨 Oxygen science", plants: "🔬 Space plants" }[id]} · SCAN`,
        1.9,
      );
    }
    dish(-9, -7, true);
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.4 + i * 0.12,
          0.3 + i * 0.12,
          0.65,
          9,
          1,
          true,
        ),
        new THREE.MeshStandardMaterial({
          color: 0xdca06c,
          transparent: true,
          opacity: 0.18,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      m.position.y = i * 0.6;
      m.position.x = Math.sin(i) * 0.25;
      this.devil.add(m);
    }
    this.scene.add(this.devil);
    this.renderer.domElement.addEventListener("pointermove", (event) => {
      this.pointer.set(
        (event.clientX / innerWidth) * 2 - 1,
        (-event.clientY / innerHeight) * 2 + 1,
      );
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const entries = Array.from(this.labels.entries()).filter(
        ([key]) => !this.actors.has(key),
      );
      const hits = this.raycaster.intersectObjects(
        entries.map(([, l]) => l.obj),
        true,
      );
      this.hovered = "";
      if (hits[0]) {
        let obj: THREE.Object3D | null = hits[0].object;
        while (obj) {
          const found = entries.find(([, l]) => l.obj === obj);
          if (found) {
            this.hovered = found[0];
            break;
          }
          obj = obj.parent;
        }
      }
    });
    this.renderer.domElement.addEventListener(
      "pointerleave",
      () => (this.hovered = ""),
    );
    this.camera.position.set(18, 13, 26);
    this.camera.lookAt(0, 1, -3);
    addEventListener("resize", () => {
      this.renderer.setSize(innerWidth, innerHeight);
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
    });
  }
  addLabel(id: string, obj: THREE.Object3D, text: string, height: number) {
    const el = document.createElement("div");
    el.className = "world-label";
    el.hidden = true;
    el.textContent = text;
    document.querySelector("#labels")!.append(el);
    this.labels.set(id, { obj, el, height });
  }
  remove(id: string, obj: THREE.Object3D) {
    this.scene.remove(obj);
    this.labels.get(id)?.el.remove();
    this.labels.delete(id);
    obj.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          m.dispose();
      }
    });
  }
  update(s: Game, id: string, dt: number) {
    const renderBegin = performance.now();
    if (this.lastSeed !== s.seed) {
      for (const [k, o] of this.buildings)
        if (k !== "hab") {
          this.remove(k, o);
          this.buildings.delete(k);
        }
      this.lastSeed = s.seed;
    }
    for (const [k, o] of this.panels)
      if (!s.panels.some((p) => p.id === k)) {
        this.remove(k, o);
        this.panels.delete(k);
      }
    this.motion.update(s, id, this.actors, dt);
    for (const [key, obj] of this.actors)
      if (!s.players[key]) {
        this.remove(key, obj);
        this.actors.delete(key);
      }
    for (const p of Object.values(s.players)) {
      let g = this.actors.get(p.id);
      if (!g) {
        g = astronaut(p.color);
        this.actors.set(p.id, g!);
        this.addLabel(p.id, g!, `${p.name}${p.id === id ? " (you)" : ""}`, 2.9);
        g!.position.set(p.x, 0, p.z);
      }
      const player = g!;
      const speed = s.allocation.heat < 1 ? B.coldSpeed : B.speed;
      let x = p.x;
      let z = p.z;
      if (this.predictMovement && s.phase === "day") {
        x += p.move.x * speed * this.stepRemainder;
        z += p.move.z * speed * this.stepRemainder;
      } else {
        const shown = (player.userData.shown ||= { x: p.x, z: p.z }) as {
          x: number;
          z: number;
        };
        const dx = p.x - shown.x,
          dz = p.z - shown.z,
          dist = Math.hypot(dx, dz),
          step = Math.min(dist, Math.max(speed, dist / 0.12) * dt);
        if (dist > 1e-5) {
          shown.x += (dx / dist) * step;
          shown.z += (dz / dist) * step;
        }
        x = shown.x;
        z = shown.z;
      }
      const radius = Math.hypot(x, z);
      if (radius > B.worldRadius) {
        x *= B.worldRadius / radius;
        z *= B.worldRadius / radius;
      }
      player.position.x = x;
      player.position.z = z;
      this.motion.actor(player, p, s, dt);
      player.position.y = this.terrain.heightAt(x, z);
    }
    for (const [key, obj] of this.pickups)
      if (!s.items.some((i) => i.id === key)) {
        this.remove(key, obj);
        this.pickups.delete(key);
      }
    for (const i of s.items) {
      let o = this.pickups.get(i.id);
      if (!o) {
        const group = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({
          color: colors[i.kind],
          flatShading: true,
          roughness: i.kind === "ice" ? 0.15 : 0.8,
        });
        const m = new THREE.Mesh(
          i.kind === "ice"
            ? new THREE.IcosahedronGeometry(0.5)
            : new THREE.BoxGeometry(0.65, 0.65, 0.65),
          mat,
        );
        m.position.y = 0.45;
        m.castShadow = true;
        group.add(m);
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.68, 0.035, 4, 20),
          new THREE.MeshBasicMaterial({
            color: i.kind === "ice" ? 0x7dd3fc : 0xfacc15,
          }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.05;
        group.add(ring);
        this.scene.add(group);
        o = group;
        this.pickups.set(i.id, o);
        this.addLabel(
          i.id,
          o,
          `${icons[i.kind]} ${itemNames[i.kind]} ×${i.count}`,
          1.2,
        );
      }
      o.userData.count = i.count;
      o.position.set(i.x, this.terrain.heightAt(i.x, i.z), i.z);
      o.children[0].position.y =
        0.55 +
        (this.motion.reduced ? 0 : Math.sin(this.motion.time * 2 + i.x) * 0.15);
      o.children[0].rotation.y = this.motion.reduced
        ? 0
        : this.motion.time * 0.35 + i.x;
      const ring = o.children[1] as THREE.Mesh<
        THREE.TorusGeometry,
        THREE.MeshBasicMaterial
      >;
      ring.material.transparent = true;
      ring.material.opacity = i.id === this.nearest ? 0.95 : 0.5;
      ring.scale.setScalar(
        this.motion.reduced ? 1 : 1 + Math.sin(this.motion.time * 3) * 0.05,
      );
      const label = this.labels.get(i.id);
      if (label)
        label.el.textContent = `${icons[i.kind]} ${itemNames[i.kind]} ×${i.count}${i.damaged ? " · damaged" : ""}`;
    }
    for (const p of s.panels) {
      let o = this.panels.get(p.id);
      if (!o) {
        o = panel(p.x, p.z, 0, 0);
        this.panels.set(p.id, o!);
        this.addLabel(p.id, o!, "", 1.7);
        const meter = new THREE.Group();
        meter.name = "clean-meter";
        meter.position.set(0, 0.08, 0.35);
        for (let n = 0; n < 4; n++) {
          const segment = new THREE.Mesh(
            new THREE.BoxGeometry(0.28, 0.025, 0.1),
            new THREE.MeshBasicMaterial({ color: 0xffc83d }),
          );
          segment.position.x = -0.5 + n * 0.33;
          meter.add(segment);
        }
        o!.children[1].add(meter);
      }
      const m = o!.children[1] as THREE.Mesh;
      const panelColor = new THREE.Color(0x1e3a8a).lerp(
        new THREE.Color(0x8a5a44),
        1 - p.clean,
      );
      if (p.covered) panelColor.setHex(0x5e4c40);
      (m.material as THREE.MeshStandardMaterial).color.lerp(
        panelColor,
        1 - Math.exp(-dt * 4),
      );
      const meter = m.getObjectByName("clean-meter");
      if (meter) {
        meter.visible =
          !this.menu &&
          (p.clean < 0.6 ||
            Math.hypot(s.players[id].x - p.x, s.players[id].z - p.z) < 4);
        meter.children.forEach((seg, i) => {
          (
            seg as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>
          ).material.color.setHex(i < p.clean * 4 ? 0xffc83d : 0x241812);
        });
      }
      this.labels.get(p.id)!.el.textContent = p.covered
        ? "🛡️ Covered · no sunlight"
        : `⚡ ${Math.round(p.clean * 100)}% clean`;
    }
    for (const k of s.built)
      if (!this.buildings.has(k)) {
        let o: THREE.Object3D;
        if (k === "shelter") {
          o = dome(-10, 2, 2.5, 0x84766b);
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const tank = new THREE.Mesh(
              new THREE.CylinderGeometry(0.38, 0.38, 1.3, 8),
              new THREE.MeshStandardMaterial({
                color: 0x168caa,
                flatShading: true,
              }),
            );
            tank.position.set(-10 + Math.cos(a) * 3, 0.65, 2 + Math.sin(a) * 3);
            tank.castShadow = true;
            tank.position.sub(o.position);
            o.add(tank);
          }
        } else if (k === "greenhouse") o = greenhouse(8, -1);
        else if (k === "radio") o = dish(-9, -7, false);
        else o = crate(6, 6, 0x7dd3fc, 1.3);
        o.userData.born = this.motion.time;
        this.buildings.set(k, o);
      }
    this.devil.position.set(
      s.devil.x,
      this.terrain.heightAt(s.devil.x, s.devil.z),
      s.devil.z,
    );
    this.devil.rotation.y = s.elapsed * 1.5;
    for (const [k, o] of this.buildings) {
      if (k === "hab") continue;
      const t = Math.min(
        1,
        (this.motion.time - Number(o.userData.born || 0)) / 0.65,
      );
      const back =
        1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
      o.scale.setScalar(this.motion.reduced ? 1 : Math.max(0.01, back));
    }
    const sunset = Math.max(0, (s.clock / B.solSeconds - 0.7) / 0.3);
    const skyColor = new THREE.Color(0xe0a982)
      .lerp(new THREE.Color(0xab6953), sunset * 0.6)
      .lerp(new THREE.Color(0x9c5a3a), this.motion.storm * 0.7);
    this.sky.lerp(skyColor, 1 - Math.exp(-dt * 2));
    this.scene.fog!.color.copy(this.sky);
    this.sun.intensity = THREE.MathUtils.lerp(
      2.5 - sunset * 0.8,
      1.05,
      this.motion.storm,
    );
    this.sun.color.setHex(0xffe2c4).lerp(new THREE.Color(0xffaa76), sunset);
    const p = s.players[id];
    if (p && !this.menu) {
      // Match the visible actor's interpolation instead of the 10 Hz simulation
      // position. Otherwise the view moves a frame ahead and makes the suit jitter.
      const actor = this.actors.get(id);
      const target = actor
        ? actor.position.clone()
        : new THREE.Vector3(p.x, this.terrain.heightAt(p.x, p.z), p.z);
      const offset = new THREE.Vector3(
        Math.sin(this.yaw) * this.zoom,
        this.zoom * 0.55,
        Math.cos(this.yaw) * this.zoom,
      );
      const desired = target.clone().add(offset);
      // Never let the camera dip below a hill between it and the player.
      desired.y = Math.max(
        desired.y,
        this.terrain.heightAt(desired.x, desired.z) + 3,
      );
      this.camera.position.lerp(desired, 1 - Math.exp(-6 * dt));
      this.camera.lookAt(target.x, target.y + 1.2, target.z - 2);
      // Shadows follow the player across the big map.
      this.sun.position.set(target.x - 18, target.y + 30, target.z + 15);
      this.sun.target.position.copy(target);
    } else if (this.menu) {
      const a = s.elapsed * 0.015;
      this.camera.position.set(19 + Math.sin(a) * 3, 13, 26);
      this.camera.lookAt(0, 1, -2);
    }
    this.nearest = placeLabels(
      this.labels,
      this.camera,
      s,
      id,
      this.menu,
      this.hovered,
    );
    for (const [key, l] of this.labels) {
      if (
        this.actors.has(key) ||
        key.startsWith("panel-") ||
        key === "workbench"
      )
        continue;
      const active = key === this.nearest || key === this.hovered;
      l.obj.traverse((o) => {
        if (
          o instanceof THREE.Mesh &&
          o.material instanceof THREE.MeshStandardMaterial
        ) {
          o.material.emissive.setHex(
            key.startsWith("item-") ? 0xffc83d : 0x39e6e0,
          );
          o.material.emissiveIntensity = active
            ? 0.2 + Math.sin(s.elapsed * 5) * 0.07
            : key.startsWith("item-")
              ? 0
              : 0.35;
        }
      });
    }
    this.objectiveMarker.visible = !!this.objectiveTarget && !this.menu;
    if (this.objectiveTarget) {
      this.objectiveMarker.position.set(
        this.objectiveTarget.x,
        this.terrain.heightAt(this.objectiveTarget.x, this.objectiveTarget.z),
        this.objectiveTarget.z,
      );
      this.objectiveMarker.children[0].position.y =
        3.3 + (this.motion.reduced ? 0 : Math.sin(this.motion.time * 4) * 0.12);
    }
    this.renderer.render(this.scene, this.camera);
    this.frameMs = performance.now() - renderBegin;
    this.fps = this.fps * 0.95 + 0.05 / Math.max(0.001, dt);
  }
}
