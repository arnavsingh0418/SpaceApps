import * as THREE from "three";
import {
  GLTFLoader,
  type GLTF,
} from "three/examples/jsm/loaders/GLTFLoader.js";

export const sandstormURL = () =>
  `${import.meta.env.BASE_URL}mars/vfx/Mars_Sandstorm.glb`;
export const SANDSTORM_LAYER = 1;

/** A local weather volume made of Blender-authored, alpha-textured mesh layers.
 * The embedded 12-second clip supplies all wind transport. No physics/colliders.
 */
export class Sandstorm {
  readonly group = new THREE.Group();
  status: "idle" | "loading" | "ready" | "failed" = "idle";
  loading: Promise<void> | null = null;
  mixer: THREE.AnimationMixer | null = null;
  private disposed = false;
  private reduced = false;
  private strength = 0;
  private model: THREE.Group | null = null;
  private grains: THREE.Object3D[] = [];
  private materials: { material: THREE.MeshBasicMaterial; opacity: number }[] =
    [];

  constructor(private scene: THREE.Scene) {
    this.group.name = "Blender sandstorm VFX";
    this.group.visible = false;
    this.group.rotation.y = -0.2;
    this.group.scale.set(1.6, 1.6, 1.6);
    scene.add(this.group);
  }

  private load() {
    this.status = "loading";
    this.loading = new GLTFLoader()
      .loadAsync(sandstormURL())
      .then((gltf) => {
        if (this.disposed) {
          release(gltf.scene);
          return;
        }
        this.install(gltf);
      })
      .catch((error) => {
        this.status = "failed";
        // Existing procedural wind particles and the sky still work if this fails.
        console.warn(
          "Blender sandstorm unavailable; keeping wind-particle fallback",
          error,
        );
      });
  }

  private install(gltf: GLTF) {
    if (!gltf.animations.length) {
      release(gltf.scene);
      throw new Error("Sandstorm GLB has no wind animation");
    }
    const owned = new Map<THREE.Material, THREE.MeshBasicMaterial>();
    gltf.scene.traverse((object) => {
      // The gameplay camera enables this layer; the static minimap camera does not.
      object.layers.set(SANDSTORM_LAYER);
      if (object.name.startsWith("Sand_Streaks")) this.grains.push(object);
      if (!(object instanceof THREE.Mesh)) return;
      const convert = (source: THREE.Material) => {
        let material = owned.get(source);
        if (!material) {
          const original = source as THREE.MeshStandardMaterial;
          // Unlit soft dust avoids flat card lighting and costs no extra shadow pass.
          material = new THREE.MeshBasicMaterial({
            color: original.color,
            map: original.map,
            transparent: true,
            opacity: source.opacity,
            alphaTest: 0.001,
            depthWrite: false,
            depthTest: true,
            side: THREE.DoubleSide,
            fog: true,
          });
          owned.set(source, material);
          this.materials.push({ material, opacity: source.opacity });
          source.dispose();
        }
        return material;
      };
      object.material = Array.isArray(object.material)
        ? object.material.map(convert)
        : convert(object.material);
      object.castShadow = object.receiveShadow = false;
      object.frustumCulled = false;
    });
    this.model = gltf.scene;
    this.group.add(gltf.scene);
    this.mixer = new THREE.AnimationMixer(gltf.scene);
    for (const clip of gltf.animations) this.mixer.clipAction(clip).play();
    // Start with the three billow layers staggered, including when reduced motion
    // is already enabled before the first lazy download finishes.
    this.mixer.setTime(4);
    this.status = "ready";
    this.applyAppearance();
  }

  private applyAppearance() {
    this.group.visible = this.status === "ready" && this.strength > 0.01;
    for (const { material, opacity } of this.materials)
      material.opacity = opacity * this.strength * (this.reduced ? 0.65 : 1);
    for (const grain of this.grains) grain.visible = !this.reduced;
  }

  update(
    dt: number,
    strength: number,
    origin: { x: number; y: number; z: number },
    reduced = false,
  ) {
    if (this.disposed) return;
    this.strength = THREE.MathUtils.clamp(strength, 0, 1);
    this.reduced = reduced;
    this.group.position.set(origin.x, origin.y + 0.04, origin.z);
    if (this.strength > 0.01 && this.status === "idle") this.load();
    this.applyAppearance();
    if (this.group.visible && !reduced)
      this.mixer?.update(Math.max(0, Math.min(dt, 0.1)));
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.mixer?.stopAllAction();
    if (this.model) {
      this.mixer?.uncacheRoot(this.model);
      release(this.model);
    }
    this.group.removeFromParent();
    this.group.clear();
    this.materials = [];
    this.grains = [];
  }
}

/** The weather GLB has its own resources, separate from the shared prop cache. */
function release(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material]) {
      materials.add(material);
      const map = (material as THREE.MeshBasicMaterial).map;
      if (map) textures.add(map);
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  const sources = new Set<unknown>();
  textures.forEach((texture) => {
    texture.dispose();
    sources.add(texture.source?.data);
  });
  sources.forEach((source) => {
    if (
      source &&
      typeof source === "object" &&
      "close" in source &&
      typeof source.close === "function"
    )
      source.close();
  });
}
