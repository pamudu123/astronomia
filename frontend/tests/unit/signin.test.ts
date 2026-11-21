import { afterEach, describe, expect, it, vi } from "vitest";

import { forwardedHeaders } from "@/lib/forward";
import { callbackParams, safeNext } from "@/lib/supabase";

const JWT = "eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJ4In0.c2lnbmF0dXJl";

describe("the /api forward", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("hands the page's token on as Authorization: Bearer", () => {
    const out = forwardedHeaders(new Headers({ "X-Sidera-Token": JWT }));
    expect(out.get("authorization")).toBe(`Bearer ${JWT}`);
    expect(out.get("x-sidera-token")).toBeNull();
  });

  it("keeps the staging password here", () => {
    const out = forwardedHeaders(new Headers({ Authorization: "Basic c3RhZ2luZzpwYXNz" }));
    expect(out.get("authorization")).toBeNull();
    const both = forwardedHeaders(new Headers({ Authorization: "Basic c3RhZ2luZzpwYXNz", "X-Sidera-Token": JWT }));
    expect(both.get("authorization")).toBe(`Bearer ${JWT}`);
  });

  it("passes on nothing that is not a token", () => {
    for (const junk of ["", "abc", "a.b", "a.b.c d", "a.b.c,d.e.f", "Bearer a.b.c"]) {
      expect(forwardedHeaders(new Headers({ "X-Sidera-Token": junk })).get("authorization")).toBeNull();
    }
    expect(forwardedHeaders(new Headers({ "X-Sidera-Token": `${"a".repeat(9000)}.b.c` })).get("authorization")).toBeNull();
  });

  it("adds the backend's access key when there is one", () => {
    vi.stubEnv("BACKEND_ACCESS_KEY", "key");
    expect(forwardedHeaders(new Headers()).get("x-access-key")).toBe("key");
  });
});

describe("coming back from Google", () => {
  it("reads the code and where to go next", () => {
    const params = callbackParams("https://sidera.example/en/auth/callback?next=%2Fen%2Fmy&code=abc");
    expect(params).toEqual({ code: "abc", error: null, next: "/en/my" });
  });

  it("reads an error from the query or the fragment", () => {
    const query = "https://s.example/en/auth/callback?error=server_error&error_code=identity_already_exists";
    expect(callbackParams(query).error).toBe("identity_already_exists");
    expect(callbackParams("https://s.example/en/auth/callback#error=access_denied").error).toBe("access_denied");
  });

  it("only goes on to a page of this site", () => {
    expect(safeNext("/si/my/123", "si")).toBe("/si/my/123");
    for (const bad of [null, "", "https://evil.example", "//evil.example", "/\\evil.example", "my"]) {
      expect(safeNext(bad, "en")).toBe("/en/my");
    }
  });
});
