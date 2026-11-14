import { chromium } from "playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const dir = "artifacts/crew-lobby";
const url = process.env.TEST_SITE || "http://127.0.0.1:2567/";
await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});
const errors = [];
async function lobby(viewport, blockWebSocket = false) {
  const p = await browser.newPage({ viewport });
  p.setDefaultTimeout(60000);
  p.on("pageerror", (e) => errors.push(e.message));
  await p.route("**/*.glb", (r) => r.abort());
  if (blockWebSocket)
    await p.routeWebSocket(/\/crew$/, (socket) => socket.close());
  await p.goto(url);
  await p.waitForFunction(() => !!window.render_game_to_text, null, {
    polling: 100,
  });
  await p.locator("[data-do=crew]").focus();
  await p.keyboard.press("Enter");
  assert.equal(await p.locator("#server-url").count(), 0);
  return p;
}
try {
  const host = await lobby({ width: 1280, height: 720 });
  await host.screenshot({ path: `${dir}/host-lobby.png` });
  await host.locator("[data-do=create]").dispatchEvent("click");
  await host.waitForFunction(
    () => !document.querySelector("#crew-invite").hidden,
    null,
    { polling: 100 },
  );
  const code = (await host.locator("#crew-invite").innerText()).match(
    /\d{5}/,
  )[0];
  assert.match(code, /^[1-9][0-9]{4}$/);
  await host.screenshot({ path: `${dir}/host-code.png` });
  const guest = await lobby({ width: 390, height: 844 }, true);
  await guest.fill("#room-code", "123");
  await guest.locator("[data-do=join]").dispatchEvent("click");
  assert.equal(await guest.locator("#room-code").count(), 1);
  await guest.fill("#crew-name", "Friend");
  await guest.fill("#room-code", code);
  await guest.screenshot({ path: `${dir}/join-phone.png` });
  await guest.locator("[data-do=join]").dispatchEvent("click");
  await guest.waitForFunction(
    () => !document.querySelector("#crew-invite").hidden,
    null,
    { polling: 100 },
  );
  assert.ok((await guest.locator("#crew-invite").innerText()).includes(code));
  const h = JSON.parse(await host.evaluate(() => window.render_game_to_text())),
    g = JSON.parse(await guest.evaluate(() => window.render_game_to_text()));
  assert.notEqual(h.player.id, g.player.id);
  assert.equal(await guest.locator("[data-power-wait]").count(), 1);
  assert.equal(await guest.locator("[data-do=lock]").count(), 0);
  await guest.screenshot({ path: `${dir}/joined-phone.png` });
  await host.locator('[data-do=lock]').dispatchEvent('click');
  await guest.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === 'day', null, { polling: 100 });
  await guest.locator('[data-do=slot][data-index="4"]').dispatchEvent('click');
  await host.waitForFunction(id => {
    const player = JSON.parse(window.render_game_to_text()).crew.find(p => p.id === id);
    return player?.selectedSlot === 4 && player.held === null;
  }, g.player.id, { polling: 100 });
  assert.equal(JSON.parse(await host.evaluate(() => window.render_game_to_text())).player.selectedSlot ?? 0, 0);
  assert.equal(
    await guest.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  await fs.writeFile(
    `${dir}/checks.json`,
    JSON.stringify(
      { code, host: h.player.id, guest: g.player.id, errors },
      null,
      2,
    ),
  );
  console.log(
    "PASS: WebSocket host and HTTPS fallback guest share a room, and the guest waits for the host to start.",
  );
} finally {
  await browser.close();
}
