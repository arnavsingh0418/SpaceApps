import { chromium } from "playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const dir = "references/alien-mission";
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
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("http://127.0.0.1:5173");
  await page.waitForFunction(() => !!window.__stageScene);
  await page.waitForFunction(() => window.__world.terrain.ready);
  const state = async () =>
    JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  const step = async (ms) => page.evaluate((ms) => window.advanceTime(ms), ms);
  const capture = async (name) => {
    // Manual stepping batches simulation ticks; settle the visual camera separately.
    if (name !== "installing-core")
      await page.evaluate(() => {
        for (let i = 0; i < 12; i++) window.advanceTime(100);
      });
    await page.screenshot({
      path: `${dir}/${name}.png`,
      animations: "disabled",
    });
    await fs.writeFile(
      `${dir}/${name}.json`,
      JSON.stringify(await state(), null, 2),
    );
  };
  // Actual new-mission flow: skip the optional film, read the new goal, then walk to Nemi.
  await page.click("[data-do=solo]");
  await page.click("[data-arrival=skip]");
  await page.click("[data-do=beginExplore]");
  await step(100);
  await page.keyboard.press("Escape");
  await page.click("[data-do=skip]");
  await step(100);
  for (let i = 0; i < 90; i++) {
    const p = (await state()).player;
    if (p.x < -31) break;
    await page.keyboard.down("ArrowLeft");
    await step(100);
    await page.keyboard.up("ArrowLeft");
  }
  for (let i = 0; i < 40; i++) {
    const p = (await state()).player;
    if (p.z < -5.2) break;
    await page.keyboard.down("ArrowUp");
    await step(100);
    await page.keyboard.up("ArrowUp");
  }
  assert.ok(
    (await state()).player.x < -30,
    "can reach Nemi on the actual base terrain",
  );
  await page.keyboard.press("e");
  await step(1000);
  assert.equal((await state()).modal, "alien");
  await capture("meet-nemi");
  await page.click("[data-do=close]");
  // Dev fixtures only provide carried materials / distant positions. All quest and repair actions use the real UI and shared rules.
  await page.evaluate(() => window.__stageScene("alien"));
  await step(1000);
  await page.click("[data-do=acceptAlien]");
  await step(100);
  for (const kind of ["ice", "glass", "scrap"])
    await page.click(`[data-do=donateAlien][data-kind=${kind}]`);
  assert.deepEqual((await state()).alienQuest.delivered, {
    ice: 3,
    glass: 2,
    scrap: 2,
  });
  await capture("crew-delivery");
  await page.click("[data-do=beginAlienRepair]");
  for (let i = 0; i < 6; i++) await page.click(`[data-alien-dust="${i}"]`);
  await step(2200);
  await page.click("[data-do=finishAlienRepair]");
  await step(200);
  assert.equal((await state()).alienQuest.brushed, true);
  await page.click('[data-do=alienAnswer][data-answer="0"]');
  assert.equal((await state()).alienQuest.completed, false);
  assert.match(
    await page.locator(".alien-feedback").innerText(),
    /contaminants/,
  );
  await page.click('[data-do=alienAnswer][data-answer="1"]');
  await step(1200);
  assert.equal((await state()).returnMission.recovered.nav, "Prototype");
  assert.equal((await state()).alienQuest.completed, true);
  await capture("navigation-core-reward");
  await page.click("[data-do=alienSpeak]");
  await step(100);
  assert.ok(
    ["device", "subtitles", "recorded"].includes(
      (await state()).alienVoice.mode,
    ),
  );
  await page.click("[data-do=close]");
  assert.equal((await state()).alienVoice.speaking, false);
  await page.evaluate(() => window.__stageScene("ship"));
  await step(1700);
  assert.ok((await state()).shipAssembly.slots.every((x) => x.broken));
  await capture("broken-ship");
  await page.evaluate(() => window.__stageScene("ship-ready"));
  await step(1800);
  await capture("parts-ready");
  for (const part of ["booster", "hull", "nav", "air"]) {
    await page.click(`[data-do=installPart][data-part=${part}]`);
    await step(150);
    if (part === "nav") {
      assert.equal((await state()).shipAssembly.installing, "nav");
      await capture("installing-core");
    }
    await step(1600);
  }
  assert.ok(
    (await state()).shipAssembly.slots.every((x) => x.installed && !x.broken),
  );
  await capture("ship-rebuilt");
  await page.click("[data-do=launchShip]");
  await step(100);
  assert.equal((await state()).phase, "flight");
  assert.ok((await state()).returnMission.flight.deck);
  await capture("physical-flight-deck");
  for (const size of [
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    for (const scene of ["alien", "alien-reward", "ship-ready"]) {
      await page.evaluate((s) => window.__stageScene(s), scene);
      await step(1800);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      assert.equal(overflow, false, `${scene} viewport overflow`);
      await capture(`${scene}-${size.width}`);
    }
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(() => window.__world.motion.reduced);
  await page.evaluate(() => window.__stageScene("ship-ready"));
  await page.click("[data-do=installPart][data-part=nav]");
  await step(100);
  assert.equal((await state()).shipAssembly.installing, "");
  await capture("reduced-motion");
  assert.deepEqual(errors, []);
  await fs.writeFile(`${dir}/errors.json`, JSON.stringify(errors));
  console.log(
    "PASS: real walk to Nemi; deliveries, cleaning, retry, shared core, four repair animations, physical ship launch, 3 sizes, reduced motion, no page/console errors.",
  );
} finally {
  await browser.close();
}
