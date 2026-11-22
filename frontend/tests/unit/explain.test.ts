import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PageContext } from "@/lib/assistant/context";
import {
  CHAPTER_SPOT,
  CHART_PLACES,
  CHART_READING,
  CHART_TOPICS,
  MATCH_PLACES,
  MATCH_READING,
  PAGE_PLACES,
  blocks,
  chapterKey,
  chapterState,
  hash,
  KEEP_DAYS,
  lead,
  outline,
  parts,
  requestChapter,
  resetChapters,
  spans,
  tone,
  writeAll,
  writtenChapters,
} from "@/lib/assistant/explain";
import { SPOTS } from "@/lib/spots";
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
    for (const id of [...MATCH_READING, ...CHART_READING, ...CHART_TOPICS, ...Object.values(PAGE_PLACES).flat()]) {
      expect(en.assistant.explain.chapters[id]).toBeTruthy();
      expect(si.assistant.explain.chapters[id]).toBeTruthy();
    }
  });

  it("points every explain button at chapters of the reading", () => {
    for (const ids of Object.values(MATCH_PLACES)) {
      for (const id of ids) expect(MATCH_READING).toContain(id);
    }
  });

  it("points the chart buttons at chapters of the chart reading", () => {
    for (const ids of Object.values(CHART_PLACES)) {
      for (const id of ids) expect(CHART_READING).toContain(id);
    }
    expect(CHART_TOPICS.every((id) => id.startsWith("chart."))).toBe(true);
  });
});

