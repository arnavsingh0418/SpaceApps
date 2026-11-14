import * as T from "three";
import type { Terrain } from "./terrain";

const lifetime = 85;
type Trail = { x: number; z: number; remaining: number; left: boolean };

function texture(tire: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#48261d";
  if (tire) {
    for (let y = 2; y < 64; y += 10) {
      ctx.fillRect(2, y, 12, 5);
      ctx.fillRect(18, y + 3, 12, 5);
    }
  } else {
    ctx.beginPath();
    ctx.roundRect(3, 2, 26, 37, [11, 11, 5, 5]);
    ctx.roundRect(7, 44, 18, 18, 4);
    ctx.fill();
    ctx.clearRect(5, 18, 22, 3);
    ctx.clearRect(7, 30, 18, 3);
  }
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  return map;
}

/** A capped ring of terrain-aligned marks. Shrink marks as they weather away. */
class Marks {
  mesh: T.InstancedMesh;
  private next = 0;
  private records: ({ matrix: T.Matrix4; at: number } | undefined)[];
  private dummy = new T.Object3D();
  private matrix = new T.Matrix4();
  private fadeScale = new T.Vector3();
  private lastUpdate = -Infinity;
  count = 0;

  constructor(scene: T.Scene, capacity: number, tire: boolean) {
    const geometry = new T.PlaneGeometry(
      tire ? 0.68 : 0.34,
      tire ? 0.71 : 0.64,
    );
    geometry.rotateX(-Math.PI / 2);
    const material = new T.MeshBasicMaterial({
      map: texture(tire),
      transparent: true,
      opacity: tire ? 0.48 : 0.57,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    this.mesh = new T.InstancedMesh(geometry, material, capacity);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.records = Array(capacity);
    scene.add(this.mesh);
  }

  stamp(
    x: number,
    z: number,
    heading: number,
    y: number,
    terrain: Terrain,
    time: number,
  ) {
    const height = terrain.heightAt(x, z, y);
    if (Math.abs(height - y) > 1.4) return;
    const radius = 0.17;
    const normal = new T.Vector3(
      terrain.heightAt(x - radius, z, height) -
        terrain.heightAt(x + radius, z, height),
      radius * 2,
      terrain.heightAt(x, z - radius, height) -
        terrain.heightAt(x, z + radius, height),
    ).normalize();
    if (normal.y < 0.7) return;
    this.dummy.position.set(x, height + 0.045, z);
    this.dummy.quaternion
      .setFromUnitVectors(new T.Vector3(0, 1, 0), normal)
      .multiply(
        new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), heading),
      );
    this.dummy.updateMatrix();
    this.records[this.next] = { matrix: this.dummy.matrix.clone(), at: time };
    this.mesh.count = Math.max(this.mesh.count, this.next + 1);
    this.next = (this.next + 1) % this.records.length;
  }

  update(time: number) {
    if (time - this.lastUpdate < 0.1) return;
    this.lastUpdate = time;
    this.count = 0;
    for (let index = 0; index < this.mesh.count; index++) {
      const record = this.records[index];
      if (!record) continue;
      const scale = T.MathUtils.clamp(
        (lifetime - (time - record.at)) / 15,
        0,
        1,
      );
      if (scale > 0) this.count++;
      this.mesh.setMatrixAt(
        index,
        this.matrix
          .copy(record.matrix)
          .scale(this.fadeScale.set(scale, 1, scale)),
      );
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    this.next = 0;
    this.mesh.count = 0;
    this.count = 0;
    this.records.fill(undefined);
    this.lastUpdate = -Infinity;
  }
}

export class SurfaceTracks {
  private boots: Marks;
  private tires: Marks;
  private trails = new Map<string, Trail>();
  constructor(scene: T.Scene) {
    this.boots = new Marks(scene, 1200, false);
    this.tires = new Marks(scene, 1600, true);
  }
  get state() {
    return {
      footprints: this.boots.count,
      tireMarks: this.tires.count,
      lifetime,
    };
  }
  reset() {
    this.trails.clear();
    this.boots.clear();
    this.tires.clear();
  }
  forget(id: string) {
    this.trails.delete(id);
  }
  trace(
    id: string,
    x: number,
    y: number,
    z: number,
    heading: number,
    grounded: boolean,
    terrain: Terrain,
    time: number,
    tire = false,
  ) {
    if (!grounded || !terrain.ready) {
      this.forget(id);
      return;
    }
    const spacing = tire ? 0.64 : 0.84;
    const trail = this.trails.get(id);
    if (!trail || Math.hypot(x - trail.x, z - trail.z) > 8) {
      this.trails.set(id, { x, z, left: true, remaining: spacing });
      return;
    }
    const dx = x - trail.x,
      dz = z - trail.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.0001) return;
    let offset = trail.remaining;
    while (offset <= distance) {
      const px = trail.x + (dx * offset) / distance,
        pz = trail.z + (dz * offset) / distance;
      for (const side of tire ? [-1.95, 1.95] : [trail.left ? -0.22 : 0.22]) {
        const marks = tire ? this.tires : this.boots;
        marks.stamp(
          px + Math.cos(heading) * side,
          pz - Math.sin(heading) * side,
          tire ? heading : heading + Math.PI,
          y,
          terrain,
          time,
        );
      }
      trail.left = !trail.left;
      offset += spacing;
    }
    trail.remaining = offset - distance;
    trail.x = x;
    trail.z = z;
  }
  update(time: number) {
    this.boots.update(time);
    this.tires.update(time);
  }
}
