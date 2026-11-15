import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { HAB_LAYOUT, berthOwners } from "../../../shared/src/hab";
import type { Game } from "../../../shared/src/sim";
import { astronaut } from "./builders.js";
import { disposeModel, updateRoleBadge } from "./modelAssets";
import { updateHeldItem } from "./heldItem";
import type { WorldMotion } from "./motion";
import type { LocalController } from "./controller";
export class HabInterior {
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 120);
  group = new T.Group();
  actors = new Map<string, T.Group>();
  status: "loading" | "ready" | "fallback" = "loading";
  ready: Promise<void>;
  private walls = new Map<string, T.Object3D>();
  private plaques: T.Sprite[] = [];
  private plaqueKey = "";
  private follow: T.Vector3 | null = null;
  private seed = -1;
  constructor(private renderer: T.WebGLRenderer) {
    this.scene.background = new T.Color(0x101e25);
    this.scene.add(this.group, new T.HemisphereLight(0xe3f4ef, 0x324349, 2.2));
    const key = new T.DirectionalLight(0xffedce, 2.1);
    key.position.set(-5, 16, 8);
    this.scene.add(key);
    const fill = new T.DirectionalLight(0xb1d9e4, 1.2);
    fill.position.set(6, 9, -5);
    this.scene.add(fill);
    const fallback = new T.Group();
    this.group.add(fallback);
    const box = (
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      color: number,
    ) => {
      const m = new T.Mesh(
        new T.BoxGeometry(w, h, d),
        new T.MeshStandardMaterial({ color, roughness: 0.8 }),
      );
      m.position.set(x, y, z);
      fallback.add(m);
    };
    box(0, -0.12, 0, 22, 0.24, 22, 0x34494c);
    for (const r of HAB_LAYOUT.colliders)
      if (!r.id.startsWith("Shell"))
        box(
          r.x,
          r.id.includes("divider") ? 1.4 : 0.6,
          r.z,
          r.w,
          r.id.includes("divider") ? 2.8 : 1.2,
          r.d,
          r.id.startsWith("Bed") ? 0xbcc8c1 : 0x668184,
        );
    this.ready = new GLTFLoader()
      .loadAsync(
        `${import.meta.env.BASE_URL}mars/interiors/Mars_Hab_Interior.glb`,
      )
      .then((gltf) => {
        const root = gltf.scene;
        root.traverse((o) => {
          if (o.name === "Roof") o.visible = false;
          if (/^Shell_[NSEW]$/.test(o.name)) this.walls.set(o.name, o);
          if (o instanceof T.Mesh) {
            o.castShadow = false;
            o.receiveShadow = false;
          }
        });
        this.group.add(root);
        fallback.removeFromParent();
        disposeModel(fallback);
        this.status = "ready";
      })
      .catch((e) => {
        this.status = "fallback";
        console.warn("Hab interior: retaining navigation fallback", e);
      });
  }
  private updatePlaques(s: Game) {
    const owners = berthOwners(s),
      key = owners.map((p) => p?.name || "").join("/");
    if (key === this.plaqueKey && this.plaques.length) return;
    this.plaqueKey = key;
    for (const o of this.plaques) {
      o.removeFromParent();
      o.material.map?.dispose();
      o.material.dispose();
    }
    this.plaques = [];
    for (let i = 0; i < 4; i++) {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 112;
      const c = canvas.getContext("2d")!;
      c.fillStyle = "#123138";
      c.fillRect(0, 0, 512, 112);
      c.fillStyle = "#e9e7d5";
      c.font = "600 35px sans-serif";
      c.textAlign = "center";
      c.fillText(
        `0${i + 1}  ${(owners[i]?.name || "UNASSIGNED").toUpperCase()}`,
        256,
        66,
        485,
      );
      const map = new T.CanvasTexture(canvas);
      map.colorSpace = T.SRGBColorSpace;
      const sprite = new T.Sprite(
        new T.SpriteMaterial({ map, depthTest: false }),
      );
      sprite.scale.set(2.7, 0.59, 1);
      sprite.position.set(-5.8, 2.9, -3.6 + i * 3.1 + 1.25);
      this.scene.add(sprite);
      this.plaques.push(sprite);
    }
  }
  update(
    s: Game,
    id: string,
    dt: number,
    local: LocalController | null,
    yaw: number,
    pitch: number,
    zoom: number,
    motion: WorldMotion,
  ) {
    const me = s.players[id].hab;
    if (!me) return;
    this.updatePlaques(s);
    if (this.seed !== s.seed) {
      this.follow = null;
      this.seed = s.seed;
    }
    motion.time += dt;
    for (const [id, g] of this.actors)
      if (!s.players[id]) {
        disposeModel(g);
        g.removeFromParent();
        this.actors.delete(id);
      }
    for (const p of Object.values(s.players)) {
      let actor = this.actors.get(p.id);
      if (!p.hab) {
        if (actor) actor.visible = false;
        continue;
      }
      if (!actor) {
        actor = astronaut(p.color);
        this.scene.add(actor!);
        this.actors.set(p.id, actor!);
        actor!.position.set(p.hab.x, 0, p.hab.z);
      }
      const g = actor!,
        prev = g.position.clone(),
        ctl = p.id === id ? local : null;
      g.visible = true;
      updateRoleBadge(g, p.role);
      updateHeldItem(g, p);
      if (ctl) g.position.set(ctl.x, 0, ctl.z);
      else
        g.position.lerp(
          new T.Vector3(p.hab.x, 0, p.hab.z),
          1 - Math.exp(-14 * dt),
        );
      const dx = g.position.x - prev.x,
        dz = g.position.z - prev.z,
        speed = Math.min(5, Math.hypot(dx, dz) / Math.max(0.001, dt));
      if (speed > 0.1) g.userData.habHeading = Math.atan2(dx, dz);
      motion.actor(g, p, s, dt, {
        speed,
        gait: "walk",
        grounded: true,
        vy: 0,
        landAgo: 99,
        landImpact: 0,
        heading: ctl?.heading ?? Number(g.userData.habHeading || 0),
      });
    }
    const at = local
      ? new T.Vector3(local.x, 0, local.z)
      : new T.Vector3(me.x, 0, me.z);
    if (!this.follow || this.follow.distanceTo(at) > 12)
      this.follow = at.clone();
    this.follow.lerp(at, 1 - Math.exp(-18 * dt));
    const focus = this.follow.clone().add(new T.Vector3(0, 1, 0));
    const p = T.MathUtils.clamp(pitch, 0.62, 1.1),
      distance = T.MathUtils.clamp(zoom, 8, 21);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.camera.position
      .copy(focus)
      .add(
        new T.Vector3(
          Math.sin(yaw) * Math.cos(p) * distance,
          Math.sin(p) * distance,
          Math.cos(yaw) * Math.cos(p) * distance,
        ),
      );
    this.camera.lookAt(focus);
    // Cut only camera-facing pressure panels; collision stays identical in every view.
    for (const [name, wall] of this.walls)
      wall.visible =
        name === "Shell_N"
          ? Math.cos(yaw) > -0.15
          : name === "Shell_S"
            ? Math.cos(yaw) < 0.15
            : name === "Shell_W"
              ? Math.sin(yaw) > -0.15
              : Math.sin(yaw) < 0.15;
    this.renderer.render(this.scene, this.camera);
  }
  resetCamera() {
    this.follow = null;
  }
}
