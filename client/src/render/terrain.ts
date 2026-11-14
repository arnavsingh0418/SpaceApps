import * as THREE from "three";

// Extracted from TEST_nasa 3fa3c0a (client/src/render/world.ts).
// This is the original procedural terrain, before the later Blender map import.
export function createTerrain(scene: THREE.Scene) {
  const geometry = new THREE.PlaneGeometry(220, 220, 80, 80);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const radius = Math.hypot(x, z);
    positions.setY(
      i,
      radius < 30
        ? -0.04
        : Math.sin(x * 0.15) * Math.cos(z * 0.12) * 1.5 +
            Math.max(0, 6 - Math.abs(radius - 43) * 0.5),
    );
  }
  geometry.computeVertexNormals();
  const ground = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: 0xc4562a,
      flatShading: true,
      roughness: 1,
    }),
  );
  ground.receiveShadow = true;
  scene.add(ground);

  const rocks = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ color: 0x803a23, flatShading: true }),
    95,
  );
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 95; i++) {
    const angle = i * 2.39996;
    const radius = 18 + (i % 17) * 1.9;
    dummy.position.set(Math.cos(angle) * radius, 0.12, Math.sin(angle) * radius);
    dummy.scale.setScalar(0.2 + (i % 7) * 0.14);
    dummy.rotation.set(i, i * 0.7, i * 0.2);
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
  }
  rocks.castShadow = rocks.receiveShadow = true;
  scene.add(rocks);
  return { ground, rocks };
}
