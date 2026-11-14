import type { Game, Action } from "../../../shared/src/sim";
import { HttpCrew } from "./httpCrew";
export class CrewConnection {
  socket: WebSocket | undefined;
  id = "";
  room = "";
  transport: "websocket" | "http" = "websocket";
  heartbeat: ReturnType<typeof setInterval> | null = null;
  onState: (s: Game) => void = () => {};
  onError: (s: string) => void = () => {};
  onClose: () => void = () => {};
  private http: HttpCrew | null = null;
  private closed = false;
  constructor(private url: string) {
    try {
      this.socket = new WebSocket(url);
    } catch {}
  }
  async join(name: string, code?: string, seed = 42) {
    return new Promise<void>((resolve, reject) => {
      let ready = false,
        fallbackStarted = false;
      const request = { type: code ? "join" : "create", name, code, seed };
      const detach = () => {
        if (this.heartbeat) {
          clearInterval(this.heartbeat);
          this.heartbeat = null;
        }
        if (this.socket) {
          this.socket.onclose = null;
          this.socket.onerror = null;
          this.socket.onmessage = null;
          this.socket.close();
        }
      };
      const fallback = async () => {
        if (ready || fallbackStarted || this.closed) return;
        fallbackStarted = true;
        clearTimeout(timeout);
        detach();
        const base = new URL(this.url);
        base.protocol = base.protocol === "wss:" ? "https:" : "http:";
        base.pathname = "/api/crew";
        base.search = "";
        base.hash = "";
        try {
          const h = await HttpCrew.join(
            base.href,
            request,
            (s) => this.onState(s),
            (e) => this.onError(e),
            () => this.onClose(),
          );
          if (this.closed) {
            h.close();
            reject(Error("Connection cancelled."));
            return;
          }
          this.http = h;
          this.transport = "http";
          this.id = h.id;
          this.room = h.room;
          this.onState(h.state);
          ready = true;
          resolve();
          h.start();
        } catch (e) {
          reject(e);
        }
      };
      const timeout = setTimeout(() => void fallback(), 8000),
        socket = this.socket;
      if (!socket) {
        void fallback();
        return;
      }
      socket.onopen = () => socket.send(JSON.stringify(request));
      socket.onerror = () => {
        if (!ready) void fallback();
      };
      socket.onmessage = (event) => {
        if (fallbackStarted) return;
        try {
          const m = JSON.parse(event.data);
          if (m.type === "welcome") {
            this.id = m.id;
            this.room = m.room;
            this.heartbeat = setInterval(() => {
              if (socket.readyState === WebSocket.OPEN)
                socket.send(JSON.stringify({ type: "ping" }));
            }, 25000);
          }
          if (m.type === "state") {
            this.onState(m.state);
            if (!ready && this.id && m.state.players?.[this.id]) {
              ready = true;
              clearTimeout(timeout);
              resolve();
            }
          }
          if (m.type === "error") {
            this.onError(m.message);
            if (!ready) {
              clearTimeout(timeout);
              reject(Error(m.message));
              detach();
            }
          }
        } catch {
          this.onError(
            "The crew update could not be displayed. Refresh the game and try again.",
          );
        }
      };
      socket.onclose = () => {
        clearTimeout(timeout);
        if (this.heartbeat) clearInterval(this.heartbeat);
        if (!ready) {
          void fallback();
          return;
        }
        this.onClose();
      };
    });
  }
  send(a: Action) {
    if (this.http) this.http.send(a);
    else if (this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify({ type: "action", action: a }));
  }
  close() {
    this.closed = true;
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.http?.close();
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close();
    }
  }
}
