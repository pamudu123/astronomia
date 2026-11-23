import { describe, expect, it } from "vitest";

import { canonicalTimezone, fieldProblems, latestBirth, toRequest } from "@/components/hadahan/BirthForm";
import { distinctLabels } from "@/components/hadahan/PlaceSearch";
import { EMPTY_FORM, type FormValues, type Place, type SavedResult, formFor } from "@/lib/hadahan";

const colombo = { id: 1248991, name: "Colombo", timezone: "Asia/Colombo" } as Place;
const filled: FormValues = { ...EMPTY_FORM, name: "QA", date: "1990-01-15", time: "23:59", place: colombo };
const saved = (request: SavedResult["request"], form?: FormValues): SavedResult => ({
  name: "QA",
  placeLabel: "Colombo",
  request,
  result: {} as SavedResult["result"],
  form,
});

describe("Edit details brings back what was submitted (QA AST-01)", () => {
  it("returns the form as submitted, with the clock-change choice", () => {
    const values = formFor(saved({ date: "2021-10-31", time: "01:30", place_id: 1, fold: 0 }, filled));
    expect(values).toEqual({ ...filled, fold: 0 });
  });

  it("rebuilds coordinates for a result saved before the form was kept", () => {
    const values = formFor(
      saved({ date: "1990-01-15", time: "23:59", latitude: 6.9271, longitude: 79.8612, timezone: "Asia/Colombo" }),
    );
    expect(values).toMatchObject({
      name: "QA",
      date: "1990-01-15",
      time: "23:59",
      manual: true,
      latitude: "6.9271",
      longitude: "79.8612",
      timezone: "Asia/Colombo",
    });
  });
});

describe("toRequest", () => {
  it("sends the chosen clock-change answer only when there is one", () => {
    expect(toRequest(filled)).toEqual({ date: "1990-01-15", time: "23:59", place_id: 1248991 });
    expect(toRequest({ ...filled, fold: 1 })).toEqual({ date: "1990-01-15", time: "23:59", place_id: 1248991, fold: 1 });
  });
});

describe("coordinates and time zone are checked beside each field (QA AST-06)", () => {
  const manual = (latitude: string, longitude: string, timezone: string): FormValues => ({
    ...filled,
    place: null,
    manual: true,
    latitude,
    longitude,
    timezone,
  });

  it("names each bad field from the QA report", () => {
    expect(fieldProblems(manual("91", "79.8612", "Asia/Colombo"))).toEqual(["latitude"]);
    expect(fieldProblems(manual("6.9271", "181", "Asia/Colombo"))).toEqual(["longitude"]);
    expect(fieldProblems(manual("91", "181", "Asia/Colombo"))).toEqual(["latitude", "longitude"]);
    expect(fieldProblems(manual("6.9271", "79.8612", "Mars/Olympus"))).toEqual(["timezone"]);
    expect(fieldProblems(manual("abc", "79.8612", "Asia/Colombo"))).toEqual(["latitude"]);
  });

  it("accepts good values and leaves empty fields to the missing-details message", () => {
    expect(fieldProblems(manual("6.9271", "79.8612", "Asia/Colombo"))).toEqual([]);
    expect(fieldProblems(manual("-90", "180", "UTC"))).toEqual([]);
    expect(fieldProblems(manual("", "", ""))).toEqual([]);
    expect(fieldProblems({ ...filled, latitude: "91" })).toEqual([]); // not in coordinate mode
  });

  it("sends the standard spelling of a time zone", () => {
    expect(canonicalTimezone(" asia/colombo ")).toBe("Asia/Colombo");
    expect(canonicalTimezone("Mars/Olympus")).toBeNull();
    expect(toRequest(manual("6.9271", "79.8612", "asia/colombo"))).toMatchObject({ timezone: "Asia/Colombo" });
    expect(toRequest(manual("91", "79.8612", "Asia/Colombo"))).toBeNull();
  });
});

describe("places with the same name can be told apart (QA AST-07)", () => {
  const place = (id: number, region: string | null, timezone: string, latitude = 0) =>
    ({ id, name: "London", name_si: null, region, region_si: null, country_name: "United States", country_name_si: null, timezone, latitude, longitude: 0 }) as unknown as Place;

  it("adds the time zone, then coordinates, only where labels repeat", () => {
    const labels = distinctLabels(
      [place(1, "Ohio", "America/New_York"), place(2, null, "America/New_York", 1), place(3, null, "America/New_York", 2), place(4, null, "America/Chicago")],
      "en",
    );
    expect(labels).toEqual([
      "London, Ohio, United States",
      "London, United States · America/New_York · 1.00, 0.00",
      "London, United States · America/New_York · 2.00, 0.00",
      "London, United States · America/Chicago",
    ]);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("a birth is today or earlier", () => {
  const now = new Date("2026-11-23T20:00:00Z"); // already the 24th in Colombo
  it("counts today where the birth was", () => {
    expect(latestBirth(filled, now)).toBe("2026-11-24");
    expect(latestBirth({ ...filled, place: null, manual: true, timezone: "America/New_York" }, now)).toBe("2026-11-23");
    expect(fieldProblems({ ...filled, date: "2026-11-24" }, now)).toEqual([]);
    expect(fieldProblems({ ...filled, date: "2026-11-25" }, now)).toEqual(["date"]);
    expect(fieldProblems({ ...filled, date: "12026-01-01" }, now)).toEqual(["date"]);
  });
  it("copes with a place whose zone the browser does not know", () => {
    expect(() => latestBirth({ ...filled, place: { ...colombo, timezone: "Mars/Olympus" } }, now)).not.toThrow();
  });
});
