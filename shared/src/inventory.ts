import type { Item, Player } from "./sim";
export function inventorySlots(p: Player) {
  return Object.entries(p.bag).filter(([, n]) => Number(n) > 0) as [
    Item,
    number,
  ][];
}
export function equippedItem(p: Player): Item | undefined {
  return inventorySlots(p)[p.selectedSlot ?? 0]?.[0];
}
