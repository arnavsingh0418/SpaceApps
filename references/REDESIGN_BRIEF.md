# Outpost Down: UI + animation overhaul (strict spec)

You are improving the existing game in this repo (Vite + TypeScript + three.js; UI in `client/src/main.ts` + `client/src/style.css`; 3D in `client/src/render/world.ts` + `client/src/render/builders.js`). **Do not change the simulation rules in `shared/src/sim/`** unless a step below says so. Keep all tests passing.

The 3D world and the title screen are good. **Everything else should look and feel like a real game, not a website.** The current UI looks AI-generated:
- big text-heavy cards
- slogan-style copy
- six permanent panels
- labels bigger than the items they describe
- tiny faint text
- almost no animation

Fix all of that by following the rules below **exactly**. When a rule and your instinct disagree, follow the rule.

---

## 0. Tools you must use (installed already)

Skills (in `~/.codex/skills`). Read each SKILL.md before starting:
- **`develop-web-game`** (main workflow). Follow its loop for every change: implement → act → pause → observe → adjust. Specifically:
  - add `window.render_game_to_text()`, which returns JSON of the player position, nearby interactables, open UI, resources, sol and phase
  - add `window.advanceTime(ms)` for deterministic stepping
  - keep `progress.md` up to date
  - use its Playwright client script to play the game and take screenshots after every task
- **`playwright-interactive`**: for clicking through menus and checking hover and focus states.
- **`threejs-animation`**: character walk/idle cycles, tweens, `AnimationMixer` or procedural animation.
- **`threejs-interaction`**: proximity detection, raycasting for highlights, world-to-screen label projection.
- **`threejs-materials`**, **`threejs-lighting`**, **`threejs-geometry`**: item and pickup visuals, highlight and emissive effects.
- **`threejs-performance`**: instancing, object pooling for particles, keeping 60 fps.
- **`threejs-postprocessing`**: optional, only a subtle outline or bloom on the hovered or nearby interactable. Skip it if it costs more than 2 ms per frame.
- **`threejs-fundamentals`**: reference whenever unsure.

MCP servers:
- **playwright**: drive the browser, screenshot at 1600×900 **and** 1280×720 **and** 390×844 (phone).
- **context7**: look up current three.js / Vite APIs before using any API you're not 100% sure of.
- **elevenlabs** (optional, Task 7): generate short SFX. Save them as files in `client/public/sfx/`; never call the API at runtime.
- **blender** (optional, only if time remains): improve the astronaut model. Export GLB under 300 KB.

Before you start, take "before" screenshots of: the title screen, the intro, the power plan, exploring HUD, standing near an item, the workbench/build menu, scanning a beacon, the storm event, and the sol summary. Save them in `references/redesign/before/`. Take the same shots after each task in `references/redesign/after/`.

---

## 1. Design system (put these in `style.css` `:root` and use ONLY these)

### Colors
```
--ink:        #1b120d   /* panel background base */
--panel:      rgba(27, 18, 13, 0.78)
--panel-solid:#241812
--edge:       rgba(255, 220, 180, 0.14)   /* 1px panel border */
--text:       #fff4e6   /* main text, never use grey-brown for body text */
--text-dim:   #e3c9ad   /* secondary only, min contrast 4.5:1 on --panel */
--sun:        #ffc83d   /* primary accent / buttons / selected */
--power:      #ffc83d
--air:        #4cc9ff
--food:       #5ee07a
--dose:       #ff5d5d
--science:    #39e6e0   /* scan beacons */
--danger:     #ff4d4d
```
No other colors in UI CSS. No gradients on panels. No glassmorphism blur except a light `backdrop-filter: blur(6px)` on the HUD.

### Type
- Display font: **Barlow Condensed 800**, uppercase, letter-spacing 0.02em. Only for: sol number, screen titles, big alerts, button labels.
- Body font: **Nunito Sans 700/800**.
- Size scale (px). Use only these: **12 / 14 / 16 / 20 / 28 / 44 / 72**.
  - Minimum text size anywhere: **14px** (12px only for key-hint chips like `E`).
  - HUD numbers: 16px+. Alerts: 28px. Screen titles: 44px.
