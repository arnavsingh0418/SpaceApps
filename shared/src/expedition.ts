import type { Bag, Game } from "./sim";

export const solarRewardSite = { x: -79, z: 97 };

export const sectors = [
  {
    id: "landing",
    name: "Landing zone",
    x: -40,
    z: 8,
    symbol: "01",
    color: "#ffc96b",
    prop: "wreck",
  },
  {
    id: "ice",
    name: "Frost hollow",
    x: -95,
    z: -85,
    symbol: "02",
    color: "#92e4f5",
    prop: "ice",
  },
  {
    id: "solar",
    name: "Sunward flats",
    x: -90,
    z: 85,
    symbol: "03",
    color: "#f2d775",
    prop: "solar",
  },
  {
    id: "basin",
    name: "Ancient basin",
    x: 94,
    z: -151,
    symbol: "04",
    color: "#efa888",
    prop: "rocks",
  },
  {
    id: "shelter",
    name: "Cavern approach",
    x: 215,
    z: 16,
    symbol: "05",
    color: "#b8acee",
    prop: "shield",
  },
  {
    id: "relay",
    name: "Echo station",
    x: 70,
    z: -265,
    symbol: "06",
    color: "#83dac1",
    prop: "dish",
  },
  {
    id: "ascent",
    name: "Base flight terminal",
    x: -5,
    z: -27,
    symbol: "07",
    color: "#f3a394",
    prop: "flight",
  },
] as const;
export type SectorId = (typeof sectors)[number]["id"];
export type FieldMission = {
  id: string;
  act: number;
  sector: SectorId;
  title: string;
  role: string;
  brief: string;
  requires: string[];
  tool: "scan" | "tune" | "sequence";
  instruction: string;
  samples: string[];
  reading: string;
  target?: number;
  order?: number[];
  question: string;
  answers: string[];
  correct: number;
  explanation: string;
  debrief: string;
  reward: Bag;
  source: string;
  sourceName: string;
};
const landingSource =
  "https://science.nasa.gov/planetary-science/programs/mars-exploration/mission-timeline/how-we-land-on-mars/";
const iceSource =
  "https://science.nasa.gov/resource/swim-map-shows-subsurface-water-ice-on-mars/";
const rocksSource =
  "https://science.nasa.gov/mission/msl-curiosity/science-highlights/";
const oxygenSource =
  "https://www.nasa.gov/missions/mars-2020-perseverance/perseverance-rover/nasas-oxygen-generating-experiment-moxie-completes-mars-mission/";
