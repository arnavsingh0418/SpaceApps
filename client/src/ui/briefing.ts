import { Button, KeyChip } from "./components";

export function missionBriefing() {
  return `<div class="mission-brief"><section class="mission-brief-card" role="dialog" aria-modal="true" aria-labelledby="brief-title" tabindex="-1">
    <small>SUIT SEALED · CREW SAFE · SOL 01</small><h2 id="brief-title">Rebuild the ship. Get home.</h2>
    <p>Recover four ship parts before Sol 15 ends. Follow the gold marker to get started, then open the map for field tasks and salvage.</p>
    <div class="brief-cards"><article><span>01 ↗</span><h3>Recover & learn</h3><p>Follow the gold marker to supplies. Cyan beacons teach the science that unlocks building recipes.</p></article><article><span>02 ⌂</span><h3>Build your base</h3><p>Bring supplies to the habitat's workbench. Make a greenhouse, radiation shelter, and radio.</p></article><article><span>03 ☀</span><h3>Keep everyone safe</h3><p>Share electricity between air, plants, heat, and radio. Protect the crew when storms and flares arrive.</p></article></div>
    <div class="brief-keyline"><span>${KeyChip("WASD")} / arrows: walk</span><span>${KeyChip("E")} use nearby objects</span><span>${KeyChip("Q")} map</span><span>${KeyChip("Esc")} pause & guide</span><span>Touch: joystick + E button</span></div>
    <p>Restore the array at Sunward Flats to power the habitat and charge the return ship.</p>
    <div class="brief-actions"><small>Mission paused until you're ready. A sol is one Mars day.</small>${Button("LET'S EXPLORE ↗", "beginExplore")}</div>
  </section></div>`;
}

export function fieldManual() {
  return `<div class="field-manual">
    <article><h3>Why you're here</h3><p>Your crew survived a rough landing beside a habitat delivered earlier. Recover cargo, keep air and food above zero, and keep radiation dose below 100.</p></article>
    <article><h3>Explore → learn → build</h3><p>Walk with WASD or arrows (touch: joystick). Follow the gold marker. Stand close and press E to pick up supplies or scan a cyan beacon. Read its lesson and answer to unlock a recipe.</p></article>
    <article><h3>Your expedition has a story</h3><p>Open the top-right map or press Q. Pin an available mission and follow its bearing. Seven field stations contain twelve investigations: recover the flight recorder, find and process ice, test sunlight, read weather and rocks, protect samples, compare shielding, make oxygen, tune a relay, inspect the return vehicle, and send your report. New missions unlock as you complete earlier evidence.</p></article>
    <article><h3>Measure, then explain</h3><p>Press E at a field terminal. Inspect every reading, arrange process cards, or tune an instrument. Then use the evidence to answer the science question. Wrong answers give feedback and can be retried. Rewards appear as supply crates beside the terminal. Completed missions remain in the map's science journal and save automatically.</p></article>
    <article><h3>Use the terrain map</h3><p>The map is a north-up overhead view of this game world. The triangle is you, the house is base, numbered markers are field sites, and gold marks your pinned mission. The dotted line gives a direction, not a walking route: avoid cliffs and solid rocks. Shift sprints, Space jumps, C crouches; click-drag or capture the mouse to look around.</p></article>
    <article><h3>Use the habitat's workbench</h3><p>Press E at the workbench in front of the dome. Store your cargo to free bag space. Choose a recipe tab, check its ingredients, then build. Start with a greenhouse for food.</p></article>
    <article><h3>Every block of power has a job</h3><p>From Sol 2, split backup and solar power each morning. Air needs at least 3 blocks. Plants need light after you build a greenhouse. Heat keeps you warm, and a working radio needs power. Each clean, uncovered panel adds 3 power blocks and up to 18 percentage points to the ship’s launch battery.</p></article>
    <article><h3>Watch the sky</h3><p>Store supplies and cover panels before dust storms; covered panels make no power. Read solar-flare alerts and choose protection. Build shielding, clean panels, and water your greenhouse using ice.</p></article>
    <article><h3>Rebuild the return ship</h3><p>Recover a booster, heat shield, navigation core, and life-support module. Field investigations, salvage caches, and Nemi’s repair can supply replacements. Each cache has two timed questions. Faster answers earn rarer parts. Install all four at the return platform before the end of Sol 15.</p></article>
    <article><h3>Fly home</h3><p>Lock departure guidance at the helm early. Walk to each alerted station and repair its fault. Return to the helm in the last minute to lock Earth-entry guidance. Ship condition, course, and both guidance locks determine whether you land or meet a rescue crew in orbit.</p></article>
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
