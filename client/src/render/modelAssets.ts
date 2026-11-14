import * as T from "three";
import {
  GLTFLoader,
  type GLTF,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Role } from "../../../shared/src/sim";

const loader = new GLTFLoader();
const templates = new Map<string, Promise<GLTF>>();
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
export const modelURL = (id: string) =>
  `${import.meta.env.BASE_URL}mars/models/${id}.glb`;
export const assetStatus = {
  loaded: new Set<string>(),
  failed: new Set<string>(),
};

/** One request per model. Geometry is immutable and shared; instance materials are owned. */
async function model(id: string) {
  let pending = templates.get(id);
  if (!pending) {
    pending = loader.loadAsync(modelURL(id));
    templates.set(id, pending);
  }
  const gltf = await pending;
  const root = gltf.scene.clone(true);
  root.name = `mars:${id}`;
  const owned = new Map<T.Material, T.Material>();
  const material = (m: T.Material) => {
    let clone = owned.get(m);
    if (!clone) {
      clone = m.clone();
      owned.set(m, clone);
    }
    return clone;
  };
  root.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    o.geometry.userData.marsShared = true;
    o.material = Array.isArray(o.material)
      ? o.material.map(material)
      : material(o.material);
    o.castShadow = o.receiveShadow = true;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (m instanceof T.MeshStandardMaterial) {
        // The greenhouse/dust shell is transparent in Blender and in the browser.
        if (m.transparent || m.opacity < 1) {
          m.depthWrite = false;
          m.side = T.DoubleSide;
          o.castShadow = false;
        }
      }
    }
  });
  assetStatus.loaded.add(id);
  return root;
}

/** Merge static opaque parts by material: the greenhouse's many leaves need few draws. */
function batchStatic(root: T.Group) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  const buckets = new Map<T.Material, T.BufferGeometry[]>();
  const remove: T.Mesh[] = [];
  root.traverse((o) => {
    if (
      !(o instanceof T.Mesh) ||
      Array.isArray(o.material) ||
      o.material.transparent
    )
      return;
    // Keep things that the game manipulates, such as dust, dish joints and crew limbs.
    const geo = o.geometry.index
      ? o.geometry.toNonIndexed()
      : o.geometry.clone();
    geo.applyMatrix4(inverse.clone().multiply(o.matrixWorld));
    for (const key of Object.keys(geo.attributes))
      if (key !== "position" && key !== "normal" && key !== "uv")
        geo.deleteAttribute(key);
    if (!geo.getAttribute("normal")) geo.computeVertexNormals();
    if (!geo.getAttribute("uv"))
      geo.setAttribute(
        "uv",
        new T.Float32BufferAttribute(
          new Float32Array(geo.getAttribute("position").count * 2),
          2,
        ),
      );
    const list = buckets.get(o.material) || [];
    list.push(geo);
    buckets.set(o.material, list);
    remove.push(o);
  });
  for (const [material, geometries] of buckets) {
    const merged = mergeGeometries(geometries);
    for (const geo of geometries) geo.dispose();
    if (!merged) continue;
    merged.userData.marsOwned = true;
    const mesh = new T.Mesh(merged, material);
    mesh.name = `Batched ${material.name}`;
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
  }
  for (const o of remove) o.removeFromParent();
}

export type ModelOptions = {
  width?: number;
  height?: number;
  size?: number;
  center?: boolean;
  rotation?: number;
  batch?: boolean;
  offset?: { x?: number; y?: number; z?: number };
  ready?: (root: T.Group) => void;
};

/** Fit an authored model inside a stable wrapper; gameplay/collision objects stay intact. */
export async function createModel(id: string, options: ModelOptions = {}) {
  const root = await model(id);
  if (options.batch) batchStatic(root);
  root.rotation.y = options.rotation || 0;
  root.updateMatrixWorld(true);
  let bounds = new T.Box3().setFromObject(root);
  const size = bounds.getSize(new T.Vector3());
  const scale = options.width
    ? options.width / size.x
    : options.height
      ? options.height / size.y
      : options.size
        ? options.size / Math.max(size.x, size.z)
        : 1;
  root.scale.multiplyScalar(scale);
  root.updateMatrixWorld(true);
  bounds = new T.Box3().setFromObject(root);
  if (options.center !== false) {
    const center = bounds.getCenter(new T.Vector3());
    root.position.x -= center.x;
    root.position.z -= center.z;
  }
  root.position.y -= bounds.min.y;
  root.position.add(
    new T.Vector3(
      options.offset?.x || 0,
      options.offset?.y || 0,
      options.offset?.z || 0,
    ),
  );
  const wrapper = new T.Group();
  wrapper.name = `model:${id}`;
  wrapper.userData.marsModel = id;
  wrapper.add(root);
  options.ready?.(root);
  return wrapper;
}

