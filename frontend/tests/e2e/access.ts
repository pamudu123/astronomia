import type { Page } from "@playwright/test";

/** The paid check as a local backend answers it: paid reports switched off, so everything is open. */
export const OPEN_ACCESS = {
  paid: false,
  features: ["ai_reading", "ai_explain", "full_detail", "full_pdf", "wedding_dates", "personal_year"],
  paid_reports: false,
  account: null,
  price: { amount: 80_000, currency: "LKR" },
  checkout: null,
};

/**
 * Answers the paid check with OPEN_ACCESS for the whole browser context. A test about buying
 * answers it itself with page.route, which comes first.
 */
export async function openAccess(page: Page): Promise<void> {
  await page.context().route("**/api/v1/reports/access", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(OPEN_ACCESS) }),
  );
}
