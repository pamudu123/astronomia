/**
 * Light and dark themes. The site follows the device setting ("system") unless the visitor picks
 * one. A pick is kept in localStorage and shown as data-theme on <html>; app/globals.css holds the
 * colours for each.
 */

export const THEMES = ["system", "light", "dark"] as const;
export type ThemeChoice = (typeof THEMES)[number];

export const THEME_KEY = "sidera-theme";
/** Sent on the window when the choice changes, so every switch on the page updates. */
export const THEME_EVENT = "sidera-theme";

export function parseTheme(value: string | null | undefined): ThemeChoice {
  return value === "light" || value === "dark" ? value : "system";
}

/**
 * Runs in <head> before the page paints, so a saved choice never flashes the other theme first.
 * Kept tiny and self-contained: it cannot import anything.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

// A choice the browser would not save (blocked or full storage): it holds until the page reloads.
let unsaved: ThemeChoice | null = null;

export function readTheme(): ThemeChoice {
  if (unsaved !== null) return unsaved;
  try {
    return parseTheme(window.localStorage.getItem(THEME_KEY));
  } catch {
    return "system";
  }
}

/** Saves the choice and applies it to the page at once. */
export function applyTheme(choice: ThemeChoice, root: HTMLElement = document.documentElement) {
  try {
    if (choice === "system") window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, choice);
    unsaved = null;
  } catch {
    // Storage can be blocked (private windows); the choice still applies to this page.
    unsaved = choice;
  }
  show(choice, root);
  window.dispatchEvent(new Event(THEME_EVENT));
}

/** Another tab saved a choice: this page follows it, over any choice of its own it could not save. */
export function followSavedTheme(root: HTMLElement = document.documentElement) {
  unsaved = null;
  show(readTheme(), root);
}

function show(choice: ThemeChoice, root: HTMLElement) {
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
}