export const fieldMissions: FieldMission[] = [
  {
    id: "blackbox",
    act: 1,
    sector: "landing",
    title: "The last 60 seconds",
    role: "COMMANDER VEGA",
    brief:
      "Our crew is safe, but the cargo trail runs beyond base. Recover the flight recorder and find out why we landed off course.",
    requires: [],
    tool: "scan",
    instruction: "Inspect all three flight-recorder channels.",
    samples: [
      "Heat shield · intact",
      "Parachute · released",
      "Port thruster · pressure lost",
    ],
    reading:
      "Entry protection worked. A pressure drop occurred in one braking engine after parachute release. The backup engine reduced the landing speed.",
    question: "Which system caused our fictional rough landing?",
    answers: ["The heat shield", "A braking thruster", "The spacesuit radio"],
    correct: 1,
    explanation:
      "The recorded pressure loss points to the thruster, not the heat shield. Real Mars landers use multiple systems to slow down; this failure is invented.",
    debrief:
      "Flight log recovered. Two supply signals are now marked: Frost Hollow and Sunward Flats. Investigate either one first.",
    reward: { scrap: 2 },
    source: landingSource,
    sourceName: "NASA · How we land on Mars",
  },
  {
    id: "ice-survey",
    act: 1,
    sector: "ice",
    title: "Water under our boots",
    role: "DR. IMANI · SCIENCE",
    brief:
      "The cargo scanner spotted a cold patch. We need evidence before calling it a water source. Compare three simulated subsurface readings.",
    requires: ["blackbox"],
    tool: "scan",
    instruction: "Sample the three survey locations.",
    samples: [
      "A · dry dust / weak ice signal",
      "B · shallow layer / strong ice signal",
      "C · warm rock / weak ice signal",
    ],
    reading:
      "Location B has the strongest modeled ice signal. The readings and this deposit are invented for the training map; they are not a real Gale Crater ice survey.",
    question: "Where should the team investigate next?",
    answers: [
      "B, then confirm with more measurements",
      "A, because dust is always frozen water",
      "All three are proven drinkable water",
    ],
    correct: 0,
    explanation:
      "One measurement guides the next investigation; it is not proof of purity. NASA combines multiple observations to map likely buried ice on Mars.",
    debrief:
      "A promising sample is secured. Test it before adding it to the water loop.",
    reward: { ice: 3 },
    source: iceSource,
    sourceName: "NASA · Mapping buried ice",
  },
  {
    id: "water-loop",
    act: 1,
    sector: "ice",
    title: "A drop worth keeping",
    role: "DR. IMANI · SCIENCE",
    brief:
      "Melting a sample is only the beginning. Build a safe processing sequence for our fictional water-recovery unit.",
    requires: ["ice-survey"],
    tool: "sequence",
    instruction:
      "Tap the process cards in working order. Reset if you want to revise.",
    samples: [
      "Test water quality",
      "Collect a sealed sample",
      "Melt and treat contaminants",
    ],
    order: [1, 2, 0],
    reading:
      "Collect → melt and treat → test. Melting changes ice into liquid; it does not automatically remove dissolved contaminants.",
    question: "Why test the water after treating it?",
    answers: [
      "Clear water is always safe",
      "Mars water never needs treatment",
      "To check whether the treatment worked",
    ],
    correct: 2,
    explanation:
      "An appearance is not a water-quality measurement. Treatment must be checked before water enters a life-support system.",
    debrief:
      "Water procedure logged. Your ice cache can supply the greenhouse; keep the crew's systems running while you explore.",
    reward: { ice: 3, seeds: 1 },
    source: iceSource,
    sourceName: "NASA · Water-ice resources",
  },
  {
    id: "solar-test",
    act: 1,
    sector: "solar",
    title: "Catch the sunlight",
    role: "JUNO · ENGINEER",
    brief:
      "Use the terminal's virtual solar array to see how pointing a panel toward the Sun changes its output.",
    requires: ["blackbox"],
    tool: "tune",
    target: 65,
    instruction:
      "Adjust the panel dial until the instrument reads at least 95% signal.",
    samples: ["Panel orientation"],
    reading:
      "The modeled output peaks when the panel faces the light. This dial is a teaching model, not a real Mars azimuth or efficiency measurement.",
    question: "What else can reduce the power from a sun-facing panel?",
    answers: [
      "Radio delay",
      "Dust covering its surface",
      "The color of a spacesuit",
    ],
    correct: 1,
    explanation:
      "Dust intercepts sunlight before it reaches a panel. Facing the Sun helps, but dust, weather and daylight still matter.",
    debrief:
      "Collect the portable solar array and glazing at Sunward Flats. Select the array in your bag, then deploy it on clear ground near base or elsewhere.",
    reward: { glass: 3, solarKit: 1 },
    source: "https://science.nasa.gov/mission/insight/",
    sourceName: "NASA · InSight and solar power",
  },
  {
    id: "weather-watch",
    act: 2,
    sector: "solar",
    title: "Read the red sky",
    role: "JUNO · ENGINEER",
    brief:
      "Weather station readings are changing. Compare the observations and make a sensible power plan before leaving base.",
    requires: ["solar-test"],
    tool: "scan",
    instruction: "Read the dust monitor, panel meter, and sky camera.",
    samples: [
      "Dust opacity · rising",
      "Panel output · falling",
      "Sky camera · less direct sunlight",
    ],
    reading:
      "All three simulated observations agree: airborne dust is blocking sunlight. Thin Martian air does not produce movie-style hurricane forces.",
    question: "What is the best response to falling solar power?",
    answers: [
      "Protect essential air systems and plan energy use",
      "Spend all remaining power on the radio",
      "Assume the panel meter is broken",
    ],
    correct: 0,
    explanation:
      "A dust event can reduce available sunlight. Power budgeting and stored energy help a mission protect its essential systems.",
    debrief:
      "Forecast logged. You can now investigate the ancient basin and test shelter options at the cavern approach.",
    reward: { battery: 1 },
    source:
      "https://science.nasa.gov/planetary-science/programs/mars-exploration/",
    sourceName: "NASA · Mars exploration",
  },
  {
    id: "rock-record",
    act: 2,
    sector: "basin",
    title: "A planet with a past",
    role: "DR. IMANI · SCIENCE",
    brief:
      "The basin has layered rock. Be a field geologist: record the observations before choosing an explanation.",
    requires: ["weather-watch", "water-loop"],
    tool: "scan",
    instruction: "Examine the three parts of this training outcrop.",
    samples: [
      "Fine, repeated layers",
      "Rounded grains",
      "Ripple-like textures",
    ],
    reading:
      "These features can record sediment transport and deposition. Curiosity found evidence of ancient streams and lakes in Gale Crater.",
    question: "Which claim is supported, without going beyond the evidence?",
    answers: [
      "We have found living aliens",
      "Mars is covered in oceans today",
      "Water may have shaped this ancient environment",
    ],
    correct: 2,
    explanation:
      "Rock textures can support an ancient-water interpretation. A habitable environment is not the same as a detection of life.",
    debrief:
      "Geology entry added to your notebook. Now protect the sample so a later experiment can trust it.",
    reward: { soil: 2 },
    source: rocksSource,
    sourceName: "NASA · Curiosity science highlights",
  },
  {
    id: "sample-care",
    act: 2,
    sector: "basin",
    title: "Leave a clean record",
    role: "DR. IMANI · SCIENCE",
    brief:
      "A useful discovery needs a trustworthy sample. Plan its collection without adding material from your gloves or another location.",
    requires: ["rock-record"],
    tool: "sequence",
    instruction: "Put the sample-handling steps in order.",
    samples: [
      "Seal and label the tube",
      "Record the location and prepare clean tools",
      "Collect without touching the sample",
    ],
    order: [1, 2, 0],
    reading:
      "Location + clean collection + sealed, labeled storage preserve the context of a sample. These are simplified scientific practices.",
    question: "Why does the location label matter?",
    answers: [
      "It makes the tube heavier",
      "It connects the sample to the environment it came from",
      "It proves that the sample contains life",
    ],
    correct: 1,
    explanation:
      "Without context, scientists lose information about how and where the material formed. A label preserves evidence; it does not prove life.",
    debrief:
      "Sample chain recorded. The return mission can carry more than people—it can carry a carefully documented scientific story.",
    reward: { circuit: 1 },
    source:
      "https://science.nasa.gov/mission/mars-2020-perseverance/rock-samples/",
    sourceName: "NASA · Perseverance rock samples",
  },
  {
    id: "shield-test",
    act: 2,
    sector: "shelter",
    title: "More than a spacesuit",
    role: "COMMANDER VEGA",
    brief:
      "The cavern approach is a testing station, not an automatically safe home. Compare simulated dose readings behind three barriers.",
    requires: ["weather-watch"],
    tool: "scan",
    instruction: "Read each dosimeter. Values are illustrative training units.",
    samples: [
      "Exposed sensor · 100 units",
      "Thin suit material · 92 units",
      "Thick water + soil barrier · 34 units",
    ],
    reading:
      "The thick barrier reduces this modeled exposure, but the reading is not zero. Real shielding depends on particle type, energy, materials, and thickness.",
    question: "Which conclusion is safest?",
    answers: [
      "A spacesuit blocks all radiation",
      "Any cave is automatically safe",
      "Tested shielding reduces risk but does not remove it",
    ],
    correct: 2,
    explanation:
      "Radiation risk is managed, not made to vanish. Measurements and engineering are needed before choosing a shelter.",
    debrief:
      "Shelter assessment complete. Take the recovered materials home and build radiation protection before the next flare.",
    reward: { soil: 2, scrap: 2 },
    source:
      "https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf",
    sourceName: "NASA · Radiation protection",
  },
  {
    id: "oxygen-test",
    act: 2,
    sector: "shelter",
    title: "Make air, use energy",
    role: "JUNO · ENGINEER",
    brief:
      "A pre-delivered prototype can demonstrate oxygen production. Trace the process instead of assuming Mars air is breathable.",
    requires: ["shield-test"],
    tool: "sequence",
    instruction: "Arrange the simplified oxygen-production process.",
    samples: [
      "Check oxygen purity",
      "Collect carbon dioxide from the atmosphere",
      "Use energy to separate oxygen",
    ],
    order: [1, 2, 0],
    reading:
      "MOXIE on Perseverance demonstrated extracting oxygen from Martian carbon dioxide. Supporting astronauts needs much larger systems and reliable power.",
    question: "Why can't we simply breathe the atmosphere outside?",
    answers: [
      "It is too thin and mostly carbon dioxide",
      "The air is only too cold",
      "A radio needs to unlock it",
    ],
    correct: 0,
    explanation:
      "Mars does not provide breathable air at Earth-like pressure. A small technology demonstration is not a complete crew life-support system.",
    debrief:
      "Oxygen flow verified. You have the survival evidence needed to bring Echo Station online.",
    reward: { circuit: 1, scrap: 2 },
    source: oxygenSource,
    sourceName: "NASA · MOXIE oxygen experiment",
  },
  {
    id: "relay-link",
    act: 3,
    sector: "relay",
    title: "A voice across the dark",
    role: "COMMANDER VEGA",
    brief:
      "The remote relay is intact. Tune its antenna to recover the stored Earth transmission. This is a field relay; your base radio still needs rebuilding.",
    requires: ["sample-care", "oxygen-test"],
    tool: "tune",
    target: 72,
    instruction: "Tune the relay until its simulated link quality reaches 95%.",
    samples: ["Relay pointing"],
    reading:
      "Signal locked. Received message: 'Crew status requested. Return vehicle is standing by. Confirm route and supplies.' Radio signals travel at light speed, not instantly.",
    question: "Why must the crew make urgent decisions locally?",
    answers: [
      "Earth has stopped listening",
      "Signals need minutes to cross interplanetary space",
      "Radio is slower than walking",
    ],
    correct: 1,
    explanation:
      "Earth–Mars signal delay varies with the planets' positions. A real-time joystick from Earth cannot control every landing or emergency.",
    debrief:
      "Signal restored at Echo Station. Collect the antenna and battery, then inspect the flight terminal back at base and send a clear readiness report.",
    reward: { antenna: 1, battery: 1 },
    source:
      "https://www.jpl.nasa.gov/news/press_kits/mars_2020/landing/mission/",
    sourceName: "NASA/JPL · Mars mission communications",
  },
  {
    id: "return-check",
    act: 3,
    sector: "ascent",
    title: "The way home",
    role: "JUNO · ENGINEER",
    brief:
      "This ascent vehicle was delivered before the crew. Inspect its simulated status. A return flight requires both fuel and an oxidizer, plus a healthy crew.",
    requires: ["relay-link"],
    tool: "scan",
    instruction: "Read all three preflight panels.",
    samples: [
      "Propellant · fuel + oxidizer reserved",
      "Crew systems · air and power checked",
      "Navigation · route data loaded",
    ],
    reading:
      "A rocket needs propellant and oxidizer; it cannot rely on breathing the thin outside atmosphere. This vehicle and readiness report are fictional.",
    question: "What is oxygen's job in a rocket engine?",
    answers: [
      "It can act as the oxidizer that helps fuel burn",
      "It replaces every other supply",
      "It makes communication instantaneous",
    ],
    correct: 0,
    explanation:
      "An oxidizer participates in combustion with fuel. Oxygen production is useful for both breathing and some rocket propulsion systems, at very different scales.",
    debrief:
      "Base flight terminal checked. File your evidence-based crew report at the relay to complete the field campaign.",
    reward: { food: 2 },
    source: oxygenSource,
    sourceName: "NASA · Oxygen for future Mars exploration",
  },
  {
    id: "home-message",
    act: 3,
    sector: "relay",
    title: "We are still explorers",
    role: "COMMANDER VEGA",
    brief:
      "You recovered the landing record, tested survival systems, and documented an ancient environment. Put the final message in a useful order.",
    requires: ["return-check"],
    tool: "sequence",
    instruction: "Build a clear mission report.",
    samples: [
      "Request the next instructions and wait for the delayed reply",
      "Report crew condition and immediate needs",
      "Send observations, tests, and return-vehicle status",
    ],
    order: [1, 2, 0],
    reading:
      "Crew status → evidence and readiness → request. Your field journal now records twelve investigations across seven sites.",
    question: "What made this mission's conclusions trustworthy?",
    answers: [
      "Choosing the most exciting story",
      "Guessing before measuring",
      "Using observations, testing ideas, and stating uncertainty",
    ],
    correct: 2,
    explanation:
      "Science is a process of comparing ideas with evidence. Your expedition is complete; use your recovered ship parts, keep the crew supplied, and launch before the end of Sol 15.",
    debrief:
      "EXPEDITION COMPLETE. Twelve investigations. Seven destinations. One crew. Your notebook is available on the field map—now bring everyone home.",
    reward: { food: 2 },
    source: rocksSource,
    sourceName: "NASA · Exploring Mars through evidence",
  },
];
export type FieldProgress = {
  completed: string[];
  surveyed: string[];
  observations: Record<string, number[]>;
};
export function fieldProgress(s: Game): FieldProgress {
  return s.expedition ?? { completed: [], surveyed: [], observations: {} };
}
export function missionAvailable(s: Game, m: FieldMission) {
  const p = fieldProgress(s);
  return (
    !p.completed.includes(m.id) &&
    m.requires.every((id) => p.completed.includes(id))
  );
}
export function nextFieldMission(s: Game, tracked?: string): FieldMission | undefined {
  const goal = fieldMissions.find((m) => m.id === tracked);
  if (goal && !fieldProgress(s).completed.includes(goal.id)) {
    const prerequisite = goal.requires.find((id) => !fieldProgress(s).completed.includes(id));
    return prerequisite ? nextFieldMission(s, prerequisite) : goal;
  }
  return (
    fieldMissions.find((m) => missionAvailable(s, m))
  );
}
export function missionSector(m: FieldMission) {
  return sectors.find((s) => s.id === m.sector)!;
}
export const actNames = [
  "",
  "Find our footing",
  "Learn to live here",
  "A way back home",
];
