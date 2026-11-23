import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchReport, reportFileName } from "@/lib/report";

vi.mock("@/lib/paid", () => ({ accountHeaders: async () => ({ "X-Sidera-Token": "a.b.c" }) }));

const REPORT = { kind: "hadahan", name: "", birth: {} } as never;

describe("fetchReport", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the sign in, so the account that paid gets its full report", async () => {
    const send = vi.fn<typeof fetch>(async () => new Response("%PDF"));
    vi.stubGlobal("fetch", send);
    await fetchReport(REPORT);
    const [url, init] = send.mock.calls[0];
    expect(url).toBe("/api/v1/reports/pdf");
    expect((init!.headers as Record<string, string>)["X-Sidera-Token"]).toBe("a.b.c");
  });

  it("names the file after the site", () => {
    expect(reportFileName(REPORT)).toBe("sidera-hadahan.pdf");
  });
});
