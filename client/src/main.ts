import * as THREE from "three";
import { createTerrain } from "./render/terrain";

declare global {
  interface Window {
    render_game_to_text: () => string;
    advanceTime: (milliseconds: number) => void;
  }
}

try {
  const canvas = document.querySelector<HTMLCanvasElement>("#world")!;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe0a982);
  scene.fog = new THREE.Fog(0xd99a72, 48, 135);
  const camera = new THREE.PerspectiveCamera(44, innerWidth / innerHeight, 0.1, 280);
  camera.position.set(18, 13, 26);
  camera.lookAt(0, 1, -3);

  // Lighting and camera extracted from the initial source world renderer.
  scene.add(new THREE.HemisphereLight(0xfff0e0, 0x7a3a20, 1.1));
  const sun = new THREE.DirectionalLight(0xffe2c4, 2.5);
  sun.position.set(-18, 30, 15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38 });
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  const { ground, rocks } = createTerrain(scene);

  const render = () => renderer.render(scene, camera);
  // The bootstrap is a static terrain preview, so render only when needed.
  render();
  addEventListener("resize", () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    render();
  });
  window.advanceTime = () => render();
  window.render_game_to_text = () =>
    JSON.stringify({
      mode: "terrain-preview",
      coordinates: "metres; origin at landing area, +Y up, +X right, +Z south",
      terrain: { width: 220, depth: 220, flatRadius: 30, vertices: ground.geometry.attributes.position.count },
      rocks: rocks.count,
      camera: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
    });
} catch (error) {
  const message = document.querySelector<HTMLParagraphElement>("#error")!;
  message.hidden = false;
  message.textContent = "The Mars preview needs a browser with WebGL 2 support. Please check that hardware acceleration is enabled.";
  console.error(error);
}
