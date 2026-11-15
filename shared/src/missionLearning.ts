export const surfaceLearning = {
  clean: {
    term: "Solar array",
    definition: "A group of solar panels that turns sunlight into electricity.",
    role: "Spacecraft electrical power engineer",
    work: "Track how much electricity the spacecraft can make and decide what can stay on.",
    mission: "InSight · dust and solar power",
    evidence: "On sol 884, windblown sand helped lift dust from InSight’s panels. NASA reported a gain of about 30 watt-hours per sol.",
    model: "You use a brush and measure game power in blocks. InSight used its robotic arm to drop sand beside a panel.",
    url: "https://www.jpl.nasa.gov/news/nasas-insight-mars-lander-gets-a-power-boost/",
    reflection: "Why does a clean panel still produce less power during an active dust storm?",
    answer: "Dust in the air can block sunlight before it reaches even a clean panel.",
  },
  align: {
    term: "Signal strength",
    definition: "How strongly an antenna receives a radio signal.",
    role: "Communications engineer",
    work: "Point antennas, monitor signal quality, and plan when data can reach Earth.",
    mission: "Mars Relay Network · the link to Earth",
    evidence: "NASA’s Mars orbiters relay rover data. Depending on the planets’ positions, a radio signal takes about 3 to 22 minutes to travel one way.",
    model: "The dial simplifies antenna pointing. A stronger signal helps communication, but it cannot shorten light travel time.",
    url: "https://science.nasa.gov/mars/mars-relay-network/",
    reflection: "Does a stronger signal make Mission Control’s reply arrive instantly?",
    answer: "No. Radio waves still take time to travel between Earth and Mars.",
  },
  patch: {
    term: "Cabin pressure",
    definition: "The push of the air inside a sealed living space. A leak lets air escape.",
    role: "Spacecraft life-support engineer",
    work: "Watch pressure readings, find air leaks, and check that repairs hold.",
    mission: "International Space Station · pressure leak",
    evidence: "In August 2018, the crew traced a leak to a hole about two millimeters across in a docked Soyuz spacecraft and fixed it.",
    model: "The game’s three seals represent locating and closing a leak. The air meter uses game units.",
    url: "https://www.nasa.gov/blogs/spacestation/2018/08/30/international-space-station-status-2/",
    reflection: "Why should you check the pressure trend again after closing a leak?",
    answer: "A stable reading helps show that air is no longer escaping through the repaired spot.",
  },
} as const;

export type SurfaceLesson = keyof typeof surfaceLearning;
export function isSurfaceLesson(kind: string): kind is SurfaceLesson {
  return Object.hasOwn(surfaceLearning, kind);
}
