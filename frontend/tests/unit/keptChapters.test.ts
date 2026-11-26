import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { keepingStream, keptChapter } from "@/lib/keptChapters";

vi.mock("server-only", () => ({}));

const signedIn = new Request("http://site/api/explain", { headers: { authorization: "Bearer a.b.c" } });
const REPORT = { kind: "hadahan", name: "", birth: {} };
const asked = { request: signedIn, id: "chart.work", language: "en", report: REPORT };
const answer = (body: object, status = 200) =>
  vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }));

/** Runs some pieces of text through the stream, ending well or with an error. */
async function run(send: typeof fetch, pieces: string[], broken = false): Promise<string> {
  const encoder = new TextEncoder();
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      pieces.forEach((piece) => controller.enqueue(encoder.encode(piece)));
      if (broken) controller.error(new Error("cut"));
      else controller.close();
    },
  });
  return new Response(source.pipeThrough(keepingStream(asked, send))).text();
}

describe("kept chapters", () => {
  beforeEach(() => vi.stubEnv("CHAT_KEY", "server-key"));
  afterEach(() => vi.unstubAllEnvs());

  it("gives the chapter the report keeps, asking with the visitor's sign in", async () => {
    const send = answer({ chapters: { "chart.work": "Kept." } });
    expect(await keptChapter(asked, send)).toBe("Kept.");
    const [url, init] = send.mock.calls[0];
    expect(String(url)).toMatch(/\/v1\/reports\/chapters$/);
    expect((init!.headers as Record<string, string>).authorization).toBe("Bearer a.b.c");
    expect(JSON.parse(String(init!.body))).toEqual({ report: REPORT, language: "en" });
    expect(await keptChapter({ ...asked, id: "chart.love" }, send)).toBeNull();
  });

  it("asks nothing without a report, a sign in, or for another page's chapter", async () => {
    const send = answer({ chapters: {} });
    expect(await keptChapter({ ...asked, report: undefined }, send)).toBeNull();
    expect(await keptChapter({ ...asked, request: new Request("http://site/") }, send)).toBeNull();
    expect(await keptChapter({ ...asked, id: "nakath.day" }, send)).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it("says so when the backend can't answer, so nothing is written twice", async () => {
    await expect(keptChapter(asked, answer({}, 500))).rejects.toThrow();
  });

  it("keeps a chapter once it is complete, with the server's key", async () => {
    const send = answer({ text: "x" });
    expect(await run(send, ["Steady ", "work."])).toBe("Steady work.");
    expect(send).toHaveBeenCalledTimes(1);
    const [url, init] = send.mock.calls[0];
    expect(String(url)).toMatch(/\/v1\/reports\/chapters\/keep$/);
    expect((init!.headers as Record<string, string>)["X-Chat-Key"]).toBe("server-key");
    expect(JSON.parse(String(init!.body))).toEqual({
      report: REPORT,
      language: "en",
      id: "chart.work",
      text: "Steady work.",
    });
  });

  it("never keeps half a chapter", async () => {
    const send = answer({ text: "x" });
    await expect(run(send, ["Half of"], true)).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  });

  it("still gives the chapter when keeping it fails, or there is no key", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await run(answer({}, 500), ["Text."])).toBe("Text.");
    expect(error).toHaveBeenCalledTimes(1);
    vi.stubEnv("CHAT_KEY", "");
    const send = answer({});
    expect(await run(send, ["Text."])).toBe("Text.");
    expect(send).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
