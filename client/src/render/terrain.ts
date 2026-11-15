import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { computeBoundsTree, acceleratedRaycast } from "three-mesh-bvh";

// BVH-accelerated raycasts (used by the camera so it never clips into walls or terrain).
(THREE.BufferGeometry.prototype as unknown as { computeBoundsTree: typeof computeBoundsTree }).computeBoundsTree =
  computeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

/**
 * The Blender-made Mars map (client/public/models/mars_map.glb, built by mars_terrain.py).
 *
 * The spawn/base sits at Blender (-55, -75), on the open plain south of the ravine.
 * That point becomes game (0, 0) and ground height 0, so every gameplay coordinate
 * in the simulation stays centred on the base. Blender (x, y, z) is glTF/three
 * (x, z, -y), so the map is shifted by (+55, -h, -75).
 *
 * A cleared landing pad is flattened around the base so the hab, beacons, panels and
 * effects (which are placed at y = 0) sit on level ground, blending into the real terrain.
 */
export const SPAWN_BLENDER = { x: -55, y: -75 };
const PAD_FLAT = 48; // fully flat radius (m): fits the life-sized base
const PAD_BLEND = 66; // blends back into the terrain by this radius
const CELL = 4; // height lookup grid cell (m)
const STEP_UP = 1.6; // how high a slope/ledge you can walk up in one step (m)

type Tri = [number, number, number, number, number, number, number, number, number];
/** A steep/vertical face, projected to the ground: its XZ triangle plus its height span. */
type Wall = [number, number, number, number, number, number, number, number];
const BODY = 2.6; // obstacle band above your feet that blocks you (m)
const RADIUS = 0.6; // astronaut collision radius (m)

export class Terrain {
  group = new THREE.Group();
  ready = false;
  private cells = new Map<number, Tri[]>();
  private statics = new Set<THREE.Object3D>();
  private staticIndex?: Terrain;
  private walls = new Map<number, Wall[]>();
  /** Solid meshes the camera must stay in front of. */
  private solids: THREE.Mesh[] = [];
  private ray = new THREE.Raycaster();