- Line height 1.25. Max line length 46 characters.

### Shape and spacing
- Spacing scale: **4 / 8 / 12 / 16 / 24 / 32**. Radius: **10px** panels, **8px** buttons, **999px** chips.
- Panel = `--panel` + 1px `--edge` border + `box-shadow: 0 6px 0 rgba(0,0,0,.35)`, the chunky "game" drop shadow. No soft blurry shadows.
- Buttons: chunky. 48px tall minimum, `--sun` fill, `--ink` text, 4px darker bottom border. On press, move down 2px and the border shrinks. Secondary buttons use the same shape with a `--panel-solid` fill.
- Icons: use a single consistent icon set (Lucide via inline SVG, or one emoji style). **Do not mix** emoji and SVG in the same component.

---

## 2. Text box rules (most important: the current ones are the main problem)

**Hard limits for every text element.** Add a dev-only check that `console.warn`s if any rendered string breaks these:

| Element | Max width | Max text |
|---|---|---|
| World label (above an object) | 160px | 2 words + count, e.g. `Ice ×6` |
| Interaction prompt | 260px | key chip + 3 words, e.g. `[E] Pick up ice` |
| Toast / hint | 360px | 1 line, max 8 words |
| Event alert banner | 520px | title 4 words + 1 line of 10 words |
| Choice card (flare/storm decisions) | 420px | title 5 words, each option 4 words + its cost chip |
| Fact card ("Real science") | 340px | 2 sentences, max 28 words total |
| Any modal | 560px | title 5 words, max 3 bullet lines of 10 words each |

Copy style rules:
- **No slogans or marketing voice.** Delete lines like "Welcome to your new little world", "One sun. A shared power plan.", "A little crew. A big planet." in-game. The title screen may keep one tagline.
- Write like a game: short verbs, direct. ✅ "Power for today" ❌ "A shared power plan". ✅ "Storm in 0:45, bring items inside" ❌ "Secure your materials before the storm arrives!".
- Explain science terms once, in ≤10 words, in a tooltip, not in a paragraph.
- No numbered-paragraph tutorials. Teach by doing (see Task 2).
- Never show placeholder characters (`·`, `—`, `0/10 · align` jargon). Empty hotbar slots are just empty.

**Labels must not be bigger than the thing they describe.** Labels are hidden by default and appear only when relevant (see Task 3).

---

## 3. HUD layout while exploring (max 3 elements)

Replace the 6 permanent panels with:
1. **Top-left vitals.** A compact pill cluster, max **300×64px**:
   - big `SOL 3` with a small `/15`
   - a thin day-progress arc
   - 4 small circular gauges or icon bars (Power, Air, Food, Dose), each with a number
   - no labels; hovering or focusing a gauge shows a tooltip like "Air: 85%, drops if the air machine has <3 power"
   - when a value is low (<30), its gauge pulses red
2. **Bottom-center hotbar.** 5 slots of 56px:
   - an item icon + count badge
   - the selected slot gets a `--sun` outline and lifts 4px
   - no "·", no numbers inside empty slots (put a small key number in the corner only on hover)
   - remove the "↥" button; drop the item with `G` instead
3. **Top-right objective chip.** One line only: the current next step, e.g. `▶ Scan the oxygen beacon`, with a small `2/3 goals` counter. Click or press `Tab` to expand into the full goal list (slides down, max 3 rows).

Everything else gets moved:
- **Crew chat** becomes a collapsed chat icon with an unread badge; press `T` to open a small chat drawer (bottom-left, 320×200).
- **"Real or game?" facts** become fact toasts that appear for 6s after relevant moments (a scan, a storm), max 2 per sol.
- **Crew role picker** moves to the lobby / pause menu only. Show the chosen role as a small icon next to the player's name tag.
- **Controls hint** shows for the first 60s only, then fades. It can be re-shown from the pause menu.
- **`?`, pause, music** become a single `≡` button (top-right corner, 40px) that opens the pause menu.

At 390px phone width: vitals compress to icons only, the hotbar shows 4 slots, and a virtual joystick + action button appear.

---

## 4. Tasks (do them in order; screenshot + `render_game_to_text` check after each)

