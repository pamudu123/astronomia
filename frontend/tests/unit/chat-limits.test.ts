import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type ChatStatus, type LimitText, formatDay, limitView, messageLength, tooLong } from "@/lib/chat";
import en from "@/messages/en.json";
import si from "@/messages/si.json";

vi.mock("server-only", () => ({}));

// The CopilotKit runtime, replaced by a handler that remembers what reached it.
const reached: Request[] = [];
vi.mock("@copilotkit/runtime/v2", () => ({
  CopilotRuntime: class {
    constructor(public options: unknown) {}
  },
  createCopilotRuntimeHandler: () => async (request: Request) => {
    reached.push(request);
    return new Response("data: run\n\n", { headers: { "Content-Type": "text/event-stream" } });
  },
}));
vi.mock("@ag-ui/client", () => ({ HttpAgent: class {} }));
// Outside a real request there is nothing to wait for.
vi.mock("next/server", () => ({ connection: async () => undefined }));

const T: LimitText = en.assistant.limits;

function status(more: Partial<ChatStatus> = {}): ChatStatus {
  return {
    mode: "free",
    max_length: 1000,
    free: { limit: 2, left: 2, resets_at: null },
    paid: null,
    blocked: null,
    ...more,
  };
}

describe("what the chat shows", () => {
  it("shows the free questions from the start", () => {
    expect(limitView(status(), T, "en")).toEqual({ state: "open", line: "2 free questions this week", note: null });
    const one = status({ free: { limit: 2, left: 1, resets_at: "2026-11-29T04:30:00Z" } });
    expect(limitView(one, T, "en")).toMatchObject({ line: "1 free question left this week" });
  });

  it("says when the free questions come back, with a report to keep asking", () => {
    const used = status({
      free: { limit: 2, left: 0, resets_at: "2026-11-29T04:30:00Z" },
      blocked: { reason: "free_used", until: "2026-11-29T04:30:00Z" },
    });
    const view = limitView(used, T, "en");
    expect(view).toEqual({
      state: "blocked",
      reason: "free_used",
      message:
        "You've used this week's 2 free questions. They come back on Sunday 29 November. Get a full report to keep asking.",
      offerReport: true,
    });
    // The same date in Sinhala, from the Sinhala words.
    const sinhala = limitView(used, si.assistant.limits, "si");
    expect(sinhala.state === "blocked" && sinhala.message).toContain(formatDay("2026-11-29T04:30:00Z", "si", T));
    expect(formatDay("2026-11-29T04:30:00Z", "si", T)).not.toMatch(/Sunday|November/);
  });

  it("uses Sri Lanka's calendar for the date", () => {
    // 20:00 UTC on the 28th is already the 29th in Sri Lanka.
    expect(formatDay("2026-11-28T20:00:00Z", "en", T)).toBe("Sunday 29 November");
    expect(formatDay(null, "en", T)).toBe("soon");
  });

  it("shows a paid allowance in questions, with a note at 80%", () => {
    const paid = status({ mode: "paid", paid: { questions_left: 15, questions_total: 20, used_share: 0.25 } });
    expect(limitView(paid, T, "en")).toEqual({ state: "open", line: "About 15 questions left", note: null });
    const near = status({ mode: "paid", paid: { questions_left: 4, questions_total: 20, used_share: 0.8 } });
    expect(limitView(near, T, "en")).toMatchObject({ note: T.paidNear });
    const last = status({ mode: "paid", paid: { questions_left: 0, questions_total: 20, used_share: 0.99 } });
    expect(limitView(last, T, "en")).toMatchObject({ line: "Nearly used up" });
  });

  it("goes on with free questions once the reports' chat is used", () => {
    const used = status({ paid: { questions_left: 0, questions_total: 20, used_share: 1 } });
    expect(limitView(used, T, "en")).toEqual({ state: "open", line: "2 free questions this week", note: T.paidDone });
  });

  it("is friendly about every other limit", () => {
    for (const reason of ["busy", "network", "burst", "account_day", "paid_used"] as const) {
      const view = limitView(status({ blocked: { reason, until: "2026-11-23T18:30:00Z" } }), T, "en");
      expect(view.state).toBe("blocked");
      if (view.state !== "blocked") continue;
      expect(view.message).not.toContain("{");
      expect(view.offerReport).toBe(reason !== "burst" && reason !== "account_day");
    }
    const busy = limitView(status({ blocked: { reason: "busy", until: "2026-11-22T18:30:00Z" } }), T, "en");
    expect(busy.state === "blocked" && busy.message).toMatch(/^Astro is very busy today/);
  });

  it("counts characters as the server does and never cuts the text", () => {
    expect(messageLength("ආයුබෝවන්")).toBe(Array.from("ආයුබෝවන්").length);
    expect(messageLength("😀")).toBe(1);
    expect(tooLong("a".repeat(1000), status())).toBe(false);
    expect(tooLong("a".repeat(1001), status())).toBe(true);
    expect(tooLong("a".repeat(5000), null)).toBe(false); // no limits known: the server decides
  });

  it("has every word in both languages", () => {
    expect(Object.keys(si.assistant.limits).sort()).toEqual(Object.keys(en.assistant.limits).sort());
    for (const [key, value] of Object.entries(si.assistant.limits)) {
      const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
      expect(placeholders(value), key).toEqual(placeholders(en.assistant.limits[key as keyof LimitText]));
    }
  });
});

