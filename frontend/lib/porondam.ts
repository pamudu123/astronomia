import type { components } from "./api-types";
import type { BirthRequest } from "./hadahan";
import type { Locale } from "./i18n";

export type Porondam = components["schemas"]["PorondamResponse"];
export type Match = NonNullable<Porondam["match"]>;
export type Factor = Match["factors"][number];
export type Person = NonNullable<Porondam["bride"]>;

export type QuickInput = { name: string; nakshatra: string; pada: number };
export type FullInput = BirthRequest & { name: string };
export type PersonInput = QuickInput | FullInput;

export type PorondamRequest = { bride: PersonInput; groom: PersonInput };

export type SavedMatch = { request: PorondamRequest; result: Porondam };

export const PORONDAM_KEY = "astronomia.porondam";

/** Birth details go in the body of a POST, never in the URL. */
export async function fetchPorondam(request: PorondamRequest, lang: Locale): Promise<Porondam> {
  const response = await fetch("/api/v1/porondam", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...request, lang }),
  });
  if (!response.ok) {
    const error = new Error(`request failed: ${response.status}`) as Error & { status: number };
    error.status = response.status;
    throw error;
  }
  return (await response.json()) as Porondam;
}

export type FactorFilter = "all" | "agree" | "disagree";

/** A factor that was not counted (it needs the birth dates) shows only under "all". */
export function filterFactors(factors: Factor[], filter: FactorFilter): Factor[] {
  if (filter === "agree") return factors.filter((f) => f.checked && f.passed);
  if (filter === "disagree") return factors.filter((f) => f.checked && !f.passed);
  return factors;
}

/** Stroke offset for a ring of the given circumference showing passed out of total. */
export function ringOffset(passed: number, total: number, circumference: number): number {
  if (total <= 0) return circumference;
  return circumference * (1 - Math.min(Math.max(passed / total, 0), 1));
}
