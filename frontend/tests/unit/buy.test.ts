import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { problemOf, reportName } from "@/components/paid/BuyApp";
import { type Basket, backOf, keepBasket, loadBasket, paymentInAddress, startPayment } from "@/lib/buy";
import type { ReportRequest } from "@/lib/report";
import { RequestError } from "@/lib/request";
import en from "@/messages/en.json";

const token = vi.hoisted(() => ({ value: null as string | null, guests: 0 }));
vi.mock("@/lib/supabase", async (original) => ({
  ...(await original<typeof import("@/lib/supabase")>()),
  accessToken: async () => token.value,
  signedInToken: async () => {
    if (!token.value) {
      token.guests += 1;
      token.value = "guest.token.x";
    }
    return token.value;
  },
}));

const birth = { date: "1995-04-19", time: "14:35", place_id: 1241622, lang: "en" as const };
const chart = { kind: "hadahan", name: "Nimali", birth } as ReportRequest;
const basket: Basket = { report: chart, kuja: true, back: "/en/hadahan" };

let store: Record<string, string>;
beforeEach(() => {
  store = {};
  token.value = null;
  token.guests = 0;
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => void (store[key] = value),
    removeItem: (key: string) => void delete store[key],
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("the report being bought", () => {
  it("travels in this tab only", () => {
    expect(loadBasket()).toBeNull();
    keepBasket(basket);
    expect(loadBasket()).toEqual(basket);
  });

  it("is nothing when what is kept is not a report", () => {
    for (const bad of ["{", "null", "{}", JSON.stringify({ report: { kind: "nakath" } })]) {
      store["sidera.buy"] = bad;
      expect(loadBasket()).toBeNull();
    }
  });

  it("goes back only to a page of this site", () => {
    expect(backOf(basket, "en")).toBe("/en/hadahan");
    expect(backOf({ ...basket, back: "https://evil.example" }, "en")).toBe("/en/my");
    expect(backOf({ ...basket, back: "//evil.example" }, "en")).toBe("/en/my");
    expect(backOf({ ...basket, back: "" }, "si")).toBe("/si/hadahan");
  });

  it("is named after the people in it", () => {
    expect(reportName(chart, en.buy)).toBe("Full hadahan report for Nimali");
    expect(reportName({ ...chart, name: "" } as ReportRequest, en.buy)).toBe("Full hadahan report");
    const match = (bride: string, groom: string) =>
      ({ kind: "porondam", match: { bride: { name: bride }, groom: { name: groom } } }) as unknown as ReportRequest;
    expect(reportName(match("Nimali", "Kasun"), en.buy)).toBe("Full porondam report for Nimali and Kasun");
    expect(reportName(match("Nimali", ""), en.buy)).toBe("Full porondam report");
  });
});

describe("a payment", () => {
  it("is named in the address by an id and nothing else", () => {
    const id = "3f1c9a52-7d4e-4b0a-9c55-0e6f2b1a8d10";
    expect(paymentInAddress(`?payment=${id}`)).toBe(id);
    for (const bad of ["", "?payment=", "?payment=../me", "?payment=1"]) expect(paymentInAddress(bad)).toBeNull();
  });

  it("is started as a guest, with no amount from the page", async () => {
    const send = vi.fn(async () => new Response(JSON.stringify({ id: "p1" }), { status: 201 }));
    vi.stubGlobal("fetch", send);
    await startPayment(chart, "SIDERA20");
    await startPayment(chart, null);
    expect(token.guests).toBe(1);
    const [url, init] = send.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/v1/checkout");
    expect((init.headers as Record<string, string>)["X-Sidera-Token"]).toBe("guest.token.x");
    expect(JSON.parse(String(init.body))).toEqual({ report: chart, code: "SIDERA20" });
  });
});

describe("what went wrong", () => {
  it("is said in words for each refusal", () => {
    for (const reason of ["unknown", "ended", "wrong_report", "used_up", "account_limit"]) {
      expect(problemOf(new RequestError(409, reason))).toBe(reason);
    }
    expect(problemOf(new RequestError(402, "payment_needed"))).toBe("payment_not_available");
    expect(problemOf(new RequestError(429, "too many wrong codes: try again in an hour"))).toBe("tooMany");
    expect(problemOf(new RequestError(429, "too many payments"))).toBe("busy");
    expect(problemOf(new RequestError(409, "already_paid"))).toBe("failed");
    expect(problemOf(new Error("offline"))).toBe("failed");
  });
});

describe("coupon codes", () => {
  it("are nowhere in the website's code or words", () => {
    // Only whole words: "pamudu" is also part of the owner's GitHub name, which may be linked.
    const root = join(__dirname, "../..");
    const found: string[] = [];
    const look = (folder: string) => {
      for (const entry of readdirSync(join(root, folder), { withFileTypes: true })) {
        const path = `${folder}/${entry.name}`;
        if (entry.isDirectory()) look(path);
        else if (/\.(tsx?|mjs|json|css)$/.test(entry.name) && /\bpamudu\b/i.test(readFileSync(join(root, path), "utf-8")))
          found.push(path);
      }
    };
    ["app", "components", "lib", "messages"].forEach(look);
    expect(found).toEqual([]);
  });
});