describe("the website's server", () => {
  it("reads what a CopilotKit call is", async () => {
    const { readRun } = await import("@/lib/chatLimits");
    const raw = JSON.stringify({
      method: "agent/run",
      params: { agentId: "guide" },
      body: {
        messages: [
          { role: "user", content: "short" },
          { role: "assistant", content: "x".repeat(4000) },
          { role: "user", content: [{ type: "text", text: "ලග්නය කුමක්ද?" }] },
        ],
      },
    });
    expect(readRun(raw)).toEqual({ method: "agent/run", agentId: "guide", longest: 13 });
    expect(readRun("not json")).toBeNull();
  });

  it("knows the browser by its cookie, or makes a new id", async () => {
    const { browserOf, turnOf } = await import("@/lib/chatLimits");
    const known = new Request("http://x", { headers: { cookie: "a=1; sidera_chat=abcd-1234-efgh" } });
    expect(browserOf(known)).toEqual({ id: "abcd-1234-efgh", fresh: false });
    const strange = new Request("http://x", { headers: { cookie: "sidera_chat=<script>" } });
    expect(browserOf(strange).fresh).toBe(true);
    const turn = new Request("http://x", { headers: { cookie: "sidera_chat_turn=6f1d2b9e-8a40-4c55-9d3b-0a1b2c3d4e5f" } });
    expect(turnOf(turn)).toBe("6f1d2b9e-8a40-4c55-9d3b-0a1b2c3d4e5f");
    expect(turnOf(new Request("http://x", { headers: { cookie: "sidera_chat_turn=nope" } }))).toBeNull();
  });

  it("takes the address Vercel reports", async () => {
    const { addressOf } = await import("@/lib/chatLimits");
    expect(addressOf(new Request("http://x", { headers: { "x-real-ip": "203.0.113.7" } }))).toBe("203.0.113.7");
    const forwarded = new Request("http://x", { headers: { "x-forwarded-for": "198.51.100.4, 10.0.0.1" } });
    expect(addressOf(forwarded)).toBe("198.51.100.4");
  });
});