/** Replace only visuals, after load succeeds. Existing simulation-facing references survive. */
export function replaceVisual(
  target: T.Object3D,
  id: string,
  options: ModelOptions = {},
) {
  const fallback: T.Mesh[] = [];
  target.traverse((o) => {
    if (o instanceof T.Mesh) fallback.push(o);
  });
  target.userData.marsRequested = id;
  const promise = createModel(id, options)
    .then((visual) => {
      if (target.userData.marsDisposed) {
        disposeModel(visual);
        return;
      }
      for (const o of fallback) o.visible = false;
      target.add(visual);
      target.userData.marsModel = id;
      target.userData.marsVisual = visual;
    })
    .catch((error) => {
      assetStatus.failed.add(id);
      console.warn(`Keeping procedural fallback for ${id}`, error);
    });
  target.userData.marsPromise = promise;
  return promise;
}

export function disposeModel(root: T.Object3D) {
  root.traverse((o) => {
    o.userData.marsDisposed = true;
    if (!(o instanceof T.Mesh)) return;
    if (o.geometry.userData.marsOwned || !o.geometry.userData.marsShared)
      o.geometry.dispose();
    for (const m of Array.isArray(o.material) ? o.material : [o.material])
      m.dispose();
  });
}

/** Native Blender rigid-part pivots are adapted to the existing gait/jump/carry rig. */
export function installAstronaut(target: T.Group, color: number) {
  const given = new T.Color(color);
  const suits = [
    ["Orange", 0xf97316],
    ["Blue", 0x3b82f6],
    ["Green", 0x22c55e],
    ["Yellow", 0xeab308],
  ] as const;
  const distance = (hex: number) => {
    const c = new T.Color(hex);
    return (given.r - c.r) ** 2 + (given.g - c.g) ** 2 + (given.b - c.b) ** 2;
  };
  const suit = [...suits].sort((a, b) => distance(a[1]) - distance(b[1]))[0][0];
  const id = `Astronaut_${suit}`;
  target.userData.marsRequested = id;
  target.userData.marsPromise = model(id)
    .then((root) => {
      if (target.userData.marsDisposed) {
        disposeModel(root);
        return;
      }
      const nodes = new Map<string, T.Object3D>();
      // Blender assigns .001/.003 suffixes when variants share a generation session.
      root.traverse((o) => nodes.set(normalize(o.name).replace(/\d+$/, ""), o));
      const rig = new T.Group();
      rig.name = "rig";
      const hips = new T.Group();
      hips.name = "hips";
      hips.position.y = 0.8;
      rig.add(hips);
      const upper = new T.Group();
      upper.name = "upper";
      hips.add(upper);
      const move = (name: string, alias: string, parent: T.Object3D) => {
        const o = nodes.get(normalize(name));
        if (!o) throw Error(`Missing astronaut pivot ${name}`);
        root.updateMatrixWorld(true);
        rig.updateMatrixWorld(true);
        parent.attach(o);
        o.name = alias;
        return o;
      };
      const body = move("Body", "body", upper);
      const head = move("Helmet", "head", upper);
      const pack = move("Backpack", "pack", upper);
      for (const side of ["Left", "Right"]) {
        const suffix = side === "Left" ? "L" : "R";
        const arm = move(side + " Arm", "arm" + suffix, upper);
        const elbow = new T.Group();
        elbow.name = "elbow" + suffix;
        elbow.position.y = -0.34;
        arm.add(elbow);
        rig.updateMatrixWorld(true);
        for (const o of [...arm.children])
          if (/lowersleeve|glove|cuff/i.test(normalize(o.name)))
            elbow.attach(o);
        const leg = move(side + " Leg", "leg" + suffix, hips);
        const knee = new T.Group();
        knee.name = "knee" + suffix;
        knee.position.y = -0.31;
        leg.add(knee);
        rig.updateMatrixWorld(true);
        for (const o of [...leg.children])
          if (/boot|ankle/i.test(o.name)) knee.attach(o);
      }
      const visor = [...nodes.values()].find((o) =>
        normalize(o.name).startsWith("visorseparate"),
      );
      if (visor) visor.name = "visor";
      const carried = target.getObjectByName("carried");
      const tool = target.getObjectByName("wrench");
      const lamp = target.getObjectByName("packLight");
      if (carried) {
        carried.removeFromParent();
        carried.name = "carry-fallback";
        const holder = new T.Group();
        holder.name = "carried";
        holder.position.copy(carried.position);
        holder.visible = carried.visible;
        carried.position.set(0, 0, 0);
        carried.visible = true;
        holder.add(carried);
        upper.add(holder);
        void replaceVisual(holder, "Supply_Crate", { width: 0.6, batch: true });
      }
      if (tool) {
        tool.removeFromParent();
        rig.getObjectByName("elbowR")!.add(tool);
      }
      if (lamp) {
        lamp.removeFromParent();
        lamp.position.set(0.12, 0.15, -0.18);
        pack.add(lamp);
      }
      const previous = [...target.children];
      target.clear();
      target.add(rig);
      for (const o of previous) disposeModel(o);
      target.userData.marsModel = id;
      target.userData.marsBody = body;
      target.userData.marsReady = true;
      updateRoleBadge(target, target.userData.wantedRole || "Engineer");
      void head;
    })
    .catch((error) => {
      assetStatus.failed.add(id);
      console.warn(`Keeping astronaut fallback for ${id}`, error);
    });
}

