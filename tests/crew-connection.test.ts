import { it, expect, vi, afterEach } from "vitest";
import { CrewConnection } from "../client/src/net/crew";
import { createGame, addPlayer } from "../shared/src/sim";
class Socket {
  static OPEN = 1;
  static latest: Socket;
  readyState = 1;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  constructor() {
    Socket.latest = this;
  }
  send(_value: string) {}
  close() {
    this.onclose?.();
  }
  message(value: unknown) {
    this.onmessage?.({ data: JSON.stringify(value) });
  }
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("waits for the joining player's first snapshot before starting gameplay", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", Socket);
  const c = new CrewConnection("ws://example.test/crew");
  let ready = false;
  const joined = c.join("Friend").then(() => {
    ready = true;
  });
  const socket = Socket.latest;
  socket.message({ type: "welcome", id: "friend", room: "48271" });
  await Promise.resolve();
  expect(ready).toBe(false);
  const s = createGame(42);
  addPlayer(s, "other");
  socket.message({ type: "state", state: s });
  await Promise.resolve();
  expect(ready).toBe(false);
  addPlayer(s, "friend");
  let received = false;
  c.onState = () => {
    received = true;
  };
  socket.message({ type: "state", state: s });
  await joined;
  expect(received).toBe(true);
  expect(ready).toBe(true);
  expect(c.room).toBe("48271");
  c.close();
});
it("rejects a connection closed before the initial state instead of hanging", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", Socket);
  const c = new CrewConnection("ws://example.test/crew"),
    joined = c.join("Friend");
  Socket.latest.close();
  await expect(joined).rejects.toThrow("before the crew was ready");
});
