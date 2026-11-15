import { chromium } from "playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const dir = "artifacts/flight";
const layout = JSON.parse(
  await fs.readFile(
    new URL("../shared/src/data/flight-layout.json", import.meta.url),
    "utf8",
  ),
);
const base = process.env.QA_BASE_URL || "http://127.0.0.1:5173";
await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.QA_CHROME,
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
  await page.addInitScript(() => {
    const raf = requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => callback.name === "frame" ? 0 : raf(callback);
  });
  await page.goto(`${base}/?qaScene=flight`);
  await page.waitForFunction(
    () => window.__stageScene && window.render_game_to_text,
    null, { polling: 100, timeout: 90000 },
  );
  const state = async () =>
    JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  const step = async (ms) => page.evaluate((ms) => window.advanceTime(ms), ms);
  const capture = async (name) => {
    for (let i = 0; i < 12; i++) await step(16);
    await page.screenshot({ path: `${dir}/${name}.png` });
    await fs.writeFile(
      `${dir}/${name}.json`,
      JSON.stringify(await state(), null, 2),
    );
  };
  const walk = async (x, z) => {
    for (const [axis, target] of [
      ["x", x],
      ["z", z],
    ]) {
      for (let i = 0; i < 180; i++) {
        const p = (await state()).player,
          d = target - p[axis];
        if (Math.abs(d) < 0.22) break;
        const key = axis === "x" ? (d > 0 ? "d" : "a") : d > 0 ? "s" : "w";
        await page.keyboard.down(key);
        await step(60);
        await page.keyboard.up(key);
      }
      assert.ok(
        Math.abs((await state()).player[axis] - target) < 0.3,
        `reach ${axis} ${target}`,
      );
    }
    await step(120);
  };
  const lock = async () => {
    await walk(0, (await state()).player.z);
    await walk(0, layout.stations.helm.z);
    await page.keyboard.press("e");
    await step(160);
    assert.equal((await state()).modal, "helm");
    for (let i = 0; i < 100; i++) {
      const c = (await state()).returnMission.flight.deck.course;
      if (Math.hypot(c.x, c.y) < 0.12) break;
      const key =
        Math.abs(c.x) > Math.abs(c.y)
          ? c.x > 0
            ? "a"
            : "d"
          : c.y > 0
            ? "w"
            : "s";
      await page.keyboard.down(key);
      await step(80);
      await page.keyboard.up(key);
    }
    await capture("helm");
    await page.click("[data-do=holdCourse]");
    await step(160);
    assert.ok((await state()).returnMission.flight.deck.autopilot > 0);
    await page.keyboard.press("Escape");
    await step(160);
  };
  await step(100);
  await capture("departure");
  await lock();
  const fixed = new Set();
  let entry = false;
  for (let guard = 0; guard < 240; guard++) {
    const s = await state(),
      d = s.returnMission.flight.deck;
    if (d.arrivalAt !== undefined) break;
    const fault = d.incidents.find((f) => !f.fixed);
    if (fault) {
      // Travel through the connected corridor rather than teleporting fixtures.
      await walk(0, (await state()).player.z);
      const pos = layout.stations[fault.kind];
      await walk(0, pos.z);
      await walk(pos.x, pos.z);
      await page.keyboard.press("e");
      await step(160);
      assert.equal((await state()).modal, "flightRepair");
      if (fault.kind === "power" || fault.kind === "air") {
        const answer = fault.kind === "power" ? 1 : 2;
        assert.equal(await page.locator(".quiz-answer[data-do=answerFlightQuiz]").count(), 4);
        await page.click('.quiz-answer[data-answer="0"]');
        assert.match(await page.locator(".quiz-feedback").innerText(), /try again/i);
        await page.click(`[data-do="answerFlightQuiz"][data-answer="${answer}"]`);
        await step(160);
        assert.ok((await state()).returnMission.flight.deck.incidents.find(
          (incident) => incident.id === fault.id,
        ).quizCleared);
      }
      if (fault.kind === "power")
        for (let i = 0; i < 3; i++) {
          await page.click(`[data-flight-wire="${i}"][data-side="0"]`);
          await page.click(`[data-flight-wire="${i}"][data-side="1"]`);
        }
      if (fault.kind === "air")
        for (const i of [2, 0, 1])
          await page.click(`[data-flight-valve="${i}"]`);
      if (fault.kind === "hull")
        for (let i = 0; i < 4; i++)
          await page.click(`[data-flight-patch="${i}"]`);
      if (fault.kind === "engine")
        await page.locator("#coolant-flow").fill("35");
      await step(3200);
      await capture(`repair-${fault.id}`);
      await page.click("[data-do=finishFlightRepair]");
      await step(240);
      assert.ok(
        (await state()).returnMission.flight.deck.incidents.find(
          (f) => f.id === fault.id,
        ).fixed,
      );
      fixed.add(fault.kind);
    } else if (d.time > 122 && !entry) {
      await walk(0, (await state()).player.z);
      await lock();
      entry = true;
    } else await step(1000);
  }
  assert.equal(fixed.size, 4);
  assert.ok(entry);
  assert.equal((await state()).returnMission.flight.deck.outcome, "home");
  await capture("arrival");
  await step(12500);
  assert.equal((await state()).phase, "ended");
  await capture("home");
  for (const size of [
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    for (const scene of ["flight", "flight-fault", "flight-arrival"]) {
      await page.evaluate((s) => window.__stageScene(s), scene);
      await step(200);
      await capture(`${scene}-${size.width}`);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
    }
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => window.__stageScene("flight"));
  await step(200);
  await capture("reduced");
  await page.keyboard.press("Escape");
  await step(100);
  const paused = (await state()).returnMission.flight.deck.time;
  await step(3000);
  assert.equal((await state()).returnMission.flight.deck.time, paused);
  await page.keyboard.press("Escape");
  await step(300);
  assert.ok((await state()).returnMission.flight.deck.time > paused);
  await page.evaluate(() => window.__stageScene("flight"));
  await step(195000);
  assert.equal((await state()).phase, "ended");
  assert.equal((await state()).returnMission.flight.deck.outcome, "rescue");
  await capture("rescue");
  assert.deepEqual(errors, []);
  await fs.writeFile(`${dir}/errors.json`, JSON.stringify(errors));
  console.log(
    "PASS: physical walking, helm, four repairs, two NASA quizzes, two guidance locks, home/rescue, pause, responsive and reduced motion; no browser errors.",
  );
} finally {
  await browser.close();
}
