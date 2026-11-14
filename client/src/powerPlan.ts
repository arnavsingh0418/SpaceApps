import {
  allocationLimit, canRunSol, createOutpost, initialAllocation, jobs, lastSol,
  powerBudget, runSol, total, type Allocation,
} from "./power";

export function connectPowerPlan(hasExtraPanel: () => boolean) {
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

  function readPlan(): Allocation {
    return Object.fromEntries(inputs.map((input) => [input.name, input.valueAsNumber])) as Allocation;
  }
  function refresh() {
    const budget = powerBudget(hasExtraPanel());
    const plan = readPlan();
    const used = total(plan);
    budgetLabel.textContent = Number.isFinite(used)
      ? used + " / " + budget + " power blocks used"
      : "Enter a value for each system";
    submit.disabled = !canRunSol(state, plan, budget);
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
    if (!runSol(state, plan, powerBudget(hasExtraPanel()))) return;
    const change = (delta: number) => (delta >= 0 ? "+" : "") + delta;
    const result = state.complete
      ? state.air === 0 ? "The outpost ran out of air."
        : state.food === 0 ? "The outpost ran out of food."
        : state.dose === 100 ? "The crew reached its radiation limit."
        : "The crew completed " + lastSol + " sols."
      : "";
    summary.textContent = "Sol " + before.sol + " complete. Air " + change(state.air - before.air) +
      " · Food " + change(state.food - before.food) + " · Dose " + change(state.dose - before.dose) +
      " · Radio " + change(state.signal - before.signal) + (result ? ". " + result : "");
    refresh();
  });
  refresh();
}
