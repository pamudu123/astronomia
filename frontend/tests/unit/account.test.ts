import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SAVE_LOCK, birthOf, listSaved, matchOf, saveReport } from "@/lib/account";
import type { ReportRequest } from "@/lib/report";
import en from "@/messages/en.json";
import si from "@/messages/si.json";

// Supabase itself is not reached in unit tests: these stand in for lib/supabase.ts.
const auth = vi.hoisted(() => ({
  token: null as string | null,
  guests: 0,
  signOut: vi.fn<(options: unknown) => Promise<{ error: null }>>(async () => ({ error: null })),
}));

vi.mock("@/lib/supabase", () => ({
  signInConfigured: () => true,
  accessToken: async () => auth.token,
  signedInToken: async () => {
    if (!auth.token) {
      auth.guests += 1;
      auth.token = `guest.token.${auth.guests}`;
    }
    return auth.token;
  },
  supabase: async () => ({
    auth: {
      signOut: async (options: unknown) => {
        auth.token = null;
        return auth.signOut(options);
      },
    },
  }),
}));

beforeEach(() => {
  auth.token = null;
  auth.guests = 0;
  auth.signOut.mockClear();
});

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
    expect(si.saved.signedInAs).toContain("{email}");
    expect(si.footer.signIn).toBeTruthy();
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
    expect(fetch).toHaveBeenCalledTimes(1); // the first sign in is not kept yet
    answer(0);
    await first;
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    answer(1);
    await expect(second).resolves.toEqual(created);
    expect(auth.guests).toBe(1);
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

describe("the sign in goes with every account call", () => {
  afterEach(() => vi.unstubAllGlobals());

  function recordedFetch(...statuses: number[]) {
    const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => {
      const status = statuses.shift() ?? 200;
      const body = status === 200 || status === 201 ? { id: "a", created: true, reports: [] } : {};
      return new Response(JSON.stringify(body), { status });
    });
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("window", new EventTarget());
    const token = (n: number) => new Headers(fetch.mock.calls[n][1]?.headers).get("X-Sidera-Token");
    return { fetch, token };
  }

  const body = { kind: "hadahan", name: "", birth: {} } as unknown as ReportRequest;

  it("the first save signs in as a guest and sends the token", async () => {
    const { fetch, token } = recordedFetch(201);
    await saveReport(body);
    expect(auth.guests).toBe(1);
    expect(fetch.mock.calls[0][0]).toBe("/api/v1/saved");
    expect(token(0)).toBe("guest.token.1");
  });

  it("reading never signs in, and sends no token when nobody is signed in", async () => {
    const { token } = recordedFetch(200);
    await expect(listSaved()).resolves.toEqual([]);
    expect(auth.guests).toBe(0);
    expect(token(0)).toBeNull();
  });

  it("a refused token signs this browser out, and a save tries once more as a new guest", async () => {
    auth.token = "old.guest.token";
    const { fetch, token } = recordedFetch(401, 201);
    await saveReport(body);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(token(0)).toBe("old.guest.token");
    expect(token(1)).toBe("guest.token.1");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("a refused token on a read signs out and does not loop", async () => {
    auth.token = "old.guest.token";
    const { fetch } = recordedFetch(401);
    await expect(listSaved()).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(auth.token).toBeNull();
  });
});