  load(scene: THREE.Scene, url = `${import.meta.env.BASE_URL}models/mars_map.glb`) {
    scene.add(this.group);
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    return loader.loadAsync(url).then((gltf) => {
      const root = gltf.scene;
      root.updateMatrixWorld(true);
      // Ground height at the spawn before flattening: average a few samples.
      const terrain = root.getObjectByName("MARS_Terrain");
      const raw = new Terrain();
      if (terrain) raw.index(terrain, -SPAWN_BLENDER.x, 0, SPAWN_BLENDER.y);
      const h0 = raw.rawAt(0, 0);
      root.position.set(-SPAWN_BLENDER.x, -h0, SPAWN_BLENDER.y);
      root.updateMatrixWorld(true);
      root.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        const name = o.name + " " + (o.parent?.name || "");
        const storm = /Storm/i.test(name);
        const old = o.material as THREE.MeshStandardMaterial;
        if (storm) {
          // The dust-storm wall is lit by its own baked colours so it reads as glowing haze,
          // not a dark cliff, when you walk up to the edge of the map.
          o.material = new THREE.MeshBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.88,
            depthWrite: false,
            side: THREE.DoubleSide,
            color: 0xffe2c8,
          });
          o.receiveShadow = o.castShadow = false;
          return;
        }
        o.material = new THREE.MeshStandardMaterial({
          vertexColors: true,
          flatShading: true,
          roughness: storm ? 1 : 0.95,
          metalness: 0,
          transparent: storm,
          opacity: storm ? 0.85 : 1,
          depthWrite: !storm,
          side: storm ? THREE.DoubleSide : THREE.FrontSide,
          emissive: old?.emissive?.clone() ?? new THREE.Color(0),
          emissiveIntensity: old?.emissiveIntensity ?? 0,
        });
        if (/Crystal/i.test(name)) {
          (o.material as THREE.MeshStandardMaterial).emissive.setHex(0x26bfff);
          (o.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.9;
        }
        o.receiveShadow = !storm;
        o.castShadow = /Boulder|Arch|Mountain|Mouth/i.test(name);
        if (/Terrain/i.test(name)) this.flattenPad(o, root);
        if (/Boulder/i.test(name)) this.clearPad(o, root);
      });
      this.group.add(root);
      root.updateMatrixWorld(true);
      // GLTFLoader strips "." from names (MARS_Mountain_Range.001 -> ...Range001), so match loosely.
      root.traverse((o) => {
        // Everything solid on the map: ground, mountain + cave, boulders, cave rocks, crystals, arch.
        if (o instanceof THREE.Mesh && !/Storm/i.test(o.name + " " + (o.parent?.name || "")))
          this.index(o);
      });
      // Build the raycast acceleration for the big map meshes now, not on the first camera frame.
      for (const m of this.solids) prepareForBVH(m.geometry as THREE.BufferGeometry);
      this.ready = true;
      return this;
    });
  }

  /**
   * Walkable height at game (x, z). 0 on the landing pad.
   * With `fromY` (your current feet height), returns the highest surface at or just above
   * your feet instead of the very top, so you walk *inside* the cave under the mountain.
   */
  heightAt(x: number, z: number, fromY?: number) {
    if (!this.ready) return 0;
    const floor = this.rawAt(x, z, fromY);
    const top = this.staticIndex?.rawAt(x, z, fromY, -Infinity) ?? -Infinity;
    return top > floor && (fromY === undefined || top <= fromY + STEP_UP) ? top : floor;
  }

  /** Terrain and natural rocks only: buildings can never become rover ground. */
  groundAt(x: number, z: number, fromY?: number) {
    return this.ready ? this.rawAt(x, z, fromY) : 0;
  }

  private rawAt(x: number, z: number, fromY?: number, empty = 0) {
    const list = this.cells.get(this.key(Math.floor(x / CELL), Math.floor(z / CELL)));
    let best = -Infinity,
      top = -Infinity;
    const limit = fromY === undefined ? Infinity : fromY + STEP_UP;
    if (list)
      for (const t of list) {
        const y = triHeight(t, x, z);
        if (y === null) continue;
        if (y > top) top = y;
        if (y <= limit && y > best) best = y;
      }
    if (best === -Infinity) best = top; // nothing below you: stand on whatever is there
    return best === -Infinity ? empty : best;
  }

  /**
   * Make a placed object solid (base buildings, panels, built structures). Indexed at its
   * final size even if it is mid build-animation.
   */
  addStatic(obj: THREE.Object3D) {
    this.statics.add(obj);
    this.rebuildStatics();
    const ready = obj.userData.marsPromise as Promise<unknown> | undefined;
    ready?.then(() => { if (this.statics.has(obj)) this.rebuildStatics(); });
  }
  removeStatic(obj: THREE.Object3D) {
    if (this.statics.delete(obj)) this.rebuildStatics();
  }
  private rebuildStatics() {
    const index = new Terrain();
    for (const obj of this.statics) {
      if (obj.userData.marsDisposed) continue;
      const scale = obj.scale.clone();
      obj.scale.setScalar(1);
      index.index(obj);
      obj.scale.copy(scale);
      obj.updateMatrixWorld(true);
    }
    this.staticIndex = index;
  }

  /**
   * Distance along a ray to the first solid surface (terrain, rocks, cave, buildings),
   * or null if nothing is hit within `far`.
   */
  rayHit(origin: THREE.Vector3, dir: THREE.Vector3, far: number): number | null {
    this.ray.set(origin, dir);
    this.ray.far = far;
    (this.ray as unknown as { firstHitOnly: boolean }).firstHitOnly = true;
    let best: number | null = this.staticIndex?.rayHit(origin, dir, far) ?? null;
    for (const m of this.solids) {
      const g = m.geometry as THREE.BufferGeometry & { boundsTree?: unknown };
      if (!g.boundsTree) prepareForBVH(g); // props added later build theirs on first use
      const hits = this.ray.intersectObject(m, false);
      if (hits[0] && (best === null || hits[0].distance < best)) best = hits[0].distance;
    }
    return best;
  }

  /**
   * Would an astronaut standing with feet at height y, centred at (x, z), overlap something?
   * Blocks on (1) walls whose height span reaches into the body, and (2) surfaces taller
   * than a step but below head height (rock tops, the dome, the rocket hull).
   */
  collides(x: number, z: number, y: number, r = RADIUS, height = BODY, step = STEP_UP) {
    if (this.staticIndex?.collides(x,z,y,r,height,step)) return true;
    const lo = y + step,
      hi = y + height;
    const i0 = Math.floor((x - r) / CELL),
      i1 = Math.floor((x + r) / CELL),
      j0 = Math.floor((z - r) / CELL),
      j1 = Math.floor((z + r) / CELL);
    for (let i = i0; i <= i1; i++)
      for (let j = j0; j <= j1; j++) {
        const list = this.walls.get(this.key(i, j));
        if (!list) continue;
        for (const w of list) {
          if (w[7] <= lo || w[6] >= hi) continue;
          if (distToTri2(x, z, w) < r * r) return true;
        }
      }
    for (const [dx, dz] of SAMPLES) {
      const px = x + dx * r,
        pz = z + dz * r;
      const list = this.cells.get(this.key(Math.floor(px / CELL), Math.floor(pz / CELL)));
      if (!list) continue;
      for (const t of list) {
        const h = triHeight(t, px, pz);
        if (h !== null && h > lo && h <= hi) return true;
      }
    }
    return false;
  }

  private key(i: number, j: number) {
    return (i + 1000) * 4000 + (j + 1000);
  }

  /** Bucket every upward-facing triangle of an object (in world space) into grid cells. */
  private index(obj: THREE.Object3D, ox = 0, oy = 0, oz = 0) {
    obj.updateMatrixWorld(true);
    obj.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || o.userData.ink || !o.visible) return;
      if (!this.solids.includes(o)) this.solids.push(o);
      const g = o.geometry as THREE.BufferGeometry;
      const pos = g.attributes.position;
      const idx = g.index;
      const n = idx ? idx.count : pos.count;
      const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
      for (let k = 0; k < n; k += 3) {
        for (let m = 0; m < 3; m++) {
          v[m].fromBufferAttribute(pos, idx ? idx.getX(k + m) : k + m).applyMatrix4(o.matrixWorld);
          v[m].x += ox;
          v[m].y += oy;
          v[m].z += oz;
        }
        const nx = (v[1].y - v[0].y) * (v[2].z - v[0].z) - (v[1].z - v[0].z) * (v[2].y - v[0].y);
        const ny = (v[1].z - v[0].z) * (v[2].x - v[0].x) - (v[1].x - v[0].x) * (v[2].z - v[0].z);
        const nz = (v[1].x - v[0].x) * (v[2].y - v[0].y) - (v[1].y - v[0].y) * (v[2].x - v[0].x);
        if (ny < 0.15 * Math.hypot(nx, ny, nz)) {
          // Steep, vertical or downward face: a wall (cave walls, cliff faces, rock sides, hulls).
          const w: Wall = [
            v[0].x, v[0].z, v[1].x, v[1].z, v[2].x, v[2].z,
            Math.min(v[0].y, v[1].y, v[2].y),
            Math.max(v[0].y, v[1].y, v[2].y),
          ];
          const i0 = Math.floor(Math.min(w[0], w[2], w[4]) / CELL),
            i1 = Math.floor(Math.max(w[0], w[2], w[4]) / CELL),
            j0 = Math.floor(Math.min(w[1], w[3], w[5]) / CELL),
            j1 = Math.floor(Math.max(w[1], w[3], w[5]) / CELL);
          for (let i = i0; i <= i1; i++)
            for (let j = j0; j <= j1; j++) {
              const key = this.key(i, j);
              let list = this.walls.get(key);
              if (!list) this.walls.set(key, (list = []));
              list.push(w);
            }
          continue;
        }
        const t: Tri = [v[0].x, v[0].y, v[0].z, v[1].x, v[1].y, v[1].z, v[2].x, v[2].y, v[2].z];
        const i0 = Math.floor(Math.min(t[0], t[3], t[6]) / CELL),
          i1 = Math.floor(Math.max(t[0], t[3], t[6]) / CELL),
          j0 = Math.floor(Math.min(t[2], t[5], t[8]) / CELL),
          j1 = Math.floor(Math.max(t[2], t[5], t[8]) / CELL);
        for (let i = i0; i <= i1; i++)
          for (let j = j0; j <= j1; j++) {
            const key = this.key(i, j);
            let list = this.cells.get(key);
            if (!list) this.cells.set(key, (list = []));
            list.push(t);
          }
      }
    });
  }

  /** Level the ground around the base (local verts -> world -> flatten -> local). */
  private flattenPad(mesh: THREE.Mesh, root: THREE.Object3D) {
    const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
    const toWorld = mesh.matrixWorld.clone();
    const toLocal = toWorld.clone().invert();
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(toWorld);
      const r = Math.hypot(v.x, v.z);
      if (r >= PAD_BLEND) continue;
      const t = smooth((r - PAD_FLAT) / (PAD_BLEND - PAD_FLAT));
      v.y = v.y * t - 0.02 * (1 - t);
      v.applyMatrix4(toLocal);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    pos.needsUpdate = true; // flatShading derives normals per face, so no normal rebuild needed
    mesh.geometry.computeBoundingSphere();
    void root;
  }

  /** Remove boulders that would sit inside the base. */
  private clearPad(mesh: THREE.Mesh, root: THREE.Object3D) {
    const g = mesh.geometry;
    const pos = g.attributes.position as THREE.BufferAttribute;
    const idx = g.index;
    if (!idx) return;
    const w = new THREE.Vector3();
    const keep: number[] = [];
    for (let k = 0; k < idx.count; k += 3) {
      w.fromBufferAttribute(pos, idx.getX(k)).applyMatrix4(mesh.matrixWorld);
      if (Math.hypot(w.x, w.z) < PAD_FLAT + 4) continue;
      keep.push(idx.getX(k), idx.getX(k + 1), idx.getX(k + 2));
    }
    g.setIndex(keep);
    void root;
  }
}

