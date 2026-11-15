export class ScreenDust {
  private canvas = document.createElement("canvas");
  private ctx = this.canvas.getContext("2d")!;
  private motes = Array.from({ length: 90 }, (_, i) => ({
    x: (i * 0.618) % 1,
    y: (i * 0.377) % 1,
    size: 1 + (i % 6),
    speed: 0.2 + (i % 9) * 0.07,
  }));
  intensity = 0;
  constructor() {
    this.canvas.className = "screen-dust";
    this.canvas.setAttribute("aria-hidden", "true");
    this.canvas.hidden = true;
    document.body.append(this.canvas);
  }
  update(time: number, intensity: number, reduced: boolean) {
    this.intensity = intensity;
    this.canvas.hidden = intensity <= 0;
    if (!intensity) return;
    const width = Math.round(innerWidth * 0.5),
      height = Math.round(innerHeight * 0.5);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = `rgba(179,114,67,${intensity * (reduced ? 0.18 : 0.37)})`;
    ctx.fillRect(0, 0, width, height);
    for (const mote of this.motes) {
      const x = ((mote.x + (reduced ? 0 : time * mote.speed)) % 1) * width;
      const y = ((mote.y + (reduced ? 0 : time * 0.09)) % 1) * height;
      ctx.fillStyle = `rgba(231,171,108,${intensity * (reduced ? 0.23 : 0.52)})`;
      ctx.beginPath();
      ctx.ellipse(
        x,
        y,
        mote.size * (reduced ? 1 : 3),
        mote.size * 0.32,
        0.14,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }
}