### Task 1: Design tokens + component rebuild
- Put the tokens from §1 into `:root`. Delete unused CSS (the stylesheet is ~1400 lines, so cut it hard).
- Build small reusable UI helpers in `client/src/ui/`: `Panel`, `Button`, `KeyChip`, `Gauge`, `Toast`, `Banner`, `ChoiceCard`, `Tooltip`, `Modal`. Every screen uses these; no one-off styled HTML strings in `main.ts`.
- Split `main.ts` into `ui/hud.ts`, `ui/hotbar.ts`, `ui/modals.ts`, `ui/toasts.ts`, `ui/powerPlan.ts`, `ui/events.ts`.

### Task 2: Kill the text walls at the start
- **Remove the "Welcome to your new little world" modal.** Replace it with a **4-step in-world tutorial**, each step a single toast + a glowing marker in the world:
  1. `[WASD] Walk to the glowing crate`
  2. `[E] Pick it up`
  3. `[E] Scan the cyan beacon`
  4. `Bring items to the workbench`
  Each step completes when the player does it, with a check-mark pop and a sound. Skippable from the pause menu.
- **Rebuild the power plan** as a compact game screen (max 560px wide):
  - Title `POWER FOR TODAY`, plus a big battery icon showing `11 ⚡`.
  - 4 rows, each with: an icon, a name of 2 words max, the pip bar, and the effect as a short chip (`+4 food`, `air steady`, `radio +1`).
  - Clicking a pip sets the value; `+`/`−` keys work too. Pips fill with a quick stagger animation.
  - When blocks are left over, the battery icon shakes gently. Locking in plays a "power up" animation: blocks fly from the battery to each row, then the screen closes.
  - The first time, show one tooltip: "Every block you give one thing is taken from another."
- Don't open the power plan on top of the tutorial. Open it after tutorial step 4, or on sol 2.

### Task 3: World labels + interaction
- Labels are hidden by default. Show them only when:
  - the player is within **4 m**, or
  - the player hovers the object with the mouse, or
  - it's the current objective target (show a small bouncing ▼ arrow, not a text label).
- Only the **nearest** interactable shows its prompt: `[E] Pick up ice ×6`. Other nearby items show just a small icon chip (24px), no text.
- **Never overlap labels.** Run a simple screen-space collision pass each frame: if two labels overlap, hide the farther one.
- Solar panel cleanliness: show a tiny 4-segment bar *on the panel itself* only when you're near it, or when it's below 60%. Never as a floating "100% clean" pill.
- The name tag over the player shows only in multiplayer, offset above the helmet so it never covers it. Show it at 70% opacity.
- Nearby interactables get a subtle highlight: emissive pulse or outline (`threejs-interaction` + `threejs-materials` skills), plus a soft ground ring that brightens.

### Task 4: Animations (required: every item below must exist)
Use `threejs-animation` (procedural is fine; no external rig needed).

**Character:**
- **Idle:** gentle breathing bob (scale Y ±2%, 2 s loop), and the helmet visor glints every few seconds.
- **Walk:** legs and arms swing opposite each other, body bobs, small lean into the direction of travel. Turning is smoothed (lerp rotation, no snapping). The speed of the swing matches the movement speed.
- **Footstep dust:** small pooled particles puff at each step.
- **Pick up:** crouch → item arcs from the ground into the player → the hotbar slot does a bounce and the count ticks up (+1 floater).
- **Carry:** while carrying a big item, it's shown above the head or in the arms.
- **Build:** a hammer/wrench loop for the build duration, with sparks; the structure grows in by scaling up from 0 with a slight overshoot (easeOutBack).
- **Scan:** a cyan scan beam sweeps from the visor to the beacon, a radial ring expands, then the fact toast slides in.
- **Hurt / dose spike:** red screen-edge vignette flash + small camera shake (respect reduced motion).

