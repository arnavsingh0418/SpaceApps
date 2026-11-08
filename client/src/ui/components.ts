import type { Game } from "../../../shared/src/sim";
export const escape = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export const KeyChip = (key: string) => `<kbd>${escape(key)}</kbd>`;
export const Panel = (content: string, cls = "") =>
  `<section class="panel ${cls}">${content}</section>`;
export const Button = (
  label: string,
  action: string,
  attrs = "",
  secondary = false,
) =>
  `<button class="button ${secondary ? "secondary" : ""}" data-do="${action}" ${attrs}>${label}</button>`;
export const Tooltip = (text: string) =>
  `<span class="tooltip" role="tooltip">${escape(text)}</span>`;
export const Modal = (
  title: string,
  content: string,
  closable = true,
  cls = "",
) =>
  `<div class="scrim"><section class="modal ${cls}" role="dialog" aria-modal="true" aria-label="${escape(title)}">${closable ? Button("×", "close", 'aria-label="Close"', true) : ""}<h2>${escape(title)}</h2>${content}</section></div>`;
export const Gauge = (
  key: string,
  icon: string,
  value: number,
  max: number,
  help: string,
  prev = value,
) =>
  `<button class="gauge ${key} ${key === "dose" ? (value > 60 ? "low" : "") : (value < 30 && key !== "power") || (key === "power" && value < 4) ? "low" : ""}" style="--value:${Math.min(100, (value / max) * 100)}%;--from:${Math.min(100, (prev / max) * 100)}%" aria-label="${escape(help)}" data-do="gauge" data-gauge="${key}"><span>${icon}</span><b>${Math.round(value)}</b>${Tooltip(help)}${prev !== value ? `<i class="delta">${value - prev > 0 ? "+" : ""}${Math.round(value - prev)}</i>` : ""}</button>`;
export const Banner = (
  title: string,
  line: string,
  seconds: number,
  total: number,
  kind: string,
) =>
  `<button class="event-banner ${kind}" data-do="event" data-copy="banner"><b class="countdown-ring" style="--progress:${(seconds / total) * 100}%">${Math.floor(seconds / 60)}:${String(Math.ceil(seconds % 60)).padStart(2, "0")}</b><div><strong>${escape(title)}</strong><span>${escape(line)}</span></div><i style="--remaining:${Math.min(100, (seconds / total) * 100)}%"></i></button>`;
export const ChoiceCard = (
  title: string,
  chip: string,
  options: string,
  seconds: number,
  total: number,
) =>
  `<div class="choice-card" data-copy="choice"><div class="countdown" style="--remaining:${(seconds / total) * 100}%"></div><h2>${title}</h2><p class="archive-chip">${chip}</p><div class="choices">${options}</div></div>`;
const warned=new Set<string>();
export function validateCopy(parent:ParentNode){
 if(!import.meta.env.DEV)return;
 const rules=[['.world-label:not(.name-tag)',4,160],['.interaction',6,260],['.toast',8,360],['.fact-toast',28,340],['.science-copy',28,340],['.event-banner strong',4,520],['.event-banner>div>span',10,520],['.choice-card h2',5,420],['.modal>h2',5,560],['.tooltip',10,360]] as const;
 for(const[selector,words,width]of rules)for(const el of parent.querySelectorAll<HTMLElement>(selector)){if(el.hidden||!el.getClientRects().length)continue;const text=el.textContent!.trim();const key=selector+text;if(!warned.has(key)&&(text.split(/\s+/).length>words||el.getBoundingClientRect().width>width+1)){warned.add(key);console.warn(`UI copy limit: ${selector}: ${text}`);}}
 for(const el of parent.querySelectorAll<HTMLElement>('.modal p')){if(!el.getClientRects().length)continue;const line=parseFloat(getComputedStyle(el).lineHeight);const key='lines:'+el.textContent;if(el.getBoundingClientRect().height>line*3+1&&!warned.has(key)){warned.add(key);console.warn(`UI body limit: ${el.textContent}`);}}
}
export const goalCount = (s: Game) =>
  ["shelter", "radio", "greenhouse"].filter(
    (k) =>
      s.built.includes(k) && (k !== "radio" || (s.aligned && s.radio >= 10)),
  ).length;
