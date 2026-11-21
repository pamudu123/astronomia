import { describe, expect, it, vi } from "vitest";

import { type Access, canUse, isReportChapter } from "@/lib/entitlements";
import { cleanCode, formatPrice } from "@/lib/paid";
import { paidCheck } from "@/lib/paidCheck";
import en from "@/messages/en.json";
import si from "@/messages/si.json";

vi.mock("server-only", () => ({}));

const PAID: Access = {
  paid: true,
  features: ["ai_reading", "ai_explain", "full_detail", "full_pdf"],
  paid_reports: true,
  account: "google",
  price: { amount: 80_000, currency: "LKR" },
};
const FREE: Access = { ...PAID, paid: false, features: [], account: null };

describe("canUse", () => {
  it("leaves pages without a report free", () => {
    expect(canUse("ai_explain")).toBe(true);
    expect(canUse("ai_explain", { state: "none" })).toBe(true);
  });

  it("waits for the backend on a report", () => {
    expect(canUse("ai_reading", { state: "loading" })).toBe(false);
  });

  it("follows the backend's answer for the report", () => {
    expect(canUse("ai_reading", { state: "ready", access: PAID })).toBe(true);
    expect(canUse("full_detail", { state: "ready", access: PAID })).toBe(true);
    expect(canUse("ai_reading", { state: "ready", access: FREE })).toBe(false);
    expect(canUse("full_pdf", { state: "ready", access: FREE })).toBe(false);
  });

  it("knows which AI chapters belong to a report", () => {
    expect(isReportChapter("chart.nature")).toBe(true);
    expect(isReportChapter("match.summary")).toBe(true);
    expect(isReportChapter("nakath.day")).toBe(false);
    expect(isReportChapter("kendara.dates")).toBe(false);
  });
});

describe("prices", () => {
  it("shows whole rupees and dollars with cents", () => {
    expect(formatPrice({ amount: 80_000, currency: "LKR" }, "en")).toBe("LKR 800");
    expect(formatPrice({ amount: 64_000, currency: "LKR" }, "si")).toBe("LKR 640");
    expect(formatPrice({ amount: 250, currency: "USD" }, "en")).toBe("USD 2.50");
    expect(formatPrice({ amount: 0, currency: "USD" }, "en")).toBe("USD 0");
  });

  it("only trims a typed code", () => {
    expect(cleanCode("  Pam udu ")).toBe("Pam udu");
    expect(cleanCode("x".repeat(300))).toHaveLength(100);
  });
});

describe("the AI route's paid check", () => {
  // As the route sees it after the site's /api forward: the page's token as a bearer token.
  const request = new Request("http://site/api/explain", { headers: { authorization: "Bearer a.b.c" } });
  const report = { kind: "hadahan", name: "Nimali", birth: { date: "1995-04-19" } };

  function answering(status: number, body: unknown) {
    return vi.fn(async () => new Response(JSON.stringify(body), { status }));
  }

  it("lets the other pages' chapters through without asking", async () => {
    const send = answering(200, {});
    expect(await paidCheck(request, "nakath.day", undefined, send)).toBe("allowed");
    expect(send).not.toHaveBeenCalled();
  });

  it("asks the backend about the report, as this browser", async () => {
    const send = answering(200, PAID);
    expect(await paidCheck(request, "chart.nature", report, send)).toBe("allowed");
    const [url, init] = send.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/v1\/reports\/access$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual(report);
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer a.b.c");
  });

  it("never passes on a staging password", async () => {
    const staging = new Request("http://site/api/explain", { headers: { authorization: "Basic eDpw" } });
    const send = answering(200, PAID);
    await paidCheck(staging, "chart.nature", report, send);
    const [, init] = send.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it("locks a report that was not paid for", async () => {
    expect(await paidCheck(request, "match.people", report, answering(200, FREE))).toBe("locked");
    expect(await paidCheck(request, "chart.nature", report, answering(422, {}))).toBe("invalid");
    expect(await paidCheck(request, "chart.nature", report, answering(500, {}))).toBe("unavailable");
    const failing = vi.fn(async () => {
      throw new Error("down");
    });
    expect(await paidCheck(request, "chart.nature", report, failing)).toBe("unavailable");
  });

  it("lets a shared page through only while paid reports are off", async () => {
    const off = answering(200, { paid_reports: false });
    expect(await paidCheck(request, "match.summary", undefined, off)).toBe("allowed");
    expect((off.mock.calls[0] as unknown as [string])[0]).toMatch(/\/v1\/price\?kind=porondam$/);
    const on = answering(200, { paid_reports: true });
    expect(await paidCheck(request, "chart.summary", undefined, on)).toBe("locked");
  });
});

describe("Get the full report text", () => {
  function keys(value: unknown, prefix = ""): string[] {
    if (Array.isArray(value)) return [`${prefix}[${value.length}]`];
    if (value && typeof value === "object") {
      return Object.entries(value).flatMap(([key, inner]) => keys(inner, `${prefix}.${key}`));
    }
    return [prefix];
  }

  it("has every line in both languages", () => {
    expect(keys(si.paid).sort()).toEqual(keys(en.paid).sort());
    expect(Object.keys(en.paid.problems)).toEqual(
      expect.arrayContaining(["unknown", "ended", "wrong_report", "used_up", "account_limit", "payment_not_available"]),
    );
  });

  it("names no plans or passes, only the report", () => {
    expect(en.assistant.explain.locked).toBe("Part of the full report");
    expect(JSON.stringify(en.paid)).not.toMatch(/plan|pass|subscri/i);
  });
});
