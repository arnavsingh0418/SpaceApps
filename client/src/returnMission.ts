import { createSalvage, partNames, partSlots, quizSeconds, sites, type Part } from "./salvage";

const shapes = ["▲", "◆", "●"];

export function connectReturnMission(onLaunch: () => void) {
  const salvage = createSalvage();
  const dialog = document.querySelector<HTMLDialogElement>("#return-dialog")!;
  const list = dialog.querySelector<HTMLElement>("#salvage-sites")!;
  const systems = dialog.querySelector<HTMLElement>("#ship-systems")!;
  const quiz = dialog.querySelector<HTMLElement>("#salvage-question")!;
  const status = dialog.querySelector<HTMLElement>("#salvage-status")!;
  const launch = dialog.querySelector<HTMLButtonElement>("#launch-home")!;
  const opener = document.querySelector<HTMLButtonElement>("#board-ship")!;
  let timer: number | undefined;

  function render() {
    const run = salvage.run;
    const active = !!run && performance.now() < run.deadline;
    list.hidden = systems.hidden = active;
    quiz.hidden = !active;
    launch.hidden = active;
    launch.disabled = !salvage.ready;
    opener.textContent = salvage.ready ? "Return ship · Ready" : "Rebuild return ship · " + Object.keys(salvage.installed).length + "/4";
    if (active && run) {
      const challenge = sites[run.site];
      const question = challenge.questions[run.step];
      quiz.innerHTML = '<p>' + challenge.name + ' · Question ' + (run.step + 1) + '/' + challenge.questions.length +
        '</p><h3>' + question.question + '</h3><div class="salvage-clock"><progress aria-label="Quiz time remaining" max="' +
        quizSeconds + '"></progress><span data-time></span></div><div class="salvage-answers">' +
        question.answers.map((answer, i) => '<button type="button" data-answer="' + i + '"><span aria-hidden="true">' +
          shapes[i] + '</span> ' + answer + '</button>').join("") + '</div>';
      updateClock();
    } else {
      quiz.textContent = "";
      list.innerHTML = '<h3>Salvage caches</h3><p>Answer two questions per cache. Faster correct answers recover rarer parts.</p>' +
        '<div class="salvage-sites">' + sites.map((site, index) => {
          const reward = salvage.finished.get(index);
          return '<button type="button" data-site="' + index + '"' + (reward ? " disabled" : "") + '><b>' + site.name +
            '</b><small>' + (reward ? reward + " recovered" : partNames[site.part]) + '</small></button>';
        }).join("") + '</div>';
      systems.innerHTML = '<h3>Install ship systems</h3><div class="ship-systems">' + partSlots.map((part) => {
        const recovered = salvage.recovered[part], installed = salvage.installed[part];
        return '<div><span><b>' + partNames[part] + '</b><small>' +
          (installed ? installed + " installed" : recovered ? recovered + " available" : "Missing") +
          '</small></span>' + (recovered && recovered !== installed ?
            '<button type="button" data-part="' + part + '">' + (installed ? "Upgrade" : "Install") + '</button>' : '') + '</div>';
      }).join("") + '</div>';
    }
    dialog.querySelector("#salvage-score")!.textContent = salvage.points + " points";
  }

  function updateClock() {
    const run = salvage.run;
    if (!run || quiz.hidden) return;
    const remaining = Math.max(0, (run.deadline - performance.now()) / 1000);
    if (!remaining) {
      status.textContent = "Time ran out. Retry the cache when you’re ready.";
      render();
      list.querySelector<HTMLElement>('[data-site="' + run.site + '"]')?.focus();
      return;
    }
    quiz.querySelector("progress")!.value = remaining;
    quiz.querySelector("[data-time]")!.textContent = Math.ceil(remaining) + "s";
  }

  function open() {
    if (dialog.open) return;
    status.textContent = "";
    render();
    dialog.showModal();
    timer = window.setInterval(updateClock, 100);
  }
  dialog.addEventListener("close", () => window.clearInterval(timer));
  dialog.querySelector("#close-return")!.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!button || button.disabled) return;
    if (button.dataset.site !== undefined) {
      if (!salvage.start(Number(button.dataset.site), performance.now())) return;
      status.textContent = "";
      render();
      quiz.querySelector("button")?.focus();
    } else if (button.dataset.answer !== undefined && salvage.run) {
      const { site, step } = salvage.run;
      const result = salvage.answer(site, step, Number(button.dataset.answer), performance.now());
      if (result === "incorrect") {
        status.textContent = "Try again. The clock is still running.";
        return;
      }
      if (result === "expired") {
        updateClock();
        return;
      }
      status.textContent = result === "complete"
        ? salvage.finished.get(site) + " " + partNames[sites[site].part].toLowerCase() + " recovered."
        : "Correct. Next question.";
      render();
      if (result === "next") quiz.querySelector("button")?.focus();
      else systems.querySelector("button")?.focus();
    } else if (button.dataset.part) {
      const part = button.dataset.part as Part;
      if (!salvage.install(part)) return;
      status.textContent = partNames[part] + " installed." + (salvage.ready ? " Ready to launch." : "");
      render();
      (salvage.ready ? launch : systems.querySelector("button") ?? list.querySelector("button:not(:disabled)"))?.focus();
    } else if (button === launch && salvage.ready) {
      dialog.close();
      onLaunch();
    }
  });
  render();
  return { open };
}
