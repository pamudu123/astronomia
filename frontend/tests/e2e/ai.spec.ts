import { readFileSync } from "node:fs";
import { join } from "node:path";

import { type Page, expect, test } from "@playwright/test";

/**
 * The AI explanations (docs/17) with the AI switched on: this file runs against its own build
 * (scripts/e2e-ai-server.mjs). The backend and the agent are not running: the backend's answers
 * are saved real responses, and the tests write each chapter themselves.
 */
const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf-8");

/** A chapter's text the way the agent streams it: an answer, a bold lead, a short part. */
const chapter = (id: string) => `Text of ${id}.\n\n**A bold lead**\nA short part of ${id}.`;

type Calls = string[];

async function mockAll(page: Page, fail: Set<string> = new Set()): Promise<Calls> {
  await page.route("**/api/v1/labels/*", (route) =>
    route.fulfill({ contentType: "application/json", body: fixture("labels-en.json") }),
  );
  await page.route("**/api/v1/porondam", (route) =>
    route.fulfill({ contentType: "application/json", body: fixture("porondam-quick-en.json") }),
  );
  await page.route("**/api/v1/porondam/timeline", (route) =>
    route.fulfill({ contentType: "application/json", body: fixture("timeline-quick-en.json") }),
  );
  // The chat panel talks to its own route; nothing to answer in these tests.
  await page.route("**/api/copilotkit**", (route) => route.fulfill({ status: 404, body: "" }));
  const calls: Calls = [];
  await page.route("**/api/explain", (route) => {
    const { id } = JSON.parse(route.request().postData() ?? "{}") as { id: string };
    calls.push(id);
    if (fail.has(id)) {
      fail.delete(id); // fails once, then works
      return route.fulfill({ status: 502, body: "down" });
    }
    return route.fulfill({ contentType: "text/plain; charset=utf-8", body: chapter(id) });
  });
  return calls;
}

async function quickMatch(page: Page) {
  await page.goto("/en/porondam");
  await page.getByRole("button", { name: "Birth stars only" }).click();
  const bride = page.getByRole("group", { name: "Bride" });
  await bride.getByLabel("Birth star (nakath)").selectOption("anuradha");
  await bride.getByLabel("Pada").selectOption("2");
  await page.getByRole("group", { name: "Groom" }).getByLabel("Birth star (nakath)").selectOption("rohini");
  await page.getByRole("button", { name: "Match the charts" }).click();
}

test("the full match reading writes its first chapters and opens the rest one by one", async ({ page }) => {
  const calls = await mockAll(page);
  await quickMatch(page);

  const card = page.locator('[data-card="full-reading"]');
  await expect(card.getByRole("heading", { name: "Full match reading" })).toBeVisible();
  await card.getByRole("button", { name: "Get the full reading" }).click();

  // The first two chapters open and are written straight away.
  await expect(card.locator('[data-chapter="match.people"]')).toContainText("Text of match.people.");
  await expect(card.locator('[data-chapter="match.factors"]')).toContainText("A bold lead");
  expect(calls.sort()).toEqual(["match.factors", "match.people"]);
  await expect(card).toContainText("AI reading · for guidance only");

  // Another chapter is written when it is opened.
  await card.getByRole("heading", { name: "Summing up" }).getByRole("button").click();
  await expect(card.locator('[data-chapter="match.summary"]')).toContainText("Text of match.summary.");
  expect(calls).toHaveLength(3);
});

test("an explain button reuses the reading's chapters and hides without losing them", async ({ page }) => {
  const calls = await mockAll(page);
  await quickMatch(page);

  const checks = page.locator('[data-explain="match.checks match.mars"]');
  await checks.getByRole("button", { name: "Explain this" }).click();
  await expect(checks.locator('[data-chapter="match.checks"]')).toContainText("Text of match.checks.");
  await expect(checks.locator('[data-chapter="match.mars"]')).toContainText("Text of match.mars.");
  expect(calls.sort()).toEqual(["match.checks", "match.mars"]);

  // Hide and open again: the same text, no new request.
  await checks.getByRole("button", { name: "Hide" }).click();
  await expect(checks.locator("[data-chapter]")).toHaveCount(0);
  await checks.getByRole("button", { name: "Explain this" }).click();
  await expect(checks.locator('[data-chapter="match.checks"]')).toContainText("Text of match.checks.");
  expect(calls).toHaveLength(2);

  // The full reading shows the same chapter without asking again.
  const card = page.locator('[data-card="full-reading"]');
  await card.getByRole("button", { name: "Get the full reading" }).click();
  // The chapter row's own button; "Next: The serious checks" under the open chapter before it matches too.
  await card.getByRole("heading", { name: "The serious checks" }).getByRole("button").click();
  await expect(card.locator('[data-chapter="match.checks"]')).toContainText("Text of match.checks.");
  expect(calls.filter((id) => id === "match.checks")).toHaveLength(1);
});

test("a chapter that can't be written offers to try again", async ({ page }) => {
  await mockAll(page, new Set(["match.summary"]));
  await quickMatch(page);

  const result = page.locator('[data-explain="match.summary"]');
  await result.getByRole("button", { name: "Explain this" }).click();
  await expect(result).toContainText("This couldn't be written just now.");
  await result.getByRole("button", { name: "Try again" }).click();
  await expect(result.locator('[data-chapter="match.summary"]')).toContainText("Text of match.summary.");
});
