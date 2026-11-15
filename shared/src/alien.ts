import type { Bag, Game, Item } from "./sim";

export const alienSite = { id: "nemi", name: "Nemi's refuge", x: -52, z: 12 };
export const alienRoverSite = { x: -45, z: 12 };
export const alienNeeds = { ice: 3, glass: 2, scrap: 2 } as const;
export type AlienSupply = keyof typeof alienNeeds;
export type AlienProgress = {
  accepted: boolean;
  delivered: Bag;
  contributions: Record<string, Bag>;
  brushed: boolean;
  completed: boolean;
  completedAt?: number;
};
export const alienProgress = (s: Game): AlienProgress =>
  s.alienQuest ?? {
    accepted: false,
    delivered: {},
    contributions: {},
    brushed: false,
    completed: false,
  };
export const alienSupplied = (s: Game) =>
  Object.entries(alienNeeds).every(
    ([k, n]) => (alienProgress(s).delivered[k as Item] ?? 0) >= n,
  );

export const alienLines = {
  hello:
    "Hello, explorers! I am Nemi. Dust has dimmed my collector, and my water loop has stopped. Help me fix it, and you can take my rover.",
  accepted:
    "A team! Wonderful. Bring three ice, two clear panels, and two scrap. Each of you can carry a different supply. Then brush my collector clean.",
  delivery:
    "Thank you! Your supplies are safe here. Check the crew list. We share one repair, so every delivery counts.",
  clean:
    "Look at that sunlight! Now we can power the water unit. But melted ice is not automatically safe. What should we do before using it?",
  ready:
    "Everything is ready. Before we restart, choose the safe water procedure. Use the evidence, not a guess.",
  complete:
    "It works! Water is flowing again. The Wayfarer rover is yours. I added a prototype navigation core for your ship, too. You helped my home. Now let us get your crew home too.",
  wrong:
    "Not quite. Clear water can still contain contaminants. Treatment and testing come before use. Try again, explorers.",
} as const;
export type AlienLine = keyof typeof alienLines;
export function alienLine(s: Game): AlienLine {
  const q = alienProgress(s);
  return q.completed
    ? "complete"
    : !q.accepted
      ? "hello"
      : alienSupplied(s) && q.brushed
        ? "ready"
        : "accepted";
}
export const alienScience = [
  {
    title: "NASA / ICE UNDER THE DUST",
    text: "NASA's SWIM map combines orbiter evidence to locate likely buried water ice. Nemi's local deposit and water unit are fictional.",
    url: "https://science.nasa.gov/resource/swim-map-shows-subsurface-water-ice-on-mars/",
  },
  {
    title: "NASA / SUNLIGHT IS POWER",
    text: "InSight's panels made about 5,000 Wh per sol after landing, falling to about 500 by spring 2022 as dust collected. Our repair is a simplified game model.",
    url: "https://science.nasa.gov/resource/insights-power-generation-after-landing-and-spring-2022/",
  },
];
