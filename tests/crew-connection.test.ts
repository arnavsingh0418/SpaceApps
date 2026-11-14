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
it("tries the fallback and explains when both connection routes fail", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", Socket);
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(Error("offline")));
  const c = new CrewConnection("ws://example.test/crew"),
    joined = c.join("Friend");
  Socket.latest.close();
  await expect(joined).rejects.toThrow("Solo play is always available");
});
it("joins through HTTP when WebSockets fail, then sends actions through that session", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", Socket);
  const state = createGame(42);
  addPlayer(state, "fallback");
  const fetcher = vi.fn(
    async (_url: string, options: any = {}) =>
      new Response(
        JSON.stringify(
          options.method === "POST" && !String(_url).endsWith("/actions")
            ? { id: "fallback", room: "48271", token: "test-session", state }
            : options.method === "GET"
              ? { state }
              : { messages: [] },
        ),
        { status: 200 },
      ),
  );
  vi.stubGlobal("fetch", fetcher);
  const c = new CrewConnection("wss://example.test/crew"),
    joined = c.join("Friend");
  Socket.latest.onerror?.();
  await joined;
  expect(c.transport).toBe("http");
  expect(c.id).toBe("fallback");
  expect(c.room).toBe("48271");
  c.send({ type: "selectSlot", slot: 4 });
  await Promise.resolve();
  expect(
    fetcher.mock.calls.some(
      ([url]) => url === "https://example.test/api/crew/actions",
    ),
  ).toBe(true);
  c.close();
});
