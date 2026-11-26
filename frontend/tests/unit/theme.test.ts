import { afterEach, describe, expect, it, vi } from "vitest";

import { THEME_KEY, THEME_SCRIPT, applyTheme, followSavedTheme, parseTheme, readTheme } from "@/lib/theme";

/** A stand-in for <html> and localStorage, enough for the theme code. */
function fakePage(saved: string | null = null) {
  const store = new Map<string, string>(saved === null ? [] : [[THEME_KEY, saved]]);
  const attributes = new Map<string, string>();
  const root = {
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    removeAttribute: (name: string) => attributes.delete(name),
  };
  const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  };
  return { store, attributes, root, localStorage };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseTheme", () => {
  it("keeps light and dark", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
  });

  it("treats anything else as following the device", () => {
    expect(parseTheme(null)).toBe("system");
    expect(parseTheme("system")).toBe("system");
    expect(parseTheme("blue")).toBe("system");
  });
});

describe("the script in <head>", () => {
  const run = (page: ReturnType<typeof fakePage>) =>
    new Function("localStorage", "document", THEME_SCRIPT)(page.localStorage, { documentElement: page.root });

  it("applies a saved choice", () => {
    const page = fakePage("dark");
    run(page);
    expect(page.attributes.get("data-theme")).toBe("dark");
  });

  it("leaves the page to the device setting when nothing usable is saved", () => {
    for (const saved of [null, "system", "<b>"]) {
      const page = fakePage(saved);
      run(page);
      expect(page.attributes.has("data-theme")).toBe(false);
    }
  });

  it("does not break the page when storage is blocked", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() => new Function("localStorage", "document", THEME_SCRIPT)(blocked, {})).not.toThrow();
  });
});

describe("applyTheme", () => {
  function stub(saved: string | null = null) {
    const page = fakePage(saved);
    const events: string[] = [];
    vi.stubGlobal("window", {
      localStorage: page.localStorage,
      dispatchEvent: (event: Event) => events.push(event.type),
    });
    return { ...page, events };
  }

  it("saves and applies light or dark", () => {
    const page = stub();
    applyTheme("light", page.root as unknown as HTMLElement);
    expect(page.store.get(THEME_KEY)).toBe("light");
    expect(page.attributes.get("data-theme")).toBe("light");
    expect(page.events).toHaveLength(1);
  });

  it("forgets the choice when going back to the device setting", () => {
    const page = stub("dark");
    page.attributes.set("data-theme", "dark");
    applyTheme("system", page.root as unknown as HTMLElement);
    expect(page.store.has(THEME_KEY)).toBe(false);
    expect(page.attributes.has("data-theme")).toBe(false);
  });
});

describe("with blocked storage (A-07)", () => {
  function block() {
    const blocked = () => {
      throw new Error("blocked");
    };
    const page = fakePage();
    vi.stubGlobal("window", {
      localStorage: { getItem: blocked, setItem: blocked, removeItem: blocked },
      dispatchEvent: () => true,
    });
    return page;
  }
  const root = (page: ReturnType<typeof fakePage>) => page.root as unknown as HTMLElement;

  it("remembers the choice for this page, and what is shown agrees with it", () => {
    const page = block();
    for (const choice of ["light", "dark", "system"] as const) {
      applyTheme(choice, root(page));
      expect(readTheme()).toBe(choice);
      expect(page.attributes.get("data-theme")).toBe(choice === "system" ? undefined : choice);
    }
  });

  it("goes back to what is saved once saving works, or another tab saves a choice", () => {
    applyTheme("light", root(block()));
    const working = fakePage("dark");
    vi.stubGlobal("window", { localStorage: working.localStorage, dispatchEvent: () => true });
    expect(readTheme()).toBe("light");
    followSavedTheme(root(working));
    expect(readTheme()).toBe("dark");
    expect(working.attributes.get("data-theme")).toBe("dark");

    applyTheme("light", root(block()));
    vi.stubGlobal("window", { localStorage: working.localStorage, dispatchEvent: () => true });
    applyTheme("system", root(working));
    expect(readTheme()).toBe("system");
  });
});
