import { Button, KeyChip } from "./components";

export function missionBriefing() {
  return `<div class="mission-brief"><section class="mission-brief-card" role="dialog" aria-modal="true" aria-labelledby="brief-title" tabindex="-1">
    <small>SUIT SEALED · CREW SAFE · SOL 01</small><h2 id="brief-title">You made it. Now make a home.</h2>
    <p>Your landing damaged the ship and radio. A habitat and solar panels were delivered before you arrived. Recover the scattered cargo and use science to build a working outpost.</p>
    <div class="brief-cards"><article><span>01 ↗</span><h3>Recover & learn</h3><p>Follow the gold marker to supplies. Cyan beacons teach the science that unlocks building recipes.</p></article><article><span>02 ⌂</span><h3>Build your base</h3><p>Bring supplies to the habitat's workbench. Make a greenhouse, radiation shelter, and radio.</p></article><article><span>03 ☀</span><h3>Keep everyone safe</h3><p>Share electricity between air, plants, heat, and radio. Protect the crew when storms and flares arrive.</p></article></div>
    <div class="brief-keyline"><span>${KeyChip("WASD")} / arrows: walk</span><span>${KeyChip("E")} use nearby objects</span><span>${KeyChip("Q")} map</span><span>${KeyChip("Esc")} pause & guide</span><span>Touch: joystick + E button</span></div>
    <p>Your goal: survive 15 sols, build all three systems, and reach radio progress 10 to prepare the return vehicle. Today's power is already set. You'll make your first power plan on Sol 2.</p>
    <div class="brief-actions"><small>Mission paused until you're ready. A sol is one Mars day.</small>${Button("LET'S EXPLORE ↗", "beginExplore")}</div>
  </section></div>`;
}

export function fieldManual() {
  return `<div class="field-manual">
    <article><h3>Why you're here</h3><p>Your crew survived a rough landing beside a habitat delivered earlier. Recover cargo, keep air and food above zero, and keep radiation dose below 100.</p></article>
    <article><h3>Explore → learn → build</h3><p>Walk with WASD or arrows (touch: joystick). Follow the gold marker. Stand close and press E to pick up supplies or scan a cyan beacon. Read its lesson and answer to unlock a recipe.</p></article>
    <article><h3>Use the habitat's workbench</h3><p>Press E at the workbench in front of the dome. Store your cargo to free bag space. Choose a recipe tab, check its ingredients, then build. Start with a greenhouse for food.</p></article>
    <article><h3>Every block of power has a job</h3><p>From Sol 2, split solar power each morning. Air needs at least 3 blocks; plants need light after you build a greenhouse. Heat keeps you warm. A working radio needs power to make progress.</p></article>
    <article><h3>Watch the sky</h3><p>Store supplies and cover panels before dust storms; covered panels make no power. Read solar-flare alerts and choose protection. Build shielding, clean panels, and water your greenhouse using ice.</p></article>
    <article><h3>Get ready to return</h3><p>By Sol 15, build the greenhouse, shelter, and radio; align the dish, reach radio progress 10, and keep at least 4 power blocks. The return vehicle is already on Mars. This deadline is fictional.</p></article>
    <article><h3>Your field controls</h3><p>E: interact · B: nearby workbench · Q: map · 1–5: bag slots · G: drop selected stack · Tab: goals · T: chat · Esc: pause. Solo missions save automatically.</p></article>
    <article><h3>Real science, a fictional adventure</h3><p>Our crew, crash, and emergency are invented. NASA's robotic landers inspire the entry sequence; crewed Mars landing systems are still being developed. Numbers in the game are simplified teaching tools.</p><div class="manual-links"><a href="https://science.nasa.gov/planetary-science/programs/mars-exploration/mission-timeline/how-we-land-on-mars/" target="_blank" rel="noopener noreferrer">NASA: landing on Mars ↗</a><a href="https://www.jpl.nasa.gov/news/press_kits/mars_2020/landing/mission/" target="_blank" rel="noopener noreferrer">NASA: journey & communication ↗</a></div></article>
    </div>${Button("GOT IT", "close")}`;
}

export const tutorialSteps = [
  {
    title: "Find your first supplies",
    text: "Follow the floating gold arrow to the glowing crate. Walk close enough for an interaction prompt to appear.",
    control: "WASD / arrows · touch joystick",
  },
  {
    title: "Put cargo in your bag",
    text: "Press E beside the crate, or tap the on-screen action. Your bag slots show what you're carrying.",
    control: "E · pick up supplies",
  },
  {
    title: "Learn before you build",
    text: "Follow the gold arrow to the cyan growing beacon. Press E, read its science note, then answer to unlock the greenhouse.",
    control: "E · scan a science beacon",
  },
  {
    title: "Bring it home",
    text: "Go to the workbench in front of the habitat dome. Press E and choose STORE ITEMS. Stored supplies are shared and safe.",
    control: "E · workbench → Store items",
  },
];
