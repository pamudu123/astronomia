/**
 * What a visitor may use. The one website place for that check (docs/17, section 6).
 *
 * Everyone gets everything for now. Once payments exist (docs/15), this reads the account's
 * plan, and the agent checks the same thing on its side (backend/app/tiers), so a feature
 * can't be reached for free by calling the API directly.
 */

export type Feature =
  /** The full reading in chapters at the top of a chart or match result. */
  | "ai_reading"
  /** The explain buttons on the main places of a page. */
  | "ai_explain";

export function canUse(feature: Feature): boolean {
  void feature;
  return true;
}
