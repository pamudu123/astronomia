/**
 * Articles shown on the Why Sidera page. The section stays hidden while this list is empty.
 * To add one, push an entry here. `href` is relative to the language, for example "articles/what-is-a-hadahan".
 */
export type Article = {
  href: string;
  /** Read time in minutes. */
  minutes: number;
  category: Record<"en" | "si", string>;
  title: Record<"en" | "si", string>;
  summary: Record<"en" | "si", string>;
};

export const ARTICLES: Article[] = [];
