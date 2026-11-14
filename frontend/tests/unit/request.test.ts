import { describe, expect, it } from "vitest";

import { RequestError, ensureOk, failureOf, failureText } from "@/lib/request";
import en from "@/messages/en.json";
import si from "@/messages/si.json";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("request failures (QA AST-02 to AST-04)", () => {
  it("keeps the backend's reason", async () => {
    await expect(ensureOk(json(404, { detail: "unknown place" }))).rejects.toMatchObject({
      status: 404,
      detail: "unknown place",
    });
    await expect(ensureOk(new Response("<html>Bad gateway</html>", { status: 502 }))).rejects.toMatchObject({
      status: 502,
      detail: null,
    });
    const fine = json(200, {});
    await expect(ensureOk(fine)).resolves.toBe(fine);
  });

  it("tells a missing route (an old deploy) from an unknown place", () => {
    expect(failureOf(new RequestError(404, "Not Found"))).toBe("unavailable");
    expect(failureOf(new RequestError(404, "unknown place"))).toBe("place");
  });

  it("sorts the other answers", () => {
    expect(failureOf(new RequestError(422, "unknown time zone"))).toBe("invalid");
    expect(failureOf(new RequestError(401, "access key needed"))).toBe("unavailable");
    expect(failureOf(new RequestError(503, null))).toBe("unavailable");
    expect(failureOf(new RequestError(500, null))).toBe("failed");
    expect(failureOf(new TypeError("Failed to fetch"))).toBe("unavailable");
    expect(failureOf(new DOMException("timed out", "TimeoutError"))).toBe("unavailable");
    expect(failureOf(new Error("anything"))).toBe("failed");
  });

  it("has every message in both languages for each date tool", () => {
    for (const dict of [en, si]) {
      for (const t of [dict.nakath, dict.porondam.wedding, dict.firstLetters]) {
        for (const kind of ["failed", "unavailable", "invalid", "place"] as const) {
          expect(t[kind]).toBeTruthy();
        }
        expect(failureText(new RequestError(503, null), t)).toBe(t.unavailable);
      }
    }
  });
});
