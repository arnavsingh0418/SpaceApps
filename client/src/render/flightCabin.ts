import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { updateHeldItem } from "./heldItem";
import { ScrubberProps } from "./scrubberProps";
import { astronaut } from "./builders.js";
import { disposeModel } from "./modelAssets";
import { SHIP_LAYOUT } from "../../../shared/src/flightLayout";
import {
  flightStations,
  flightDuration,
  arrivalDuration,
  type FlightStation,
} from "../../../shared/src/flight";
import type { Game } from "../../../shared/src/sim";
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
/** Eye camera uses the same yaw as camera-relative walking. */
export function setFlightView(
  camera: T.PerspectiveCamera,
  at: { x: number; z: number },
  yaw: number,
  pitch: number,
) {
  camera.position.set(at.x, SHIP_LAYOUT.eyeHeight, at.z);
  camera.rotation.order = "YXZ";
  camera.rotation.set(-T.MathUtils.clamp(pitch, -1.1, 1.1), yaw, 0, "YXZ");
}
export class FlightCabin {
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(78, innerWidth / innerHeight, 0.08, 300);
  actors = new Map<string, T.Group>();
  status: "loading" | "ready" | "fallback" = "loading";
  ready: Promise<void>;
  private root = new T.Group();
  private scrubber: ScrubberProps;
  private earth: T.Mesh;
  private stars: T.InstancedMesh;
  private dummy = new T.Object3D();
  private lamps = new Map<FlightStation, T.Object3D>();
  private alarm: T.PointLight;
  private capsule = new T.Group();
  private seed = -1;
  private time = 0;
  private progress = 0;
  private shownArrival = 0;
  constructor(private renderer: T.WebGLRenderer) {
    this.scene.background = new T.Color(0x060c20);
    this.scene.add(this.root, new T.HemisphereLight(0xf2f4dd, 0x5d736c, 2.0));
    this.scene.add(this.camera);
    this.scrubber = new ScrubberProps(this.root, this.camera);
    const fill = new T.DirectionalLight(0xffefd1, 1.4);
    fill.position.set(2, 8, 5);
    this.scene.add(fill);
    for (const z of [7, -2, -11, -21]) {
      const light = new T.PointLight(0xfff0d4, 15, 16, 2);
      light.position.set(0, 3.3, z);
      this.root.add(light);
    }
    this.alarm = new T.PointLight(0xff4c4c, 0, 30);
    this.alarm.position.set(0, 3, -5);
    this.root.add(this.alarm);
    const fallback = new T.Group();
    this.root.add(fallback);
    const box = (
      parent: T.Object3D,
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      color: number,
    ) => {
      const mesh = new T.Mesh(
        new T.BoxGeometry(w, h, d),
        new T.MeshStandardMaterial({ color, roughness: 0.7 }),
      );
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return mesh;
    };
    for (const room of SHIP_LAYOUT.rooms) {
      box(fallback, room.x, -0.1, room.z, room.w, 0.2, room.d, 0x68736b);
      box(fallback, 0, 3.9, room.z, room.w, 0.15, room.d, 0xd7ddce);
      for (const sign of [-1, 1])
        box(
          fallback,
          (sign * room.w) / 2,
          1.9,
          room.z,
          0.15,
          3.8,
          room.d,
          0xc1cabb,
        );
    }
    for (const r of SHIP_LAYOUT.colliders)
      box(fallback, r.x, 0.85, r.z, r.w, 1.7, r.d, 0x29473e);
    this.ready = new GLTFLoader()
      .loadAsync(
        `${import.meta.env.BASE_URL}mars/interiors/Mars_Return_Ship_Interior.glb`,
      )
      .then((gltf) => {
        this.root.add(gltf.scene);
        fallback.removeFromParent();
        disposeModel(fallback);
        for (const key of Object.keys(flightStations) as FlightStation[]) {
          const group = gltf.scene.getObjectByName(`Indicator_${key}`);
          if (group) {
            group.traverse((o) => {
              if (o instanceof T.Mesh)
                o.material = Array.isArray(o.material)
                  ? o.material.map((m) => m.clone())
                  : o.material.clone();
            });
            this.lamps.set(key, group);
          }
        }
        this.status = "ready";
      })
      .catch((e) => {
        this.status = "fallback";
        console.warn("Return ship: keeping enclosed fallback", e);
      });
    this.earth = new T.Mesh(
      new T.SphereGeometry(1, 40, 24),
      new T.MeshStandardMaterial({
        map: earthTexture(),
        roughness: 1,
        emissive: 0x123354,
        emissiveIntensity: 0.35,
      }),
    );
    this.earth.position.set(0, 2, -65);
    this.scene.add(this.earth);
    const glow = new T.Mesh(
      new T.SphereGeometry(1.035, 32, 20),
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
      new T.SphereGeometry(0.06, 4, 3),
      new T.MeshBasicMaterial({ color: 0xcde8ff }),
      180,
    );
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);
    const shell = new T.Mesh(
      new T.ConeGeometry(1.1, 2.6, 14),
      new T.MeshStandardMaterial({ color: 0xf3e6cf }),
    );
    shell.rotation.x = Math.PI / 2;
    this.capsule.add(shell);
    box(this.capsule, 0, 0.3, 0.2, 0.8, 0.4, 0.35, 0x304f70);
    this.capsule.visible = false;
    this.scene.add(this.capsule);
  }
  update(
    s: Game,
    id: string,
    dt: number,
    reduced: boolean,
    yaw = 0,
    pitch = 0.03,
  ) {
    const d = s.returnMission!.flight!.deck!;
    this.scrubber.update(d, id, s.players);
    this.time += dt;
    this.progress = Math.min(1, d.time / flightDuration);
    if (this.seed !== s.seed) {
      this.seed = s.seed;
      for (const actor of this.actors.values()) {
        actor.removeFromParent();
        disposeModel(actor);
      }
      this.actors.clear();
    }
    const arrival = d.arrivalAt !== undefined;
    this.shownArrival = arrival
      ? Math.min(1, (d.time - d.arrivalAt!) / arrivalDuration)
      : 0;
    const danger = d.incidents.filter((i) => !i.fixed).length;
    this.alarm.intensity = danger
      ? reduced
        ? 0.8
        : 1.1 + Math.sin(this.time * 5) * 0.3
      : 0;
    for (const [key, group] of this.lamps) {
      const bad = d.incidents.some((i) => i.kind === key && !i.fixed);
      group.traverse((o) => {
        if (o instanceof T.Mesh) {
          const materials = Array.isArray(o.material)
            ? o.material
            : [o.material];
          for (const m of materials)
            if (m instanceof T.MeshStandardMaterial) {
              m.color.set(bad ? 0xff6854 : 0x6cdac0);
              m.emissive.set(bad ? 0xff3528 : 0x4be1c5);
              m.emissiveIntensity = bad
                ? reduced
                  ? 0.5
                  : 0.9 + Math.sin(this.time * 6) * 0.25
                : 0.4;
            }
        }
      });
    }
    for (const [key, actor] of this.actors)
      if (!s.players[key]) {
        actor.removeFromParent();
        disposeModel(actor);
        this.actors.delete(key);
      }
    for (const p of Object.values(s.players)) {
      let actor = this.actors.get(p.id);
      if (!actor) {
        actor = astronaut(p.color);
        this.root.add(actor!);
        actor!.scale.setScalar(0.9);
        actor!.position.set(p.x, 0, p.z);
        this.actors.set(p.id, actor!);
      }
      actor!.position.lerp(new T.Vector3(p.x, 0, p.z), 1 - Math.exp(-dt * 18));
      // Your body would intersect the eye camera; crewmates remain fully visible.
      actor!.visible = p.id !== id;
      const held = updateHeldItem(actor!, p),
        moving = Math.hypot(p.move.x, p.move.z) > 0.01;
      if (moving) actor!.rotation.y = Math.atan2(p.move.x, p.move.z);
      for (const [name, sign] of [
        ["armL", 1],
        ["armR", -1],
        ["legL", -1],
        ["legR", 1],
      ] as const) {
        const limb = actor!.getObjectByName(name);
        if (limb)
          limb.rotation.x =
            Math.sin(this.time * 9) * (moving && !reduced ? 0.6 : 0) * sign;
      }
      if (held)
        for (const name of ["armL", "armR"]) {
          const arm = actor!.getObjectByName(name);
          if (arm) arm.rotation.x = -1.15;
        }
      const wrench = actor!.getObjectByName("wrench");
      if (wrench) wrench.visible = p.task?.kind === "flightRepair";
    }
    this.earth.scale.setScalar(
      arrival ? 14 + this.shownArrival * 14 : 8 + this.progress * 6,
    );
    this.earth.rotation.y = reduced ? 0.5 : this.time * 0.015;
    for (let i = 0; i < 180; i++) {
      // Every star stays beyond the pressure hull; no streaks pass through the cabin.
      this.dummy.position.set(
        Math.sin(i * 81.7) * 70,
        Math.sin(i * 13.1) * 40,
        -45 - ((i * 5.71 + (reduced ? 0 : this.time * 0.5)) % 60),
      );
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      this.stars.setMatrixAt(i, this.dummy.matrix);
    }
    this.stars.instanceMatrix.needsUpdate = true;
    this.root.visible = !arrival;
    this.capsule.visible = arrival;
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.fov = arrival ? 48 : 78;
    this.camera.updateProjectionMatrix();
    if (arrival) {
      this.capsule.position.set(
        (1 - this.shownArrival) * 6,
        2,
        -37 - this.shownArrival * 7,
      );
      this.capsule.rotation.z = reduced ? 0 : Math.sin(this.time) * 0.06;
      this.camera.position.set(9, 8, -24);
      this.camera.lookAt(0, 2, -51);
    } else {
      const actor = this.actors.get(id),
        me = s.players[id];
      setFlightView(
        this.camera,
        { x: actor?.position.x ?? me.x, z: actor?.position.z ?? me.z },
        yaw,
        pitch,
      );
    }
    this.renderer.render(this.scene, this.camera);
  }
  get state() {
    return {
      model: this.status,
      camera: "first-person",
      eyeHeight: SHIP_LAYOUT.eyeHeight,
      earthScale: this.earth.scale.x,
      progress: this.progress,
      arrival: this.shownArrival,
      starsMoving: true,
      actors: Array.from(this.actors, ([id, g]) => ({
        id,
        x: g.position.x,
        z: g.position.z,
        visible: g.visible,
      })),
    };
  }
}
