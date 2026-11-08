// Science references are shown in the field manual. The crew and landing emergency
// are fictional; the sequence illustrates principles used by robotic Mars landers.
export const arrivalStory = [
  {
    key: "boarding",
    duration: 10,
    place: "EARTH · LAUNCH DAY",
    title: "A small crew. A very big journey.",
    status: "SUIT SEALED / OXYGEN CHECKED",
    lines: [
      "You're an explorer on the way to a small outpost on Mars. Your job: help turn a landing site into a home.",
      "Helmet sealed. Oxygen checked. Walk across the access bridge, climb aboard, and bring the supplies your crew will need.",
    ],
    fact: "A spacesuit carries breathable air and protects an astronaut when the air outside cannot.",
  },
  {
    key: "cabin",
    duration: 10,
    place: "CREW CABIN · PRELAUNCH",
    title: "Buckle in, explorer.",
    status: "HARNESS LOCKED / CABIN PRESSURIZED",
    lines: [
      "The hatch closes behind you. Strap into your seat. The crew checks air, power, and the route one last time.",
      "Mission Control: “All systems ready. Three… two… one… liftoff!”",
    ],
    fact: "Seats and harnesses support the crew as the rocket accelerates. Inside the cabin, pressure lets them breathe.",
  },
  {
    key: "launch",
    duration: 9,
    place: "EARTH · ASCENT",
    title: "Up, up, and away.",
    status: "ENGINES FIRING / ASCENT NOMINAL",
    lines: [
      "The engines push exhaust down, lifting the rocket up. Earth grows smaller beneath your window.",
      "When a booster has used its fuel, it separates. The lighter spacecraft continues the journey.",
    ],
    fact: "Rockets push out exhaust to produce thrust. They can work in space, where there is no air to push against.",
  },
  {
    key: "cruise",
    duration: 12,
    place: "INTERPLANETARY SPACE · MONTHS LATER",
    title: "Space is a long way from home.",
    status: "COASTING / SOLAR ARRAYS DEPLOYED",
    lines: [
      "This trip takes months, not minutes. Between engine burns, the ship coasts while solar panels collect energy.",
      "Air, food, and power must last. Ahead, a habitat and supplies sent earlier are waiting near Gale Crater.",
    ],
    fact: "NASA's Perseverance rover took nearly seven months to reach Mars. Travel time depends on the route and launch date.",
  },
  {
    key: "entry",
    duration: 10,
    place: "MARS · ATMOSPHERIC ENTRY",
    title: "A shield against the heat.",
    status: "HEAT SHIELD FORWARD / HOLD TIGHT",
    lines: [
      "The lander separates and turns its heat shield toward Mars. Rushing into the atmosphere heats the gas ahead of it.",
      "The cabin rattles as the air slows the lander. The heat shield protects the crew inside.",
    ],
    fact: "Mars has a thin atmosphere. It creates intense heating during entry, but cannot slow a lander enough on its own.",
  },
  {
    key: "parachute",
    duration: 10,
    place: "MARS · DESCENT",
    title: "Slow down. Find safe ground.",
    status: "PARACHUTE OPEN / TERRAIN SCANNING",
    lines: [
      "A parachute opens after the lander slows enough. The heat shield drops away so the landing sensors can see below.",
      "Earth cannot steer every moment: radio signals take minutes to cross space. The onboard computer handles the descent.",
    ],
    fact: "Robotic Mars missions have combined heat shields, parachutes, and rockets. Landing a heavy human spacecraft needs further engineering.",
  },
  {
    key: "braking",
    duration: 10,
    place: "GALE CRATER · FINAL APPROACH",
    title: "An unexpected emergency.",
    status: "TRAINING SCENARIO / THRUSTER FAULT",
    lines: [
      "The parachute releases and braking rockets fire. But in this training story, one thruster loses power.",
      "“Brace!” Backup engines slow the fall. The crew aims for open ground beside the pre-delivered habitat.",
    ],
    fact: "Rockets provide the final braking near the surface. This fault and crash are invented for our survival story.",
  },
  {
    key: "touchdown",
    duration: 8,
    place: "GALE CRATER · HARD LANDING",
    title: "Down. But not out.",
    status: "CREW SAFE / RADIO DAMAGED",
    lines: [
      "The landing gear gives way. The ship slides, tips, and stops in a cloud of red dust. Everyone is safe.",
      "The radio is damaged and supplies are scattered. The nearby habitat is intact. You have somewhere to start.",
    ],
    fact: "Space missions plan backups. In this game, you will recover supplies and rebuild the systems that keep your crew alive.",
  },
  {
    key: "egress",
    duration: 12,
    place: "MARS · YOUR FIRST SOL",
    title: "Your first steps. Your outpost.",
    status: "SUIT CHECK COMPLETE / HATCH OPEN",
    lines: [
      "Check the suit seal and oxygen before opening the hatch. Lower the ladder. One careful step… then another.",
      "Welcome to Mars, explorer. Gather supplies, learn the science, and build a greenhouse, radiation shelter, and working radio.",
    ],
    fact: "A sol is a Mars day: about 24 hours and 39 minutes. Your 15-sol rescue objective is a game scenario.",
  },
] as const;

export const arrivalDuration = arrivalStory.reduce(
  (sum, shot) => sum + shot.duration,
  0,
);
