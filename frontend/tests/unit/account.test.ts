import { describe, expect, it } from "vitest";

import { birthOf, matchOf } from "@/lib/account";
import en from "@/messages/en.json";
import si from "@/messages/si.json";

describe("a saved request back in the forms' shape", () => {
  it("drops empty fields and the language", () => {
    expect(
      birthOf({
        date: "1995-04-19",
        time: "14:35",
        place_id: 1241622,
        latitude: null,
        longitude: null,
        timezone: null,
        fold: null,
        lang: "si",
      } as Parameters<typeof birthOf>[0]),
    ).toEqual({ date: "1995-04-19", time: "14:35", place_id: 1241622 });
  });

  it("keeps a full person and a quick one apart", () => {
    const match = matchOf({
      bride: { name: "Nimali", date: "1995-04-19", time: "14:35", place_id: 1, latitude: null },
      groom: { name: "", nakshatra: "rohini", pada: 1 },
      lang: "en",
    } as Parameters<typeof matchOf>[0]);
    expect(match).toEqual({
      bride: { name: "Nimali", date: "1995-04-19", time: "14:35", place_id: 1 },
      groom: { name: "", nakshatra: "rohini", pada: 1 },
    });
  });
});

describe("My reports text", () => {
  it("has every line in both languages", () => {
    expect(Object.keys(si.saved).sort()).toEqual(Object.keys(en.saved).sort());
    expect(si.nav.myReports).toBeTruthy();
    expect(si.saved.savedOn).toContain("{date}");
  });
});
