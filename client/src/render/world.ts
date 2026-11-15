import { HAB_LAYOUT } from "../../../shared/src/hab";
import { HabInterior } from "./habInterior";
import { RoverView } from "./rover";
import type { RoverController } from "./roverController";
import { roverState, roverSeat, angleDelta } from "../../../shared/src/rover";
import { FlightCabin } from "./flightCabin";
import { WorldMotion } from "./motion";
import { SANDSTORM_LAYER } from "./sandstorm";
import { SurfaceTracks } from "./surfaceTracks";
import { ScreenDust } from "./screenDust";
import { DustDevil } from "./dustDevil";
import { vortexField } from "../../../shared/src/dustDevil";
import {
  replaceVisual,
  disposeModel,
  updateRoleBadge,
  updatePanelModel,
  updateDishModel,
} from "./modelAssets";
import { placeLabels } from "./labels";
import { Terrain } from "./terrain";
import { Nemi } from "./alien";
import { alienSite } from "../../../shared/src/alien";
import { FieldSites, captureFieldMap } from "./fieldSites";
import { sectors } from "../../../shared/src/expedition";
import { LocalController, jumpArc } from "./controller";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import {
  initBuilders,
  astronaut,
  wreck,
  hab,
  workbench,
  beacon,
  shelter,
  batteryBank,
  smoke,
  dome,
  greenhouse,
  panel,
  dish,
  crate,
} from "./builders.js";
import {
  B,
  clampToWorld,
  gaitSpeed,
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
/** Where the hab and the crashed lander sit (metres, game coordinates). */
export const HAB = { x: 0, z: -17 };
export const WRECK = { x: -10, z: -36 };
/** Built structures stand ~7 m further out than their science beacon so they don't swallow it. */
function buildSpot(p: { x: number; z: number }, push = 7) {
  const r = Math.hypot(p.x, p.z) || 1;
  return { x: p.x + (p.x / r) * push, z: p.z + (p.z / r) * push };
}
export class World {
  cabin?: FlightCabin;
  habInterior: HabInterior;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(44, innerWidth / innerHeight, 0.1, 1600);
  terrain = new Terrain();
  fieldSites: FieldSites;
  mapImage = "";
  nemi: Nemi;
  focus: "alien" | "ship" | null = null;
  /** Your own movement controller (set by main.ts once a mission starts). */
  local: LocalController | null = null;
  brokenDish: THREE.Object3D | null = null;
  cameraFollow: THREE.Vector3 | null = null;
  camDist = 9;
  renderer: THREE.WebGLRenderer;
  actors = new Map<string, THREE.Group>();
  pickups = new Map<string, THREE.Object3D>();
  panels = new Map<string, THREE.Group>();
  buildings = new Map<string, THREE.Object3D>();
  labels = new Map<
    string,
    { obj: THREE.Object3D; el: HTMLElement; height: number }
  >();
  dustDevil = new DustDevil(this.scene);
  devil = this.dustDevil.group;
  tracks = new SurfaceTracks(this.scene);
  screenDust = new ScreenDust();
  objectiveTarget: { x: number; z: number } | null = null;
  objectiveMarker = new THREE.Group();
  hovered = "";
  nearest = "";
  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();
  motion: WorldMotion;
  rover: RoverView;
  localRover: RoverController | null = null;
  private previousRoverHeading: number | null = null;
  zoom = 9;
  stepRemainder = 0;
  predictMovement = true;
  lastSeed = -1;
  /** Camera orbit around the player (radians). yaw 0 = camera south of the player, looking north. */
  firstPerson = false;
  yaw = 0;
  pitch = 0.36;
  /** main.ts decides when mouse-look is allowed (in a mission, no menu/modal open). */
  lookAllowed: () => boolean = () => false;
  menu = true;
  last = 0;
  fps = 60;
  frameMs = 0;
  sun: THREE.DirectionalLight;
  sky = new THREE.Color(0xe0a982);
  skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(1400, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        horizon: { value: new THREE.Color(0xe0a982) },
        zenith: { value: new THREE.Color(0x8a5a44) },
        sunGlow: { value: new THREE.Color(0xfff0d0) },
        sunDir: { value: new THREE.Vector3(-0.5, 0.8, 0.4).normalize() },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 horizon; uniform vec3 zenith; uniform vec3 sunGlow; uniform vec3 sunDir; varying vec3 vDir;
        void main(){
          float h = clamp(vDir.y, 0.0, 1.0);
          vec3 c = mix(horizon, zenith, pow(h, 0.6));
          float s = max(dot(normalize(vDir), sunDir), 0.0);
          c += sunGlow * (pow(s, 24.0) * 0.55 + pow(s, 600.0) * 1.6);
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  constructor() {
    this.camera.layers.enable(SANDSTORM_LAYER);
    this.renderer = new THREE.WebGLRenderer({
      canvas: document.querySelector("#world")!,
      antialias: true,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    this.renderer.setSize(innerWidth, innerHeight);
    this.habInterior = new HabInterior(this.renderer);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.scene.background = this.sky;
    this.scene.fog = new THREE.Fog(0xd99a72, 110, 620);
    initBuilders(this.scene);
    this.motion = new WorldMotion(this.scene);
    this.rover = new RoverView(this.scene);
    this.addLabel("rover", this.rover.group, "Wayfarer rover", 6.1);
    this.fieldSites = new FieldSites(this.scene);
    this.nemi = new Nemi(this.scene);
    this.addLabel("nemi", this.nemi.group, "Nemi", 3.4);
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
          4.5,
          24,
        );
      },
      { passive: false },
    );
    this.setupMouseLook();
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
    this.objectiveMarker.scale.setScalar(1.8);
    this.scene.add(this.objectiveMarker);
    this.scene.add(new THREE.HemisphereLight(0xffeedd, 0x8a4a2a, 1.0));
    this.skyDome.renderOrder = -1;
    this.scene.add(this.skyDome);
    this.sun = new THREE.DirectionalLight(0xffe2c4, 2.9);
    this.sun.position.set(-18, 30, 15);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    this.sun.shadow.bias = -0.0004;
    Object.assign(this.sun.shadow.camera, {
      left: -55,
      right: 55,
      top: 55,
      bottom: -55,
      far: 200,
    });
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    // The Blender-made Mars map replaces the old flat plane and scattered rocks.
    this.terrain
      .load(this.scene)
      .catch((err) => console.error("Mars map failed to load", err));
    // Life-sized base (layout spread by B.layoutScale in the sim).
    const solid = (o: THREE.Object3D) => (this.terrain.addStatic(o), o);
    solid(wreck(WRECK.x, WRECK.z));
    const habitat = solid(hab(HAB.x, HAB.z, 6.2));
    this.buildings.set("hab", habitat);
    const airlockMarker = new THREE.Group();
    airlockMarker.position.set(HAB_LAYOUT.exterior.x,0,HAB_LAYOUT.exterior.z);
    this.scene.add(airlockMarker);
    this.addLabel("hab-airlock",airlockMarker,"Habitat airlock",3.5);
    solid(crate(-8, -8, 0x9b6e44, 1.5));
    solid(crate(-9.8, -9.6, 0xa37c50, 1.1));
    solid(crate(-8.4, -10.6, 0x8b6a45, 0.9));
    const bench = workbench(stations.workbench.x, stations.workbench.z);
    solid(bench.group);
    this.addLabel("workbench", bench.group, "🔧 WORKBENCH", 2.6);
    for (const site of sectors)
      this.addLabel(
        `field-${site.id}`,
        this.fieldSites.groups.get(site.id)!,
        site.name,
        2.2,
      );
    for (const [id, group] of this.fieldSites.salvage)
      this.addLabel(
        `salvage-${id}`,
        group,
        id === "return" ? "Return ship" : "Salvage cache",
        1.8,
      );
    for (const [key, pos] of Object.entries(stations)) {
      if (key === "workbench") continue;
      const g = solid(beacon(pos.x, pos.z));
      this.addLabel(
        key,
        g,
        `${{ shield: "🛡️ Shielding", comms: "📡 Radio science", grow: "🌱 Growing food", power: "⚡ Solar science", oxygen: "💨 Oxygen science", plants: "🔬 Space plants" }[key]} · SCAN`,
        3.8,
      );
    }
    const broken = buildSpot(stations.comms);
    this.brokenDish = solid(dish(broken.x, broken.z, true));
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
  /** Rotate the camera by a mouse/touch delta in pixels. */
  look(dx: number, dy: number) {
    this.yaw -= dx * 0.0028;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch + dy * 0.0022,
      this.firstPerson ? -1.1 : -0.12,
      this.firstPerson ? 1.1 : 1.25,
    );
  }
  /**
   * Fortnite/Minecraft-style mouse look: click the game to capture the mouse (pointer lock),
   * move it to orbit the camera, Esc releases it. Falls back to click-drag (and touch drag
   * on phones) when pointer lock is unavailable.
   */
  private setupMouseLook() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener("click", () => {
      if (!this.lookAllowed() || document.pointerLockElement === canvas) return;
      try {
        const req = canvas.requestPointerLock() as unknown as
          Promise<void> | undefined;
        req?.catch?.(() => {});
      } catch {}
    });
    addEventListener("mousemove", (e) => {
      if (document.pointerLockElement === canvas && this.lookAllowed())
        this.look(e.movementX, e.movementY);
    });
    const drags = new Map<number, { x: number; y: number }>();
    canvas.addEventListener("pointerdown", (e) => {
      drags.set(e.pointerId, { x: e.clientX, y: e.clientY });
    });
    canvas.addEventListener("pointermove", (e) => {
      const d = drags.get(e.pointerId);
      if (!d) return;
      const dx = e.clientX - d.x,
        dy = e.clientY - d.y;
      d.x = e.clientX;
      d.y = e.clientY;
      if (document.pointerLockElement === canvas || !this.lookAllowed()) return;
      if (e.pointerType === "touch" || e.buttons & 1)
        this.look(dx * 1.4, dy * 1.4);
    });
    const end = (e: PointerEvent) => drags.delete(e.pointerId);
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
  }
  releaseMouse() {
    if (document.pointerLockElement === this.renderer.domElement)
      document.exitPointerLock();
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
    obj.userData.marsDisposed = true;
    this.terrain.removeStatic(obj);
    this.scene.remove(obj);
    this.labels.get(id)?.el.remove();
    this.labels.delete(id);
    disposeModel(obj);
  }
  update(s: Game, id: string, dt: number) {
    const renderBegin = performance.now();
    if (
      (s.phase === "flight" || s.phase === "ended") &&
      s.returnMission?.flight?.deck
    ) {
      this.firstPerson = true;
      this.screenDust.update(0, 0, this.motion.reduced);
      document.querySelector<HTMLElement>("#labels")!.hidden = true;
      (this.cabin ??= new FlightCabin(this.renderer)).update(
        s,
        id,
        dt,
        this.motion.reduced,
        this.yaw,
        this.pitch,
      );
      return;
    }
    if (this.firstPerson) {
      this.yaw = 0;
      this.pitch = 0.36;
      this.releaseMouse();
    }
    this.firstPerson = false;
    if (s.players[id]?.hab && !this.menu && s.phase !== "flight" && s.phase !== "ended") {
      this.screenDust.update(0, 0, this.motion.reduced);
      this.tracks.forget(id);
      document.querySelector<HTMLElement>("#labels")!.hidden = true;
      this.habInterior.update(s,id,dt,this.local,this.yaw,this.pitch,this.zoom,this.motion);
      this.frameMs = performance.now() - renderBegin;
      return;
    }
    document.querySelector<HTMLElement>("#labels")!.hidden = false;
    if (this.lastSeed !== s.seed) {
      this.tracks.reset();
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
    const rover = roverState(s);
    this.rover.update(rover, this.terrain, dt, rover.driver === id ? this.localRover : null);
    const vehicle = this.rover.group;
    this.tracks.trace("rover", vehicle.position.x, vehicle.position.y, vehicle.position.z,
      vehicle.rotation.y, !this.menu && s.phase === "day" && !rover.gust, this.terrain, s.elapsed, true);
    const aboard = roverSeat(rover, id) >= 0;
    if (aboard) {
      if (this.previousRoverHeading !== null) this.yaw += angleDelta(this.rover.group.rotation.y, this.previousRoverHeading);
      this.previousRoverHeading = this.rover.group.rotation.y;
    } else this.previousRoverHeading = null;
    for (const [key, obj] of this.actors)
      if (!s.players[key]) {
        this.tracks.forget(key);
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
      player.visible = !p.hab;
      if (p.hab) {
        this.tracks.forget(p.id);
        continue;
      }
      updateRoleBadge(player, p.role);
      const seat = roverSeat(rover, p.id);
      if (seat >= 0) {
        this.tracks.forget(p.id);
        const at = new THREE.Vector3(seat % 2 === 0 ? -.86 : .86, 1.35, seat < 2 ? -1 : .9);
        this.rover.group.localToWorld(at);
        player.position.copy(at);
        this.motion.actor(player, p, s, dt, { speed: 0, gait: "walk", grounded: true, vy: 0, landAgo: 99, landImpact: 0, heading: this.rover.group.rotation.y + Math.PI });
        for (const name of ["legL", "legR"]) { const limb = player.getObjectByName(name); if (limb) limb.rotation.x = -1.35; }
        for (const name of ["kneeL", "kneeR"]) { const limb = player.getObjectByName(name); if (limb) limb.rotation.x = 1.45; }
        for (const name of ["armL", "armR"]) { const limb = player.getObjectByName(name); if (limb) limb.rotation.x = seat === 0 ? -.9 : -.3; }
        const hips = player.getObjectByName("hips"); if (hips) hips.position.y = .5;
        const carried = player.getObjectByName("carried"); if (carried) carried.visible = false;
        player.rotation.x = this.rover.group.rotation.x; player.rotation.z = this.rover.group.rotation.z;
        continue;
      }
      const local = p.id === id ? this.local : null;
      if (local) {
        // Your own astronaut: drawn straight from the per-frame controller (no 10 Hz lag).
        player.position.set(local.x, local.y, local.z);
        this.tracks.trace(p.id, local.x, local.y, local.z, local.heading,
          !this.menu && s.phase === "day" && local.grounded, this.terrain, s.elapsed);
        this.motion.actor(player, p, s, dt, {
          speed: local.speed,
          gait: local.gait,
          grounded: local.grounded,
          vy: local.vy,
          landAgo: local.time - local.landedAt,
          landImpact: local.landImpact,
          heading: local.heading,
        });
        continue;
      }
      const speed = gaitSpeed(p.gait, s.allocation.heat < 1);
      let x = p.x;
      let z = p.z;
      if (this.predictMovement && s.phase === "day" && p.posAt === undefined) {
        x += p.move.x * speed * this.stepRemainder;
        z += p.move.z * speed * this.stepRemainder;
      } else {
        // Other players: glide between network updates.
        const shown = (player.userData.shown ||= { x: p.x, z: p.z }) as {
          x: number;
          z: number;
        };
        const k = 1 - Math.exp(-12 * dt);
        if (Math.hypot(p.x - shown.x, p.z - shown.z) > 12) {
          shown.x = p.x;
          shown.z = p.z;
        } else {
          shown.x += (p.x - shown.x) * k;
          shown.z += (p.z - shown.z) * k;
        }
        x = shown.x;
        z = shown.z;
      }
      const inside = { x, z };
      clampToWorld(inside);
      x = inside.x;
      z = inside.z;
      const prevX = player.position.x,
        prevZ = player.position.z;
      const seen = Math.hypot(x - prevX, z - prevZ) / Math.max(dt, 1e-3);
      player.userData.seen = THREE.MathUtils.damp(
        Number(player.userData.seen || 0),
        Math.min(seen, 20),
        10,
        dt,
      );
      const airtime = (2 * B.jumpSpeed) / B.marsGravity;
      const since = s.elapsed - (p.jumpAt ?? -99);
      const lift = p.gust?.height ?? (since < airtime ? jumpArc(since) : 0);
      player.position.set(x, this.terrain.heightAt(x, z) + lift, z);
      this.tracks.trace(p.id, x, player.position.y, z, player.rotation.y,
        !this.menu && s.phase === "day" && lift <= 0 && !p.gust, this.terrain, s.elapsed);
      this.motion.actor(player, p, s, dt, {
        speed: Number(player.userData.seen),
        gait: p.gait || "walk",
        grounded: lift <= 0,
        vy: p.gust?.vy ?? (B.jumpSpeed - B.marsGravity * since),
        landAgo: since >= airtime ? since - airtime : 99,
        landImpact: 0.4,
      });
      if (p.gust && !this.motion.reduced) {
        player.rotation.y = s.elapsed * 5;
        player.rotation.z = Math.sin(s.elapsed * 6) * Math.min(0.85, lift * 0.3);
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
            ? new THREE.IcosahedronGeometry(0.75, 0)
            : new RoundedBoxGeometry(1.05, 1.05, 1.05, 3, 0.12),
          mat,
        );
        m.castShadow = true;
        const itemVisual = new THREE.Group();
        itemVisual.position.y = 0.8;
        itemVisual.add(m);
        group.add(itemVisual);
        const asset = {
          scrap: "Scrap_Metal",
          ice: "Ice_Chunk",
          soil: "Soil_Bag",
          seeds: "Seeds_Packet",
          antenna: "Antenna_Part",
          battery: "Battery",
          circuit: "Circuit_Board",
          food: "Supply_Crate",
        }[i.kind as Exclude<Item, "glass">];
        if (asset)
          void replaceVisual(itemVisual, asset, { size: 1.25, batch: true });
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(1.1, 0.05, 4, 28),
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
          2.0,
        );
      }
      o.userData.count = i.count;
      o.position.set(i.x, this.terrain.heightAt(i.x, i.z), i.z);
      o.children[0].position.y =
        0.95 +
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
        o.position.y = this.terrain.heightAt(p.x, p.z);
        this.terrain.addStatic(o!);
        this.panels.set(p.id, o!);
        this.addLabel(p.id, o!, "", 3.6);
        const meter = new THREE.Group();
        meter.name = "clean-meter";
        meter.position.set(0, 0.1, 1.0);
        meter.scale.setScalar(2.2);
        for (let n = 0; n < 4; n++) {
          const segment = new THREE.Mesh(
            new THREE.BoxGeometry(0.28, 0.025, 0.1),
            new THREE.MeshBasicMaterial({ color: 0xffc83d }),
          );
          segment.position.x = -0.5 + n * 0.33;
          meter.add(segment);
        }
        o!.add(meter);
      }
      const m = o!.children[1] as THREE.Mesh;
      // The cells are a texture; dust tints it toward Mars-tan, a tarp makes it dull brown.
      const panelColor = new THREE.Color(0xffffff).lerp(
        new THREE.Color(0xb27a52),
        1 - p.clean,
      );
      if (p.covered) panelColor.setHex(0x6b5a4c);
      (m.material as THREE.MeshStandardMaterial).color.lerp(
        panelColor,
        1 - Math.exp(-dt * 4),
      );
      updatePanelModel(o!, p.clean, p.covered);
      const meter = o!.getObjectByName("clean-meter");
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
          const at = buildSpot(stations.shield);
          o = shelter(at.x, at.z);
        } else if (k === "greenhouse") {
          const at = buildSpot(stations.grow);
          o = greenhouse(at.x, at.z);
        } else if (k === "radio") {
          const at = buildSpot(stations.comms);
          o = dish(at.x, at.z, false);
          if (this.brokenDish) this.brokenDish.visible = false;
        } else {
          const at = buildSpot(stations.oxygen);
          o = batteryBank(at.x, at.z);
        }
        this.terrain.addStatic(o);
        o.userData.born = this.motion.time;
        this.buildings.set(k, o);
      }
    for (const [k, o] of this.buildings) {
      if (k === "hab") continue;
      if (k === "radio")
        updateDishModel(o, s.aligned, this.motion.time, this.motion.reduced);
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
    // Sky dome: horizon matches the fog, zenith darker; the glow around the sun turns blue
    // at sunset (real Mars sunsets are blue because fine dust scatters blue light forward).
    const u = (this.skyDome.material as THREE.ShaderMaterial).uniforms;
    u.horizon.value.copy(this.sky);
    u.zenith.value
      .copy(this.sky)
      .multiplyScalar(0.62)
      .lerp(new THREE.Color(0x6b4636), 0.35);
    u.sunGlow.value.setHex(0xfff0d0).lerp(new THREE.Color(0x8fb4e8), sunset);
    u.sunDir.value
      .copy(this.sun.position)
      .sub(this.sun.target.position)
      .normalize();
    this.skyDome.position.copy(this.camera.position);
    this.sun.intensity = THREE.MathUtils.lerp(
      2.5 - sunset * 0.8,
      1.05,
      this.motion.storm,
    );
    this.sun.color.setHex(0xffe2c4).lerp(new THREE.Color(0xffaa76), sunset);
    const p = s.players[id];
    if (p && !this.menu && !this.focus) {
      // Match the visible actor's interpolation instead of the 10 Hz simulation
      // position. Otherwise the view moves a frame ahead and makes the suit jitter.
      const actor = this.actors.get(id);
      const target = aboard
        ? this.rover.group.position.clone()
        : actor
        ? actor.position.clone()
        : new THREE.Vector3(p.x, this.terrain.heightAt(p.x, p.z), p.z);
      // Third-person orbit camera behind the player, a little over the right shoulder.
      // Smooth only the followed point, so turning the mouse is instant (no swing).
      const follow = (this.cameraFollow ||= target.clone());
      follow.lerp(target, 1 - Math.exp(-18 * dt));
      const orbitZoom = aboard ? Math.max(18, this.zoom) : this.zoom;
      const focusHeight = aboard ? 2.7 : 2.3;
      const cp = Math.cos(this.pitch),
        sp = Math.sin(this.pitch);
      const right = new THREE.Vector3(
        Math.cos(this.yaw),
        0,
        -Math.sin(this.yaw),
      );
      const shoulder = right.multiplyScalar(Math.min(1.1, this.zoom * 0.09));
      const focus = follow
        .clone()
        .add(new THREE.Vector3(0, focusHeight, 0))
        .add(shoulder);
      const desired = focus
        .clone()
        .add(
          new THREE.Vector3(
            Math.sin(this.yaw) * cp * orbitZoom,
            sp * orbitZoom,
            Math.cos(this.yaw) * cp * orbitZoom,
          ),
        );
      // Never let the camera dip into a hill.
      desired.y = Math.max(
        desired.y,
        this.terrain.heightAt(desired.x, desired.z, desired.y) + 0.8,
      );
      // Camera collision: cast from the astronaut's head toward the camera and stop in front
      // of the first wall, rock, hill or building. Snap in instantly, ease back out.
      const head = follow.clone().add(new THREE.Vector3(0, focusHeight, 0));
      const toCam = desired.clone().sub(head);
      const full = toCam.length();
      toCam.divideScalar(full || 1);
      const hit = this.terrain.rayHit(head, toCam, full + 0.4);
      const want = hit === null ? full : Math.max(0.6, hit - 0.45);
      this.camDist =
        want < this.camDist
          ? want
          : THREE.MathUtils.damp(this.camDist, want, 5, dt);
      this.camera.position
        .copy(head)
        .addScaledVector(toCam, Math.min(this.camDist, full));
      this.camera.lookAt(this.camDist < 2.5 ? head : focus);
      // Shadows follow the player across the big map.
      this.sun.position.set(target.x - 18, target.y + 30, target.z + 15);
      this.sun.target.position.copy(target);
    } else if (this.menu) {
      const a = s.elapsed * 0.015;
      this.camera.position.set(19 + Math.sin(a) * 3, 13, 26);
      this.camera.lookAt(0, 1, -2);
    }
    if (this.focus) {
      const site = this.focus === "alien" ? alienSite : sectors[6];
      const h = this.terrain.heightAt(site.x, site.z);
      const target = new THREE.Vector3(
        site.x + (this.focus === "ship" ? 20 : 7),
        h + (this.focus === "ship" ? 14 : 4),
        site.z + (this.focus === "ship" ? 16 : 8),
      );
      this.camera.position.lerp(target, 1 - Math.exp(-dt * 6));
      this.camera.lookAt(
        site.x,
        h + (this.focus === "ship" ? 5 : 1.5),
        site.z + (this.focus === "ship" ? -7 : 0),
      );
    }
    this.nemi.update(
      s,
      this.terrain,
      dt,
      this.motion.reduced,
      this.focus === "alien"
        ? { x: alienSite.x + 7, z: alienSite.z + 8 }
        : s.players[id],
    );
    this.nearest = placeLabels(
      this.labels,
      this.camera,
      s,
      id,
      this.menu || !!this.focus,
      this.hovered,
    );
    const labelRay = new THREE.Vector3();
    for (const [key, l] of this.labels) {
      if (s.players[key]?.hab || roverSeat(rover, key) >= 0 || (key === "rover" && aboard)) l.el.hidden = true;
      if (!l.el.hidden && (key.startsWith("field-") || key.startsWith("salvage-") || (key !== "workbench" && Object.hasOwn(stations, key)))) {
        labelRay.copy(l.obj.position).sub(this.camera.position);
        labelRay.y += l.height;
        const distanceToLabel = labelRay.length();
        if (distanceToLabel > 0.2 && this.terrain.rayHit(this.camera.position, labelRay.normalize(), distanceToLabel - 0.2) !== null) {
          l.el.hidden = true;
        }
      }
      if (
        this.actors.has(key) ||
        key === "nemi" ||
        key === "rover" ||
        key.startsWith("field-") ||
        key.startsWith("salvage-") ||
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
    this.fieldSites.update(
      s,
      this.terrain,
      this.motion.time,
      this.motion.reduced,
    );
    if (this.terrain.ready && !this.mapImage)
      this.mapImage = captureFieldMap(this.renderer, this.scene);
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
    const weather = this.menu ? 0 : this.motion.storm;
    const impact = s.event?.kind === "storm" ? s.clock - s.event.at - B.stormWarningSeconds : -1;
    const burst = !this.menu && s.phase === "day" && impact >= 0 && impact < 7
      ? Math.min(1, (impact + 0.1) * 4, (7 - impact) / 2) : 0;
    const vortexExposure = !this.menu && !s.players[id]?.hab && s.phase === "day"
      ? vortexField(s.players[id]?.x ?? 0,s.players[id]?.z ?? 0,s.devil).strength : 0;
    this.screenDust.update(s.clock, Math.max(burst,vortexExposure*.7), this.motion.reduced);
    this.tracks.erode(s.devil, dt);
    this.tracks.update(s.elapsed);
    // Animate the dust on the render clock rather than the 10 Hz network clock.
    this.dustDevil.update(s.devil,this.motion.time,this.terrain,this.camera,this.motion.reduced,!this.menu && s.phase === "day");

    // A shallow weather volume follows the local terrain height. It stays out of
    // collision and shared simulation; the same storm event drives every client.
    const weatherOrigin = this.actors.get(id)?.position || this.camera.position;
    this.motion.sandstorm.update(
      dt,
      weather,
      {
        x: weatherOrigin.x,
        y: this.terrain.heightAt(weatherOrigin.x, weatherOrigin.z),
        z: weatherOrigin.z,
      },
      this.motion.reduced,
    );
    const fog = this.scene.fog as THREE.Fog;
    fog.near = THREE.MathUtils.lerp(THREE.MathUtils.lerp(110, 18, weather), 5, Math.max(burst,vortexExposure));
    fog.far = THREE.MathUtils.lerp(THREE.MathUtils.lerp(620, 145, weather), 35, Math.max(burst,vortexExposure));
    this.renderer.render(this.scene, this.camera);
    this.frameMs = performance.now() - renderBegin;
    this.fps = this.fps * 0.95 + 0.05 / Math.max(0.001, dt);
  }
}
