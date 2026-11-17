import type { ReactNode } from "react";

/** What the real pages accept. They only read `params`; `searchParams` is passed through. */
export type LabPageProps = {
  params: Promise<{ lang: "si" | "en" }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
type PageModule = { default: (props: LabPageProps) => ReactNode | Promise<ReactNode> };

/** The real pages shown in each theme. `path` is the part after the theme in the address. */
export const LAB_PAGES: { id: string; label: string; path: string[]; load: () => Promise<PageModule> }[] = [
  { id: "home", label: "Home", path: [], load: () => import("@/app/[lang]/page") },
  { id: "hadahan", label: "Hadahan", path: ["hadahan"], load: () => import("@/app/[lang]/hadahan/page") },
  { id: "porondam", label: "Porondam", path: ["porondam"], load: () => import("@/app/[lang]/porondam/page") },
  { id: "tools", label: "Tools", path: ["tools"], load: () => import("@/app/[lang]/tools/page") },
  { id: "nakath", label: "Nakath", path: ["nakath"], load: () => import("@/app/[lang]/nakath/page") },
  { id: "plans", label: "Plans", path: ["plans"], load: () => import("@/app/[lang]/plans/page") },
];

export function findPage(path: string[]) {
  return LAB_PAGES.find((page) => page.path.join("/") === path.join("/"));
}
