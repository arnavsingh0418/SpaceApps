import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { serveGame } from "./http";
import { CrewRooms, type CrewClient } from "./rooms";
import { crewHTTP } from "./crewHttp";
const hub = new CrewRooms(),
  http = crewHTTP(hub),
  clients = new Map<WebSocket, CrewClient>();
const server = createServer((req, res) => {
  void http
    .handle(req, res)
    .then((handled) => {
      if (!handled) return serveGame(req, res, hub.rooms.size);
    })
    .catch(() => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
});
const wss = new WebSocketServer({ server, maxPayload: 4096 });
const send = (ws: WebSocket, value: object) => {
  if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 1e6)
    ws.send(JSON.stringify(value));
};
wss.on("connection", (ws) => {
  const c = hub.client();
  clients.set(ws, c);
  ws.on("message", (raw) => {
    try {
      for (const m of hub.receive(c, JSON.parse(raw.toString()))) send(ws, m);
    } catch {
      send(ws, { type: "error", message: "That action could not be read." });
    }
  });
  ws.on("close", () => {
    hub.remove(c);
    clients.delete(ws);
  });
});
const interval = setInterval(() => {
  hub.tick();
  http.cleanup();
  for (const [ws, c] of clients) {
    if (Date.now() - c.last > 90000) {
      ws.close(1001, "Idle connection");
      continue;
    }
    const state = hub.state(c);
    if (state) send(ws, { type: "state", state });
  }
}, 100);
server.listen(Number(process.env.PORT) || 2567, "0.0.0.0", () =>
  console.log(
    `Crew server listening on http://localhost:${process.env.PORT || 2567}`,
  ),
);
function shutdown() {
  clearInterval(interval);
  wss.clients.forEach((w) => w.close());
  server.close();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
