const names = [
  "footstep",
  "pickup",
  "scan",
  "build",
  "storm",
  "flare",
  "power",
  "click",
  "success",
] as const;
type Name = (typeof names)[number];
export class Sfx {
  context: AudioContext | null = null;
  master: GainNode | null = null;
  buffers = new Map<Name, AudioBuffer>();
  pending = new Map<Name, Promise<void>>();
  loops = new Map<Name, AudioBufferSourceNode>();
  muted = true;
  volume = 0.35;
  async unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
      this.sync();
    }
    await this.context.resume();
    await Promise.all(names.map((n) => this.load(n)));
  }
  async load(name: Name) {
    if (this.buffers.has(name)) return;
    if (this.pending.has(name)) return this.pending.get(name);
    const promise = (async () => {
      try {
        const r = await fetch(
          new URL(
            `${import.meta.env.BASE_URL}sfx/${name}.wav`,
            document.baseURI,
          ),
        );
        if (!r.ok) return;
        const data = await r.arrayBuffer();
        this.buffers.set(name, await this.context!.decodeAudioData(data));
      } catch {}
    })();
    this.pending.set(name, promise);
    return promise;
  }
  sync() {
    if (this.master && this.context)
      this.master.gain.setTargetAtTime(
        this.muted ? 0 : this.volume,
        this.context.currentTime,
        0.025,
      );
    if (this.muted) this.stopLoops();
  }
  play(kind: string) {
    const name: Name =
      kind === "step"
        ? "footstep"
        : kind === "built" ||
            ["clean", "align", "patch", "wire", "water"].includes(kind)
          ? "success"
          : kind === "dose"
            ? "flare"
            : names.includes(kind as Name)
              ? (kind as Name)
              : "click";
    if (this.muted || !this.context) return;
    if (!this.buffers.has(name)) {
      void this.load(name).then(() => {
        if (this.buffers.has(name)) this.play(name);
      });
      return;
    }
    const source = this.context.createBufferSource();
    source.buffer = this.buffers.get(name)!;
    source.connect(this.master!);
    source.start();
    source.onended = () => source.disconnect();
  }
  loop(name: "build" | "storm", active: boolean) {
    if (!active || this.muted) {
      this.loops.get(name)?.stop();
      this.loops.delete(name);
      return;
    }
    if (this.loops.has(name) || !this.context || !this.buffers.has(name))
      return;
    const source = this.context.createBufferSource();
    source.buffer = this.buffers.get(name)!;
    source.loop = true;
    const gain = this.context.createGain();
    gain.gain.value = name === "storm" ? 0.3 : 0.4;
    source.connect(gain);
    gain.connect(this.master!);
    source.start();
    this.loops.set(name, source);
    source.onended = () => gain.disconnect();
  }
  stopLoops() {
    for (const source of this.loops.values()) source.stop();
    this.loops.clear();
  }
  get ready() {
    return this.buffers.size;
  }
}
