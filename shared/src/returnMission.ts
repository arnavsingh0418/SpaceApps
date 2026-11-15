import { sectors } from "./expedition";
import type { Game } from "./sim";
import type { DeckFlight } from "./flight";
import { alienSite, alienProgress } from "./alien";

export type Quiz = {
  question: string;
  answers: string[];
  correct: number;
};

export const partNames = {
  booster: "Launch booster",
  hull: "Heat shield",
  nav: "Navigation core",
  air: "Life-support module",
};
export type Part = keyof typeof partNames;
export const partSlots = Object.keys(partNames) as Part[];
export const rarities = ["Standard", "Rare", "Prototype"] as const;
export type Rarity = (typeof rarities)[number];
export const quizSeconds = 20;
export const fastAnswerSeconds = 8;

function question(prompt: string, answers: string[], correct: number): Quiz {
  return { question: prompt, answers, correct };
}

const cacheChallenges: { part: Part; questions: Quiz[] }[] = [
  {
    part: "booster",
    questions: [
      question(
        "What pushes a rocket forward in a vacuum?",
        [
          "Air pushing back",
          "Exhaust expelled backward",
          "Wings generating lift",
        ],
        1,
      ),
      question(
        "Why shed a spent rocket stage?",
        [
          "To reduce the mass still being carried",
          "To add drag",
          "To make fuel heavier",
        ],
        0,
      ),
    ],
  },
  {
    part: "air",
    questions: [
      question(
        "Which gas must the crew replenish as they breathe?",
        ["Helium", "Carbon dioxide", "Oxygen"],
        2,
      ),
      question(
        "Why recycle water aboard the ship?",
        [
          "To reduce the water carried from Mars",
          "To remove the need for oxygen",
          "To power the radio antenna",
        ],
        0,
      ),
    ],
  },
  {
    part: "nav",
    questions: [
      question(
        "What can a star tracker measure?",
        [
          "Cabin air pressure",
          "The ship's orientation",
          "The fuel temperature",
        ],
        1,
      ),
      question(
        "What does a short guidance burn change?",
        ["The crew's mass", "The speed of light", "The ship's velocity"],
        2,
      ),
    ],
  },
  {
    part: "hull",
    questions: [
      question(
        "When does the heat shield have its main job?",
        [
          "During atmospheric entry",
          "While parked in the hangar",
          "During a radio call",
        ],
        0,
      ),
      question(
        "How can an ablative shield carry heat away?",
        [
          "By reflecting radio signals",
          "By shedding heated material",
          "By collecting sunlight",
        ],
        1,
      ),
    ],
  },
  {
    part: "hull",
    questions: [
      question(
        "Which system keeps air inside the cabin?",
        ["The solar array", "The landing radar", "The sealed pressure hull"],
        2,
      ),
      question(
        "Which reading would reveal a possible cabin leak?",
        [
          "A falling cabin pressure",
          "A rising antenna angle",
          "A brighter screen",
        ],
        0,
      ),
    ],
  },
  {
    part: "nav",
    questions: [
      question(
        "Why send important telemetry more than once?",
        [
          "To shorten the distance to Earth",
          "To recover from missed transmissions",
          "To eliminate signal travel time",
        ],
        1,
      ),
      question(
        "Which information helps controllers reconstruct a maneuver?",
        [
          "The cabin paint color",
          "The crew's meal plan",
          "When and how long the engine fired",
        ],
        2,
      ),
    ],
  },
  {
    part: "booster",
    questions: [
      question(
        "What can start a fire near a propellant leak?",
        ["A spark", "A radio delay", "A lower camera angle"],
        0,
      ),
      question(
        "Why bolt a booster securely to the ship?",
        [
          "To make the ship glow",
          "To transmit thrust into the frame",
          "To cool the crew cabin",
        ],
        1,
      ),
    ],
  },
];

export const salvageSites = sectors.map((sector, index) => ({
  id: sector.id,
  name: sector.name,
  x: sector.id === "basin" ? 82 : sector.x + 8,
  z: sector.id === "basin" ? -141 : sector.z + 4,
  ...cacheChallenges[index],
}));
export const launchSite = {
  x: sectors[6].x - 8,
  z: sectors[6].z + 4,
};

