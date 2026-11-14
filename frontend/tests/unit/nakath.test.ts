import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import sitemap from "@/app/sitemap";
import {
  AVURUDU_YEARS,
  CITIES,
  FEATURED_YEAR,
  avuruduPath,
  hasAvuruduYear,
  isIsoDate,
  isMonth,
  monthPath,
  panchangaPath,
  shiftMonth,
  todayIn,
} from "@/lib/nakath";
import en from "@/messages/en.json";
import si from "@/messages/si.json";

const fixture = <T,>(name: string) =>
  JSON.parse(readFileSync(join(__dirname, "..", "e2e", "fixtures", name), "utf-8")) as T;

describe("Avurudu years and cities", () => {
  it("has an official list for every year up to the featured one", () => {
    expect(fixture<{ official: boolean }>(`avurudu-${FEATURED_YEAR}-colombo-en.json`).official).toBe(true);
    expect(fixture<{ official: boolean }>("avurudu-2028-colombo-en.json").official).toBe(false);
    expect(hasAvuruduYear("2027")).toBe(true);
    expect(hasAvuruduYear("1999")).toBe(false);
    expect(hasAvuruduYear("2027.5")).toBe(false);
    expect(AVURUDU_YEARS).toContain(FEATURED_YEAR);
  });

  it("gives every city a real time zone and a unique key", () => {
    for (const city of CITIES) {
      expect(() => new Intl.DateTimeFormat("en", { timeZone: city.timezone })).not.toThrow();
    }
    expect(new Set(CITIES.map((city) => city.key)).size).toBe(CITIES.length);
  });
});

describe("paths", () => {
  it("keeps only a time zone or a place in the address", () => {
    expect(avuruduPath(2027, "Europe/London", "si")).toBe("/v1/avurudu/2027?timezone=Europe%2FLondon&lang=si");
    expect(panchangaPath("2027-04-14", { placeId: 1248991 }, "en")).toBe(
      "/v1/panchanga?date=2027-04-14&place_id=1248991&lang=en",
    );
    expect(
      panchangaPath("2027-04-14", { latitude: 51.5, longitude: -0.12, timezone: "Europe/London" }, "en"),
    ).toBe("/v1/panchanga?date=2027-04-14&latitude=51.5&longitude=-0.12&timezone=Europe%2FLondon&lang=en");
  });
});

describe("dates", () => {
  it("knows today in Sri Lanka, which can be a day ahead of London", () => {
    const late = new Date("2027-04-13T20:00:00Z");
    expect(todayIn("Asia/Colombo", late)).toBe("2027-04-14");
    expect(todayIn("Europe/London", late)).toBe("2027-04-13");
  });

  it("accepts only real dates", () => {
    expect(isIsoDate("2027-04-14")).toBe(true);
    expect(isIsoDate("2027-13-40")).toBe(false);
    expect(isIsoDate("14-04-2027")).toBe(false);
  });
});

describe("text", () => {
  const keys = (value: object): string[] =>
    Object.entries(value).flatMap(([key, inner]) =>
      typeof inner === "object" && !Array.isArray(inner) ? keys(inner).map((k) => `${key}.${k}`) : [key],
    );

  it.each(["avurudu", "nakath"] as const)("has the same %s keys in both languages", (section) => {
    expect(keys(si[section])).toEqual(keys(en[section]));
  });
});

describe("sitemap", () => {
  it("lists the Avurudu and daily nakath pages", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toContain("http://localhost:3000/en/avurudu");
    expect(urls).toContain("http://localhost:3000/si/avurudu/2027/london");
    expect(urls).toContain("http://localhost:3000/en/nakath");
    expect(urls.filter((url) => /\/avurudu\/\d{4}$/.test(url))).toHaveLength(AVURUDU_YEARS.length * 2);
  });
});

describe("litha months", () => {
  it("reads only real YYYY-MM months", () => {
    expect(isMonth("2026-11")).toBe(true);
    expect(isMonth("2026-13")).toBe(false);
    expect(isMonth("2026-1")).toBe(false);
  });

  it("steps across year ends", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2027-01", -1)).toBe("2026-12");
    expect(shiftMonth("2026-11", 0)).toBe("2026-11");
  });

  it("asks for a month by place, never by birth details", () => {
    expect(monthPath(2026, 12, 1248991, "si")).toBe(
      "/v1/panchanga/month?year=2026&month=12&place_id=1248991&lang=si",
    );
  });

  it("lists the litha and All tools pages in the sitemap", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls.some((url) => url.endsWith("/en/litha"))).toBe(true);
    expect(urls.some((url) => url.endsWith("/si/tools"))).toBe(true);
  });
});
