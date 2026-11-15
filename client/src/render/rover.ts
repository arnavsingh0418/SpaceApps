import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ROVER, angleDelta, type RoverState } from "../../../shared/src/rover";
import type { Terrain } from "./terrain";
import type { RoverController } from "./roverController";
export class RoverView {
  group = new T.Group();
  status: "loading" | "ready" | "fallback" = "loading";
  ready: Promise<void>;
  private wheels: T.Object3D[] = [];
  private steering: T.Object3D[] = [];
  private travel = 0;
  private frontSteer = 0;
  private previousHeading = 0;
  private windHeight = 0;
  private last: { x: number; z: number } | null = null;
  constructor(scene: T.Scene) {
    this.group.name = "Wayfarer rover";
    scene.add(this.group);
    const fallback = new T.Group();
    const shell = new T.Mesh(
      new T.BoxGeometry(3.7, 2.9, 5.5),
      new T.MeshStandardMaterial({ color: 0xe1e7dc, roughness: 0.6 }),
    );
    shell.position.y = 2.8;
    shell.castShadow = true;
    fallback.add(shell);
    const tire = new T.CylinderGeometry(0.85, 0.85, 0.62, 16);
    tire.rotateZ(Math.PI / 2);
    const rubber = new T.MeshStandardMaterial({ color: 0x182c2c });
    for (const x of [-2.05, 2.05])
      for (const z of [-2.25, 0, 2.25]) {
        const w = new T.Mesh(tire, rubber);
        w.position.set(x, 0.86, z);
        fallback.add(w);
      }
    this.group.add(fallback);
    this.ready = new GLTFLoader()
      .loadAsync(`${import.meta.env.BASE_URL}mars/vehicles/Mars_Rover.glb`)
      .then((gltf) => {
        const root = gltf.scene;
        root.traverse((o) => {
          if (/^Wheel_[FMR][LR]$/.test(o.name)) this.wheels.push(o);
          if (/^Steer_F[LR]$/.test(o.name)) this.steering.push(o);
          if (!(o instanceof T.Mesh)) return;
          o.castShadow = o.receiveShadow = true;
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            if (m.transparent) {
              m.depthWrite = false;
              m.side = T.DoubleSide;
              o.castShadow = false;
            }
        });
        this.group.add(root);
        this.group.remove(fallback);
        shell.geometry.dispose();
        (shell.material as T.Material).dispose();
        tire.dispose();
        rubber.dispose();
        this.status = "ready";
      })
      .catch((error) => {
        this.status = "fallback";
        console.warn("Using simple rover visual after GLB load failure", error);
      });
  }
  update(
    r: RoverState,
    terrain: Terrain,
    dt: number,
    local: RoverController | null,
  ) {
    const x = local?.x ?? r.x,
      z = local?.z ?? r.z;
    if (local) {
      this.group.position.set(x, local.y, z);
      this.group.rotation.set(local.pitch, local.heading, local.roll, "YXZ");
      this.travel = local.distance;
    } else {
      if (
        !this.last ||
        Math.hypot(x - this.group.position.x, z - this.group.position.z) > 20
      )
        this.group.position.set(x, terrain.groundAt(x, z), z);
      else {
        const k = 1 - Math.exp(-14 * dt);
        this.group.position.x += (x - this.group.position.x) * k;
        this.group.position.z += (z - this.group.position.z) * k;
        this.group.position.y = terrain.groundAt(
          this.group.position.x,
          this.group.position.z,
        );
      }
      this.group.rotation.y +=
        angleDelta(r.heading, this.group.rotation.y) * (1 - Math.exp(-14 * dt));
      const c = Math.cos(r.heading),
        s = Math.sin(r.heading);
      const front = terrain.groundAt(x - s * 2.25, z - c * 2.25),
        back = terrain.groundAt(x + s * 2.25, z + c * 2.25);
      const left = terrain.groundAt(x - c * 1.95, z + s * 1.95),
        right = terrain.groundAt(x + c * 1.95, z - s * 1.95);
      this.group.rotation.x = Math.atan2(front - back, 4.5);
      this.group.rotation.z = -Math.atan2(left - right, 3.9);
      if (this.last)
        this.travel += (x - this.last.x) * -s + (z - this.last.z) * -c;
    }
    this.windHeight += ((r.gust?.height ?? 0)-this.windHeight)*(1-Math.exp(-dt*16));
    if (!local && this.windHeight > .001) {
      this.group.position.y += this.windHeight;
      this.group.rotation.x += Math.sin(r.heading * 3) * Math.min(0.7, this.windHeight * 0.15);
      this.group.rotation.z += Math.cos(r.heading * 2) * Math.min(0.8, this.windHeight * 0.18);
    }
    if (local) this.frontSteer = local.steer;
    else if (this.last) {
      const travelled =
        (x - this.last.x) * -Math.sin(r.heading) +
        (z - this.last.z) * -Math.cos(r.heading);
      if (Math.abs(travelled) > 0.01)
        this.frontSteer = T.MathUtils.clamp(
          Math.atan(
            (-angleDelta(r.heading, this.previousHeading) * ROVER.wheelbase) /
              travelled,
          ),
          -0.6,
          0.6,
        );
      else if (Math.abs(r.speed) < 0.1) this.frontSteer *= Math.exp(-dt * 8);
    }
    this.previousHeading = local?.heading ?? r.heading;
    this.last = { x, z };
    for (const w of this.wheels)
      w.rotation.x = -this.travel / ROVER.wheelRadius;
    for (const w of this.steering) w.rotation.y = -this.frontSteer;
    this.group.updateMatrixWorld(true);
  }
}
