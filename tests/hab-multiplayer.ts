import assert from "node:assert/strict";
import { WebSocket } from "ws";
import type { Game, Point } from "../shared/src/sim";
class Client {
  ws = new WebSocket(process.env.TEST_SERVER || "ws://127.0.0.1:2567");
  id = "";
  room = "";
  state: Game | null = null;
  error = "";
  constructor() {
    this.ws.on("message", (b) => {
      const m = JSON.parse(b.toString());
      if (m.type === "welcome") {
        this.id = m.id;
        this.room = m.room;
      }
      if (m.type === "state") this.state = m.state;
      if (m.type === "error") this.error = m.message;
    });
  }
  ready() {
    return new Promise<void>((r, j) => {
      this.ws.once("open", r);
      this.ws.once("error", j);
    });
  }
  send(m: object) {
    this.ws.send(JSON.stringify(m));
  }
  action(action: object) {
    this.send({ type: "action", action });
  }
  async until(check: () => boolean, label: string) {
    const end = Date.now() + 10000;
    while (!check()) {
      if (Date.now() > end) throw Error(`${label}: ${this.error}`);
      await new Promise((r) => setTimeout(r, 25));
    }
  }
  async walk(target: Point, inside = false) {
    for (let guard = 0; guard < 300; guard++) {
      const p = this.state!.players[this.id],
        at = inside ? p.hab! : p,
        d = Math.hypot(target.x - at.x, target.z - at.z);
      if (d < 0.15) return;
      const step = Math.min(inside ? 0.35 : 1, d),
        next = {
          x: at.x + ((target.x - at.x) / d) * step,
          z: at.z + ((target.z - at.z) / d) * step,
        };
      this.action({ type: inside ? "habPos" : "pos", ...next, mx: 0, mz: 0 });
      await this.until(() => {
        const p = this.state!.players[this.id],
          at = inside ? p.hab! : p;
        return Math.hypot(at.x - next.x, at.z - next.z) < 0.08;
      }, "walk");
    }
    throw Error("walk limit");
  }
}
const clients: Client[] = [];
const heartbeat = setInterval(() => {
  for (const c of clients)
    if (c.ws.readyState === WebSocket.OPEN) c.send({ type: "ping" });
}, 4000);
try {
  const a = new Client();
  clients.push(a);
  await a.ready();
  a.send({ type: "create", name: "Hab A", seed: 420 });
  await a.until(() => !!a.state && !!a.id, "create");
  const b = new Client();
  clients.push(b);
  await b.ready();
  b.send({ type: "join", code: a.room, name: "Hab B" });
  await b.until(() => !!b.state && !!b.id, "join");
  a.action({ type: "power", value: { air: 3, light: 3, radio: 3, heat: 2 } });
  await b.until(() => b.state?.phase === "day", "day");
  await a.walk({ x: -1, z: -8.2 });
  a.action({ type: "enterHab" });
  await b.until(() => !!b.state!.players[a.id].hab, "A enters");
  await b.walk({ x: 1, z: -8.2 });
  b.action({ type: "enterHab" });
  await a.until(() => !!a.state!.players[b.id].hab, "B enters");
  assert.equal(a.state!.players[a.id].habBerth, 0);
  assert.equal(a.state!.players[b.id].habBerth, 1);
  await a.walk({ x: 0, z: 0 }, true);
  await b.until(
    () => Math.abs(b.state!.players[a.id].hab!.z) < 0.15,
    "interior movement broadcast",
  );
  const p = { ...a.state!.players[a.id] };
  a.action({ type: "pos", x: 100, z: 100 });
  await a.until(
    () => a.error.includes("Leave the habitat"),
    "reject outdoor report",
  );
  assert.equal(a.state!.players[a.id].x, p.x);
  assert.equal(a.state!.players[a.id].z, p.z);
  a.error = "";
  a.action({ type: "exitHab" });
  await a.until(
    () => a.error.includes("airlock"),
    "reject exit away from hatch",
  );
  const before = { ...b.state!.players[b.id].hab! };
  b.action({ type: "habPos", x: 1, z: 100 });
  await b.until(
    () => b.state!.players[b.id].hab!.at > before.at,
    "boundary report",
  );
  assert.ok(b.state!.players[b.id].hab!.z < 10.2);
  await a.walk({ x: -1, z: 8.7 }, true);
  a.action({ type: "exitHab" });
  await b.until(() => !b.state!.players[a.id].hab, "shared airlock exit");
  assert.equal(b.state!.players[a.id].habBerth, 0);
  assert.ok(Math.abs(b.state!.players[a.id].z + 8.5) < 0.01);
  a.ws.close();
  await b.until(() => !b.state!.players[a.id], "disconnect cleanup");
  const c = new Client();
  clients.push(c);
  await c.ready();
  c.send({ type: "join", code: b.room, name: "Hab C" });
  await c.until(() => !!c.state && !!c.id, "replacement crew");
  await c.walk({ x: -1, z: -8.2 });
  c.action({ type: "enterHab" });
  await b.until(() => !!b.state!.players[c.id].hab, "replacement enters");
  assert.equal(b.state!.players[c.id].habBerth, 0);
  console.log(
    "PASS: shared hab entry, distinct berths, interior movement, outdoor-action isolation, hatch-only exit and disconnected berth reuse.",
  );
} finally {
  clearInterval(heartbeat);
  for (const c of clients) c.ws.close();
}
