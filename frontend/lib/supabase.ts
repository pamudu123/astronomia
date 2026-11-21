/**
 * Sign in with Supabase Auth (docs/19). The browser uses Supabase only to sign in: it never
 * reads or writes the app's tables. The backend checks the access token sent with each account
 * call (lib/account.ts).
 *
 * - The first Save signs this browser in anonymously: a guest, with nothing asked.
 * - "Continue with Google" links Google to that same user, so the id and every report stay.
 *   Someone with no sign in here (a second phone) signs in with Google instead.
 *
 * The Supabase script is loaded only when one of these is first needed, so pages where nobody
 * saves never download it. Supabase keeps the sign in in this browser's storage and renews it.
 */
import type { Session, SupabaseClient } from "@supabase/supabase-js";

import type { Locale } from "./i18n";

// Public by design: the publishable key only lets a browser sign in. Set in Vercel.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export class SignInUnavailable extends Error {
  constructor(reason: string) {
    super(`sign in is unavailable: ${reason}`);
    this.name = "SignInUnavailable";
  }
}

let client: Promise<SupabaseClient> | null = null;

/** True when this build of the site can sign in at all. */
export function signInConfigured(): boolean {
  return Boolean(SUPABASE_URL && KEY);
}

export function supabase(): Promise<SupabaseClient> {
  if (!signInConfigured()) return Promise.reject(new SignInUnavailable("not configured"));
  client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(SUPABASE_URL, KEY, {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        // The callback page exchanges the code itself (app/[lang]/auth/callback).
        detectSessionInUrl: false,
      },
    }),
  );
  return client;
}

/** The sign in on this browser, renewed first if it has run out. Null when signed out. */
export async function currentSession(): Promise<Session | null> {
  if (!signInConfigured()) return null;
  const { data } = await (await supabase()).auth.getSession();
  return data.session;
}

/** The access token to send to the backend, or null when nobody is signed in here. */
export async function accessToken(): Promise<string | null> {
  return (await currentSession())?.access_token ?? null;
}

/** The access token, signing this browser in as a guest first if nobody is signed in. */
export async function signedInToken(): Promise<string> {
  const token = await accessToken();
  if (token) return token;
  const { data, error } = await (await supabase()).auth.signInAnonymously();
  if (error || !data.session) throw new SignInUnavailable(error?.message ?? "no session");
  return data.session.access_token;
}

export type Who = { kind: "guest" | "google"; email: string | null } | null;

/** Who is signed in on this browser: nobody, a guest, or a Google account (with its email). */
export async function whoIsSignedIn(): Promise<Who> {
  const session = await currentSession();
  if (!session) return null;
  const { user } = session;
  return user.is_anonymous ? { kind: "guest", email: null } : { kind: "google", email: user.email ?? null };
}

/** Where Supabase sends the browser back to after Google. `next` is a path on this site. */
export function callbackUrl(lang: Locale, next: string): string {
  const url = new URL(`/${lang}/auth/callback`, window.location.origin);
  url.searchParams.set("next", next);
  return url.toString();
}

/** A path on this site to go to after signing in. Anything else becomes My reports. */
export function safeNext(next: string | null, lang: Locale): string {
  const fallback = `/${lang}/my`;
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}

/** What Supabase put in the address on the way back: the code, or why it failed. */
export function callbackParams(href: string): {
  code: string | null;
  error: string | null;
  next: string | null;
} {
  const url = new URL(href);
  // Errors come in the query with the code flow, and in the fragment from some failures.
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const pick = (name: string) => url.searchParams.get(name) ?? hash.get(name);
  return {
    code: url.searchParams.get("code"),
    error: pick("error_code") ?? pick("error"),
    next: url.searchParams.get("next"),
  };
}

/**
 * "Continue with Google". A guest links Google to the same Supabase user, so every report they
 * saved stays. Anyone else (nobody signed in here) signs in with Google. Either way the browser
 * goes to Google and comes back to the callback page.
 */
export async function continueWithGoogle(lang: Locale, next: string): Promise<void> {
  const auth = (await supabase()).auth;
  const session = await currentSession();
  const options = { redirectTo: callbackUrl(lang, safeNext(next, lang)) };
  const { error } = session?.user.is_anonymous
    ? await auth.linkIdentity({ provider: "google", options })
    : await auth.signInWithOAuth({ provider: "google", options });
  if (error) throw new SignInUnavailable(error.message);
}

/** Supabase's answer when Google is already the sign in of another Sidera account. */
export const ALREADY_LINKED = "identity_already_exists";
// The guest's access token, kept for this tab only while it goes to Google and back.
const GUEST_KEY = "sidera-guest-token";

/**
 * For a guest whose Google account already has its own Sidera account (from another phone):
 * linking fails, so this signs in with that Google account instead. The guest's access token,
 * renewed first so it lasts the trip, is kept in this tab; the callback page then asks the
 * backend to move the guest's reports into the Google account (lib/account.ts, mergeGuest).
 */
export async function signInKeepingGuest(lang: Locale, next: string): Promise<void> {
  const auth = (await supabase()).auth;
  const { data } = await auth.refreshSession();
  const session = data.session ?? (await currentSession());
  if (session?.user.is_anonymous) {
    try {
      sessionStorage.setItem(GUEST_KEY, session.access_token);
    } catch {
      // Storage refused (a private window): sign in anyway; the reports stay with the guest.
    }
  }
  const options = { redirectTo: callbackUrl(lang, safeNext(next, lang)) };
  const { error } = await auth.signInWithOAuth({ provider: "google", options });
  if (error) {
    takeGuestToken();
    throw new SignInUnavailable(error.message);
  }
}

/** The guest token kept by signInKeepingGuest, once: it is removed as it is read. */
export function takeGuestToken(): string | null {
  try {
    const token = sessionStorage.getItem(GUEST_KEY);
    sessionStorage.removeItem(GUEST_KEY);
    return token;
  } catch {
    return null;
  }
}

/** Finishes signing in on the callback page, from the code Supabase sent back. */
export async function finishSignIn(code: string): Promise<void> {
  const { error } = await (await supabase()).auth.exchangeCodeForSession(code);
  if (error) throw new SignInUnavailable(error.message);
}