describe("the chat route", () => {
  const backend = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.resetModules();
    reached.length = 0;
    backend.mockReset();
    vi.stubGlobal("fetch", backend);
    vi.stubEnv("AGENT_URL", "http://agent.test/agent");
    vi.stubEnv("CHAT_KEY", "chat-key");
    vi.stubEnv("BACKEND_URL", "http://backend.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function run(message = "What is my nakatha?", headers: Record<string, string> = {}, method = "agent/run") {
    const body = JSON.stringify({
      method,
      params: { agentId: method === "agent/run" ? "guide" : "suggest" },
      body: { messages: [{ id: "m1", role: "user", content: message }] },
    });
    return new Request("http://site.test/api/copilotkit", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": "203.0.113.7", ...headers },
      body,
    });
  }

  it("asks the backend first, then sends the question with its id", async () => {
    backend.mockResolvedValue(Response.json({ turn: "6f1d2b9e-8a40-4c55-9d3b-0a1b2c3d4e5f", kind: "free" }, { status: 201 }));
    const { POST } = await import("@/app/api/copilotkit/route");
    const response = await POST(run("hello", { authorization: "Bearer a.b.c", "x-sidera-turn": "forged" }));

    expect(response.status).toBe(200);
    const [url, init] = backend.mock.calls[0];
    expect(url).toBe("http://backend.test/v1/chat/turns");
    const sent = init?.headers as Record<string, string>;
    expect(sent["X-Chat-Key"]).toBe("chat-key");
    expect(sent.authorization).toBe("Bearer a.b.c");
    expect(JSON.parse(String(init?.body))).toMatchObject({ address: "203.0.113.7", length: 5 });
    // The agent gets the backend's id, never one the browser sent.
    expect(reached[0].headers.get("x-sidera-turn")).toBe("6f1d2b9e-8a40-4c55-9d3b-0a1b2c3d4e5f");
    const cookies = response.headers.getSetCookie();
    expect(cookies.some((c) => c.startsWith("sidera_chat=") && c.includes("HttpOnly"))).toBe(true);
    expect(cookies.some((c) => c.startsWith("sidera_chat_turn=6f1d2b9e"))).toBe(true);
  });

  it("passes a refusal back and sends nothing to the agent", async () => {
    const refusal = { reason: "free_used", until: "2026-11-29T04:30:00Z", status: {} };
    backend.mockResolvedValue(Response.json(refusal, { status: 429 }));
    const { POST } = await import("@/app/api/copilotkit/route");
    const response = await POST(run());
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual(refusal);
    expect(reached).toHaveLength(0);
  });

  it("stops when the limits cannot be checked", async () => {
    backend.mockRejectedValue(new Error("down"));
    const { POST } = await import("@/app/api/copilotkit/route");
    expect((await POST(run())).status).toBe(502);
    expect(reached).toHaveLength(0);
  });

  it("sends the follow-up buttons with the last question's id, without asking again", async () => {
    const { POST } = await import("@/app/api/copilotkit/route");
    const cookie = "sidera_chat=abcd-1234-efgh; sidera_chat_turn=6f1d2b9e-8a40-4c55-9d3b-0a1b2c3d4e5f";
    await POST(run("", { cookie }, "agent/suggest"));
    expect(backend).not.toHaveBeenCalled();
    expect(reached[0].headers.get("x-sidera-turn")).toBe("6f1d2b9e-8a40-4c55-9d3b-0a1b2c3d4e5f");
  });

  it("runs without limits when there is no chat key, and drops a browser's question id", async () => {
    vi.stubEnv("CHAT_KEY", "");
    const { POST } = await import("@/app/api/copilotkit/route");
    await POST(run("hi", { "x-sidera-turn": "forged" }));
    expect(backend).not.toHaveBeenCalled();
    expect(reached[0].headers.get("x-sidera-turn")).toBeNull();
  });

  it("says what is left, or nothing without limits", async () => {
    backend.mockResolvedValue(Response.json(status()));
    const { GET } = await import("@/app/api/chat/route");
    const found = await GET(new Request("http://site.test/api/chat", { headers: { cookie: "sidera_chat=abcd-1234-efgh" } }));
    expect(await found.json()).toEqual(status());
    expect(JSON.parse(String(backend.mock.calls[0][1]?.body))).toMatchObject({ browser: "abcd-1234-efgh" });
    vi.stubEnv("CHAT_KEY", "");
    expect((await GET(new Request("http://site.test/api/chat"))).status).toBe(204);
  });
});
