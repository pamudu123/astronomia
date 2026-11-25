import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { type PageVisuals, offers, parseShown } from "@/lib/assistant/pageVisuals";
import { chartContext, chartReadingContext } from "@/lib/assistant/pages";
import { VISUALS } from "@/lib/assistant/visuals";
import type { Hadahan, Labels } from "@/lib/hadahan";
import type { Porondam } from "@/lib/porondam";
import en from "@/messages/en.json";
import si from "@/messages/si.json";

import hadahan from "../e2e/fixtures/hadahan-en.json";
import labelsEn from "../e2e/fixtures/labels-en.json";
import porondamFull from "../e2e/fixtures/porondam-full-en.json";

const labels = labelsEn as unknown as Labels;
const chart = hadahan as unknown as Hadahan;
const match = porondamFull as unknown as Porondam;

const ofChart = (parts: Partial<Hadahan> = {}): PageVisuals => ({ kind: "chart", result: { ...chart, ...parts }, labels });

describe("what a page can draw", () => {
  it("offers a chart's diagrams, for free and paid reports alike", () => {
    expect(offers(ofChart())).toEqual(["pillars", "wheel", "houses", "periods", "mars"]);
  });

  it("leaves out what a shared or saved result does not hold", () => {
    expect(offers(ofChart({ dasha: null, kuja: null } as Partial<Hadahan>))).toEqual(["pillars", "wheel", "houses"]);
    expect(offers(ofChart({ chart: null } as Partial<Hadahan>))).toEqual([]);
  });

  it("offers a match's diagrams", () => {
    expect(offers({ kind: "match", result: match, labels })).toEqual(["people", "ring", "checks"]);
    expect(offers({ kind: "match", result: { ...match, match: null } as unknown as Porondam, labels })).toEqual([]);
  });

  it("names the same diagrams as the agent's tool, each with a title in both languages", () => {
    const tool = readFileSync(join(__dirname, "../../../agent/app/tools/visuals.py"), "utf-8");
    const names = [.../Visual = Literal\[([^\]]+)\]/.exec(tool)![1].matchAll(/"(\w+)"/g)].map((m) => m[1]);
    expect(names).toEqual([...VISUALS]);
    for (const messages of [en, si]) expect(Object.keys(messages.assistant.cards.visual)).toEqual([...VISUALS]);
  });

  it("adds nothing to the facts a written chapter is kept under", () => {
    expect(chartContext(chart, labels, "en")).not.toHaveProperty("visuals");
    expect(chartReadingContext(chart, labels, "en")).not.toHaveProperty("visuals");
  });
});

describe("reading Astro's call", () => {
  it("reads the diagram, the result it belongs to and the houses to light", () => {
    expect(parseShown('{"shown":"houses","page":"a1","houses":[10,11]}')).toEqual({ shown: "houses", page: "a1", houses: [10, 11] });
    expect(parseShown('{"shown":"periods","page":"a1"}')).toEqual({ shown: "periods", page: "a1", houses: [] });
  });

  it("draws nothing for a refused call or a name it does not know", () => {
    expect(parseShown("The page can't draw that. Answer in words, and don't mention a diagram.")).toBeNull();
    expect(parseShown('{"shown":"tarot","page":"a1"}')).toBeNull();
    expect(parseShown('{"shown":"periods"}')).toBeNull();
    expect(parseShown(undefined)).toBeNull();
  });
});
