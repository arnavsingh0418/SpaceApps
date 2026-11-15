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
  { part: "booster", questions: [
    question("What pushes a rocket forward in a vacuum?", ["Air pushing back", "Exhaust expelled backward", "Wings generating lift"], 1),
    question("Why shed a spent rocket stage?", ["To reduce the mass still being carried", "To add drag", "To make fuel heavier"], 0),
  ] },
  { part: "air", questions: [
    question("Which gas must the crew replenish as they breathe?", ["Helium", "Carbon dioxide", "Oxygen"], 2),
    question("Why recycle water aboard the ship?", ["To reduce the water carried from Mars", "To remove the need for oxygen", "To power the radio antenna"], 0),
  ] },
  { part: "nav", questions: [
    question("What can a star tracker measure?", ["Cabin air pressure", "The ship's orientation", "The fuel temperature"], 1),
    question("What does a short guidance burn change?", ["The crew's mass", "The speed of light", "The ship's velocity"], 2),
  ] },
  { part: "hull", questions: [
    question("When does the heat shield have its main job?", ["During atmospheric entry", "While parked in the hangar", "During a radio call"], 0),
    question("How can an ablative shield carry heat away?", ["By reflecting radio signals", "By shedding heated material", "By collecting sunlight"], 1),
  ] },
  { part: "hull", questions: [
    question("Which system keeps air inside the cabin?", ["The solar array", "The landing radar", "The sealed pressure hull"], 2),
    question("Which reading would reveal a possible cabin leak?", ["A falling cabin pressure", "A rising antenna angle", "A brighter screen"], 0),
  ] },
  { part: "nav", questions: [
    question("Why send important telemetry more than once?", ["To shorten the distance to Earth", "To recover from missed transmissions", "To eliminate signal travel time"], 1),
    question("Which information helps controllers reconstruct a maneuver?", ["The cabin paint color", "The crew's meal plan", "When and how long the engine fired"], 2),
  ] },
  { part: "booster", questions: [
    question("What can start a fire near a propellant leak?", ["A spark", "A radio delay", "A lower camera angle"], 0),
    question("Why bolt a booster securely to the ship?", ["To make the ship glow", "To transmit thrust into the frame", "To cool the crew cabin"], 1),
  ] },
];

const siteNames = ["Landing zone", "Frost hollow", "Sunward flats", "Ancient basin", "Cavern approach", "Echo station", "Return platform"] as const;

export const sites = cacheChallenges.map((challenge, index) => ({
  ...challenge,
  name: siteNames[index],
}));

export function createSalvage() {
  const recovered: Partial<Record<Part, Rarity>> = {};
  const installed: Partial<Record<Part, Rarity>> = {};
  const finished = new Map<number, Rarity>();
  let points = 0;
  let run: { site: number; step: number; deadline: number; fast: number; points: number } | undefined;

  function start(site: number, now: number) {
    if (!sites[site] || finished.has(site) || (run && now < run.deadline)) return false;
    run = { site, step: 0, deadline: now + quizSeconds * 1000, fast: 0, points: 0 };
    return true;
  }

  function answer(site: number, step: number, index: number, now: number) {
    if (!run || run.site !== site || run.step !== step || now >= run.deadline) return "expired";
    const challenge = sites[site];
    if (challenge.questions[step].correct !== index) return "incorrect";
    const remaining = (run.deadline - now) / 1000;
    run.points += 100 + Math.floor(Math.min(quizSeconds, remaining) / quizSeconds * 100);
    if (remaining >= quizSeconds - fastAnswerSeconds) run.fast++;
    if (++run.step < challenge.questions.length) {
      run.deadline = now + quizSeconds * 1000;
      return "next";
    }
    const rarity = rarities[run.fast];
    const previous = recovered[challenge.part];
    if (!previous || rarities.indexOf(rarity) > rarities.indexOf(previous)) recovered[challenge.part] = rarity;
    finished.set(site, rarity);
    points += run.points;
    run = undefined;
    return "complete";
  }

  function install(part: Part) {
    if (!recovered[part] || installed[part] === recovered[part]) return false;
    installed[part] = recovered[part];
    return true;
  }

  return {
    recovered, installed, finished, start, answer, install,
    get run() { return run; },
    get points() { return points; },
    get ready() { return partSlots.every((part) => installed[part]); },
  };
}
