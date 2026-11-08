import { chromium } from "playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const dir = "references/redesign/after/offline";
await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:4173");
  await page.waitForFunction(() => !!window.render_game_to_text);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.click("[data-do=solo]");
  await page.click('[data-arrival="skip"]');
  await page.click('[data-do="beginExplore"]');
  await page.evaluate(() => window.advanceTime(2600));
  const before = JSON.parse(
    await page.evaluate(() => window.render_game_to_text()),
  );
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.render_game_to_text);
  await page.click("[data-do=resume]");
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).audio.ready === 9,
  );
  const start = JSON.parse(
    await page.evaluate(() => window.render_game_to_text()),
  ).player.x;
  await page.keyboard.down("ArrowLeft");
  await page.evaluate(() => window.advanceTime(500));
  await page.keyboard.up("ArrowLeft");
  await page.evaluate(() => window.advanceTime(100));
  const after = JSON.parse(
    await page.evaluate(() => window.render_game_to_text()),
  );
  assert.equal(after.started, true);
  assert.equal(after.phase, "day");
  assert.equal(after.sol, before.sol);
  assert.ok(after.player.x < start);
  assert.deepEqual(errors, []);
  await page.screenshot({
    animations: "disabled",
    path: `${dir}/offline-resume.png`,
  });
  await fs.writeFile(`${dir}/state.json`, JSON.stringify(after, null, 2));
  console.log(
    "PASS: production offline reload, save/resume, audio and movement; zero page errors.",
  );
} finally {
  await browser.close();
}
