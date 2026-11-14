import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const loader = new GLTFLoader();
const templates = new Map<string, ReturnType<GLTFLoader["loadAsync"]>>();

export function modelURL(id: string) {
  return `${import.meta.env.BASE_URL}mars/models/${id}.glb`;
}

/** Static models share geometry and cache requests, but own their materials. */
export async function loadModel(id: string, footprint: number, rotation = 0) {
  let request = templates.get(id);
  if (!request) {
    request = loader.loadAsync(modelURL(id));
    templates.set(id, request);
    request.catch(() => templates.delete(id));
  }
  const root = (await request).scene.clone(true);
  const materials = new Map<THREE.Material, THREE.Material>();
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const originals: THREE.Mesh[] = [];
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  root.traverse((part) => {
    if (!(part instanceof THREE.Mesh)) return;
    const own = (source: THREE.Material) => {
      let material = materials.get(source);
      if (!material) {
        material = source.clone();
        materials.set(source, material);
      }
      return material;
    };
    part.material = Array.isArray(part.material)
      ? part.material.map(own)
      : own(part.material);
    part.castShadow = part.receiveShadow = true;
    if (Array.isArray(part.material)) return;
    if (part.material.transparent || part.material.opacity < 1) {
      part.material.depthWrite = false;
      part.material.side = THREE.DoubleSide;
      part.castShadow = false;
      return;
    }
    // These are static scene props. Merge small opaque details by material;
    // preserve transparent glass as separate meshes for correct depth sorting.
    const geometry = part.geometry.index
      ? part.geometry.toNonIndexed()
      : part.geometry.clone();
    geometry.applyMatrix4(inverse.clone().multiply(part.matrixWorld));
    for (const key of Object.keys(geometry.attributes))
      if (!["position", "normal", "uv"].includes(key))
        geometry.deleteAttribute(key);
    if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
    if (!geometry.getAttribute("uv"))
      geometry.setAttribute(
        "uv",
        new THREE.Float32BufferAttribute(
          new Float32Array(geometry.attributes.position.count * 2),
          2,
        ),
      );
    const list = buckets.get(part.material) || [];
    list.push(geometry);
    buckets.set(part.material, list);
    originals.push(part);
  });
  for (const [material, geometries] of buckets) {
    const geometry = mergeGeometries(geometries);
    geometries.forEach((part) => part.dispose());
    if (!geometry) throw new Error(`Cannot batch ${id}`);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
  }
  originals.forEach((part) => part.removeFromParent());
  root.rotation.y = rotation;
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  root.scale.multiplyScalar(footprint / Math.max(size.x, size.z));
  root.updateMatrixWorld(true);
  bounds.setFromObject(root);
  const center = bounds.getCenter(new THREE.Vector3());
  root.position.set(-center.x, -bounds.min.y, -center.z);
  const wrapper = new THREE.Group();
  wrapper.name = id;
  wrapper.add(root);
  return wrapper;
}
