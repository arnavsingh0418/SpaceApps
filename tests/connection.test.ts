import { afterEach, it, expect, vi } from "vitest";
import { CrewConnection } from "../client/src/net/crew";
import { createGame, addPlayer } from "../shared/src/sim";
class Socket {
  static OPEN = 1;
  readyState = 1;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(_url: string) {}
  send(text: string) {
    this.sent.push(text);
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("keeps a crew connection alive without animation frames and stops on close", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", Socket);
  const client = new CrewConnection("ws://localhost:2567");
  const joined = client.join("Explorer");
  const socket = client.socket as unknown as Socket;
  socket.onopen!();
  socket.onmessage!({
    data: JSON.stringify({ type: "welcome", id: "player-1", room: "48271" }),
  });
  const state = createGame(42);
  addPlayer(state, "player-1");
  socket.onmessage!({ data: JSON.stringify({ type: "state", state }) });
  await joined;
  vi.advanceTimersByTime(100000);
  expect(socket.sent.filter((s) => JSON.parse(s).type === "ping")).toHaveLength(
    4,
  );
  expect(client.room).toBe("48271");
  client.close();
  const sent = socket.sent.length;
  vi.advanceTimersByTime(100000);
  expect(socket.sent).toHaveLength(sent);
});
it("connection timeouts explain that solo mode is available", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", Socket);
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(Error("offline")));
  const client = new CrewConnection("ws://localhost:2567");
  const joined = client.join("Explorer");
  const assertion = expect(joined).rejects.toThrow(
    "Solo play is always available",
  );
  vi.advanceTimersByTime(8001);
  await assertion;
});
