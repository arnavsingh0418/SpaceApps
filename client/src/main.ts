import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createTerrain } from "./render/terrain";
import { Terrain } from "./render/marsTerrain";
import { createBase, stations } from "./render/base";
import { createReturnShip } from "./render/ship";
import { createShipWalk } from "./shipWalk";
import { createConstruction, recipeIds, recipes, type Structure } from "./construction";
import { connectPowerPlan } from "./powerPlan";
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
  const mars = new Terrain();
  const groundHeight = (x: number, z: number) =>
    mars.ready ? mars.heightAt(x, z) : -0.035;
  let mapFailed = false;

  const ship = createReturnShip();
  const shipScene = new THREE.Scene();
  shipScene.background = new THREE.Color(0xd8d8d2);
  shipScene.add(ship.root);
  const shipHud = document.querySelector<HTMLElement>("#ship-hud")!;
  const shipLook = document.querySelector<HTMLElement>("#ship-look")!;
  const locationBadge = document.querySelector<HTMLElement>("#location-badge")!;
  const help = document.querySelector<HTMLElement>(".help")!;
  const locationHome = locationBadge.innerHTML;
  const helpHome = help.innerHTML;
  const panel = document.querySelector<HTMLElement>("#panel")!;
  let shipMode = false;
  let shipFrame = 0;
  const shipClock = new THREE.Clock();
  const render = () => renderer.render(shipMode ? shipScene : scene, camera);
  controls.addEventListener("change", render);
  const walk = createShipWalk(camera, canvas, ship.occupied, (locked) => {
    shipLook.hidden = locked;
  });

  const status = document.querySelector<HTMLParagraphElement>("#load-status")!;
  const base = createBase(scene, () => {
    status.textContent = base.state.failed.length
      ? `${base.state.loaded} models loaded · ${base.state.failed.length} unavailable. Reload to retry.`
      : base.state.loaded === base.state.total
        ? "Outpost ready · Select a station to explore"
        : `Preparing outpost · ${base.state.loaded}/${base.state.total}`;
    if (mapFailed) status.textContent += " · Using backup terrain";
    render();
  }, groundHeight);
  void mars.load(scene).then(() => {
    base.groundModels();
    ground.visible = rocks.visible = false;
    scene.fog = new THREE.Fog(0xd99a72, 110, 620);
    camera.far = 900;
    camera.updateProjectionMatrix();
    render();
  }, (error) => {
    mapFailed = true;
    mars.group.removeFromParent();
    status.textContent += " · Using backup terrain";
    console.warn("Could not load the Mars map", error);
  });
  const heading = document.querySelector<HTMLHeadingElement>("#station-title")!;
  const tag = document.querySelector<HTMLElement>("#station-tag")!;
  const description = document.querySelector<HTMLParagraphElement>(
    "#station-description",
  )!;
  const construction = createConstruction();
  const workbench = document.querySelector<HTMLElement>("#construction")!;
  const stock = workbench.querySelector<HTMLElement>("#construction-stock")!;
  const recipeList = workbench.querySelector<HTMLElement>("#construction-recipes")!;
  const buildStatus = workbench.querySelector<HTMLElement>("#construction-status")!;
  const cacheButtons = workbench.querySelectorAll<HTMLButtonElement>("[data-cache]");
  recipeList.innerHTML = recipeIds.map((id) => {
    const { name, cost } = recipes[id];
    const supplies = Object.entries(cost).map(([item, amount]) => amount + " " + item).join(" · ");
    return '<div class="recipe"><b>' + name + '</b><small>' + supplies +
      '</small><button type="button" data-build="' + id + '">Build</button><small data-build-status></small></div>';
  }).join("");
  const buildButtons = recipeList.querySelectorAll<HTMLButtonElement>("[data-build]");
  function refreshWorkbench() {
    stock.textContent = Object.entries(construction.stock).map(([item, amount]) => amount + " " + item).join(" · ");
    cacheButtons.forEach((button) => { button.disabled = construction.collected.has(button.dataset.cache!); });
    buildButtons.forEach((button) => {
      const id = button.dataset.build as Structure;
      const reason = construction.problem(id);
      button.disabled = !!reason || !base.constructionReady(id);
      button.parentElement!.querySelector("[data-build-status]")!.textContent =
        reason || (button.disabled ? "Waiting for the model" : "Ready to build");
    });
  }
  connectPowerPlan(construction, refreshWorkbench);
  cacheButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const cache = button.dataset.cache!;
      if (!construction.collect(cache)) return;
      base.hideCache(cache);
      buildStatus.textContent = "Supplies stored.";
      refreshWorkbench();
      render();
    });
  });
  buildButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.build as Structure;
      if (!base.constructionReady(id) || !construction.build(id)) return;
      base.showStructure(id);
      buildStatus.textContent = recipes[id].name + " built.";
      refreshWorkbench();
      render();
    });
  });

  const quizzes = Array.from(document.querySelectorAll<HTMLDetailsElement>("[data-quiz]"), (quiz) => {
    const form = quiz.querySelector<HTMLFormElement>("form")!;
    const feedback = quiz.querySelector<HTMLElement>("[data-success]")!;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const correct = !!form.querySelector("[data-correct]:checked");
      feedback.textContent = correct
        ? feedback.dataset.success!
        : "Try again. Choose another answer.";
      if (correct) {
        construction.learned.add(quiz.dataset.quiz!);
        refreshWorkbench();
      }
    });
    return { quiz, form, feedback };
  });
  let selected = "overview";
  function focus(key: string) {
    const station = stations.find((s) => s.key === key);
    selected = station?.key || "overview";
    workbench.hidden = selected !== "workbench";
    if (!workbench.hidden) refreshWorkbench();
    for (const { quiz, form, feedback } of quizzes) {
      quiz.hidden = selected !== quiz.dataset.quiz;
      if (quiz.hidden) {
        quiz.open = false;
        form.reset();
        feedback.textContent = "";
      }
    }
    if (station) {
      const [x, offset, z] = station.position;
      controls.target.set(x, groundHeight(x, z) + offset + 1.3, z);
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
        "Explore your crew’s first outpost. A habitat to call home, sunlight for power and a workbench for the next big idea. Board the return ship to walk the cabin on the way to Earth.";
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
    if (shipMode) {
      if (event.key.toLowerCase() === "b") leaveShip();
      return;
    }
    if (event.key.toLowerCase() === "r") focus("overview");
  });

  function boardShip() {
    if (shipMode) return;
    shipMode = true;
    controls.enabled = false;
    document.querySelector<HTMLDialogElement>("#power-dialog")?.close();
    panel.hidden = true;
    document.body.classList.add("aboard");
    shipHud.hidden = false;
    shipLook.hidden = false;
    locationBadge.innerHTML = "EARTH <strong> / </strong> APPROACH";
    help.innerHTML =
      "<strong>Inside the return ship.</strong><br />WASD walk · Mouse to look · Shift to hurry<br />Esc releases the mouse · B back to the outpost";
    const previousFov = camera.fov;
    camera.userData.homeFov = previousFov;
    camera.fov = 86;
    camera.near = 0.05;
    camera.updateProjectionMatrix();
    camera.position.copy(ship.spawn);
    walk.look(0, -0.04);
    walk.setActive(true);
    shipClock.getDelta();
    if (!shipFrame) shipFrame = requestAnimationFrame(flyShip);
  }

  function leaveShip() {
    if (!shipMode) return;
    shipMode = false;
    walk.setActive(false);
    walk.unlock();
    if (shipFrame) cancelAnimationFrame(shipFrame);
    shipFrame = 0;
    shipHud.hidden = true;
    document.body.classList.remove("aboard");
    panel.hidden = false;
    locationBadge.innerHTML = locationHome;
    help.innerHTML = helpHome;
    camera.fov = camera.userData.homeFov || 44;
    camera.near = 0.1;
    camera.updateProjectionMatrix();
    controls.enabled = true;
    focus("overview");
  }

  function flyShip() {
    if (!shipMode) {
      shipFrame = 0;
      return;
    }
    shipFrame = requestAnimationFrame(flyShip);
    const dt = Math.min(shipClock.getDelta(), 0.05);
    walk.update(dt);
    ship.earth.rotation.y += dt * 0.08;
    const pulse = 0.72 + Math.sin(performance.now() * 0.004) * 0.12;
    for (const display of ship.displays) display.emissiveIntensity = pulse;
    renderer.render(shipScene, camera);
  }

  document.querySelector<HTMLButtonElement>("#board-ship")!.addEventListener("click", () => {
    boardShip();
    canvas.requestPointerLock?.();
  });
  document.querySelector<HTMLButtonElement>("#leave-ship")!.addEventListener("click", leaveShip);

  // Ignore drags, and resolve a clicked mesh to its station wrapper.
  const pointer = new THREE.Vector2();
  const down = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  canvas.addEventListener("pointerdown", (event) => {
    down.set(event.clientX, event.clientY);
    if (shipMode) shipLook.hidden = true;
  });
  canvas.addEventListener("pointerup", (event) => {
    if (down.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 5)
      return;
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    if (shipMode) return;
    raycaster.setFromCamera(pointer, camera);
    let object: THREE.Object3D | null =
      raycaster.intersectObjects(base.root.children.filter((model) => model.visible), true)[0]?.object || null;
    while (object && !object.userData.station && !object.userData.board) object = object.parent;
    if (object?.userData.board) {
      boardShip();
      canvas.requestPointerLock?.();
      return;
    }
    if (object) focus(object.userData.station);
  });
  addEventListener("resize", () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    render();
  });
  // The outpost stays static. The return ship renders only while you are aboard.
  render();
  window.advanceTime = (milliseconds: number) => {
    if (!shipMode) {
      render();
      return;
    }
    walk.update(milliseconds / 1000);
    renderer.render(shipScene, camera);
  };
  window.render_game_to_text = () =>
    JSON.stringify({
      mode: shipMode ? "earth-return-ship" : "mars-outpost-preview",
      selected,
      coordinates: "metres; origin at landing area, +Y up, +X right, +Z south",
      terrain: mars.ready
        ? { kind: "blender-map", originHeight: groundHeight(0, 0) }
        : { kind: mapFailed ? "procedural-fallback" : "loading", width: 220, depth: 220, flatRadius: 30, vertices: ground.geometry.attributes.position.count },
      rocks: mars.ready ? undefined : rocks.count,
      models: base.state,
      stations: stations.map(({ key, position: [x, offset, z] }) => ({
        key, position: [x, groundHeight(x, z) + offset, z],
      })),
      camera: {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
      },
    });
  void base.ready.then(() => {
    const rocket = base.root.getObjectByName("Rocket_Return");
    if (rocket) rocket.userData.board = true;
    refreshWorkbench();
    render();
  });
} catch (error) {
  const message = document.querySelector<HTMLParagraphElement>("#error")!;
  message.hidden = false;
  message.textContent =
    "The Mars preview could not start. Try reloading with WebGL 2 and hardware acceleration enabled.";
  console.error(error);
}