**World:**
- Pickups bob up and down (±0.15 m) and slowly rotate; their ground ring pulses.
- Science beacons pulse a cyan light and emit rising particles.
- The wreck's smoke drifts and rises continuously (particles, not static spheres).
- Solar panels visibly gather dust (texture or tint lerps toward brown) and sparkle when cleaned.
- Dust devils spin and wander, lifting small particles.
- **Storm:** the sky and fog tint toward dark orange over 5 s, wind streak particles, the camera shakes slightly, and the light dims.
- **Flare:** a bright white-yellow flash, then a red pulse on the Dose gauge.
- **Day/night:** a smooth light-color cycle over the sol, with a sunset tint at the end of each sol.

**UI motion** (CSS or tiny tween helper; 150–250 ms; `ease-out`):
- Panels and modals scale from 0.96 → 1 + fade in. Toasts slide up from the bottom. Banners drop down from the top with a small bounce.
- Resource gauges animate value changes; a −/+ number floats up from the gauge when a value changes.
- Buttons: hover lift 2px, press depress 2px, focus ring in `--sun`.
- Respect `prefers-reduced-motion`: replace movement with fades.

### Task 5: Event screens
- **Storm warning:** a banner `DUST STORM · 0:45`, with a countdown ring and one line: `Bring items and cover panels.` Plus a 3-item mini checklist (icons + counts) in the objective chip, not a new panel.
- **Solar flare choice:** a ChoiceCard with title `SOLAR FLARE`, the real flare chip `X8.7 · 14 May 2024 · NASA DONKI`, and 3 option buttons of 4 words each. Each option shows its cost as colored chips (`−10 🥔`, `+25 ☢️`). The countdown bar shrinks across the top of the card.
- **Sol summary:** instead of paragraphs, show 4 animated rows (each resource: before → after with an arrow and a one-line reason of ≤8 words), then a big `NEXT SOL` button.
- **Win / lose screen:** full-screen with a big title, crew portraits, 3 stats and one "what real astronauts do" fact (≤2 sentences). Buttons: `Try again`, `Main menu`.

### Task 6: Polish pass
- Camera: smooth follow with slight lag (damped spring); zoom with mouse wheel within limits.
- Add a soft vignette and a subtle color grade (warm), only if it costs under 2 ms.
- Fix the 404 console error.
- 60 fps on a mid laptop at 1600×900. Use instanced rocks and pooled particles (`threejs-performance`).

### Task 7: Sound (optional; use ElevenLabs MCP if available, else CC0 sounds)
- Generate and save in `client/public/sfx/`: footstep (soft crunch), pickup pop, scan beep sweep, build hammer loop, storm wind loop, alarm for flare, power-up for the plan lock-in, UI click, success jingle.
- Each under 100 KB, normalized, with a master volume. Muted by default until the first user click.

---

## 5. Acceptance checks (verify every one with Playwright screenshots + `render_game_to_text`)

- [ ] While exploring, at most **3 HUD elements** are visible (vitals, hotbar, objective chip).
- [ ] No text on screen smaller than 14px (except key chips); body text contrast ≥ 4.5:1.
- [ ] No two world labels overlap in any screenshot; only the nearest interactable shows a text prompt.
- [ ] No label is wider than 160px; no toast is longer than one line.
- [ ] No modal or card has more than 3 lines of body text.
- [ ] The game is playable within 5 seconds of pressing Start: no blocking text modal before the first step.
- [ ] Character visibly walks (limbs swing) and idles (breathing); turning is smooth.
- [ ] Pickup, scan, build, storm and flare each have a visible animation + UI feedback.
- [ ] Gauges animate on change and pulse red when low.
- [ ] Works at 1600×900, 1280×720 and 390×844 with nothing overflowing or overlapping.
- [ ] `prefers-reduced-motion` turns off shakes and big movements.
- [ ] `npm test` passes, `npm run build` passes, 0 console errors.
- [ ] Before/after screenshots saved in `references/redesign/` and listed in `progress.md`.

## 6. How to work
1. Read the skills listed in §0, then take the "before" screenshots.
2. Do Task 1 → 7 in order. After **each** task:
   - run the develop-web-game Playwright loop
   - look at the screenshots yourself and compare them against §2 and §5
   - fix problems before moving on
   - commit with a message like `ui: task 3 world labels`
3. When unsure about a three.js API, check it with context7 first.
4. At the end, give me: a list of what changed, the after screenshots, and anything you skipped and why.