const SAMPLES = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];

/** Squared distance from point (x, z) to a wall's XZ triangle (0 if inside). */
function distToTri2(x: number, z: number, w: Wall) {
  const [ax, az, bx, bz, cx, cz] = w;
  const d1 = (x - bx) * (az - bz) - (ax - bx) * (z - bz),
    d2 = (x - cx) * (bz - cz) - (bx - cx) * (z - cz),
    d3 = (x - ax) * (cz - az) - (cx - ax) * (z - az);
  const neg = d1 < 0 || d2 < 0 || d3 < 0,
    pos = d1 > 0 || d2 > 0 || d3 > 0;
  if (!(neg && pos)) return 0;
  return Math.min(seg2(x, z, ax, az, bx, bz), seg2(x, z, bx, bz, cx, cz), seg2(x, z, cx, cz, ax, az));
}
function seg2(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax,
    dz = bz - az,
    l = dx * dx + dz * dz;
  let t = l > 0 ? ((px - ax) * dx + (pz - az) * dz) / l : 0;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + dx * t - px,
    qz = az + dz * t - pz;
  return qx * qx + qz * qz;
}

/** BVH needs plain float positions; the meshopt-compressed map stores them quantized. */
function prepareForBVH(g: THREE.BufferGeometry) {
  const p = g.attributes.position as THREE.BufferAttribute;
  if (!(p.array instanceof Float32Array) || p.normalized || (p as unknown as { isInterleavedBufferAttribute?: boolean }).isInterleavedBufferAttribute) {
    const a = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      a[i * 3] = p.getX(i);
      a[i * 3 + 1] = p.getY(i);
      a[i * 3 + 2] = p.getZ(i);
    }
    g.setAttribute("position", new THREE.BufferAttribute(a, 3));
  }
  (g as unknown as { computeBoundsTree: () => void }).computeBoundsTree();
}

function smooth(t: number) {
  t = Math.min(1, Math.max(0, t));
  return t * t * (3 - 2 * t);
}

function triHeight(t: Tri, x: number, z: number) {
  const [ax, ay, az, bx, by, bz, cx, cy, cz] = t;
  const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
  if (Math.abs(d) < 1e-9) return null;
  const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d;
  const l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d;
  const l3 = 1 - l1 - l2;
  if (l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) return null;
  return l1 * ay + l2 * by + l3 * cy;
}
