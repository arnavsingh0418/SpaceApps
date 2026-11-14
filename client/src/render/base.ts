import * as THREE from "three";
import { loadModel } from "./models";
import type { Structure } from "../construction";

export const stations = [
  {
    key: "habitat",
    model: "Habitat_With_Workbench",
    title: "Habitat",
    tag: "01 / HOME BASE",
    description:
      "A safe place to rest, plan the next expedition and stay out of the Martian dust. Peek through the dome to find the interior workbench.",
    position: [-3, 0, -4],
    size: 11,
    rotation: 0,
    view: [13, 10, 18],
  },
  {
    key: "solar",
    model: "Solar_Panels_Clean",
    title: "Solar array",
    tag: "02 / POWER",
    description:
      "Sunlight keeps the outpost running. Matching clean and dusty arrays show how a panel could change during a dust storm.",
    position: [10, 0, -2],
    size: 7,
    rotation: -0.35,
    view: [10, 8, 13],
  },
  {
    key: "workbench",
    model: "Workbench",
    title: "Crafting bench",
    tag: "03 / MAKE & REPAIR",
    description:
      "Tools, spare parts and a sturdy workspace for future repairs and crafting. The rounded white, teal and orange design matches the habitat.",
    position: [-4, 0, 5],
    size: 3.5,
    rotation: 0,
    view: [6, 4, 7],
  },
] as const;

export function createBase(scene: THREE.Scene, onProgress: () => void) {
  const root = new THREE.Group();
  root.name = "Mars outpost";
  scene.add(root);
  const state = { loaded: 0, total: 0, failed: [] as string[] };
  const selectable: THREE.Group[] = [];
  const structures = new Map<Structure, THREE.Group>();
  const caches = new Map<string, THREE.Group>();
  const hiddenCaches = new Set<string>();
  const place = async (
    id: string,
    position: readonly number[],
    size: number,
    rotation = 0,
    station?: string,
    placement?: { structure: Structure } | { cache: string },
  ) => {
    state.total++;
    try {
      const model = await loadModel(id, size, rotation);
      model.position.set(position[0], -0.035 + position[1], position[2]);
      model.userData.station = station;
      if (placement && "structure" in placement) {
        structures.set(placement.structure, model);
        model.visible = false;
      }
      if (placement && "cache" in placement) {
        caches.set(placement.cache, model);
        model.visible = !hiddenCaches.has(placement.cache);
      }
      root.add(model);
      if (station) selectable.push(model);
      state.loaded++;
    } catch (error) {
      state.failed.push(id);
      console.error(`Could not load Mars model ${id}`, error);
    }
    onProgress();
  };
  const jobs = stations.map((s) =>
    place(s.model, s.position, s.size, s.rotation, s.key),
  );
  jobs.push(
    place("Solar_Panels_Dusty", [12, 0, -9], 6, -0.35, "solar"),
    place("Greenhouse_Tunnel", [-13, 0, -6], 7, Math.PI / 2),
    place("Radio_Dish_Fixed", [3, 0, -13], 3.8, -0.8),
    place("Rocket_Return", [-15, 0, -17], 4.5),
    place("Storm_Shelter", [8, 0, -17], 5, 0, undefined, { structure: "shelter" }),
    place("Solar_Panels_Clean", [16, 0, -4], 6, -0.35, "solar", { structure: "panel" }),
    place("Science_Beacon", [5, 0, 3], 1.4),
    place("Supply_Crate", [-8, 0, 4], 1.1, 0, undefined, { cache: "metal" }),
    place("Supply_Crate", [-9.4, 0, 4.8], 1.1, 0, undefined, { cache: "soil" }),
    place("Battery", [-2.1, 0, 4.9], 0.65),
    place("Scrap_Metal", [-2.2, 0, 6], 0.8),
    place("Astronaut_Orange", [0, 0, 3], 1.15, -0.2),
    place("Astronaut_Blue", [3, 0, 4], 1.15, -0.6),
    place("Astronaut_Green", [-10, 0, -1], 1.15, 0.6),
    place("Astronaut_Yellow", [8, 0, 2], 1.15, -0.7),
  );
  return {
    root, selectable, state, ready: Promise.all(jobs),
    constructionReady: (id: Structure) => structures.has(id),
    showStructure(id: Structure) {
      const model = structures.get(id);
      if (model) model.visible = true;
    },
    hideCache(id: string) {
      hiddenCaches.add(id);
      const model = caches.get(id);
      if (model) model.visible = false;
    },
  };
}
