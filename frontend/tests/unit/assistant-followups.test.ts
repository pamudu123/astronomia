import { describe, expect, it } from "vitest";

import type { PageContext } from "@/lib/assistant/context";
import { type Chip, answerable, pickFollowUps } from "@/lib/assistant/followups";

const chip = (text: string, isLoading = false): Chip => ({ title: text, message: text, isLoading });

const home: PageContext = { page: "home", language: "en" };
const match: PageContext = { page: "match_result", language: "en", result: { score: { agree: 16, counted: 20 } } };
const nakath: PageContext = { page: "good_times_day", language: "en", result: { date: "2026-11-15" } };

describe("answerable", () => {
  it("keeps questions the page, a tool or a note can answer in full", () => {
    expect(answerable(chip("When is Rahu kalaya tomorrow?"), nakath)).toBe(true);
    expect(answerable(chip("What is a thithi?"), home)).toBe(true);
    expect(answerable(chip("Why doesn't Gana agree in our match?"), match)).toBe(true);
    expect(answerable(chip("අද රාහු කාලය කීයටද?"), home)).toBe(true);
  });

  it("drops a question about their own chart or match when none is on the page", () => {
    expect(answerable(chip("What is my rising sign?"), home)).toBe(false);
    expect(answerable(chip("Explain our match score"), nakath)).toBe(false);
    expect(answerable(chip("මගේ ලග්නය කුමක්ද?"), home)).toBe(false);
    // With the match on screen, the same kind of question is fine.
    expect(answerable(chip("Explain our match score"), match)).toBe(true);
  });

  it("drops what the site never answers", () => {
    for (const text of [
      "Should we marry?",
      "Will we be happy together?",
      "Which remedy fixes Kuja dosha?",
      "Is this a good day to invest money?",
      "Can astrology help my health?",
      "මගේ අනාගතය කොහොමද?",
    ]) {
      expect(answerable(chip(text), match), text).toBe(false);
    }
  });

  it("drops chips spoken to the person, empty ones and long ones", () => {
    expect(answerable(chip("Would you like the poya dates?"), home)).toBe(false);
    expect(answerable(chip("ඔබේ ලග්නය දැනගන්න කැමතිද?"), home)).toBe(false);
    expect(answerable(chip("   "), home)).toBe(false);
    expect(answerable(chip(`What is ${"a very long question ".repeat(6)}?`), home)).toBe(false);
  });

  it("waits for a chip that is still streaming in", () => {
    expect(answerable(chip("", true), home)).toBe(true);
    expect(answerable(chip("What is my lagna", true), home)).toBe(false);
  });
});

describe("pickFollowUps", () => {
  it("shows none when nothing can be answered in full", () => {
    const picked = pickFollowUps([chip("What is my rising sign?"), chip("Should we marry?")], home);
    expect(picked).toEqual({ chips: [], original: [], loading: [] });
    expect(pickFollowUps([], home).chips).toEqual([]);
  });

  it("shows one when only one is answerable", () => {
    const picked = pickFollowUps([chip("What is my dasha?"), chip("What is a nakatha?")], home);
    expect(picked.chips.map((c) => c.message)).toEqual(["What is a nakatha?"]);
    expect(picked.original).toEqual([1]);
  });

  it("shows however many are answerable, with no fixed count", () => {
    const three = [chip("What is a thithi?"), chip("When is the next poya?"), chip("What is Rahu kalaya?")];
    expect(pickFollowUps(three, home).chips).toHaveLength(3);
    expect(pickFollowUps(three.slice(0, 2), home).chips).toHaveLength(2);
  });

  it("keeps each chip's original place, and renumbers the loading ones", () => {
    const chips = [chip("Will we be rich?"), chip("What is a yoga?"), chip("", true)];
    const picked = pickFollowUps(chips, home, [2]);
    expect(picked.original).toEqual([1, 2]);
    expect(picked.loading).toEqual([1]);
  });

  it("never drops the site's own page questions", () => {
    const fixed = new Set(["What does my chart say about me?"]);
    const picked = pickFollowUps([chip("What does my chart say about me?")], home, [], fixed);
    expect(picked.chips).toHaveLength(1);
  });
});
