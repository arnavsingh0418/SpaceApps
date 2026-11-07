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
  camera = new THREE.PerspectiveCamera(44, innerWidth / innerHeight, 0.1, 280);
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
  yaw = 0;
  menu = true;
  last = 0;
  fps = 60;
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
    this.scene.fog = new THREE.Fog(0xd99a72, 48, 135);
    initBuilders(this.scene);
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
    const geo = new THREE.PlaneGeometry(220, 220, 80, 80);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        z = p.getZ(i),
        r = Math.hypot(x, z);
      p.setY(
        i,
        r < 30
          ? -0.04
          : Math.sin(x * 0.15) * Math.cos(z * 0.12) * 1.5 +
              Math.max(0, 6 - Math.abs(r - 43) * 0.5),
      );
    }
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: 0xc4562a,
        flatShading: true,
        roughness: 1,
      }),
    );
    ground.receiveShadow = true;
    this.scene.add(ground);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x803a23,
      flatShading: true,
    });
    const rocks = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(1, 0),
      rockMat,
      95,
    );
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 95; i++) {
      const a = i * 2.39996,
        r = 18 + (i % 17) * 1.9;
      dummy.position.set(Math.cos(a) * r, 0.12, Math.sin(a) * r);
      dummy.scale.setScalar(0.2 + (i % 7) * 0.14);
      dummy.rotation.set(i, i * 0.7, i * 0.2);
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);
    }
    rocks.castShadow = rocks.receiveShadow = true;
    this.scene.add(rocks);
    wreck(-7, -12);
    smoke(-10, 3, -13);
    const hab = dome(0, -3, 2.7);
    this.buildings.set("hab", hab);
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 1.6, 0.25),
      new THREE.MeshStandardMaterial({ color: 0x302823 }),
    );
    door.position.set(0, 0.8, -0.45);
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
    el.className = "world-tag";
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
      player.position.lerp(
        new THREE.Vector3(p.x, 0, p.z),
        1 - Math.exp(-14 * dt),
      );
      if (Math.hypot(p.move.x, p.move.z) > 0.01) {
        player.rotation.y = Math.atan2(p.move.x, p.move.z);
        const swing = Math.sin(s.elapsed * 10) * 0.55;
        player.getObjectByName("armL")!.rotation.x = swing;
        player.getObjectByName("armR")!.rotation.x = -swing;
        player.position.y = Math.abs(Math.sin(s.elapsed * 10)) * 0.07;
      }
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
      o.position.set(i.x, Math.sin(s.elapsed * 1.5 + i.x) * 0.05, i.z);
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
      }
      const m = o!.children[1] as THREE.Mesh;
      (m.material as THREE.MeshStandardMaterial).color.set(
        p.covered ? 0x5e4c40 : p.clean < 0.7 ? 0x8a5a44 : 0x1e3a8a,
      );
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
            this.scene.add(tank);
          }
        } else if (k === "greenhouse") o = greenhouse(8, -1);
        else if (k === "radio") o = dish(-9, -7, false);
        else o = crate(6, 6, 0x7dd3fc, 1.3);
        this.buildings.set(k, o);
      }
    this.devil.position.set(s.devil.x, 0, s.devil.z);
    this.devil.rotation.y = s.elapsed * 1.5;
    const storm = s.event?.kind === "storm" && s.clock >= s.event.at,
      flare =
        s.event?.kind === "flare" && s.clock >= s.event.at && !s.event.resolved;
    this.sky.lerp(
      new THREE.Color(storm ? 0xa76b4e : flare ? 0xa16c58 : 0xe0a982),
      0.025,
    );
    this.sun.intensity = storm ? 1.1 : 2.5;
    const p = s.players[id];
    if (p && !this.menu) {
      const target = new THREE.Vector3(p.x, 0, p.z);
      const offset = new THREE.Vector3(
        Math.sin(this.yaw) * 20,
        11,
        Math.cos(this.yaw) * 20,
      );
      this.camera.position.lerp(
        target.clone().add(offset),
        1 - Math.exp(-4 * dt),
      );
      this.camera.lookAt(target.x, 1.2, target.z - 2);
    } else if (this.menu) {
      const a = s.elapsed * 0.015;
      this.camera.position.set(19 + Math.sin(a) * 3, 13, 26);
      this.camera.lookAt(0, 1, -2);
    }
    for (const [key, { obj, el, height }] of this.labels) {
      const v = new THREE.Vector3();
      obj.getWorldPosition(v);
      v.y += height;
      const dist = this.camera.position.distanceTo(v);
      v.project(this.camera);
      el.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`;
      el.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
      el.hidden =
        v.z > 1 ||
        v.z < -1 ||
        Math.abs(v.x) > 1.1 ||
        Math.abs(v.y) > 1.1 ||
        (!this.menu && dist > 30);
      if (this.menu) el.hidden = true;
    }
    this.renderer.render(this.scene, this.camera);
    this.fps = this.fps * 0.95 + 0.05 / Math.max(0.001, dt);
  }
}
