/**
 * Diagrams in the chat (docs/24). A page hands the chat the result it shows; the chat tells
 * Astro only which diagrams that result can draw, under an id. When Astro asks for one
 * (the agent's `show_visual` tool), the chat draws it here, in the browser, from the result
 * with that id. The result itself never goes to the AI.
 *
 * A result handed over is kept as it was for as long as the chat is open, so an earlier answer
 * keeps the diagram it was given, whatever page or result the person opens next.
 */

import type { SavedTimes } from "@/components/account/SavedTime";
import type { AnyHadahan, Labels } from "@/lib/hadahan";
import type { Porondam } from "@/lib/porondam";

import { parseResult } from "./tools";
import { VISUALS, type VisualName } from "./visuals";

export type PageVisuals =
  | {
      kind: "chart";
      /** Only the parts drawn. */
      result: Pick<AnyHadahan, "chart" | "dasha" | "kuja">;
      labels: Labels;
      birth?: string | null;
      /** On a saved report: what its running period was worked out from. */
      saved?: SavedTimes;
    }
  | { kind: "match"; result: Porondam; labels: Labels };

/** A result the chat holds: its id, when it was handed over, and what it can draw. */
export type HeldVisuals<Words> = { id: string; at: Date; visuals: PageVisuals; words: Words };

/** The diagrams this result can draw, in the order the page would show them. */
export function offers(page: PageVisuals): VisualName[] {
  if (page.kind === "match") {
    const { match, bride, groom } = page.result;
    return match && bride && groom ? ["people", "ring", "checks"] : [];
  }
  const { chart, dasha, kuja } = page.result;
  if (!chart) return [];
  return ["pillars", "wheel", "houses", ...(dasha ? (["periods"] as const) : []), ...(kuja ? (["mars"] as const) : [])];
}

export type Shown = { shown: VisualName; page: string; houses: number[] };

/** A `show_visual` result, or null when Astro's call was refused. */
export function parseShown(result: string | undefined): Shown | null {
  const found = parseResult<{ shown?: unknown; page?: unknown; houses?: unknown }>(result);
  if (!found || typeof found.page !== "string") return null;
  const shown = VISUALS.find((name) => name === found.shown);
  if (!shown) return null;
  const houses = Array.isArray(found.houses) ? found.houses.filter((n): n is number => Number.isInteger(n)) : [];
  return { shown, page: found.page, houses };
}