/** A Storage over a map, like the browser's. */
function memoryStorage(map: Map<string, string>) {
  return {
    get length() {
      return map.size;
    },
    key: (index: number) => [...map.keys()][index] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

const keptText = (raw: string | undefined) => (raw ? (JSON.parse(raw) as { text: string }).text : undefined);

describe("requestChapter", () => {
  const storage = new Map<string, string>();
  const tab = new Map<string, string>();

  beforeEach(() => {
    resetChapters();
    storage.clear();
    tab.clear();
    vi.stubGlobal("window", { localStorage: memoryStorage(storage), sessionStorage: memoryStorage(tab) });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("streams the chapter, keeps it, and doesn't ask twice", async () => {
    const send = streaming(["Both essential ", "checks pass."]);
    await requestChapter("match.checks", "en", FACTS, send);

    const key = chapterKey("match.checks", "en", FACTS);
    expect(chapterState(key)).toEqual({ status: "done", text: "Both essential checks pass." });
    expect(keptText(storage.get(key))).toBe("Both essential checks pass.");
    const [url, init] = send.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/explain");
    expect(JSON.parse(String(init.body))).toEqual({ id: "match.checks", language: "en", facts: FACTS });

    await requestChapter("match.checks", "en", FACTS, send);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("sends the report on the page, for the paid check", async () => {
    const send = streaming(["Text."]);
    const report = { kind: "porondam", match: { bride: {}, groom: {}, lang: "en" } } as never;
    await requestChapter("match.summary", "en", FACTS, send, report);
    const [, init] = send.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body)).report).toEqual(report);
  });

  it("reads a chapter kept on this device without asking", async () => {
    const key = chapterKey("match.people", "en", FACTS);
    storage.set(key, JSON.stringify({ text: "Kept text.", at: Date.now() }));
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

  it("lists only the chapters already written, in the order asked, for the PDF", async () => {
    await requestChapter("match.summary", "en", FACTS, streaming(["Summing up text."]));
    await requestChapter("match.people", "en", FACTS, streaming(["People text."]));
    await requestChapter("match.mars", "en", FACTS, streaming([], 502));
    const other = { ...FACTS, shared: true };
    const factsFor = (id: string) => (id === "match.styles" ? null : id === "match.factors" ? other : FACTS);
    expect(writtenChapters(["match.people", "match.mars", "match.styles", "match.summary"], "en", factsFor)).toEqual([
      { id: "match.people", text: "People text." },
      { id: "match.summary", text: "Summing up text." },
    ]);
  });

  it("forgets a chapter kept longer than a month, and reads one an older visit kept in the tab", async () => {
    const old = chapterKey("match.people", "en", FACTS);
    storage.set(old, JSON.stringify({ text: "Old.", at: Date.now() - (KEEP_DAYS + 1) * 86_400_000 }));
    const send = streaming(["Fresh."]);
    await requestChapter("match.people", "en", FACTS, send);
    expect(send).toHaveBeenCalledTimes(1);
    expect(chapterState(old).text).toBe("Fresh.");

    const inTab = chapterKey("match.styles", "en", FACTS);
    tab.set(inTab, "From the tab.");
    expect(chapterState(inTab)).toEqual({ status: "done", text: "From the tab." });
  });

  it("writes every chapter not written yet for the PDF, reusing the rest and retrying a failure once", async () => {
    await requestChapter("match.people", "en", FACTS, streaming(["Already written."]));
    let calls = 0;
    const send = vi.fn(async (_url: string, init?: RequestInit) => {
      calls += 1;
      const { id } = JSON.parse(String(init?.body)) as { id: string };
      // The first try at the Mars chapter fails; the second works.
      if (id === "match.mars" && calls === 1) return new Response("no", { status: 502 });
      return streaming([`Text for ${id}.`])();
    });
    const seen: [number, number][] = [];
    const items = (["match.people", "match.mars", "match.summary"] as const).map((id) => ({ id, facts: FACTS }));
    await writeAll(items, "en", (done, total) => seen.push([done, total]), send as unknown as typeof fetch, 1);

    expect(send).toHaveBeenCalledTimes(3); // the Mars chapter twice and the summary; not the people
    expect(chapterState(chapterKey("match.mars", "en", FACTS)).text).toBe("Text for match.mars.");
    expect(chapterState(chapterKey("match.people", "en", FACTS)).text).toBe("Already written.");
    expect(seen).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it("treats an empty answer as failed", async () => {
    await requestChapter("match.styles", "en", FACTS, streaming(["  "]));
    expect(chapterState(chapterKey("match.styles", "en", FACTS)).status).toBe("failed");
  });
});

describe("outline", () => {
  it("gives the chat a chapter's short answer and the headings of its parts", () => {
    const text = "You meet life **warmly**.\n\n**💼 Work that suits you**\nSteady roles.\n\n**⚠️ Take care**\n- Rest";
    expect(outline(text)).toEqual({ in_short: "You meet life warmly.", parts: ["Work that suits you", "Take care"] });
    expect(outline("x".repeat(30), 10).in_short).toBe("xxxxxxxxx…");
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

  it("keeps a lead that starts with an icon as a lead", () => {
    expect(blocks("**💼 Work that suits you**\n\nSteady roles suit you.")).toEqual([
      { kind: "paragraph", spans: [{ text: "💼 Work that suits you", bold: true }] },
      { kind: "paragraph", spans: [{ text: "Steady roles suit you.", bold: false }] },
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

  it("reads a small table between paragraphs, padding short rows", () => {
    const text = [
      "Three stretches stand out.",
      "| Period | Dates |",
      "|---|:--:|",
      "| **Mercury** | 2026 – 2028 |",
      "| Ketu |",
      "",
      "Each brings its own pace.",
    ].join("\n");
    expect(blocks(text)).toEqual([
      { kind: "paragraph", spans: [{ text: "Three stretches stand out.", bold: false }] },
      {
        kind: "table",
        head: [[{ text: "Period", bold: false }], [{ text: "Dates", bold: false }]],
        rows: [
          [[{ text: "Mercury", bold: true }], [{ text: "2026 – 2028", bold: false }]],
          [[{ text: "Ketu", bold: false }], []],
        ],
      },
      { kind: "paragraph", spans: [{ text: "Each brings its own pace.", bold: false }] },
    ]);
  });

  it("keeps lines that only look like a table as text, as while the rule is still arriving", () => {
    expect(blocks("| Period | Dates |")).toEqual([
      { kind: "paragraph", spans: [{ text: "| Period | Dates |", bold: false }] },
    ]);
  });

  it("keeps an escaped pipe inside its cell", () => {
    const [block] = blocks("| a | b |\n|---|---|\n| x \\| y | z |");
    expect(block.kind === "table" && block.rows[0][0]).toEqual([{ text: "x | y", bold: false }]);
  });
});

describe("parts", () => {
  it("splits the opening answer from the parts, with each lead's icon apart", () => {
    const { answer, parts: found } = parts(
      blocks("You meet life warmly.\n\n**💼 Work that suits you**\n\nSteady roles.\n\n**💡 What helps**\n\n- Rest"),
    );
    expect(answer).toEqual([{ kind: "paragraph", spans: [{ text: "You meet life warmly.", bold: false }] }]);
    expect(found.map((part) => part.lead)).toEqual([
      { icon: "💼", text: "Work that suits you" },
      { icon: "💡", text: "What helps" },
    ]);
    expect(found[1].blocks).toEqual([{ kind: "list", items: [[{ text: "Rest", bold: false }]] }]);
  });

  it("reads joined emoji and leads without an icon", () => {
    expect(lead("⚠️ Take care")).toEqual({ icon: "⚠️", text: "Take care" });
    expect(lead("Plain lead")).toEqual({ icon: null, text: "Plain lead" });
  });

  it("tints tips, cautions and good news only", () => {
    expect([tone("💡"), tone("⚠️"), tone("✅"), tone("💼"), tone(null)]).toEqual([
      "tip",
      "attention",
      "good",
      "plain",
      "plain",
    ]);
  });

  it("has a picture for every chapter", () => {
    for (const id of [...MATCH_READING, ...CHART_READING, ...CHART_TOPICS, ...Object.values(PAGE_PLACES).flat()]) {
      expect(SPOTS[CHAPTER_SPOT[id]]).toBeDefined();
    }
  });
});
