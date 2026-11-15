import * as T from "three";
import { VORTEX, vortexField } from "../../../shared/src/dustDevil";
import type { Terrain } from "./terrain";
function dustTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,.85)");
  gradient.addColorStop(0.35, "rgba(255,255,255,.55)");
  gradient.addColorStop(0.72, "rgba(255,255,255,.16)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gradient;
  g.fillRect(0, 0, 64, 64);
  return new T.CanvasTexture(c);
}
/** Capped, instanced dust volume. Its ground skirt is the same 18 m radius as the force field. */
export class DustDevil {
  group = new T.Group();
  private clouds: T.InstancedMesh;
  private debris: T.InstancedMesh;
  private scour: T.InstancedMesh;
  private dummy = new T.Object3D();
  private visibleStrength = 0;
  readonly particles = 256;
  constructor(scene: T.Scene) {
    this.group.name =
      "Dust devil | airborne dust, ground skirt and entrained grit";
    this.clouds = new T.InstancedMesh(
      new T.PlaneGeometry(1, 1),
      new T.MeshBasicMaterial({
        map: dustTexture(),
        color: 0xc18b63,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        side: T.DoubleSide,
      }),
      this.particles,
    );
    this.debris = new T.InstancedMesh(
      new T.IcosahedronGeometry(0.09, 0),
      new T.MeshStandardMaterial({ color: 0x624638, roughness: 1 }),
      48,
    );
    this.scour = new T.InstancedMesh(
      new T.PlaneGeometry(0.45, 1.8).rotateX(-Math.PI / 2),
      new T.MeshBasicMaterial({
        map: dustTexture(),
        color: 0x593c2e,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
      80,
    );
    for (const m of [this.clouds, this.debris, this.scour]) {
      m.instanceMatrix.setUsage(T.DynamicDrawUsage);
      m.frustumCulled = false;
      this.group.add(m);
    }
    scene.add(this.group);
  }
  update(
    center: { x: number; z: number },
    time: number,
    terrain: Terrain,
    camera: T.Camera,
    reduced: boolean,
    visible = true,
  ) {
    this.group.visible = visible;
    if (!visible) return;
    const t = reduced ? 0 : time,
      ground = terrain.groundAt(center.x, center.z);
    this.group.position.set(center.x, ground, center.z);
    for (let i = 0; i < this.particles; i++) {
      const skirt = i >= 192,
        seed = (i * 0.61803398875) % 1;
      const phase = (seed + t * (skirt ? 0.13 : 0.075)) % 1;
      const y = skirt ? 0.2 + ((i * 17) % 11) * 0.07 : phase * VORTEX.height;
      const radius = skirt
        ? 2 + seed * (VORTEX.radius - 2)
        : (1.1 + Math.pow(phase, 0.8) * 4.4) * (0.7 + ((i * 13) % 19) / 45);
      const angle = i * 2.39996 + (t * (skirt ? 1.7 : 2.4)) / (1 + y * 0.09);
      const wx = Math.sin(y * 0.34 + t * 0.65) * (0.15 + y * 0.025),
        wz = Math.cos(y * 0.27 + t * 0.4) * y * 0.025;
      const x = Math.cos(angle) * radius + wx,
        z = Math.sin(angle) * radius + wz;
      this.dummy.position.set(
        x,
        y + (skirt ? terrain.groundAt(center.x + x, center.z + z) - ground : 0),
        z,
      );
      this.dummy.quaternion.copy(camera.quaternion);
      const size = skirt
        ? 2.2 + seed * 3.5
        : (1.6 + y * 0.17) * (0.8 + seed * 0.5);
      // Fade the head and foot by shrinking puffs rather than a visible cylinder edge.
      const fade = skirt ? 1 : Math.min(1, phase * 14, (1 - phase) * 9);
      this.dummy.scale.set(size * fade, size * (skirt ? 0.48 : 1.2) * fade, 1);
      this.dummy.updateMatrix();
      this.clouds.setMatrixAt(i, this.dummy.matrix);
    }
    for (let i = 0; i < 48; i++) {
      const phase = (i / 48 + t * 0.16) % 1,
        angle = i * 2.39996 + t * 3.1,
        radius = 1.3 + phase * 6;
      this.dummy.position.set(
        Math.cos(angle) * radius,
        phase * 9 + 0.15,
        Math.sin(angle) * radius,
      );
      this.dummy.rotation.set(t + i, t * 0.7 + i * 0.3, t * 0.6);
      this.dummy.scale.setScalar(
        (0.5 + (i % 5) * 0.25) * Math.min(1, phase * 12, (1 - phase) * 8),
      );
      this.dummy.updateMatrix();
      this.debris.setMatrixAt(i, this.dummy.matrix);
    }
    for (let i = 0; i < 80; i++) {
      const angle = i * 2.39996 + t * 0.7,
        r = 2 + ((i % 23) / 23) * 15,
        x = Math.cos(angle) * r,
        z = Math.sin(angle) * r;
      this.dummy.position.set(
        x,
        terrain.groundAt(center.x + x, center.z + z) - ground + 0.04,
        z,
      );
      this.dummy.rotation.set(0, -angle, 0);
      this.dummy.scale.set(0.6, 1, 1.2);
      this.dummy.updateMatrix();
      this.scour.setMatrixAt(i, this.dummy.matrix);
    }
    for (const m of [this.clouds, this.debris, this.scour])
      m.instanceMatrix.needsUpdate = true;
    this.visibleStrength = vortexField(
      camera.position.x,
      camera.position.z,
      center,
    ).strength;
  }
  get state() {
    return {
      visible: this.group.visible,
      particles: this.particles,
      drawCalls: 3,
      radius: VORTEX.radius,
      nearby: this.visibleStrength,
    };
  }
}
