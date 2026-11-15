import flares from "./data/donki_flares.json";
import type { FailureKind } from "./flight";
import type { Quiz } from "./returnMission";

const flare = flares.find((record) => record.peakTime === "2024-05-14T16:51Z" && record.classType === "X8.7");

type Research = {
  name: string;
  url: string;
  readings: [string, string][];
  note: string;
  term: string;
  definition: string;
  role: string;
  model: string;
  quiz?: Quiz;
};

export const flightResearch: Record<FailureKind, Research> = {
  power: {
    term: "Power bus",
    definition: "A shared electrical pathway that carries power to several systems.",
    role: "Spacecraft electrical power engineer",
    model: "The archived flare provides evidence. The in-game circuit fault is a fictional scenario.",
    name: "NASA DONKI · May 2024 solar flare archive",
    url: "https://ccmc.gsfc.nasa.gov/DONKI/events/?end=2024-05-14T00%3A00%3A00Z&start=2024-05-07T00%3A00%3A00Z",
    readings: [
      ["Flare class", flare?.classType ?? "X8.7"],
      ["Start", (flare?.beginTime ?? "2024-05-14T16:46Z").slice(11, 16) + " UTC"],
      ["Peak", (flare?.peakTime ?? "2024-05-14T16:51Z").slice(11, 16) + " UTC"],
    ],
    note: "Mission Control sent this archived flare as a reference for the electrical alert.",
    quiz: {
      question: "How many minutes passed from the start of the flare to its peak?",
      answers: ["1 minute", "5 minutes", "15 minutes", "51 minutes"],
      correct: 1,
    },
  },
  engine: {
    term: "Coolant loop",
    definition: "A path that moves fluid to carry heat away from equipment.",
    role: "Spacecraft thermal systems engineer",
    model: "Challenger used an alternate flight path. The coolant backup is a fictional repair.",
    name: "NASA · Challenger STS-51F mission record",
    url: "https://www.nasa.gov/mission/sts-51F/",
    readings: [["Engine 1 shutdown", "5 min 45 s after liftoff"], ["Recovery route", "Abort to orbit"]],
    note: "Challenger reached orbit after an engine shut down. In this cabin, switch the cooling loop to its backup setting.",
  },
  air: {
    term: "CO₂ scrubber",
    definition: "A filter that removes carbon dioxide from the air the crew breathes.",
    role: "Spacecraft life-support engineer",
    model: "Apollo 13’s crew used bags, tape, and a suit hose to adapt an incompatible cartridge. Your ship has a reusable adapter collar in the aft supplies cabinet.",
    name: "NASA · Apollo 13 carbon dioxide technical brief",
    url: "https://www.nasa.gov/ochmo-tb-004-carbon-dioxide-2/",
    readings: [["Before the scrubber fix", "14.9 mmHg CO₂"], ["After the scrubber fix", "1 mmHg CO₂"]],
    note: "Apollo 13's crew adapted a spare cartridge to remove carbon dioxide from the cabin.",
    quiz: {
      question: "Which reading shows the repaired scrubber was removing CO₂?",
      answers: ["14.9 mmHg after the repair", "An unchanged CO₂ reading", "1 mmHg after the repair", "A rising CO₂ reading"],
      correct: 2,
    },
  },
  hull: {
    term: "Thermal protection",
    definition: "Materials that limit how much heat reaches a spacecraft’s cabin.",
    role: "Thermal protection technician",
    model: "NASA investigated Artemis I’s material loss after landing. The backup shield switches are fictional.",
    name: "NASA · Artemis I heat shield investigation",
    url: "https://www.nasa.gov/missions/artemis/nasa-identifies-cause-of-artemis-i-orion-heat-shield-char-loss/",
    readings: [["Orion cabin", "Steady in the mid-70s °F"], ["Heat shield surface", "Unexpected char loss"]],
    note: "Orion stayed cool inside even as char chipped off the outside. At your station, activate the four backup shield panels before entry.",
  },
};
