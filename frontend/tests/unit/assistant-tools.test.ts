import { describe, expect, it } from "vitest";

import {
  ENGINE_TOOLS,
  isEngineTool,
  midday,
  minutes,
  parseResult,
  rahuOnDaylight,
  score,
  splitSpan,
  statusKey,
} from "@/lib/assistant/tools";
import en from "@/messages/en.json";
import si from "@/messages/si.json";

describe("status lines", () => {
  it("has working and done words for every tool, in both languages", () => {
    const keys = [...ENGINE_TOOLS, "task", "notes", "other"] as const;
    for (const messages of [en, si]) {
      for (const key of keys) {
        const [working, done] = messages.assistant.cards.status[key];
        expect(working, key).toBeTruthy();
        expect(done, key).toBeTruthy();
      }
    }
  });

  it("sorts tools into engine lookups, helpers, notes and the rest", () => {
    expect(isEngineTool("good_times_for_day")).toBe(true);
    expect(isEngineTool("read_file")).toBe(false);
    expect(statusKey("find_matching_stars")).toBe("find_matching_stars");
    expect(statusKey("task")).toBe("task");
    expect(statusKey("read_file")).toBe("notes");
    expect(statusKey("ls")).toBe("notes");
    expect(statusKey("write_todos")).toBe("other");
  });
});

describe("parseResult", () => {
  it("reads a tool's JSON result", () => {
    expect(parseResult<{ date: string }>('{"date":"2026-11-15"}')).toEqual({ date: "2026-11-15" });
  });

  it("gives null for a tool's error text, an empty result or a bare value", () => {
    expect(parseResult("Error: the engine is not reachable")).toBeNull();
    expect(parseResult(undefined)).toBeNull();
    expect(parseResult("42")).toBeNull();
  });
});

describe("the daylight bar", () => {
  const day = { sunrise: "06:00", sunset: "18:00", rahu_kalaya: "16:30 to 18:00" };

  it("reads clock times, and skips times on another day", () => {
    expect(minutes("06:02")).toBe(362);
    expect(minutes("02:02 on 2026-11-16")).toBeNull();
    expect(splitSpan("16:28 to 17:58")).toEqual(["16:28", "17:58"]);
  });

  it("places Rahu kalaya between sunrise and sunset", () => {
    expect(rahuOnDaylight(day)).toEqual({ left: 87.5, width: 12.5 });
    expect(midday(day.sunrise, day.sunset)).toBe("12:00");
  });

  it("draws no segment when a time is missing or on another day", () => {
    expect(rahuOnDaylight({ ...day, rahu_kalaya: null })).toBeNull();
    expect(rahuOnDaylight({ ...day, rahu_kalaya: "23:30 to 01:00 on 2026-11-16" })).toBeNull();
  });
});

describe("score", () => {
  it("reads the factors that agree", () => {
    expect(score("17 of 20")).toEqual({ agree: 17, total: 20 });
    expect(score("seventeen")).toBeNull();
    expect(score("0 of 0")).toBeNull();
  });
});
