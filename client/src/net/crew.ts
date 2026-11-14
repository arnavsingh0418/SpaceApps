import type { Game, Action } from "../../../shared/src/sim";
export class CrewConnection {
  socket: WebSocket;
  id = "";
  room = "";
  heartbeat: ReturnType<typeof setInterval> | null = null;
  onState: (s: Game) => void = () => {};
  onError: (s: string) => void = () => {};
  onClose: () => void = () => {};
  constructor(url: string) {
    this.socket = new WebSocket(url);
  }
  async join(name: string, code?: string, seed = 42) {
    return new Promise<void>((resolve, reject) => {
      let ready = false;
      const timeout = setTimeout(() => {
        reject(
          Error("Crew server did not answer. Solo play is always available."),
        );
        this.socket.close();
      }, 8000);
      this.socket.onopen = () =>
        this.socket.send(
          JSON.stringify({ type: code ? "join" : "create", name, code, seed }),
        );
      this.socket.onerror = () => {
        clearTimeout(timeout);
        reject(
          Error(
            "Multiplayer is unavailable on this website right now. Try again shortly, or play solo.",
          ),
        );
      };
      this.socket.onmessage = (event) => {
        try {
          const m = JSON.parse(event.data);
          if (m.type === "welcome") {
            this.id = m.id;
            this.room = m.room;
            this.heartbeat = setInterval(() => {
              if (this.socket.readyState === WebSocket.OPEN)
                this.socket.send(JSON.stringify({ type: "ping" }));
            }, 25000);
          }
          if (m.type === "state") {
            this.onState(m.state);
            // A welcome identifies us, but gameplay needs our authoritative player too.
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
              this.socket.close();
            }
          }
        } catch {
          this.onError("The crew server sent an unreadable update.");
        }
      };
      this.socket.onclose = () => {
        clearTimeout(timeout);
        if (this.heartbeat) clearInterval(this.heartbeat);
        if (!ready)
          reject(
            Error("Connection closed before the crew was ready. Try again."),
          );
        this.onClose();
      };
    });
  }
  send(a: Action) {
    if (this.socket.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify({ type: "action", action: a }));
  }
  close() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.socket.onclose = null;
    this.socket.close();
  }
}
