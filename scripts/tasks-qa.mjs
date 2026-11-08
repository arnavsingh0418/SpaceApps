import { chromium } from "playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const dir = "references/redesign/after/task-7-controls";
await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({
      viewport: { width: 1600, height: 900 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("http://127.0.0.1:5173");
  await page.waitForFunction(() => !!window.render_game_to_text);
  const state = async () =>
    JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  const advance = (ms) => page.evaluate((n) => window.advanceTime(n), ms);
  assert.equal((await state()).audio.muted, true);
  await page.click("[data-do=solo]");
  await page.click('[data-arrival="skip"]');
  await page.click('[data-do="beginExplore"]');
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).audio.ready === 9,
  );
  assert.equal((await state()).audio.muted, false);
  await page.evaluate(() => window.__stageScene("tasks"));
  await advance(100);
  async function go(x, z) {
    for (let i = 0; i < 120; i++) {
      const p = (await state()).player,
        dx = x - p.x,
        dz = z - p.z;
      if (Math.hypot(dx, dz) < 0.4) return;
      const key =
        Math.abs(dx) > Math.abs(dz)
          ? dx > 0
            ? "ArrowRight"
            : "ArrowLeft"
          : dz > 0
            ? "ArrowDown"
            : "ArrowUp";
      await page.keyboard.down(key);
      await advance(100);
      await page.keyboard.up(key);
    }
    throw Error("walk timeout");
  }
  await page.keyboard.press("e");
  await page.click("[data-kind=wire]");
  for (let n = 0; n < 3; n++) {
    await page.click(`[data-side="0"][data-wire="${n}"]`);
    await page.click(`[data-side="1"][data-wire="${n}"]`);
  }
  await advance(2200);
  await page.click("[data-do=finishTask]");
  assert.equal((await state()).player.bag.circuit, 1);
  await go(-8, 7);
  await page.keyboard.press("e");
  await page.click("[data-do=clean]");
  for (let n = 0; n < 18; n++) await page.click(`[data-dust="${n}"]`);
  await advance(2200);
  await page.click("[data-do=finishTask]");
  assert.equal((await state()).panels[0].clean, 1);
  await page.keyboard.press("e");
  await page.click("[data-do=cover]");
  assert.equal((await state()).panels[0].covered, true);
  await page.keyboard.press("e");
  await page.click("[data-do=cover]");
  assert.equal((await state()).panels[0].covered, false);
  await go(6, 6);
  await page.keyboard.press("e");
  await advance(900);
  await page.click("[data-kind=patch]");
  for (let n = 0; n < 3; n++) await page.click(`[data-hole="${n}"]`);
  await advance(2200);
  await page.click("[data-do=finishTask]");
  assert.equal((await state()).leakFixed, true);
  await go(8, -1);
  await page.keyboard.press("e");
  await advance(900);
  await page.click("[data-kind=water]");
  await page.locator("#water").focus();
  await page.keyboard.press("End");
  await advance(2200);
  await page.click("[data-do=finishTask]");
  assert.equal((await state()).watering, true);
  assert.equal((await state()).stock.ice, 5);
  await go(-9, -7);
  await page.keyboard.press("e");
  await advance(900);
  await page.click("[data-kind=align]");
  const needle = await page.locator("#needle").boundingBox();
  await page.mouse.click(
    needle.x + needle.width * 0.72,
    needle.y + needle.height / 2,
  );
  await advance(2200);
  await page.click("[data-do=finishTask]");
  assert.equal((await state()).aligned, true);
  assert.equal((await state()).radio, 3);
  await page.keyboard.press("g");
  assert.equal((await state()).player.bag.circuit, undefined);
  await page.click("[data-do=pause]");
  await page.click("[data-do=mute]");
  assert.equal((await state()).audio.muted, true);
  await page.click("[data-do=mute]");
  assert.equal((await state()).audio.muted, false);
  const volume = await page.locator("#master-volume").boundingBox();
  await page.mouse.click(
    volume.x + volume.width * 0.25,
    volume.y + volume.height / 2,
  );
  assert.ok((await state()).audio.volume < 40);
  await page.screenshot({
    animations: "disabled",
    path: `${dir}/sound-controls.png`,
  });
  await page.click("[data-do=close]");
  await page.evaluate(() => window.__stageScene("scan"));
  await advance(900);
  await page.click('[data-answer="1"]');
  assert.equal((await state()).learned.includes("shield"), false);
  assert.equal((await state()).modal, "learn");
  await page.click('[data-answer="0"]');
  assert.equal((await state()).learned.includes("shield"), true);
  await fs.writeFile(
    `${dir}/state.json`,
    JSON.stringify(await state(), null, 2),
  );
  await fs.writeFile(`${dir}/errors.json`, JSON.stringify(errors));
  assert.deepEqual(errors, []);
  console.log(
    "PASS: all five mini-tasks, cover/uncover, drop, sound unlock/mute/volume, incorrect quiz and retry.",
  );
} finally {
  await browser.close();
}
