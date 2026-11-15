import type { Action, Game } from "../../../shared/src/sim";
const networkError =
  "Could not connect to multiplayer. Check your internet and try again. Solo play is always available.";
export class HttpCrew {
  id = "";
  room = "";
  state!: Game;
  private token = "";
  private closed = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private queue: Action[] = [];
  private sending = false;
  private failures = 0;
  constructor(
    private base: string,
    private onState: (s: Game) => void,
    private onError: (s: string) => void,
    private onClose: () => void,
  ) {}
  static async join(
    base: string,
    request: object,
    onState: (s: Game) => void,
    onError: (s: string) => void,
    onClose: () => void,
  ) {
    const c = new HttpCrew(base, onState, onError, onClose),
      result = await c.request("", "POST", request);
    if (!result.token || !result.state?.players?.[result.id])
      throw Error("The crew is not ready yet. Try again.");
    c.id = result.id;
    c.room = result.room;
    c.token = result.token;
    c.state = result.state;
    return c;
  }
  private async request(path: string, method = "GET", body?: object) {
    const controller = new AbortController(),
      timeout = setTimeout(() => controller.abort(), 45000);
    try {
      let response: Response;
      try {
        response = await fetch(this.base + path, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
          signal: controller.signal,
          cache: "no-store",
        });
      } catch {
        throw Error(networkError);
      }
      let value: any;
      try {
        value = await response.json();
      } catch {
        throw Error(
          "This game link does not have multiplayer. Open test-nasa.onrender.com and try again.",
        );
      }
      if (!response.ok) throw Error(value.error || networkError);
      return value;
    } finally {
      clearTimeout(timeout);
    }
  }
  start() {
    if (!this.closed) this.timer = setTimeout(() => void this.poll(), 200);
  }
  private async poll() {
    if (this.closed) return;
    try {
      const value = await this.request("");
      if (this.closed) return;
      this.state = value.state;
      this.onState(value.state);
      this.failures = 0;
    } catch (e) {
      if (++this.failures >= 3 && !this.closed) {
        this.onError((e as Error).message);
        this.close();
        this.onClose();
        return;
      }
    }
    this.start();
  }
  send(action: Action) {
    if (this.closed) return;
    if (["move", "pos", "flightMove", "flightSteer"].includes(action.type)) {
      const pending = this.queue.findIndex((a) => a.type === action.type);
      if (pending >= 0) this.queue[pending] = action;
      else this.queue.push(action);
    } else this.queue.push(action);
    if (!this.sending) void this.flush();
  }
  private async flush() {
    this.sending = true;
    while (this.queue.length && !this.closed) {
      const actions = this.queue.splice(0, 16);
      try {
        const value = await this.request("/actions", "POST", { actions });
        if (!this.closed)
          for (const m of value.messages || [])
            if (m.type === "error") this.onError(m.message);
      } catch (e) {
        if (!this.closed) this.onError((e as Error).message);
      }
    }
    this.sending = false;
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    this.queue = [];
    void fetch(this.base, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${this.token}` },
      keepalive: true,
    }).catch(() => {});
  }
}
