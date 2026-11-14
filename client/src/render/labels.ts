import * as THREE from "three";
import { sectors } from "../../../shared/src/expedition";
import {
  distance,
  icons,
  type Game,
  type Player,
} from "../../../shared/src/sim";
export type WorldLabel = {
  obj: THREE.Object3D;
  el: HTMLElement;
  height: number;
};
const v = new THREE.Vector3();
const titles: Record<string, string> = {
  ...Object.fromEntries(sectors.map((s) => [`field-${s.id}`, s.name])),
  workbench: "Workbench",
  shield: "Shielding",
  comms: "Radio",
  grow: "Garden",
  power: "Solar science",
  oxygen: "Oxygen",
  plants: "Space plants",
};
export function placeLabels(
  labels: Map<string, WorldLabel>,
  camera: THREE.Camera,
  s: Game,
  id: string,
  menu: boolean,
  hovered: string,
) {
  const player = s.players[id],
    multiplayer = Object.keys(s.players).length > 1;
  let nearest = "",
    best = 4;
  for (const [key, l] of labels) {
    if (!l.obj.visible || s.players[key] || key.startsWith("panel-")) continue;
    const d = distance(player, { x: l.obj.position.x, z: l.obj.position.z });
    if (d < best) {
      nearest = key;
      best = d;
    }
  }
  const candidates: {
    label: WorldLabel;
    key: string;
    distance: number;
    priority: number;
  }[] = [];
  for (const [key, l] of labels) {
    l.el.hidden = true;
    if (menu || !l.obj.visible || key.startsWith("panel-")) continue;
    const actor = s.players[key];
    if (actor && !multiplayer) continue;
    const dist = distance(player, { x: l.obj.position.x, z: l.obj.position.z });
    if (!actor && dist > 4 && key !== hovered) continue;
    l.obj.getWorldPosition(v);
    v.y += actor ? 3.4 : l.height;
    v.project(camera);
    if (v.z < -1 || v.z > 1 || Math.abs(v.x) > 0.98 || Math.abs(v.y) > 0.92)
      continue;
    const item = s.items.find((i) => i.id === key);
    if (item && dist < 0.8) continue;
    l.el.className = "world-label";
    if (actor) {
      l.el.textContent = `${({ Engineer: "🔧", Scientist: "🔬", Medic: "🩺", Comms: "📡" } as const)[actor.role]} ${actor.name}`;
      l.el.classList.add("name-tag");
    } else if (key === nearest || key === hovered) {
      l.el.textContent = item
        ? `${({ scrap: "Scrap", ice: "Ice", soil: "Soil", glass: "Clear panels", seeds: "Seeds", antenna: "Antenna", battery: "Battery", circuit: "Circuit", food: "Food" } as const)[item.kind]} ×${item.count}`
        : titles[key] || (key === "salvage-return" ? "Return ship" : key.startsWith("salvage-") ? "Salvage cache" : "Use");
    } else {
      l.el.textContent = item ? icons[item.kind] : "🔹";
      l.el.classList.add("icon-chip");
    }
    l.el.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`;
    l.el.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
    candidates.push({
      label: l,
      key,
      distance: dist,
      priority: key === nearest ? 0 : key === hovered ? 1 : actor ? 2 : 3,
    });
  }
  candidates.sort((a, b) => a.priority - b.priority || a.distance - b.distance);
  const taken = Array.from(
    document.querySelectorAll<HTMLElement>("[data-hud],#joystick,#touch>button"),
  ).map((el) => el.getBoundingClientRect());
  for (const { label: l } of candidates) {
    l.el.hidden = false;
    const r = l.el.getBoundingClientRect();
    const overlaps = taken.some(
      (q) =>
        r.left < q.right + 4 &&
        r.right > q.left - 4 &&
        r.top < q.bottom + 4 &&
        r.bottom > q.top - 4,
    );
    if (overlaps || r.left < 4 || r.right > innerWidth - 4 || r.width > 160)
      l.el.hidden = true;
    else taken.push(r);
  }
  return nearest;
}
