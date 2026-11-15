import * as T from "three";
import { createModel, disposeModel } from "./modelAssets";
import { equippedItem } from "../../../shared/src/inventory";
import type { Item, Player } from "../../../shared/src/sim";
const assets: Partial<Record<Item, string>> = {
  scrap: "Scrap_Metal",
  ice: "Ice_Chunk",
  soil: "Soil_Bag",
  seeds: "Seeds_Packet",
  antenna: "Antenna_Part",
  battery: "Battery",
  circuit: "Circuit_Board",
  food: "Supply_Crate",
  solarKit: "Solar_Panels_Clean",
};
const colors: Record<Item, number> = {
  scrap: 0x9ba7b0,
  ice: 0x8ddfee,
  soil: 0x8f6243,
  glass: 0xa5ecff,
  seeds: 0x78a959,
  antenna: 0xd4dce0,
  battery: 0xffcc47,
  circuit: 0x3ea46d,
  food: 0xe4bd75,
  solarKit: 0x8adccc,
};
/** Per-actor wrapper and request revision prevent another slot's async model replacing this one. */
export function updateHeldItem(actor: T.Object3D, p: Player) {
  const holder = actor.getObjectByName("carried"),
    item = equippedItem(p);
  if (!holder) return item;
  holder.visible = !!item;
  if (holder.userData.heldItem === item) return item;
  holder.userData.heldItem = item;
  const revision = (holder.userData.heldRevision || 0) + 1;
  holder.userData.heldRevision = revision;
  for (const child of [...holder.children]) {
    holder.remove(child);
    disposeModel(child);
  }
  if (!item) return;
  const geometry =
    item === "ice"
      ? new T.IcosahedronGeometry(0.3)
      : new T.BoxGeometry(
          0.6,
          item === "scrap" || item === "circuit" ? 0.1 : 0.45,
          item === "glass" ? 0.05 : 0.35,
        );
  const fallback = new T.Mesh(
    geometry,
    new T.MeshStandardMaterial({
      color: colors[item],
      roughness: 0.65,
      transparent: item === "glass",
      opacity: item === "glass" ? 0.6 : 1,
    }),
  );
  fallback.position.y = 0.2;
  holder.add(fallback);
  if (assets[item])
    void createModel(assets[item]!, { width: 0.65, batch: true })
      .then((model) => {
        if (
          holder.userData.heldRevision !== revision ||
          holder.userData.marsDisposed
        ) {
          disposeModel(model);
          return;
        }
        for (const child of [...holder.children]) {
          holder.remove(child);
          disposeModel(child);
        }
        holder.add(model);
      })
      .catch(() => {});
  return item;
}
