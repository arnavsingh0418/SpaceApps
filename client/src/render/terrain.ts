import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

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
const PAD_FLAT = 22; // fully flat radius (m)
const PAD_BLEND = 36; // blends back into the terrain by this radius
const CELL = 4; // height lookup grid cell (m)

type Tri = [number, number, number, number, number, number, number, number, number];

export class Terrain {
  group = new THREE.Group();
  ready = false;
  private cells = new Map<number, Tri[]>();

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
        if (o instanceof THREE.Mesh && /Terrain|Mountain/i.test(o.name + " " + (o.parent?.name || "")))
          this.index(o);
      });
      this.ready = true;
      return this;
    });
  }

  /** Walkable height at game (x, z). 0 on the landing pad. */
  heightAt(x: number, z: number) {
    if (!this.ready) return 0;
    return this.rawAt(x, z);
  }

  private rawAt(x: number, z: number) {
    const list = this.cells.get(this.key(Math.floor(x / CELL), Math.floor(z / CELL)));
    let best = -Infinity;
    if (list)
      for (const t of list) {
        const y = triHeight(t, x, z);
        if (y !== null && y > best) best = y;
      }
    return best === -Infinity ? 0 : best;
  }

  private key(i: number, j: number) {
    return (i + 1000) * 4000 + (j + 1000);
  }

  /** Bucket every upward-facing triangle of an object (in world space) into grid cells. */
  private index(obj: THREE.Object3D, ox = 0, oy = 0, oz = 0) {
    obj.updateMatrixWorld(true);
    obj.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
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
        if (Math.abs(ny) < 0.15 * Math.hypot(nx, ny, nz)) continue; // skip walls
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
