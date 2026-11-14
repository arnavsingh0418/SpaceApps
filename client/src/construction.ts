export const recipes = {
  shelter: {
    name: "Radiation shelter",
    lesson: "habitat",
    cost: { ice: 3, soil: 2, scrap: 3 },
  },
  panel: {
    name: "Extra solar panel",
    lesson: "solar",
    cost: { scrap: 2, glass: 1 },
  },
} as const;

export type Structure = keyof typeof recipes;
type Supply = "ice" | "soil" | "scrap" | "glass";
type Stock = Record<Supply, number>;

const caches: Record<string, Partial<Stock>> = {
  metal: { scrap: 5, glass: 1 },
  soil: { soil: 2, ice: 3 },
};

export const recipeIds = Object.keys(recipes) as Structure[];

export function createConstruction() {
  const stock: Stock = { ice: 0, soil: 0, scrap: 0, glass: 0 };
  const learned = new Set<string>();
  const built = new Set<Structure>();
  const collected = new Set<string>();

  function collect(cache: string) {
    if (!Object.hasOwn(caches, cache) || collected.has(cache)) return false;
    for (const [item, count] of Object.entries(caches[cache]))
      stock[item as Supply] += count;
    collected.add(cache);
    return true;
  }

  function problem(id: Structure) {
    const recipe = recipes[id];
    if (built.has(id)) return "Built";
    if (!learned.has(recipe.lesson)) return "Complete the station quiz";
    if (Object.entries(recipe.cost).some(([item, count]) => stock[item as Supply] < count))
      return "Collect more supplies";
    return "";
  }

  function build(id: Structure) {
    if (problem(id)) return false;
    for (const [item, count] of Object.entries(recipes[id].cost))
      stock[item as Supply] -= count;
    built.add(id);
    return true;
  }

  return { stock, learned, built, collected, collect, problem, build };
}
