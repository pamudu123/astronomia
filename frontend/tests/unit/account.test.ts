import { afterEach, describe, expect, it, vi } from "vitest";

import { SAVE_LOCK, birthOf, matchOf, saveReport } from "@/lib/account";
import type { ReportRequest } from "@/lib/report";
import en from "@/messages/en.json";
import si from "@/messages/si.json";

describe("a saved request back in the forms' shape", () => {
  it("drops empty fields and the language", () => {
    expect(
      birthOf({
        date: "1995-04-19",
        time: "14:35",
        place_id: 1241622,
        latitude: null,
        longitude: null,
        timezone: null,
        fold: null,
        lang: "si",
      } as Parameters<typeof birthOf>[0]),
    ).toEqual({ date: "1995-04-19", time: "14:35", place_id: 1241622 });
  });

  it("keeps a full person and a quick one apart", () => {
    const match = matchOf({
      bride: { name: "Nimali", date: "1995-04-19", time: "14:35", place_id: 1, latitude: null },
      groom: { name: "", nakshatra: "rohini", pada: 1 },
      lang: "en",
    } as Parameters<typeof matchOf>[0]);
    expect(match).toEqual({
      bride: { name: "Nimali", date: "1995-04-19", time: "14:35", place_id: 1 },
      groom: { name: "", nakshatra: "rohini", pada: 1 },
    });
  });
});

describe("My reports text", () => {
  it("has every line in both languages", () => {
    expect(Object.keys(si.saved).sort()).toEqual(Object.keys(en.saved).sort());
    expect(si.nav.myReports).toBeTruthy();
    expect(si.saved.savedOn).toContain("{date}");
  });
});

describe("saving from two tabs at once", () => {
  const body = { kind: "hadahan", name: "", birth: {} } as unknown as ReportRequest;
  const created = { id: "a", created: true };

  afterEach(() => vi.unstubAllGlobals());

  /** A fetch that answers only when told to, and counts the requests sent so far. */
  function heldFetch() {
    const answers: (() => void)[] = [];
    const fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          answers.push(() => resolve(new Response(JSON.stringify(created), { status: 201 })));
        }),
    );
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("window", new EventTarget());
    return { fetch, answer: (n: number) => answers[n]() };
  }

  it("sends the second save only after the first answers, so both use one account", async () => {
    vi.stubGlobal("navigator", {});
    const { fetch, answer } = heldFetch();
    const first = saveReport(body);
    const second = saveReport(body);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(fetch).toHaveBeenCalledTimes(1); // the first cookie is not set yet
    answer(0);
    await first;
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    answer(1);
    await expect(second).resolves.toEqual(created);
  });

  it("a failed save does not hold up the next one", async () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("window", new EventTarget());
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("{}", { status: 500 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(created), { status: 201 })),
    );
    await expect(saveReport(body)).rejects.toThrow();
    await expect(saveReport(body)).resolves.toEqual(created);
  });

  it("uses the browser's lock, which every tab shares", async () => {
    const request = vi.fn((_name: string, work: () => Promise<unknown>) => work());
    vi.stubGlobal("navigator", { locks: { request } });
    vi.stubGlobal("window", new EventTarget());
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(created), { status: 201 })));
    await expect(saveReport(body)).resolves.toEqual(created);
    expect(request).toHaveBeenCalledWith(SAVE_LOCK, expect.any(Function));
  });
});
