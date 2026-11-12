import { afterEach, describe, expect, it, vi } from "vitest";

import { backendHeaders, stagingAllowed } from "@/lib/staging";

const basic = (user: string, password: string) => `Basic ${btoa(`${user}:${password}`)}`;

describe("stagingAllowed", () => {
  it("accepts the password with any user name", () => {
    expect(stagingAllowed(basic("anyone", "s3cret"), "s3cret")).toBe(true);
    expect(stagingAllowed(basic("", "s3cret"), "s3cret")).toBe(true);
  });

  it("allows a colon inside the password", () => {
    expect(stagingAllowed(basic("me", "a:b:c"), "a:b:c")).toBe(true);
  });

  it("refuses everything else", () => {
    expect(stagingAllowed(null, "s3cret")).toBe(false);
    expect(stagingAllowed("Bearer s3cret", "s3cret")).toBe(false);
    expect(stagingAllowed(basic("me", "wrong"), "s3cret")).toBe(false);
    expect(stagingAllowed(basic("me", "s3cret!"), "s3cret")).toBe(false);
    expect(stagingAllowed("Basic not-base64!!", "s3cret")).toBe(false);
    expect(stagingAllowed(`Basic ${btoa("no colon")}`, "s3cret")).toBe(false);
  });
});

describe("backendHeaders", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is empty when no key is set", () => {
    vi.stubEnv("BACKEND_ACCESS_KEY", "");
    expect(backendHeaders()).toEqual({});
  });

  it("carries the key when set", () => {
    vi.stubEnv("BACKEND_ACCESS_KEY", "k".repeat(32));
    expect(backendHeaders()).toEqual({ "X-Access-Key": "k".repeat(32) });
  });
});
