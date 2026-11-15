import { escape, validateCopy } from "./components";
let expires = 0,
  factsThisSol = 0,
  sol = 0;
export function toast(text: string, fact = false, currentSol = 0) {
  if (fact) {
    if (sol !== currentSol) {
      sol = currentSol;
      factsThisSol = 0;
    }
    if (factsThisSol >= 2) return;
    factsThisSol++;
  }
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.setAttribute("role", "status");
    document.body.append(el);
  }
  el.className = fact ? "fact-toast" : "toast";
  const words = text.split(/\s+/);
  el.innerHTML = escape(words.slice(0, fact ? 28 : 8).join(" "));
  el.classList.add("show");
  expires = performance.now() + (fact ? 6000 : 3200);
  validateCopy(document);
}
export function tickToast() {
  if (performance.now() > expires)
    document.getElementById("toast")?.classList.remove("show");
}
