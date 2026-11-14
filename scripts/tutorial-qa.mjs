import { chromium } from "playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const dir = process.argv[2] || "references/redesign/after/task-2-functional";
await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({
  viewport: { width: 1600, height: 900 },
  reducedMotion: "reduce",
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:5173");
await page.click("[data-do=solo]");
await page.click('[data-arrival="skip"]');
await page.evaluate(() => window.advanceTime(5000));
assert.equal(JSON.parse(await page.evaluate(() => window.render_game_to_text())).seconds, 0, "briefing pauses the mission clock");
await page.click('[data-do="beginExplore"]');
await page.evaluate(() => window.advanceTime(100));
const state = async () =>
  JSON.parse(await page.evaluate(() => window.render_game_to_text()));
assert.equal((await state()).modal, "");
assert.equal((await state()).hudGroups, 4);
async function walk(x, z, reach = 0.4) {
  for (let guard = 0; guard < 100; guard++) {
    const p = (await state()).player,
      dx = x - p.x,
      dz = z - p.z;
    if (Math.hypot(dx, dz) < reach) return;
    const key =
      Math.abs(dx) > Math.abs(dz)
        ? dx > 0
          ? "ArrowRight"
          : "ArrowLeft"
        : dz > 0
          ? "ArrowDown"
          : "ArrowUp";
    await page.keyboard.down(key);
    await page.evaluate(() => window.advanceTime(100));
    await page.keyboard.up(key);
  }
  throw Error(`Could not reach tutorial target (${x}, ${z})`);
}
await walk(-6.6, 8.8);
assert.equal((await state()).tutorial, 1);
await page.keyboard.press("e");
await page.evaluate(() => window.advanceTime(100));
assert.equal((await state()).tutorial, 2);
assert.equal((await state()).player.bag.scrap, 6);
await walk(17.6, 10);
await walk(17.6, -2.2, 1.5);
await page.keyboard.press("e");
await page.evaluate(() => window.advanceTime(800));
await page.click('[data-do=answer][data-answer="0"]');
await page.evaluate(() => window.advanceTime(100));
assert.equal((await state()).tutorial, 3);
await walk(7, -2.2);
await walk(0, -4.4, 1.5);
await page.keyboard.press("e");
await page.click("[data-do=store]");
await page.evaluate(() => window.advanceTime(100));
assert.equal((await state()).tutorial, 4);
await page.click("[data-do=close]");
await page.screenshot({ path: `${dir}/tutorial-complete.png` });
await page.evaluate(() => window.advanceTime(211000));
assert.equal((await state()).phase, "summary");
await page.click("[data-do=next]");
await page.evaluate(() => window.advanceTime(100));
assert.equal((await state()).modal, "power");
await page.getByRole("button", { name: "Less radio power" }).click();
await page.locator("[data-row=air]").focus();
await page.keyboard.press("+");
await page.keyboard.press("-");
await page.click("[data-do=lock]");
await page.evaluate(() => window.advanceTime(500));
assert.equal((await state()).phase, "day");
assert.equal((await state()).modal, "");
await fs.writeFile(`${dir}/state.json`, JSON.stringify(await state(), null, 2));
await fs.writeFile(`${dir}/errors.json`, JSON.stringify(errors));
assert.deepEqual(errors, []);
console.log(
  "PASS: real-input tutorial, HUD groups, sol summary, second-sol power, keyboard pips, lock-in.",
);
await browser.close();
