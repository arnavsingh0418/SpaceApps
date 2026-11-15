import { randomInt, randomUUID } from "node:crypto";
import {
  createGame,
  addPlayer,
  removePlayer,
  dispatch,
  tick,
  type Game,
} from "../shared/src/sim";
export type CrewClient = {
  id: string;
  room: string;
  count: number;
  window: number;
  last: number;
};
export class CrewRooms {
  rooms = new Map<string, Game>();
  client(): CrewClient {
    return {
      id: randomUUID(),
      room: "",
      count: 0,
      window: Date.now(),
      last: Date.now(),
    };
  }
  receive(c: CrewClient, m: Record<string, any>): object[] {
    const error = (message: string) => [{ type: "error", message }];
    if (Date.now() - c.window > 1000) {
      c.window = Date.now();
      c.count = 0;
    }
    if (++c.count > 40) return [];
    c.last = Date.now();
    if (m.type === "create" || m.type === "join") {
      if (c.room) return [];
      if (this.rooms.size >= 100 && m.type === "create")
        return error("The server is full. Please try solo play.");
      let code = String(m.code || "").trim(),
        s: Game | undefined;
      if (m.type === "create") {
        do {
          code = String(randomInt(10000, 100000));
        } while (this.rooms.has(code));
        s = createGame(Number.isFinite(m.seed) ? m.seed : randomInt(1000000));
        this.rooms.set(code, s);
      } else s = this.rooms.get(code);
      if (!s)
        return error(
          "That crew code has expired or is incorrect. Ask the host to create a new crew, and open the same game link.",
        );
      if (!addPlayer(s, c.id, String(m.name || "Explorer")))
        return error("This crew already has four explorers.");
      c.room = code;
      return [
        { type: "welcome", id: c.id, room: code },
        { type: "state", state: s },
      ];
    }
    if (m.type === "action" && c.room) {
      const s = this.rooms.get(c.room);
      if (s && m.action && typeof m.action === "object") {
        const message = dispatch(s, c.id, m.action);
        if (message) return error(message);
      }
    }
    return [];
  }
  state(c: CrewClient) {
    return this.rooms.get(c.room);
  }
  remove(c: CrewClient) {
    const s = this.state(c);
    if (s) {
      removePlayer(s, c.id);
      if (!Object.keys(s.players).length) this.rooms.delete(c.room);
    }
  }
  tick() {
    for (const s of this.rooms.values()) tick(s, 0.1);
  }
}