export function updateRoleBadge(actor: T.Group, role: Role) {
  actor.userData.wantedRole = role;
  if (!actor.userData.marsReady || actor.userData.marsRole === role) return;
  actor.userData.marsRole = role;
  const body = actor.userData.marsBody as T.Object3D;
  void model(`Badge_${role}`)
    .then((badge) => {
      if (actor.userData.marsDisposed || actor.userData.marsRole !== role) {
        disposeModel(badge);
        return;
      }
      for (const child of [...body.children])
        if (
          normalize(child.name).startsWith("badge") ||
          child.userData.crewBadge
        ) {
          child.removeFromParent();
          disposeModel(child);
        }
      badge.userData.crewBadge = true;
      badge.rotation.x = Math.PI / 2;
      badge.scale.setScalar(0.24);
      badge.position.set(-0.13, 0.015, 0.212);
      body.add(badge);
    })
    .catch(() => {
      actor.userData.marsRole = "";
    });
}

export function updatePanelModel(
  panel: T.Group,
  clean: number,
  covered: boolean,
) {
  const visual = panel.userData.marsVisual as T.Group | undefined;
  if (!visual) return;
  if (
    panel.userData.marsClean === clean &&
    panel.userData.marsCovered === covered
  )
    return;
  panel.userData.marsClean = clean;
  panel.userData.marsCovered = covered;
  visual.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    if (/regolithpatch|dustgranule/.test(normalize(o.name))) {
      o.visible = clean < 0.98;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        m.transparent = true;
        m.opacity = T.MathUtils.clamp((1 - clean) * 1.5, 0, 1);
        m.depthWrite = false;
      }
    } else
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!(m instanceof T.MeshStandardMaterial)) continue;
        m.userData.originalColor ||= m.color.clone();
        m.color
          .copy(m.userData.originalColor)
          .lerp(new T.Color(0x574a3b), covered ? 0.8 : 0);
      }
  });
  let tarp = visual.getObjectByName("Storm cover");
  if (!tarp) {
    const material = new T.MeshStandardMaterial({
      color: 0x81715a,
      roughness: 0.95,
    });
    tarp = new T.Mesh(new T.BoxGeometry(5.0, 0.08, 2.05), material);
    tarp.name = "Storm cover";
    tarp.position.set(0, 1.49, -0.28);
    tarp.rotation.x = -0.42;
    visual.add(tarp);
  }
  tarp.visible = covered;
}

export function updateDishModel(
  dish: T.Object3D,
  aligned: boolean,
  time: number,
  reduced: boolean,
) {
  if (!dish.userData.marsVisual) return;
  let pivot = dish.userData.marsDishPivot as T.Object3D | undefined;
  if (!pivot) {
    (dish.userData.marsVisual as T.Group).traverse((o) => {
      if (normalize(o.name).includes("azimuthrotationpivot")) pivot = o;
    });
    dish.userData.marsDishPivot = pivot;
  }
  if (pivot)
    pivot.rotation.y =
      (aligned ? 0.55 : -0.35) +
      (aligned || reduced ? 0 : Math.sin(time * 0.3) * 0.12);
}
