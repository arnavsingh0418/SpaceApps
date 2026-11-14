import { icons, type Item, type Role } from "../../../shared/src/sim";

export const artURL = (file: string) =>
  `${import.meta.env.BASE_URL}mars/${file}`;
export const art = (name: string, cls = "model-icon") =>
  `<img class="${cls}" src="${artURL(`icons/${name}.png`)}" alt="" aria-hidden="true" width="32" height="32">`;
const items: Partial<Record<Item, string>> = {
  scrap: "scrap_metal",
  ice: "ice_chunk",
  soil: "soil_bag",
  seeds: "seeds_packet",
  battery: "battery",
  circuit: "circuit_board",
  antenna: "antenna_part",
  food: "supply_crate",
};
export const itemArt = (item: Item) =>
  items[item] ? art(items[item]!) : icons[item];
export const resourceArt = (key: "power" | "air" | "food" | "dose") =>
  art(`resource_${key === "dose" ? "radiation" : key}`);
const builds: Record<string, string> = {
  shelter: "build_shelter",
  radio: "build_radio",
  greenhouse: "build_greenhouse",
  panel: "build_solar_panel",
  oxygen: "resource_air",
};
export const buildingArt = (key: string, fallback: string) =>
  builds[key] ? art(builds[key]) : fallback;
const portraits: Record<Role, string> = {
  Engineer: "Orange",
  Scientist: "Blue",
  Medic: "Green",
  Comms: "Yellow",
};
export const crewPortrait = (role: Role) =>
  `<img class="crew-portrait" src="${artURL(`portraits/Crew_${portraits[role]}.png`)}" alt="${role} astronaut" width="64" height="64">`;