export const flightTasks = [
  {
    name: "Ascent guidance",
    instruction: "Adjust the trim, then confirm the correction.",
    control: "trim",
    target: 68,
  },
  {
    name: "Cruise life support",
    instruction: "Use the diagnostic readout to choose the first action.",
    control: "quiz",
    quiz: question(
      "Cabin CO₂ is rising. What should the crew check first?",
      ["The landing gear", "The CO₂ scrubber", "The star tracker"],
      1,
    ),
  },
  {
    name: "Earth entry",
    instruction: "Set the capsule's entry trim before the deadline.",
    control: "trim",
    target: 36,
  },
] as const;

export type CacheRun = {
  step: number;
  deadline: number;
  fast: number;
  points: number;
  contributions: Record<string, number>;
  feedback?: string;
  reward?: Rarity;
};
export type Flight = {
  deck?: DeckFlight;
  stage: number;
  deadline: number;
  passed: boolean[];
  baseChance: number;
  chance?: number;
  roll?: number;
};
export type ReturnProgress = {
  points: number;
  crewPoints: Record<string, number>;
  lessonTimers: Record<string, number>;
  caches: Record<string, CacheRun>;
  recovered: Partial<Record<Part, Rarity>>;
  installed: Partial<Record<Part, Rarity>>;
  flight?: Flight;
};

export function returnProgress(game: Game): ReturnProgress {
  return (
    game.returnMission ?? {
      points: 0,
      crewPoints: {},
      lessonTimers: {},
      caches: {},
      recovered: {},
      installed: {},
    }
  );
}

export const lessonTimerKey = (id: string, kind: string, quiz: string) =>
  `${id}/${kind}/${quiz}`;

export function quizPoints(remaining: number) {
  return (
    100 +
    Math.floor(
      (Math.max(0, Math.min(quizSeconds, remaining)) / quizSeconds) * 100,
    )
  );
}

export function awardPoints(
  progress: ReturnProgress,
  id: string,
  points: number,
) {
  progress.points += points;
  progress.crewPoints[id] = (progress.crewPoints[id] ?? 0) + points;
}

export function installedCount(s: Game) {
  return partSlots.filter((slot) => returnProgress(s).installed[slot]).length;
}

export function shipTarget(s: Game, id: string, pinned: string) {
  const progress = returnProgress(s);
  const nearby = salvageSites.filter(
    (site) => !progress.caches[site.id]?.reward,
  );
  if (pinned === "return") return launchSite;
  if (pinned === "nemi" && !alienProgress(s).completed) return alienSite;
  const selected = nearby.find((site) => site.id === pinned);
  if (selected) return selected;
  const missing = partSlots.filter(
    (slot) => !progress.recovered[slot] && !progress.installed[slot],
  );
  if (missing.length === 0) return launchSite;
  if (missing.includes("nav") && !alienProgress(s).completed) return alienSite;
  const player = s.players[id];
  return (
    nearby
      .filter((site) => missing.includes(site.part))
      .sort(
        (a, b) =>
          Math.hypot(player.x - a.x, player.z - a.z) -
          Math.hypot(player.x - b.x, player.z - b.z),
      )[0] ?? launchSite
  );
}

export function returnChance(s: Game) {
  const progress = returnProgress(s);
  const equipment = partSlots.reduce((total, slot) => {
    const part = progress.installed[slot];
    return total + (part ? [5, 9, 11][rarities.indexOf(part)] : 0);
  }, 0);
  const outpost =
    Number(s.built.includes("greenhouse")) * 2 +
    Number(s.built.includes("shelter")) * 2 +
    Number(s.built.includes("radio") && s.aligned && s.radio >= 10) * 4;
  return 30 + equipment + outpost;
}

export const flightChance = (base: number, passed: boolean[]) =>
  Math.max(
    5,
    Math.min(
      95,
      base + passed.reduce((chance, success) => chance + (success ? 4 : -9), 0),
    ),
  );
