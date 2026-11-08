import { chromium } from "playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const dir = "references/redesign/after/task-4-motion";
await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5173");
  await page.click("[data-do=solo]");
  const state = async () =>
    JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  const advance = (ms) => page.evaluate((n) => window.advanceTime(n), ms);
  await advance(100);
  const idle = (await state()).motion.actors[0].scaleY;
  await advance(500);
  assert.notEqual((await state()).motion.actors[0].scaleY, idle);
  await page.keyboard.down("ArrowLeft");
  await advance(500);
  const walk = (await state()).motion.actors[0];
  assert.ok(walk.arm * walk.leg <= 0);
  await page.screenshot({ path: `${dir}/walk.png` });
  await page.keyboard.up("ArrowLeft");
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
  await go(-3, 4);
  await page.keyboard.press("e");
  assert.equal((await state()).player.bag.scrap, 6);
  await advance(100);
  assert.ok((await state()).motion.flights > 0);
  await page.screenshot({ path: `${dir}/pickup.png` });
  await advance(500);
  assert.equal((await state()).motion.actors[0].carrying, true);
  await go(-10, 2);
  await page.keyboard.press("e");
  await advance(100);
  assert.ok((await state()).motion.scans > 0);
  await page.screenshot({ path: `${dir}/scan.png` });
  await advance(800);
  await page.click('[data-do=answer][data-answer="0"]');
  await go(-12, 3);
  await page.keyboard.press("e");
  await go(-15, 10);
  await page.keyboard.press("e");
  await go(0, -2);
  await page.keyboard.press("e");
  await page.click("[data-do=store]");
  await page.click("[data-do=build]");
  await advance(800);
  assert.equal((await state()).modal, "building");
  assert.ok((await state()).motion.particles > 0);
  await page.screenshot({ path: `${dir}/build.png` });
  await advance(1600);
  assert.ok((await state()).built.includes("shelter"));
  await advance(200);
  await page.screenshot({ path: `${dir}/structure-grow.png` });
  await page.evaluate(() => window.__stageScene("storm"));
  await advance(5500);
  assert.ok((await state()).motion.storm > 0.9);
  await page.screenshot({ path: `${dir}/storm.png` });
  await page.evaluate(() => window.__stageScene("flare"));
  await page.click("[data-do=choice][data-choice=work]");
  await advance(100);
  assert.ok((await state()).resources.dose > 0);
  await page.screenshot({ path: `${dir}/dose.png` });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).motion.reduced,
  );
  await advance(500);
  assert.equal((await state()).motion.reduced, true);
  assert.equal((await state()).motion.actors[0].scaleY, 1.35);
  await page.screenshot({ path: `${dir}/reduced-motion.png` });
  await fs.writeFile(
    `${dir}/state.json`,
    JSON.stringify(await state(), null, 2),
  );
  await fs.writeFile(`${dir}/errors.json`, JSON.stringify(errors));
  assert.deepEqual(errors, []);
  console.log(
    "PASS: idle/walk, pickup arc/carry, scan beam, build, growth, storm tint, dose flash, and reduced motion.",
  );
} finally {
  await browser.close();
}
