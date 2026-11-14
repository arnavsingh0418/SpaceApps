import {
  allocationLimit, canRunSol, createOutpost, initialAllocation, jobs, lastSol,
  runSol, total, type Allocation,
} from "./power";

import type { createConstruction } from "./construction";
import { flareEffect, flareForSol, flareResponses } from "./flare";
import { applyDustStorm, budgetForSol, isDustStormSol } from "./solar";

export function connectPowerPlan(construction: ReturnType<typeof createConstruction>, refreshWorkbench: () => void) {
  const state = createOutpost();
  const dialog = document.querySelector<HTMLDialogElement>("#power-dialog")!;
  const opener = document.querySelector<HTMLButtonElement>("#open-power")!;
  const form = dialog.querySelector("form")!;
  const fieldset = form.querySelector("fieldset")!;
  const inputs = Array.from(fieldset.querySelectorAll<HTMLInputElement>("input"));
  const summary = dialog.querySelector<HTMLElement>("#power-summary")!;
  const budgetLabel = dialog.querySelector<HTMLElement>("#power-budget")!;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const solLabel = document.querySelector<HTMLElement>("#sol-number")!;
  const vitals = document.querySelector<HTMLElement>("#outpost-vitals")!;
  const alert = form.querySelector<HTMLFieldSetElement>("#flare-alert")!;
  const flareLabel = alert.querySelector<HTMLElement>("[data-flare-label]")!;
  const archive = alert.querySelector<HTMLAnchorElement>("a")!;
  const response = alert.querySelector<HTMLSelectElement>("select")!;
  const options = {
    shelter: "Take shelter · 10 food",
    ice: "Add shielding · 2 ice",
    work: "Keep working outside",
  };
  const supplies = () => ({ ice: construction.stock.ice, shelter: construction.built.has("shelter") });
  const storm = dialog.querySelector<HTMLElement>("#dust-storm-warning")!;
  const budgetNow = () => budgetForSol(construction.array, isDustStormSol(state.sol));
  const cover = dialog.querySelector<HTMLButtonElement>("#storm-cover")!;
  cover.addEventListener("click", () => {
    const array = construction.array;
    if (!array) return;
    array.covered = !array.covered;
    refreshWorkbench();
    refresh();
  });
  const chosen = () => flareResponses.find((choice) => choice === response.value);
  const effect = (choice = chosen()) =>
    flareEffect(state.sol, choice, { ...supplies(), food: state.food, shield: state.shield });

  function readPlan(): Allocation {
    return Object.fromEntries(inputs.map((input) => [input.name, input.valueAsNumber])) as Allocation;
  }
  function refresh() {
    const budget = budgetNow();
    const plan = readPlan();
    const used = total(plan);
    storm.hidden = state.complete || !isDustStormSol(state.sol);
    cover.hidden = !construction.array;
    cover.textContent = construction.array?.covered ? "Uncover array" : "Cover array";
    budgetLabel.textContent = Number.isFinite(used)
      ? used + " / " + budget + " power blocks used"
      : "Enter a value for each system";
    const flare = state.complete ? undefined : flareForSol(state.sol);
    alert.hidden = !flare;
    alert.disabled = !flare;
    if (flare) {
      flareLabel.textContent = flare.classType + " solar flare · archived " + flare.beginTime.slice(0, 10);
      archive.href = flare.url.replace("kauai.ccmc.gsfc.nasa.gov", "ccmc.gsfc.nasa.gov");
      for (const choice of flareResponses) {
        const option = response.querySelector<HTMLOptionElement>('option[value="' + choice + '"]')!;
        const preview = effect(choice);
        option.disabled = !preview;
        option.textContent = options[choice] + (preview ? " · +" + (preview.dose - 2) + " flare dose" : " · unavailable");
      }
    }
    submit.disabled = !canRunSol(state, plan, budget) || (!!flare && !effect());
    fieldset.disabled = state.complete;
    solLabel.textContent = String(state.sol).padStart(3, "0");
    vitals.textContent = "Air " + state.air + "% · Food " + state.food +
      "% · Dose " + state.dose + "% · Radio " + state.signal + "/10";
    opener.textContent = state.complete ? "View sol report" : "Plan power";
    submit.textContent = state.complete ? "Outpost run ended" : "Run sol " + state.sol;
  }

  for (const input of inputs) {
    const job = jobs.find((key) => key === input.name)!;
    input.value = String(initialAllocation[job]);
    input.max = String(allocationLimit);
  }
  opener.addEventListener("click", () => {
    refresh();
    dialog.showModal();
  });
  dialog.querySelector("#close-power")!.addEventListener("click", () => dialog.close());
  form.addEventListener("input", refresh);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const before = { ...state };
    const plan = readPlan();
    const resources = supplies();
    if (!runSol(state, plan, budgetNow(), chosen(), resources)) return;
    construction.stock.ice = resources.ice;
    const dustStorm = isDustStormSol(before.sol);
    if (dustStorm && construction.array) applyDustStorm(construction.array);
    const weatherReport = dustStorm && construction.array
      ? construction.array.covered ? " The cover kept dust off the array." : " Dust reduced the array output. Brush it clean at Solar science."
      : "";
    response.value = "";
    refreshWorkbench();
    const change = (delta: number) => (delta >= 0 ? "+" : "") + delta;
    const result = state.complete
      ? state.air === 0 ? "The outpost ran out of air."
        : state.food === 0 ? "The outpost ran out of food."
        : state.dose === 100 ? "The crew reached its radiation limit."
        : "The crew completed " + lastSol + " sols."
      : "";
    summary.textContent = "Sol " + before.sol + " complete. Air " + change(state.air - before.air) +
      " · Food " + change(state.food - before.food) + " · Dose " + change(state.dose - before.dose) +
      " · Radio " + change(state.signal - before.signal) + "." + weatherReport + (result ? " " + result : "");
    refresh();
  });
  refresh();
}
