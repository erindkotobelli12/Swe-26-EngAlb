import type { Override, SimulationOverrides } from "./overrides";
import type { Toggle } from "./simulate";

/** Maps UI choices (toggle key → selected value) to overrides. Shared by the server (initial render) and the client. */
export type Choice = Record<string, string>;

export function overridesFrom(toggles: Toggle[], choice: Choice, includeProposed: boolean): SimulationOverrides {
  const items: Override[] = [];
  for (const t of toggles) {
    const v = choice[t.key];
    if (!v) continue;
    if (t.kind === "check") items.push(t.override);
    else {
      const opt = t.options.find((o) => o.value === v);
      if (opt) items.push(opt.override);
    }
  }
  return { items, includeProposed };
}

/** A "Simulate resolving this" link pre-selects the most complete option of that toggle. */
export function presetChoice(toggles: Toggle[], preset: string | undefined): Choice {
  const t = toggles.find((x) => x.key === preset);
  if (!t) return {};
  return { [t.key]: t.kind === "check" ? "on" : t.options.at(-1)?.value ?? "" };
}
