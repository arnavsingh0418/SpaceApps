import { partNames, type Part } from "../../../shared/src/returnMission";
import { partDetails } from "../../../shared/src/shipRewards";

const drawings: Record<Part, string> = {
  booster:
    '<path d="M27 30h24v10l9 24H18l9-24zM69 30h24v10l9 24H60l9-24z" fill="#687b8a"/><path d="M25 48h28l7 17H18zM67 48h28l7 17H60z" fill="#e29b5b"/><path d="M32 68l7 23 7-23M74 68l7 23 7-23" fill="#ffe09a"/><path d="M38 29V18h43v11" fill="none" stroke="currentColor" stroke-width="6"/><path d="M20 63h38M62 63h38" stroke="#e6f0ec" stroke-width="3"/>',
  hull: '<path d="M60 13 99 31 91 70 60 94 29 70 21 31z" fill="#62718e" stroke="currentColor" stroke-width="3"/><path d="M60 21 85 35 79 61 60 78 41 61 35 35z" fill="#b78bc9"/><path d="M60 21v57M35 35l44 26M85 35 41 61" stroke="#ead7ed" stroke-width="2"/><path d="m60 39 13 8-3 15-10 8-10-8-3-15z" fill="#354460"/>',
  nav: '<ellipse cx="60" cy="54" rx="40" ry="15" fill="none" stroke="#b1e0d3" stroke-width="4" transform="rotate(-28 60 54)"/><ellipse cx="60" cy="54" rx="40" ry="15" fill="none" stroke="currentColor" stroke-width="4" transform="rotate(60 60 54)"/><path d="m60 30 16 24-16 24-16-24z" fill="currentColor"/><path d="m60 30 0 48 16-24z" fill="#e7fff7"/><path d="M35 86h50v7H35z" fill="#719892"/>',
  air: '<rect x="24" y="25" width="24" height="54" rx="11" fill="#b9d9ef"/><rect x="72" y="25" width="24" height="54" rx="11" fill="#b9d9ef"/><path d="M22 41h28v7H22zM70 41h28v7H70zM22 64h28v7H22zM70 64h28v7H70z" fill="#45637c"/><path d="M36 25V16h48v9M48 55h24" fill="none" stroke="currentColor" stroke-width="5"/><rect x="51" y="41" width="18" height="29" rx="4" fill="#426b90"/><circle cx="60" cy="51" r="4" fill="currentColor"/>',
};
export function partArt(part: Part, state = "available") {
  return `<div class="part-art ${state}" style="--part-color:${partDetails[part].color}" aria-label="${partNames[part]} · ${state}"><svg viewBox="0 0 120 106" role="img"><title>${partNames[part]}</title>${drawings[part]}</svg><span class="part-orbit"></span></div>`;
}
export function partReward(
  part: Part,
  rarity: string,
  title = "SHIP PART RECOVERED",
) {
  return `<section class="part-reward" role="status">${partArt(part, "reward")}<div><small>${title}</small><h3>${partNames[part]}</h3><b>${rarity.toUpperCase()} · SHARED WITH CREW</b><p>Install at the return platform.</p></div></section>`;
}
