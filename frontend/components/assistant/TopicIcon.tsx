import type { ReactNode } from "react";

import type { ChapterId } from "@/lib/assistant/explain";

/**
 * The small line icon on each life topic chip. One colour (the chip's own text colour), so it
 * follows the hover and selected states and both themes. Decorative: the label says the same.
 */
const PATHS: Partial<Record<ChapterId, ReactNode>> = {
  // Sun rising over a horizon: your nature.
  "chart.nature": (
    <>
      <path d="M3 15h14M5.5 15a4.5 4.5 0 0 1 9 0" />
      <path d="M10 4v2.5M3.6 8.1l1.7 1.7M16.4 8.1l-1.7 1.7" />
    </>
  ),
  // Briefcase: work and money.
  "chart.work": (
    <>
      <rect x="2.5" y="6.5" width="15" height="10" rx="2" />
      <path d="M7.5 6.5V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 12.5 5v1.5M2.5 11h15" />
    </>
  ),
  // Heart: love and marriage.
  "chart.love": <path d="M10 16.5S3 12.2 3 7.8A3.8 3.8 0 0 1 10 6a3.8 3.8 0 0 1 7 1.8c0 4.4-7 8.7-7 8.7Z" />,
  // House: family and home.
  "chart.family": (
    <>
      <path d="M3 9.5 10 3.5l7 6M4.5 8.5v8h11v-8" />
      <path d="M8.5 16.5v-4.5h3v4.5" />
    </>
  ),
  // Open book: studies.
  "chart.studies": (
    <>
      <path d="M10 5.5C8.5 4.3 6 4 3 4.3v10.4c3-.3 5.5 0 7 1.2 1.5-1.2 4-1.5 7-1.2V4.3C14 4 11.5 4.3 10 5.5Z" />
      <path d="M10 5.5v10.4" />
    </>
  ),
  // Aeroplane: travel and going abroad.
  "chart.abroad": <path d="M17 3 3 8.5l5 2 2 5L17 3ZM8 10.5 17 3" />,
};

export function TopicIcon({ id, className }: { id: ChapterId; className?: string }) {
  const paths = PATHS[id];
  if (!paths) return null;
  return (
    <svg
      className={className}
      aria-hidden="true"
      focusable="false"
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths}
    </svg>
  );
}
