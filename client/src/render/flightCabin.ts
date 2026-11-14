import * as T from "three";
import { astronaut } from "./builders.js";
import {
  deckRooms,
  flightStations,
  flightDuration,
  arrivalDuration,
  type FlightStation,
} from "../../../shared/src/flight";
import type { Game } from "../../../shared/src/sim";

function label(text: string, color: string, w = 5) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.font = "800 52px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 64, 490);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  const m = new T.Mesh(
    new T.PlaneGeometry(w, w / 4),
    new T.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    }),
  );
  m.rotation.x = -Math.PI / 2;
  return m;
}
function earthTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#236aab";
  g.fillRect(0, 0, 512, 256);
  const continents = [
    [
      [40, 65],
      [105, 35],
      [140, 70],
      [120, 105],
      [85, 118],
      [70, 90],
    ],
    [
      [125, 115],
      [167, 128],
      [155, 178],
      [131, 216],
      [118, 165],
    ],
    [
      [240, 83],
      [275, 68],
      [305, 90],
      [300, 145],
      [272, 183],
      [255, 128],
    ],
    [
      [275, 65],
      [325, 39],
      [415, 51],
      [451, 90],
      [399, 111],
      [358, 98],
      [338, 126],
    ],
    [
      [402, 164],
      [449, 159],
      [467, 182],
      [431, 201],
      [408, 188],
    ],
  ];
  for (const points of continents) {
    g.fillStyle = "#88ae75";
    g.beginPath();
    points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fill();
  }
  g.fillStyle = "#f2f6e6";
  g.fillRect(0, 0, 512, 10);
  g.fillRect(0, 244, 512, 12);
  g.strokeStyle = "#ffffff60";
  g.lineWidth = 7;
  for (let i = 0; i < 14; i++) {
    g.beginPath();
    g.ellipse(
      (i * 79) % 512,
      24 + ((i * 37) % 210),
      28,
      5,
      0.2,
      0,
      Math.PI * 1.3,
    );
    g.stroke();
  }
  const texture = new T.CanvasTexture(c);
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}
export class FlightCabin {
  scene = new T.Scene();
  camera = new T.OrthographicCamera(-28, 28, 16, -16, 0.1, 250);
  actors = new Map<string, T.Group>();
  private root = new T.Group();
  private earth: T.Mesh;
  private stars: T.InstancedMesh;
  private dummy = new T.Object3D();
  private lamps = new Map<
    FlightStation,
    T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>
  >();
  private alarm: T.PointLight;
  private capsule = new T.Group();
  private seed = -1;
  private time = 0;
  private progress = 0;
  private shownArrival = 0;
  constructor(private renderer: T.WebGLRenderer) {
    this.scene.background = new T.Color(0x060c20);
    this.scene.add(new T.HemisphereLight(0xd2efff, 0x33405e, 2.2));
    const sun = new T.DirectionalLight(0xffeed7, 3.3);
    sun.position.set(-12, 28, 12);
    this.scene.add(sun);
    this.scene.add(this.root);
    this.alarm = new T.PointLight(0xff4c4c, 0, 40);
    this.alarm.position.set(0, 6, 0);
    this.scene.add(this.alarm);
    const mat = (color: number | string, emissive = 0) =>
      new T.MeshStandardMaterial({
        color,
        roughness: 0.65,
        metalness: 0.2,
        emissive,
        emissiveIntensity: 0.4,
      });
    const box = (
      parent: T.Object3D,
      w: number,
      h: number,
      d: number,
      color: number | string,
      x = 0,
      y = 0,
      z = 0,
    ) => {
      const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat(color));
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    };
    for (const room of deckRooms) {
      box(
        this.root,
        room.w,
        0.3,
        room.d,
        room.name === "CORRIDOR" ? 0x71899e : 0x41576d,
        room.x,
        -0.16,
        room.z,
      );
      const edge = box(
        this.root,
        room.w,
        0.055,
        0.09,
        room.color,
        room.x,
        0.02,
        room.z - room.d / 2 + 0.05,
      );
      const name = label(
        room.name,
        room.color,
        room.name === "CORRIDOR" ? 2.6 : 5,
      );
      name.position.set(room.x, 0.04, room.z + room.d / 2 - 1.2);
      this.root.add(name);
      for (let x = -room.w / 2 + 0.8; x < room.w / 2; x += 2)
        box(
          this.root,
          0.025,
          0.015,
          room.d,
          0x8da2b1,
          room.x + x,
          0.015,
          room.z,
        );
      void edge;
    }
    // Low outer walls keep the playable interior visible in this cutaway view.
    for (const x of [-12.45, 12.45])
      box(this.root, 0.3, 0.8, 16.5, 0xc0ccd3, x, 0.4, 2.3);
    box(this.root, 25, 0.8, 0.3, 0xc0ccd3, 0, 0.4, 10.2);
    for (const x of [-5.65, 5.65])
      box(this.root, 0.25, 0.8, 6.3, 0xc0ccd3, x, 0.4, -7);
    for (const x of [-9, 9])
      box(this.root, 6, 0.8, 0.25, 0xc0ccd3, x, 0.4, -3.6);
    // Bridge windows: real space remains visible beyond the cabin.
    for (let i = 0; i < 5; i++) {
      box(this.root, 2.1, 0.12, 0.15, 0x82b8cb, -4.4 + i * 2.2, 2.2, -10.1);
      box(this.root, 0.09, 2.2, 0.12, 0x83a8bb, -5.5 + i * 2.2, 1.1, -10.1);
    }
    for (const [key, station] of Object.entries(flightStations)) {
      const g = new T.Group();
      g.position.set(station.x, 0, station.z);
      this.root.add(g);
      box(g, 2.1, 0.9, 1.1, 0x263b50, 0, 0.45, -0.65);
      const panel = box(g, 1.65, 0.65, 0.15, station.color, 0, 1.05, -1.1);
      panel.rotation.x = -0.28;
      const lamp = new T.Mesh(
        new T.SphereGeometry(0.18, 10, 8),
        mat(station.color, 0x4be1c5),
      );
      lamp.position.set(1.1, 1.3, -0.65);
      g.add(lamp);
      this.lamps.set(key as FlightStation, lamp);
      const sign = label(station.name.toUpperCase(), station.color, 3.3);
      sign.position.set(0, 0.05, 1);
      g.add(sign);
      if (key === "power")
        for (let i = 0; i < 3; i++)
          box(
            g,
            0.38,
            1.2,
            0.5,
            [0xdf925a, 0x70abdd, 0xe8c557][i],
            -0.7 + i * 0.7,
            0.65,
            -1.2,
          );
      if (key === "air")
        for (const x of [-0.5, 0.5]) {
          const tank = new T.Mesh(
            new T.CapsuleGeometry(0.3, 0.9, 4, 12),
            mat(0xb0d8de),
          );
          tank.position.set(x, 0.8, -1.5);
          g.add(tank);
        }
      if (key === "hull") {
        box(g, 2.5, 1.6, 0.18, 0xaebdcb, 0, 0.8, -1.5);
        for (let i = 0; i < 4; i++)
          box(g, 0.22, 0.23, 0.08, 0xed9b83, -0.75 + i * 0.5, 0.8, -1.36);
      }
      if (key === "engine") {
        const core = new T.Mesh(
          new T.TorusKnotGeometry(0.45, 0.12, 40, 6),
          mat(0xb8a0eb, 0x856bcc),
        );
        core.name = "reactor-core";
        core.position.set(0, 1.4, -1.2);
        g.add(core);
      }
    }
    // Unattended seats and handrails give the cabin a physical scale.
    for (const x of [-3, 3]) {
      box(this.root, 0.9, 0.22, 0.9, 0x628298, x, 0.7, -6.3);
      box(this.root, 0.9, 1.1, 0.18, 0x52657d, x, 1.1, -5.9);
      box(this.root, 0.15, 0.8, 0.15, 0x92a6b7, x, 0.4, -6.3);
    }
    this.earth = new T.Mesh(
      new T.SphereGeometry(1, 40, 24),
      new T.MeshStandardMaterial({
        map: earthTexture(),
        roughness: 1,
        emissive: 0x123354,
        emissiveIntensity: 0.28,
      }),
    );
    this.earth.position.set(0, 1, -16);
    this.scene.add(this.earth);
    const glow = new T.Mesh(
      new T.SphereGeometry(1.08, 32, 20),
      new T.MeshBasicMaterial({
        color: 0x6ad7ff,
        transparent: true,
        opacity: 0.18,
        side: T.BackSide,
        depthWrite: false,
      }),
    );
    this.earth.add(glow);
    this.stars = new T.InstancedMesh(
      new T.SphereGeometry(0.045, 4, 3),
      new T.MeshBasicMaterial({ color: 0xcde8ff }),
      180,
    );
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);
    const shell = new T.Mesh(new T.ConeGeometry(1.1, 2.6, 14), mat(0xf3e6cf));
    shell.rotation.x = Math.PI / 2;
    this.capsule.add(shell);
    box(this.capsule, 0.8, 0.4, 0.35, 0x304f70, 0, 0.3, 0.2);
    this.capsule.visible = false;
    this.scene.add(this.capsule);
  }
  update(s: Game, id: string, dt: number, reduced: boolean) {
    const d = s.returnMission!.flight!.deck!;
    this.time += dt;
    this.progress = Math.min(1, d.time / flightDuration);
    if (this.seed !== s.seed) {
      this.seed = s.seed;
      for (const actor of this.actors.values()) this.root.remove(actor);
      this.actors.clear();
    }
    const arrival = d.arrivalAt !== undefined;
    this.shownArrival = arrival
      ? Math.min(1, (d.time - d.arrivalAt!) / arrivalDuration)
      : 0;
    const danger = d.incidents.filter((i) => !i.fixed).length;
    this.alarm.intensity = danger
      ? reduced
        ? 1.2
        : 1.4 + Math.sin(this.time * 5) * 0.6
      : 0;
    for (const [key, lamp] of this.lamps) {
      const bad = d.incidents.some((i) => i.kind === key && !i.fixed);
      lamp.material.color.set(bad ? 0xff6854 : flightStations[key].color);
      lamp.material.emissive.set(bad ? 0xff3528 : 0x4be1c5);
      lamp.material.emissiveIntensity = bad
        ? reduced
          ? 0.6
          : 1 + Math.sin(this.time * 6) * 0.5
        : 0.4;
    }
    const core = this.root.getObjectByName("reactor-core");
    if (core && !reduced) core.rotation.y = this.time;
    for (const [key, actor] of this.actors)
      if (!s.players[key]) {
        this.root.remove(actor);
        this.actors.delete(key);
      }
    for (const p of Object.values(s.players)) {
      let actor = this.actors.get(p.id);
      if (!actor) {
        actor = astronaut(p.color);
        this.root.add(actor);
        actor.scale.setScalar(0.9);
        actor.position.set(p.x, 0, p.z);
        this.actors.set(p.id, actor);
      }
      actor.position.lerp(new T.Vector3(p.x, 0, p.z), 1 - Math.exp(-dt * 18));
      const moving = Math.hypot(p.move.x, p.move.z) > 0.01;
      if (moving) actor.rotation.y = Math.atan2(p.move.x, p.move.z);
      const phase = this.time * 9,
        amp = moving && !reduced ? 0.6 : 0;
      for (const [name, sign] of [
        ["armL", 1],
        ["armR", -1],
        ["legL", -1],
        ["legR", 1],
      ] as const) {
        const limb = actor.getObjectByName(name);
        if (limb) limb.rotation.x = Math.sin(phase) * amp * sign;
      }
      const wrench = actor.getObjectByName("wrench");
      if (wrench) wrench.visible = p.task?.kind === "flightRepair";
      if (p.task?.kind === "flightRepair") {
        const arm = actor.getObjectByName("armR");
        if (arm)
          arm.rotation.x = -1 + (reduced ? 0 : Math.sin(this.time * 12) * 0.3);
      }
    }
    const earthScale = arrival
      ? 8 + this.shownArrival * 12
      : 2 + Math.pow(this.progress, 2) * 6;
    this.earth.scale.setScalar(earthScale);
    this.earth.rotation.y = reduced ? 0.5 : this.time * 0.015;
    for (let i = 0; i < 180; i++) {
      this.dummy.position.set(
        Math.sin(i * 81.7) * 45,
        Math.sin(i * 13.1) * 11 - 3,
        reduced
          ? Math.cos(i * 37.3) * 45
          : ((i * 5.71 + this.time * 3) % 90) - 50,
      );
      this.dummy.scale.set(1, 1, reduced ? 1 : 2.5);
      this.dummy.updateMatrix();
      this.stars.setMatrixAt(i, this.dummy.matrix);
    }
    this.stars.instanceMatrix.needsUpdate = true;
    this.root.visible = !arrival;
    this.capsule.visible = arrival;
    this.capsule.position.set(
      (1 - this.shownArrival) * 7,
      2 - this.shownArrival * 2,
      -4 - this.shownArrival * 6,
    );
    this.capsule.rotation.z = reduced ? 0 : Math.sin(this.time) * 0.08;
    const mobile = innerWidth < 700,
      half = mobile ? 16 : 16,
      aspect = innerWidth / innerHeight;
    this.camera.left = -half * aspect;
    this.camera.right = half * aspect;
    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.updateProjectionMatrix();
    const me = s.players[id],
      followX = mobile ? T.MathUtils.clamp(me?.x || 0, -6, 6) : 0,
      followZ = mobile ? T.MathUtils.clamp(me?.z || 0, -3, 3) : 0;
    this.camera.position.set(followX, 32, 29 + followZ);
    this.camera.lookAt(followX, 0, followZ - 2);
    if (arrival) {
      this.camera.position.set(0, 15, 20);
      this.camera.lookAt(0, 2, -12);
    }
    this.renderer.render(this.scene, this.camera);
  }
  get state() {
    return {
      earthScale: this.earth.scale.x,
      progress: this.progress,
      arrival: this.shownArrival,
      starsMoving: true,
      actors: Array.from(this.actors, ([id, g]) => ({
        id,
        x: g.position.x,
        z: g.position.z,
      })),
    };
  }
}
