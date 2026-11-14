import { chromium } from "playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const dir = "references/multiplayer";
await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});
const errors = [];
async function lobby(viewport) {
  const p = await browser.newPage({ viewport });
  p.setDefaultTimeout(60000);
  p.on("pageerror", (e) => errors.push(e.message));
  await p.route("**/*.glb", (r) => r.abort());
  await p.goto("http://127.0.0.1:2567/");
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
  const guest = await lobby({ width: 390, height: 844 });
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
  await guest.screenshot({ path: `${dir}/joined-phone.png` });
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
    "PASS: desktop host and phone guest use five-digit code on one website, without entering a server address.",
  );
} finally {
  await browser.close();
}
