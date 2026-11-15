import {
  icons,
  itemNames,
  type Game,
  type Item,
} from "../../../shared/src/sim";
import { KeyChip } from "./components";
import { itemArt } from "./modelArt";
import { inventorySlots } from "../../../shared/src/inventory";
export function hotbar(
  s: Game,
  id: string,
  selected: number,
  bounce = false,
  progress = 1,
) {
  const bag = inventorySlots(s.players[id]);
  return `<div class="hotbar">${Array.from({ length: 5 }, (_, i) => `<button class="slot ${i === selected ? "selected" : ""} ${bounce && bag[i] ? "pickup-bounce" : ""}" data-do="slot" data-index="${i}" aria-label="${bag[i] ? `${itemNames[bag[i][0] as Item]} ${bag[i][1]}` : "Empty slot"}">${bag[i] ? `<span>${itemArt(bag[i][0] as Item)}</span><b>${bounce ? Math.max(1, Math.ceil((bag[i][1] || 0) * progress)) : bag[i][1]}</b>` : ""}<small>${KeyChip(String(i + 1))}</small></button>`).join("")}</div>`;
}
