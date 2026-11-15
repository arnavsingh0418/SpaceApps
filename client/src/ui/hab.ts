import { HAB_LAYOUT, berthOwners, habRoom } from "../../../shared/src/hab";
import { type Game } from "../../../shared/src/sim";
import { Button, escape } from "./components";
export function habDirectory(s: Game, id: string) {
  const owners = berthOwners(s);
  return `<div class="hab-directory"><p class="hab-eyebrow">ARES / SURFACE HABITAT</p><p>Four crew cabins and shared systems surround the central passage. Walk with WASD or the joystick, orbit with the mouse, and press E beside equipment to inspect it. Return to the south airlock to go outside.</p><div class="hab-room-grid">${HAB_LAYOUT.zones.map((q) => `<article><b>${escape(q.label)}</b><span>${escape(q.id.startsWith("quarter") ? owners[Number(q.id.slice(-1))]?.name || "Unassigned berth" : q.name)}</span></article>`).join("")}</div><p>Your berth: <strong>${s.players[id].habBerth !== undefined ? `0${s.players[id].habBerth! + 1}` : "Assigned on entry"}</strong>. Crew supplies stay in the existing shared stock and bags.</p>${Button("BACK TO EXPLORING", "close")}</div>`;
}
export function habMap(s: Game, id: string) {
  const p = s.players[id].hab!;
  return `<aside class="hab-map panel" data-hud="map"><button data-do="habDirectory" aria-label="Open habitat floor plan"><span>HAB / DECK 01</span><svg viewBox="-12 -12 24 24" role="img" aria-label="Habitat floor plan, airlock to the south">${HAB_LAYOUT.zones.map((q) => `<rect x="${q.area[0]}" y="${q.area[2]}" width="${q.area[1] - q.area[0]}" height="${q.area[3] - q.area[2]}" fill="${q.color}" fill-opacity=".26" stroke="${q.color}" stroke-width=".15"/>`).join("")}${Object.values(
    s.players,
  )
    .filter((q) => q.hab)
    .map(
      (q) =>
        `<circle cx="${q.hab!.x}" cy="${q.hab!.z}" r="${q.id === id ? 0.5 : 0.35}" fill="${q.id === id ? "#fff0c9" : "#80c8d5"}"/>`,
    )
    .join(
      "",
    )}</svg><b>${escape(habRoom(p))}</b><small>Q · Floor plan</small></button></aside>`;
}
export function habEquipment(s: Game, id: string, key: string) {
  const quarters = key.startsWith("quarter");
  const owner = quarters ? berthOwners(s)[Number(key.slice(-1))] : undefined;
  const info: Record<string, [string, string, string]> = {
    eclss: [
      "Environmental control & life support",
      "Separate racks capture carbon dioxide, generate oxygen and recover water. Service cartridges, sample ports and isolated valves make maintenance possible without shutting down every loop.",
      `Shared air: ${Math.round(s.air)}% · Air power: ${s.allocation.air} blocks · Heat: ${s.allocation.heat} blocks. These are the mission’s existing readings; the water loop is modeled equipment.`,
    ],
    command: [
      "Command & communications",
      "The workstations bring mission telemetry together. The communications rack routes messages through the external radio. Earth conversations have a delay, so the crew must handle urgent problems locally.",
      `Radio progress: ${s.radio}/10 · Dish ${s.aligned ? "aligned" : "not aligned"} · Crew: ${Object.keys(s.players).length}/4. Use the morning power plan and outdoor radio tasks to change these systems.`,
    ],
    medical: [
      "Medical bay",
      "The examination couch has restraint rails, diagnostic equipment, oxygen and closed medical storage. First aid and fire suppression gear remain easy to reach from the main aisle.",
      `Shared radiation dose: ${Math.round(s.dose)}/100 game units. This is a game indicator, not a medical measurement. Equipment inspection does not remove dose or restore supplies.`,
    ],
    galley: [
      "Galley & dining",
      "Food pouches are warmed or rehydrated at the counter. Lidded storage, a small sink and a four-place table keep meal preparation separate from engineering and hygiene work.",
      `Shared food: ${Math.round(s.food)}% · Stored ice: ${s.stock.ice || 0} · Stored food crates: ${s.stock.food || 0}. Meals still follow the mission’s daily food rules.`,
    ],
    hygiene: [
      "Hygiene & sanitation",
      "A screened wash stall, low-water sink and sealed toilet keep the wet area separate from the galley. Water returns to treatment before reuse. Personal towels and cleaning supplies stay in this room.",
      "The fixtures are environmental props. They do not spend ice or change the survival resource rules.",
    ],
    airlock: [
      "Airlock & suit preparation",
      "The pressurized vestibule separates the living area from Mars. Suit service packs, umbilicals and a dust grate mark the dirty side. Pressure lights and two hatch frames make the boundary clear.",
      "Press E in the vestibule to cycle outside. Crew inventory travels with you; the rover stays parked outside.",
    ],
  };
  const q = quarters
    ? [
        `Crew quarters ${Number(key.slice(-1)) + 1}`,
        `Assigned to ${owner?.name || "an arriving crew member"}. A private sleeping berth, personal locker, desk, terminal, reading light and gathered privacy curtain provide a small place to rest away from shared work.`,
        `Water stowage under the bed and acoustic lining are visible design features. ${owner?.id === id ? "This is your assigned berth." : "Each explorer receives a different berth on first entry."} Sleeping and personal storage are scenery; your existing bag is preserved.`,
      ]
    : info[key];
  return q
    ? `<div class="hab-equipment"><p class="hab-eyebrow">HABITAT SYSTEMS</p><h3>${escape(q[0])}</h3><p>${escape(q[1])}</p><p class="hab-readout">${escape(q[2])}</p>${key === "airlock" ? `<div class="hab-airlock-status"><span>● HAB SIDE / PRESSURIZED</span><span>● EXTERIOR / MARS</span></div>${Button("CYCLE AIRLOCK · GO OUTSIDE", "habExit")}` : ""}${Button("BACK", "close")}</div>`
    : "";
}
