import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { CrewRooms, type CrewClient } from "./rooms";
export function crewHTTP(hub: CrewRooms) {
  const sessions = new Map<string, CrewClient>();
  async function handle(req: IncomingMessage, res: ServerResponse) {
    const path = new URL(req.url || "/", "http://localhost").pathname;
    if (path !== "/api/crew" && path !== "/api/crew/actions") return false;
    const reply = (status: number, value: unknown) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      });
      res.end(JSON.stringify(value));
    };
    if (req.method === "OPTIONS") {
      reply(200, {});
      return true;
    }
    try {
      const token = (req.headers.authorization || "").replace(/^Bearer /, ""),
        c = sessions.get(token);
      if (req.method === "POST" && path === "/api/crew") {
        const m = await readBody(req);
        if (m.type !== "create" && m.type !== "join") {
          reply(400, { error: "Choose create or join." });
          return true;
        }
        const client = hub.client(),
          messages = hub.receive(client, m),
          error = messages.find((v: any) => v.type === "error") as
            { message: string } | undefined;
        if (error) {
          reply(400, { error: error.message });
          return true;
        }
        const key = randomUUID();
        sessions.set(key, client);
        reply(200, {
          token: key,
          id: client.id,
          room: client.room,
          state: hub.state(client),
        });
        return true;
      }
      if (!c) {
        reply(401, {
          error: "Your crew connection expired. Rejoin with the crew code.",
        });
        return true;
      }
      c.last = Date.now();
      if (req.method === "GET" && path === "/api/crew") {
        const state = hub.state(c);
        reply(
          state ? 200 : 410,
          state
            ? { state }
            : { error: "This crew ended. Ask the host for a new code." },
        );
        return true;
      }
      if (req.method === "DELETE" && path === "/api/crew") {
        sessions.delete(token);
        hub.remove(c);
        reply(200, {});
        return true;
      }
      if (req.method === "POST" && path === "/api/crew/actions") {
        const m = await readBody(req);
        if (!Array.isArray(m.actions) || m.actions.length > 16) {
          reply(400, { error: "Too many actions. Try again." });
          return true;
        }
        const messages = m.actions.flatMap((action) =>
          hub.receive(c, { type: "action", action }),
        );
        reply(200, { messages });
        return true;
      }
      reply(405, { error: "Unsupported crew request." });
    } catch {
      reply(400, { error: "That crew request could not be read. Try again." });
    }
    return true;
  }
  return {
    handle,
    cleanup() {
      for (const [token, c] of sessions)
        if (Date.now() - c.last > 90000) {
          sessions.delete(token);
          hub.remove(c);
        }
    },
  };
}
async function readBody(req: IncomingMessage): Promise<Record<string, any>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 4096) throw Error("Request too large");
    chunks.push(chunk);
  }
  const value = JSON.parse(Buffer.concat(chunks).toString());
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Invalid request");
  return value;
}
