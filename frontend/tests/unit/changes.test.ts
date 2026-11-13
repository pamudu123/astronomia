import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import sitemap from "@/app/sitemap";
import { CHANGES, FEATURED, PUBLISHED, findChange, houseFrom } from "@/lib/changes";
import { changeTitle } from "@/components/changes/text";
import { RASHI } from "@/lib/rashi";
import en from "@/messages/en.json";
import si from "@/messages/si.json";

const fixture = <T,>(name: string) =>
  JSON.parse(readFileSync(join(__dirname, "..", "e2e", "fixtures", name), "utf-8")) as T;

type Move = {
  body: string;
  from_sign: string;
  to_sign: string;
  retrograde: boolean;
  returning: boolean;
  until: string;
  next_sign: string;
};
type Change = { id: string; kind: string; moment: string; moves: Move[] };
type Hub = { lagnas: { sign: string; moves: { body: string; from_house: number; to_house: number }[] }[] };
type Labels = { planet: Record<string, { name: string; short: string }>; house: string[] };

/** A UTC time as a Sri Lanka date and time (UTC+05:30). */
const sriLanka = (iso: string) => new Date(new Date(iso).getTime() + 330 * 60_000).toISOString().slice(0, 16);

describe("CHANGES", () => {
  it("is the backend's list (GET /v1/changes)", () => {
    const backend = fixture<{ changes: Change[] }>("changes-en.json").changes;
    expect(
      CHANGES.map(({ id, kind, moment, local, moves }) => ({ id, kind, moment, local, moves })),
    ).toEqual(
      backend.map((change) => ({
        id: change.id,
        kind: change.kind,
        moment: change.moment,
        local: sriLanka(change.moment),
        moves: change.moves.map((move) => ({
          body: move.body,
          from: move.from_sign,
          to: move.to_sign,
          retrograde: move.retrograde,
          returning: move.returning,
          until: sriLanka(move.until).slice(0, 10),
          next: move.next_sign,
        })),
      })),
    );
  });

  it("publishes every change on the list", () => {
    expect(PUBLISHED).toHaveLength(6);
    expect(findChange(FEATURED)?.local).toBe("2026-12-05T22:32");
    expect(findChange("saturn-2027-06")?.local).toBe("2027-06-03T05:28");
    expect(findChange("saturn-2099-01")).toBeUndefined();
  });
});

describe("houseFrom", () => {
  it("agrees with the backend for every lagna", () => {
    const hub = fixture<Hub>("changes-rahu-ketu-2026-12-en.json");
    const change = CHANGES[0];
    for (const row of hub.lagnas) {
      expect(change.moves.map((move) => [houseFrom(move.from, row.sign), houseFrom(move.to, row.sign)])).toEqual(
        row.moves.map((move) => [move.from_house, move.to_house]),
      );
    }
  });

  it("counts the lagna's own sign as the 1st house", () => {
    for (const rashi of RASHI) expect(houseFrom(rashi.key, rashi.key)).toBe(1);
    expect(houseFrom("mesha", "meena")).toBe(2);
  });
});

describe("planet and house names", () => {
  it.each([
    ["en", en],
    ["si", si],
  ] as const)("match the backend labels (%s)", (lang, messages) => {
    const labels = fixture<Labels>(`labels-${lang}.json`);
    expect(messages.changes.house).toEqual(labels.house);
    for (const [body, name] of Object.entries(messages.changes.planet)) {
      expect(name).toEqual(labels.planet[body]);
    }
  });

  it("has the same text keys in both languages", () => {
    const keys = (value: object): string[] =>
      Object.entries(value).flatMap(([key, inner]) =>
        typeof inner === "object" && !Array.isArray(inner) ? keys(inner).map((k) => `${key}.${k}`) : [key],
      );
    expect(keys(si.changes)).toEqual(keys(en.changes));
  });
});

describe("sitemap", () => {
  it("lists the change pages in both languages", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toContain("http://localhost:3000/en/changes");
    expect(urls).toContain("http://localhost:3000/si/changes/rahu-ketu-2026-12");
    expect(urls).toContain("http://localhost:3000/en/changes/rahu-ketu-2026-12/makara");
    expect(urls.filter((url) => url.includes("/changes/rahu-ketu-2026-12/"))).toHaveLength(24);
    expect(urls).toContain("http://localhost:3000/si/changes/saturn-2027-06/vrishabha");
    expect(urls.filter((url) => /\/changes\/[a-z-]+-\d{4}-\d{2}\/[a-z]+$/.test(url))).toHaveLength(6 * 12 * 2);
  });
});

describe("changeTitle", () => {
  const find = (id: string) => CHANGES.find((change) => change.id === id)!;

  it("names a single planet change by the sign it enters", () => {
    expect(changeTitle(en.changes, find("rahu-ketu-2026-12"), "en")).toBe("Rahu and Ketu change 2026");
    expect(changeTitle(en.changes, find("jupiter-2027-01"), "en")).toBe("Jupiter change 2027 back into Kataka");
    expect(changeTitle(en.changes, find("jupiter-2027-06"), "en")).toBe("Jupiter change 2027 back into Simha");
    expect(changeTitle(en.changes, find("jupiter-2027-11"), "en")).toBe("Jupiter change 2027 into Kanya");
    expect(changeTitle(si.changes, find("saturn-2027-06"), "si")).toBe("2027 ශනි මාරුව: මේෂ රාශියට");
  });

  it("gives every change its own title", () => {
    const titles = CHANGES.map((change) => changeTitle(en.changes, change, "en"));
    expect(new Set(titles).size).toBe(CHANGES.length);
  });
});
