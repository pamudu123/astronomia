import type { components } from "./api-types";
import type { BirthRequest } from "./hadahan";
import type { Locale } from "./i18n";
import { RASHI } from "./rashi";

export type ChangeList = components["schemas"]["ChangeListResponse"];
export type ChangeLagna = components["schemas"]["ChangeLagnaResponse"];
export type ChangeOut = components["schemas"]["ChangeOut"];
export type Counted = components["schemas"]["CountedOut"];
export type PersonalChange = components["schemas"]["PersonalChangeResponse"];
export type Upcoming = components["schemas"]["UpcomingResponse"];

export type SlowBody = "saturn" | "jupiter" | "rahu" | "ketu";
export type ChangeKind = "rahu-ketu" | "saturn" | "jupiter";

export type ChangeMove = {
  body: SlowBody;
  from: string;
  to: string;
  /** A backward step. Never set for Rahu and Ketu, which always move backwards. */
  retrograde: boolean;
  /** A forward move back into the sign it stepped back out of. */
  returning: boolean;
  /** The Sri Lanka date it next changes sign, and the sign it enters then. */
  until: string;
  next: string;
};

export type PlanetChange = {
  id: string;
  kind: ChangeKind;
  /** UTC. */
  moment: string;
  /** Sri Lanka time, as almanacs print it. */
  local: string;
  moves: ChangeMove[];
  /** Has its own pages. The others show on the list as coming soon. */
  published: boolean;
};

/**
 * The changes on the list page, from GET /v1/changes. A test keeps this equal to the
 * backend (tests/e2e/fixtures/changes-en.json), so the pages and sitemap work without it.
 */
export const CHANGES: PlanetChange[] = [
  {
    id: "rahu-ketu-2026-12",
    kind: "rahu-ketu",
    moment: "2026-12-05T17:02:00Z",
    local: "2026-12-05T22:32",
    moves: [
      {
        body: "rahu",
        from: "kumbha",
        to: "makara",
        retrograde: false,
        returning: false,
        until: "2028-06-24",
        next: "dhanu",
      },
      {
        body: "ketu",
        from: "simha",
        to: "kataka",
        retrograde: false,
        returning: false,
        until: "2028-06-24",
        next: "mithuna",
      },
    ],
    published: true,
  },
  {
    id: "jupiter-2027-01",
    kind: "jupiter",
    moment: "2027-01-24T20:02:00Z",
    local: "2027-01-25T01:32",
    moves: [
      {
        body: "jupiter",
        from: "simha",
        to: "kataka",
        retrograde: true,
        returning: false,
        until: "2027-06-26",
        next: "simha",
      },
    ],
    published: true,
  },
  {
    id: "saturn-2027-06",
    kind: "saturn",
    moment: "2027-06-02T23:58:00Z",
    local: "2027-06-03T05:28",
    moves: [
      {
        body: "saturn",
        from: "meena",
        to: "mesha",
        retrograde: false,
        returning: false,
        until: "2027-10-20",
        next: "meena",
      },
    ],
    published: true,
  },
  {
    id: "jupiter-2027-06",
    kind: "jupiter",
    moment: "2027-06-25T23:49:00Z",
    local: "2027-06-26T05:19",
    moves: [
      {
        body: "jupiter",
        from: "kataka",
        to: "simha",
        retrograde: false,
        returning: true,
        until: "2027-11-26",
        next: "kanya",
      },
    ],
    published: true,
  },
  {
    id: "saturn-2027-10",
    kind: "saturn",
    moment: "2027-10-20T01:42:00Z",
    local: "2027-10-20T07:12",
    moves: [
      {
        body: "saturn",
        from: "mesha",
        to: "meena",
        retrograde: true,
        returning: false,
        until: "2028-02-23",
        next: "mesha",
      },
    ],
    published: true,
  },
  {
    id: "jupiter-2027-11",
    kind: "jupiter",
    moment: "2027-11-26T13:15:00Z",
    local: "2027-11-26T18:45",
    moves: [
      {
        body: "jupiter",
        from: "simha",
        to: "kanya",
        retrograde: false,
        returning: false,
        until: "2028-02-28",
        next: "simha",
      },
    ],
    published: true,
  },
];

export const PUBLISHED = CHANGES.filter((change) => change.published);

export function findChange(id: string): PlanetChange | undefined {
  return PUBLISHED.find((change) => change.id === id);
}

export function findLagna(key: string) {
  return RASHI.find((rashi) => rashi.key === key);
}

/** The house a sign falls in, counted from the lagna (whole signs). */
export function houseFrom(sign: string, lagna: string): number {
  const keys = RASHI.map((rashi) => rashi.key);
  return ((keys.indexOf(sign) - keys.indexOf(lagna) + 12) % 12) + 1;
}

export const changeYear = (change: PlanetChange) => Number(change.local.slice(0, 4));

/** The change the home page points to. Move it on when the next change gets its pages. */
export const FEATURED = "rahu-ketu-2026-12";

/** The general answer needs only a lagna, so it is a GET that may be cached. */
export function changeLagnaPath(id: string, lagna: string, lang: Locale): string {
  return `/v1/changes/${encodeURIComponent(id)}/${encodeURIComponent(lagna)}?lang=${lang}`;
}

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`request failed: ${response.status}`);
  return (await response.json()) as T;
}

export async function fetchChangeLagna(id: string, lagna: string, lang: Locale): Promise<ChangeLagna> {
  return json<ChangeLagna>(await fetch(`/api${changeLagnaPath(id, lagna, lang)}`));
}

/** Birth details go in the body of a POST, never in the URL. */
async function post<T>(path: string, request: BirthRequest, lang: Locale): Promise<T> {
  return json<T>(
    await fetch(`/api${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...request, lang }),
    }),
  );
}

export const fetchPersonalChange = (id: string, request: BirthRequest, lang: Locale) =>
  post<PersonalChange>(`/v1/changes/${encodeURIComponent(id)}/personal`, request, lang);

export const fetchUpcomingChanges = (request: BirthRequest, lang: Locale) =>
  post<Upcoming>("/v1/changes/personal", request, lang);
