import assert from "node:assert/strict";
import { WebSocket } from "ws";
import type { Game } from "../shared/src/sim";
const url = process.env.TEST_SERVER || "ws://localhost:2567";
const httpURL = url.replace(/^ws/, "http");
const health = await fetch(`${httpURL}/health`);
assert.equal(health.status, 200);
assert.equal((await health.json()).service, "Outpost Down crew server");
const website = await fetch(httpURL);
assert.equal(website.status, 200);
assert.match(website.headers.get("content-type") || "", /text\/html/);
assert.match(await website.text(), /<html/i);
assert.equal((await fetch(`${httpURL}/.env`)).status, 404);
class Client {
  ws: WebSocket;
  id = "";
  room = "";
  state: Game | null = null;
  error = "";
  constructor() {
    this.ws = new WebSocket(url);
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
  async ready() {
    await new Promise<void>((resolve, reject) => {
      this.ws.once("open", resolve);
      this.ws.once("error", reject);
    });
  }
  send(m: object) {
    this.ws.send(JSON.stringify(m));
  }
  action(a: object) {
    this.send({ type: "action", action: a });
  }
  async until(condition: () => boolean, label: string) {
    const end = Date.now() + 8000;
    while (!condition()) {
      if (Date.now() > end) throw Error(`Timed out: ${label}. ${this.error}`);
      await new Promise((r) => setTimeout(r, 30));
    }
  }
}
const clients: Client[] = [];
try {
  const a = new Client();
  clients.push(a);
  await a.ready();
  a.send({ type: "create", name: "Explorer A", seed: 420 });
  await a.until(() => !!a.id && !!a.state, "create crew");
  const b = new Client();
  clients.push(b);
  await b.ready();
  b.send({ type: "join", name: "Explorer B", code: a.room });
  await b.until(() => !!b.id && !!b.state, "join crew");
  await a.until(
    () => Object.keys(a.state!.players).length === 2,
    "two synchronized players",
  );
  assert.match(a.room, /^[1-9][0-9]{4}$/);
  assert.equal(a.room, b.room);
  assert.equal(a.state!.seed, b.state!.seed);
  b.action({ type: "power", value: { air: 3, light: 3, radio: 3, heat: 2 } });
  await b.until(() => !!b.error, "reject guest power changes");
  assert.match(b.error, /leader/);
  a.action({ type: "power", value: { air: 3, light: 3, radio: 3, heat: 2 } });
  await a.until(() => a.state!.phase === "day", "start exploration");
  await b.until(() => b.state!.phase === "day", "broadcast phase");
  const target = a.state!.items[0];
  async function walk(c: Client, offset: number) {
    const p = c.state!.players[c.id],
      x = target.x + offset,
      dx = x - p.x,
      dz = target.z - p.z,
      mag = Math.hypot(dx, dz);
    c.action({ type: "move", x: dx / mag, z: dz / mag });
    await c.until(
      () =>
        Math.hypot(
          c.state!.players[c.id].x - x,
          c.state!.players[c.id].z - target.z,
        ) < 0.55,
      "server-authoritative walking",
    );
    c.action({ type: "move", x: 0, z: 0 });
  }
  await Promise.all([walk(a, -1.2), walk(b, 1.2)]);
  await a.until(
    () =>
      Math.hypot(
        a.state!.players[b.id].x - (target.x + 1.2),
        a.state!.players[b.id].z - target.z,
      ) < 1,
    "remote movement visible",
  );
  a.action({ type: "pick", target: target.id });
  b.action({ type: "pick", target: target.id });
  await a.until(
    () => !a.state!.items.some((i) => i.id === target.id),
    "shared item removed",
  );
  await b.until(
    () => !b.state!.items.some((i) => i.id === target.id),
    "both clients see pickup",
  );
  assert.equal(
    (a.state!.players[a.id].bag.scrap || 0) +
      (a.state!.players[b.id].bag.scrap || 0),
    6,
  );
  assert.deepEqual(a.state!.players[a.id].bag, b.state!.players[a.id].bag);
  const owner = a.state!.players[a.id].bag.scrap ? a : b;
  const observer = owner === a ? b : a;
  assert.equal(observer.state!.players[observer.id].bag.scrap ?? 0, 0);
  owner.action({ type: "selectSlot", slot: 4 });
  await observer.until(
    () => observer.state!.players[owner.id].selectedSlot === 4,
    "empty slot synced to teammate",
  );
  assert.equal(observer.state!.players[observer.id].selectedSlot ?? 0, 0);
  for (const name of ["C", "D"]) {
    const c = new Client();
    clients.push(c);
    await c.ready();
    c.send({ type: "join", name, code: a.room });
    await c.until(() => !!c.id, "additional crew member");
  }
  const fifth = new Client();
  clients.push(fifth);
  await fifth.ready();
  fifth.send({ type: "join", name: "E", code: a.room });
  await fifth.until(() => !!fifth.error, "reject fifth player");
  assert.match(fifth.error, /four/);
  console.log(
    "PASS: room codes, two synced clients, remote movement, leader authorization, pickup race without duplication, and four-player limit.",
  );
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  for (const c of clients) c.ws.close();
}
