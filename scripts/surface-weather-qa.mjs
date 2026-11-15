import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const origin = process.env.TEST_SITE ?? "http://127.0.0.1:5173";
const output = "artifacts/surface-weather";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const schedule = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) =>
      callback.name === "frame" ? 0 : schedule(callback);
  });
  // Keep the real terrain and rover while reducing unrelated software-rendering work.
  await page.route("**/mars/models/*.glb", (route) => route.abort());
  const state = () =>
    page.evaluate(() => JSON.parse(window.render_game_to_text()));
  const advance = (ms) => page.evaluate((ms) => window.advanceTime(ms), ms);
  async function scene(name) {
    await page.goto(origin + "/?qaScene=" + name);
    await page.waitForFunction(
      () => window.__world?.terrain.ready && window.render_game_to_text,
      null,
      { polling: 150, timeout: 90000 },
    );
    console.log("Checking", name);
  }
  const screenshot = (name) =>
    page.screenshot({ path: output + "/" + name + ".png" });
  async function drive(key, seconds) {
    await page.keyboard.down(key);
    try {
      for (let i = 0; i < seconds * 5; i++) await advance(200);
    } finally {
      await page.keyboard.up(key);
    }
  }

  await scene("storm-impact");
  await advance(950);
  assert.ok((await state()).weather.screenDust > 0.7);
  await screenshot("dust-impact");
  await advance(7400);
  assert.equal((await state()).weather.screenDust, 0);

  await scene("devil");
  const before = await state();
  for (let i = 0; i < 5; i++) await advance(150);
  const gust = await state();
  assert.ok(
    Math.hypot(
      gust.player.x - before.player.x,
      gust.player.z - before.player.z,
    ) > 3,
  );
  assert.ok((gust.rover.gust?.height ?? 0) > 0.5);
  assert.ok((gust.player.gust?.height ?? 0) > 0.5);
  await screenshot("vortex");

  await scene("rover-driving");
  await drive("w", 3);
  assert.ok((await state()).weather.tracks.tireMarks > 4);
  await screenshot("tire-tracks");

  await scene("near-item");
  await drive("s", 3);
  const bootMarks = (await state()).weather.tracks.footprints;
  assert.ok(bootMarks > 4);
  await screenshot("footprints");
  await advance(18000);
  assert.ok((await state()).weather.tracks.footprints >= bootMarks);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: player and rover lift, temporary screen dust, persistent footprints and tire tracks.",
  );
} finally {
  await browser.close();
}
