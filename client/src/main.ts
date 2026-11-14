import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createTerrain } from "./render/terrain";
import { createBase, stations } from "./render/base";
import "./style.css";

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
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe0a982);
  scene.fog = new THREE.Fog(0xd99a72, 60, 145);
  const camera = new THREE.PerspectiveCamera(
    44,
    innerWidth / innerHeight,
    0.1,
    280,
  );
  const controls = new OrbitControls(camera, canvas);
  controls.minDistance = 4;
  controls.maxDistance = 65;
  controls.maxPolarAngle = Math.PI / 2 - 0.04;
  controls.listenToKeyEvents(canvas);
  controls.target.set(0, 1, -5);
  camera.position.set(25, 22, 34);
  controls.update();

  scene.add(new THREE.HemisphereLight(0xfff0e0, 0x7a3a20, 1.8));
  const sun = new THREE.DirectionalLight(0xffe2c4, 3);
  sun.position.set(-18, 30, 15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -38,
    right: 38,
    top: 38,
    bottom: -38,
  });
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  const { ground, rocks } = createTerrain(scene);
  const render = () => renderer.render(scene, camera);
  controls.addEventListener("change", render);

  const status = document.querySelector<HTMLParagraphElement>("#load-status")!;
  const base = createBase(scene, () => {
    status.textContent = base.state.failed.length
      ? `${base.state.loaded} models loaded · ${base.state.failed.length} unavailable. Reload to retry.`
      : base.state.loaded === base.state.total
        ? "Outpost ready · Select a station to explore"
        : `Preparing outpost · ${base.state.loaded}/${base.state.total}`;
    render();
  });
  const heading = document.querySelector<HTMLHeadingElement>("#station-title")!;
  const tag = document.querySelector<HTMLElement>("#station-tag")!;
  const description = document.querySelector<HTMLParagraphElement>(
    "#station-description",
  )!;
  const quiz = document.querySelector<HTMLDetailsElement>("#solar-quiz")!;
  const form = quiz.querySelector<HTMLFormElement>("form")!;
  const feedback = quiz.querySelector<HTMLElement>("#solar-feedback")!;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const correct = new FormData(form).get("answer") === "0";
    feedback.textContent = correct
      ? "Correct. Dust blocks sunlight, so removing it helps the panels produce more power."
      : "Try again. Which choice lets more sunlight reach the panel?";
  });
  let selected = "overview";
  function focus(key: string) {
    const station = stations.find((s) => s.key === key);
    selected = station?.key || "overview";
    quiz.hidden = selected !== "solar";
    if (quiz.hidden) {
      quiz.open = false;
      form.reset();
      feedback.textContent = "";
    }
    if (station) {
      controls.target.set(station.position[0], 1.3, station.position[2]);
      camera.position
        .copy(controls.target)
        .add(new THREE.Vector3(...station.view));
      heading.textContent = station.title;
      tag.textContent = station.tag;
      description.textContent = station.description;
    } else {
      controls.target.set(0, 1, -5);
      camera.position.set(25, 22, 34);
      heading.textContent = "A new home on Mars";
      tag.textContent = "OUTPOST 01 / GALE CRATER";
      description.textContent =
        "Explore your crew’s first outpost. A habitat to call home, sunlight for power and a workbench for the next big idea.";
    }
    document
      .querySelectorAll<HTMLButtonElement>("[data-focus]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.focus === selected),
        ),
      );
    controls.update();
    render();
  }
  document
    .querySelectorAll<HTMLButtonElement>("[data-focus]")
    .forEach((button) =>
      button.addEventListener("click", () => focus(button.dataset.focus!)),
    );
  addEventListener("keydown", (event) => {
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return;
    if (event.key.toLowerCase() === "r") focus("overview");
  });

  // Ignore drags, and resolve a clicked mesh to its station wrapper.
  const pointer = new THREE.Vector2();
  const down = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  canvas.addEventListener("pointerdown", (event) =>
    down.set(event.clientX, event.clientY),
  );
  canvas.addEventListener("pointerup", (event) => {
    if (down.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 5)
      return;
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    let object: THREE.Object3D | null =
      raycaster.intersectObjects(base.root.children, true)[0]?.object || null;
    while (object && !object.userData.station) object = object.parent;
    if (object) focus(object.userData.station);
  });
  addEventListener("resize", () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    render();
  });
  // Static scene: no continuous render loop or background GPU work.
  render();
  window.advanceTime = () => render();
  window.render_game_to_text = () =>
    JSON.stringify({
      mode: "mars-outpost-preview",
      selected,
      coordinates: "metres; origin at landing area, +Y up, +X right, +Z south",
      terrain: {
        width: 220,
        depth: 220,
        flatRadius: 30,
        vertices: ground.geometry.attributes.position.count,
      },
      rocks: rocks.count,
      models: base.state,
      stations: stations.map(({ key, position }) => ({ key, position })),
      camera: {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
      },
    });
  void base.ready.then(render);
} catch (error) {
  const message = document.querySelector<HTMLParagraphElement>("#error")!;
  message.hidden = false;
  message.textContent =
    "The Mars preview could not start. Try reloading with WebGL 2 and hardware acceleration enabled.";
  console.error(error);
}
