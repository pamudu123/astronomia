import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CONVERSATION_IDLE_MINUTES, isIdle } from "@/lib/assistant/idle";
import {
  NOTICE_KEY,
  NOTICE_VERSION,
  acknowledge,
  acknowledged,
  resetForTests,
  subscribe,
} from "@/lib/assistant/notice";
import en from "@/messages/en.json";
import si from "@/messages/si.json";

/** A browser window with working storage, or with storage that throws (blocked, private). */
function browser(storage: "works" | "blocked") {
  const saved = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => {
      if (storage === "blocked") throw new DOMException("blocked", "SecurityError");
      return saved.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      if (storage === "blocked") throw new DOMException("blocked", "SecurityError");
      saved.set(key, value);
    },
  };
  const win = Object.assign(new EventTarget(), { localStorage });
  vi.stubGlobal("window", win);
  return { saved, win };
}

describe("the AI notice", () => {
  beforeEach(() => resetForTests());
  afterEach(() => vi.unstubAllGlobals());

  it("is not acknowledged at first, and is remembered in this browser once it is", () => {
    const { saved } = browser("works");
    expect(acknowledged()).toBe(false);

    acknowledge();
    expect(acknowledged()).toBe(true);
    expect(saved.get(NOTICE_KEY)).toBe(NOTICE_VERSION);

    // A later visit (module state gone) still finds it.
    resetForTests();
    expect(acknowledged()).toBe(true);
  });

  it("shows again when the notice's version changes", () => {
    const { saved } = browser("works");
    saved.set(NOTICE_KEY, "an-older-version");
    expect(acknowledged()).toBe(false);
  });

  it("with storage blocked, is remembered for this visit only, without errors", () => {
    browser("blocked");
    expect(acknowledged()).toBe(false);
    expect(() => acknowledge()).not.toThrow();
    expect(acknowledged()).toBe(true);

    resetForTests(); // a new visit
    expect(acknowledged()).toBe(false);
  });

  it("tells every listener, and hears another tab acknowledging", () => {
    const { win } = browser("works");
    const heard = vi.fn();
    const stop = subscribe(heard);

    acknowledge();
    expect(heard).toHaveBeenCalledTimes(1);

    const other = Object.assign(new Event("storage"), { key: NOTICE_KEY });
    win.dispatchEvent(other);
    expect(heard).toHaveBeenCalledTimes(2);

    stop();
    acknowledge();
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it("is never acknowledged during server rendering", () => {
    expect(acknowledged()).toBe(false);
  });

  it("uses the reviewed English wording, and has Sinhala words for every part", () => {
    expect(en.assistant.notice.text).toBe(
      "This is an AI helper. Your message and selected chart facts go to an AI service to write the answer. Please leave out names, " +
        "children's details, and health or other sensitive information. AI can make mistakes.",
    );
    expect(Object.keys(si.assistant.notice).sort()).toEqual(Object.keys(en.assistant.notice).sort());
    // The notice says "an AI service"; the provider is named on the privacy page.
    expect(si.assistant.notice.text).toContain("AI සේවාවකට");
    expect(en.assistant.notice.text + si.assistant.notice.text).not.toContain("OpenAI");
  });
});

describe("the chat's idle time limit", () => {
  it("is 30 minutes, the same as the AI service's", () => {
    expect(CONVERSATION_IDLE_MINUTES).toBe(30);
  });

  it("counts a conversation as idle only after the full time", () => {
    const start = Date.UTC(2026, 10, 21, 9, 0);
    expect(isIdle(start, start + 29 * 60_000 + 59_000)).toBe(false);
    expect(isIdle(start, start + 30 * 60_000)).toBe(true);
    expect(isIdle(start, start + 5 * 60_000, 5)).toBe(true);
  });
});
