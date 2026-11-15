import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const out = "artifacts/opening-qa";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const raf = requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (f) => (f.name === "frame" ? 0 : raf(f));
  });
  await page.goto("http://127.0.0.1:5173");
  await page.waitForFunction(() => window.render_game_to_text, null, {
    polling: 100,
    timeout: 90000,
  });
  await page.click("[data-do=solo]");
  const state = () =>
    page.evaluate(() => JSON.parse(window.render_game_to_text()));
  const step = (ms) => page.evaluate((ms) => window.advanceTime(ms), ms);
  await step(1500);
  assert.equal((await state()).arrival.shot, "prologue");
  await page.click("[data-arrival=pause]");
  const paused = (await state()).arrival.elapsed;
  await step(1000);
  assert.equal((await state()).arrival.elapsed, paused);
  await page.click("[data-arrival=pause]");
  await page.click("[data-arrival=previous]");
  const shots = [];
  for (let i = 0; i < 40; i++) {
    const s = await state();
    if (!s.arrival) break;
    await step(1500);
    const a = (await state()).arrival;
    await step(1500);
    const b = (await state()).arrival;
    assert.notDeepEqual(
      a.camera,
      b.camera,
      "camera moves in " + s.arrival.shot,
    );
    shots.push(b.shot);
    if (
      [
        "prologue",
        "suitroom",
        "launch",
        "entry",
        "parachute",
        "egress",
        "resolve",
      ].includes(b.shot)
    )
      await page.screenshot({ path: out + "/" + b.shot + ".png" });
    await step((b.duration - 3.2) * 1000);
    await page.click("[data-arrival=next]");
  }
  assert.ok(shots.length > 20);
  assert.equal((await state()).modal, "briefing");
  await step(3000);
  assert.equal((await state()).seconds, 0);
  await page.click("[data-do=beginExplore]");
  const before = (await state()).player;
  await page.keyboard.down("s");
  await step(700);
  await page.keyboard.up("s");
  const after = (await state()).player;
  assert.ok(Math.hypot(after.x - before.x, after.z - before.z) > 0.5);
  await page.keyboard.press("5");
  await step(50);
  assert.equal((await state()).player.selectedSlot, 4);
  await page.screenshot({ path: out + "/exploring.png" });
  await writeFile(
    out + "/state.json",
    JSON.stringify({ shots, errors, state: await state() }, null, 2),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS opening chapters, continuous cameras, pause/resume, briefing, movement, empty slot",
    shots.length,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:5173");
  await page.click("[data-do=solo]");
  await step(1500);
  await page.screenshot({ path: out + "/phone.png" });
  await page.click("[data-arrival=motion]");
  await step(100);
  assert.equal((await state()).arrival.reduced, true);
  await page.click("[data-arrival=skip]");
  assert.equal((await state()).modal, "briefing");
  console.log("PASS phone, gentle motion and skip");
} finally {
  await browser.close();
}
