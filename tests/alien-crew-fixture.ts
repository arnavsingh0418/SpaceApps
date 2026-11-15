import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { alienSite } from "../shared/src/alien";
import { movePastPlayers } from "../shared/src/playerCollision";
import type { Game, Action } from "../shared/src/sim";
const url = process.env.TEST_SERVER || "ws://127.0.0.1:2572";
export class Client {
  ws = new WebSocket(url);
  id = "";
  room = "";
  state: Game | null = null;
  error = "";
  constructor() {
    this.ws.on("message", (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.type === "welcome") {
        this.id = m.id;
        this.room = m.room;
      }
      if (m.type === "state") this.state = m.state;
      if (m.type === "error") this.error = m.message;
    });
  }
  async ready() {
    await new Promise<void>((resolve, reject) => {
      this.ws.once("open", resolve);
      this.ws.once("error", reject);
    });
  }
  send(value: object) {
    this.ws.send(JSON.stringify(value));
  }
  action(a: Action) {
    this.send({ type: "action", action: a });
  }
  async until(check: () => boolean, label: string) {
    const end = Date.now() + 10000;
    while (!check()) {
      if (Date.now() > end) throw Error(`${label}: ${this.error}`);
      await new Promise((r) => setTimeout(r, 25));
    }
  }
  async walk(x: number, z: number) {
    for (let guard = 0; guard < 500; guard++) {
      const p = this.state!.players[this.id],
        dx = x - p.x,
        dz = z - p.z,
        d = Math.hypot(dx, dz);
      if (d < 0.1) return;
      const step = Math.min(2, d);
      const others = Object.values(this.state!.players).filter(
        (other) => other.id !== this.id,
      );
      const heading = Math.atan2(dz, dx);
      const next = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2]
        .map((angle) => ({
          x: p.x + Math.cos(heading + angle) * step,
          z: p.z + Math.sin(heading + angle) * step,
        }))
        .find((target) => {
          const reach = movePastPlayers(p, target, others);
          return Math.hypot(reach.x - target.x, reach.z - target.z) < 0.01;
        });
      if (!next) throw Error("No clear path to the next test waypoint");
      const { x: nx, z: nz } = next;
      this.action({ type: "pos", x: nx, z: nz, mx: 0, mz: 0, gait: "walk" });
      await this.until(
        () =>
          Math.hypot(
            this.state!.players[this.id].x - nx,
            this.state!.players[this.id].z - nz,
          ) < 0.1,
        "walk report",
      );
    }
    throw Error("walk limit");
  }
  async collect(kind: string) {
    const item = this.state!.items.find((i) => i.kind === kind)!;
    await this.walk(item.x, item.z);
    this.action({ type: "pick", target: item.id });
    await this.until(
      () =>
        (this.state!.players[this.id].bag as Record<string, number>)[kind] > 0,
      `pick ${kind}`,
    );
  }
}

export async function unlockCrewRover(a: Client, b: Client) {
  await a.collect("scrap");
  await a.collect("ice");
  await a.walk(alienSite.x - 1.5, alienSite.z);
  await b.collect("glass");
  await b.walk(alienSite.x + 1.5, alienSite.z);
  a.action({ type: "acceptAlien" });
  await b.until(() => !!b.state!.alienQuest?.accepted, "shared acceptance");
  a.action({ type: "donateAlien", kind: "ice" });
  a.action({ type: "donateAlien", kind: "scrap" });
  b.action({ type: "donateAlien", kind: "glass" });
  await a.until(
    () =>
      a.state!.alienQuest?.delivered.ice === 3 &&
      a.state!.alienQuest?.delivered.glass === 2 &&
      a.state!.alienQuest?.delivered.scrap === 2,
    "shared supplies",
  );
  b.action({ type: "beginAlienRepair" });
  await b.until(
    () => b.state!.players[b.id].task?.kind === "alienBrush",
    "brush started",
  );
  const start = b.state!.players[b.id].task!.at;
  await b.until(() => b.state!.elapsed - start > 2.1, "brush duration");
  b.action({ type: "finishAlienRepair", patches: 6 });
  await a.until(() => !!a.state!.alienQuest?.brushed, "shared collector");
  a.action({ type: "alienAnswer", answer: 1 });
  b.action({ type: "alienAnswer", answer: 1 });
  await b.until(() => !!b.state!.alienQuest?.completed, "shared completion");
  assert.equal(b.state!.returnMission!.recovered.nav, "Prototype");
  assert.equal(b.state!.returnMission!.points, 300);
  assert.equal(Object.keys(b.state!.alienQuest!.contributions).length, 2);
  assert.equal(b.state!.rover?.locked, false);
  assert.equal(a.state!.rover?.locked, false);
}
