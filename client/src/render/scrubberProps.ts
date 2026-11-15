import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { cartridgeCabinet, flightStations, scrubberFault, type DeckFlight } from "../../../shared/src/flight";

const material = (color: number, metalness = 0.2) =>
  new T.MeshStandardMaterial({ color, metalness, roughness: 0.42 });

export class ScrubberProps {
  private spare: T.Group;
  private spent: T.Group;
  private installed: T.Group;
  private carried: T.Group;
  private beacon: T.Mesh;
  private cabinet: T.Group;

  constructor(root: T.Group, camera: T.PerspectiveCamera) {
    const enamel = material(0xb6c7c5);
    const dark = material(0x213637);
    const light = material(0x81d2bc);
    const gold = material(0xda9847, 0.55);
    const steel = material(0x6f898e, 0.65);
    const beaconMaterial = new T.MeshStandardMaterial({
      color: 0x9de3c6, emissive: 0x47ffbc, emissiveIntensity: 0.15,
    });
    const box = (parent: T.Group, mat: T.Material, w: number, h: number, d: number, x = 0, y = 0, z = 0) => {
      const mesh = new T.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.018), mat);
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return mesh;
    };
    const cylinder = (parent: T.Group, mat: T.Material, length: number, radius: number, x: number) => {
      const mesh = new T.Mesh(new T.CylinderGeometry(radius, radius, length, 20), mat);
      mesh.rotation.z = Math.PI / 2;
      mesh.position.x = x;
      parent.add(mesh);
    };
    const label = (parent: T.Group, text: string, w: number, h: number, y: number, z: number) => {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 96;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#183339";
      ctx.fillRect(0, 0, 512, 96);
      ctx.fillStyle = "#b9f3da";
      ctx.fillRect(0, 0, 14, 96);
      ctx.font = "bold 52px sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText(text, 32, 49, 460);
      const map = new T.CanvasTexture(canvas);
      map.colorSpace = T.SRGBColorSpace;
      const sign = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map }));
      sign.position.set(0, y, z);
      parent.add(sign);
    };
    const cartridge = (used: boolean, adapted = false) => {
      const group = new T.Group();
      const body = used ? material(0x80634c) : light;
      cylinder(group, dark, 0.54, 0.122, 0);
      cylinder(group, body, 0.38, 0.131, 0);
      for (const end of [-1, 1]) {
        cylinder(group, steel, 0.055, 0.143, end * 0.22);
        cylinder(group, dark, 0.06, 0.083, end * 0.28);
        for (let i = 0; i < 8; i++) {
          const angle = i * Math.PI / 4;
          box(group, steel, 0.03, 0.035, 0.035, end * 0.25, Math.sin(angle) * 0.105, Math.cos(angle) * 0.105);
        }
      }
      box(group, dark, 0.25, 0.036, 0.065, 0, 0.16);
      box(group, gold, 0.025, 0.07, 0.065, -0.105, 0.125);
      box(group, gold, 0.025, 0.07, 0.065, 0.105, 0.125);
      label(group, used ? "CO₂ / SPENT" : "CO₂ / SPARE", 0.32, 0.075, 0.01, 0.132);
      const collar = new T.Mesh(new T.TorusGeometry(0.12, 0.028, 10, 24), gold);
      collar.rotation.y = Math.PI / 2;
      collar.position.set(adapted ? 0.31 : 0.41, adapted ? 0 : -0.025, 0);
      collar.visible = !used;
      group.add(collar);
      return group;
    };

    this.cabinet = new T.Group();
    this.cabinet.position.set(2.78, 1.44, cartridgeCabinet.z);
    this.cabinet.rotation.y = -Math.PI / 2;
    root.add(this.cabinet);
    box(this.cabinet, enamel, 1.06, 0.82, 0.32);
    box(this.cabinet, dark, 0.96, 0.52, 0.06, 0, -0.02, 0.17);
    box(this.cabinet, steel, 1, 0.07, 0.39, 0, -0.29, 0.07);
    label(this.cabinet, "AFT SUPPLIES", 0.92, 0.16, 0.31, 0.167);
    this.beacon = box(this.cabinet, beaconMaterial, 0.88, 0.045, 0.055, 0, 0.187, 0.2);
    this.spare = cartridge(false);
    this.spare.position.set(-0.05, -0.104, 0.29);
    this.cabinet.add(this.spare);

    const rack = new T.Group();
    rack.position.set(-2.18, 1.36, flightStations.air.z);
    rack.rotation.y = Math.PI / 2;
    root.add(rack);
    box(rack, steel, 0.79, 0.56, 0.19);
    box(rack, dark, 0.69, 0.3, 0.06, 0, -0.065, 0.111);
    label(rack, "CO₂ SCRUBBER", 0.71, 0.15, 0.18, 0.1);
    this.spent = cartridge(true);
    this.installed = cartridge(false, true);
    for (const part of [this.spent, this.installed]) {
      part.position.set(0, -0.063, 0.22);
      rack.add(part);
    }
    this.carried = cartridge(false);
    this.carried.scale.setScalar(0.7);
    this.carried.rotation.set(-0.12, -0.16, 0.1);
    this.carried.position.set(0.31, -0.29, -0.68);
    camera.add(this.carried);
  }

  update(deck: DeckFlight, id: string, players: DeckFlightPlayers) {
    const fault = scrubberFault(deck);
    const carrier = fault?.cartridgeCarrier;
    const carrying = carrier !== undefined && Boolean(players[carrier]);
    this.spare.visible = !carrying && !deck.incidents.some((incident) => incident.kind === "air" && incident.fixed);
    this.spent.visible = Boolean(fault && !fault.cartridgeRemoved);
    this.installed.visible = !fault;
    this.carried.visible = Boolean(fault && carrier === id && deck.arrivalAt === undefined);
    (this.beacon.material as T.MeshStandardMaterial).emissiveIntensity =
      fault?.cartridgeRemoved && !carrying ? 1.8 : 0.15;
  }
}

type DeckFlightPlayers = Record<string, unknown>;
