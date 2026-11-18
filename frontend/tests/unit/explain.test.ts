import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PageContext } from "@/lib/assistant/context";
import {
  MATCH_PLACES,
  MATCH_READING,
  blocks,
  chapterKey,
  chapterState,
  hash,
  requestChapter,
  resetChapters,
  spans,
} from "@/lib/assistant/explain";
import en from "@/messages/en.json";
import si from "@/messages/si.json";

const FACTS: PageContext = { page: "match_result", language: "en", result: { score: { agree: 12, counted: 15 } } };

/** A fetch that streams the given pieces of text. */
function streaming(pieces: string[], status = 200) {
  return vi.fn(async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        pieces.forEach((piece) => controller.enqueue(encoder.encode(piece)));
        controller.close();
      },
    });
    return new Response(body, { status });
  });
}

describe("chapter keys", () => {
  it("are the same for the same chapter, language and facts", () => {
    expect(chapterKey("match.summary", "en", FACTS)).toBe(chapterKey("match.summary", "en", { ...FACTS }));
    expect(hash("abc")).toBe(hash("abc"));
  });

  it("change with the chapter, the language or any fact", () => {
    const key = chapterKey("match.summary", "en", FACTS);
    expect(chapterKey("match.checks", "en", FACTS)).not.toBe(key);
    expect(chapterKey("match.summary", "si", FACTS)).not.toBe(key);
    expect(chapterKey("match.summary", "en", { ...FACTS, shared: true })).not.toBe(key);
  });
});

describe("the chapters and their words", () => {
  it("has a title for every chapter in both languages", () => {
    for (const id of MATCH_READING) {
      expect(en.assistant.explain.chapters[id]).toBeTruthy();
      expect(si.assistant.explain.chapters[id]).toBeTruthy();
    }
  });

  it("points every explain button at chapters of the reading", () => {
    for (const ids of Object.values(MATCH_PLACES)) {
      for (const id of ids) expect(MATCH_READING).toContain(id);
    }
  });
});

describe("requestChapter", () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    resetChapters();
    storage.clear();
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("streams the chapter, keeps it, and doesn't ask twice", async () => {
    const send = streaming(["Both essential ", "checks pass."]);
    await requestChapter("match.checks", "en", FACTS, send);

    const key = chapterKey("match.checks", "en", FACTS);
    expect(chapterState(key)).toEqual({ status: "done", text: "Both essential checks pass." });
    expect(storage.get(key)).toBe("Both essential checks pass.");
    const [url, init] = send.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/explain");
    expect(JSON.parse(String(init.body))).toEqual({ id: "match.checks", language: "en", facts: FACTS });

    await requestChapter("match.checks", "en", FACTS, send);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("reads a chapter kept earlier in the visit without asking", async () => {
    const key = chapterKey("match.people", "en", FACTS);
    storage.set(key, "Kept text.");
    const send = streaming(["new"]);
    await requestChapter("match.people", "en", FACTS, send);
    expect(send).not.toHaveBeenCalled();
    expect(chapterState(key).text).toBe("Kept text.");
  });

  it("marks a failed chapter so it can be asked for again", async () => {
    await requestChapter("match.mars", "en", FACTS, streaming([], 502));
    const key = chapterKey("match.mars", "en", FACTS);
    expect(chapterState(key).status).toBe("failed");
    expect(storage.has(key)).toBe(false);

    await requestChapter("match.mars", "en", FACTS, streaming(["Neither chart shows it."]));
    expect(chapterState(key)).toEqual({ status: "done", text: "Neither chart shows it." });
  });

  it("treats an empty answer as failed", async () => {
    await requestChapter("match.styles", "en", FACTS, streaming(["  "]));
    expect(chapterState(chapterKey("match.styles", "en", FACTS)).status).toBe("failed");
  });
});

describe("blocks", () => {
  it("splits bold leads, paragraphs and lists", () => {
    const text = "Your result is warm.\n\n**Where it comes easily**\nGana agrees.\n\n- **Yoni**: agrees\n- Rashi: doesn't";
    expect(blocks(text)).toEqual([
      { kind: "paragraph", spans: [{ text: "Your result is warm.", bold: false }] },
      { kind: "paragraph", spans: [{ text: "Where it comes easily", bold: true }] },
      { kind: "paragraph", spans: [{ text: "Gana agrees.", bold: false }] },
      {
        kind: "list",
        items: [
          [
            { text: "Yoni", bold: true },
            { text: ": agrees", bold: false },
          ],
          [{ text: "Rashi: doesn't", bold: false }],
        ],
      },
    ]);
  });

  it("shows headings as bold lines and keeps an unclosed ** as text", () => {
    expect(blocks("## The two of you")).toEqual([
      { kind: "paragraph", spans: [{ text: "The two of you", bold: true }] },
    ]);
    expect(spans("a **b")).toEqual([{ text: "a **b", bold: false }]);
  });

  it("never turns text into markup", () => {
    const [block] = blocks("<img src=x onerror=alert(1)>");
    expect(block).toEqual({ kind: "paragraph", spans: [{ text: "<img src=x onerror=alert(1)>", bold: false }] });
  });
});
