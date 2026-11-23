import type { ChapterId } from "./explain";

/**
 * The picture beside each reading chapter's short answer, the same as in the PDF report
 * (backend/app/reports/artwork.py, CHAPTER_ART). Made from the originals by
 * design/tools/build_report_art.py. The other pages' explanations keep their line drawing
 * (components/Spot.tsx).
 */
export const CHAPTER_ART: Partial<Record<ChapterId, string>> = {
  "match.people": "people",
  "match.factors": "factors",
  "match.checks": "checks",
  "match.mars": "mars",
  "match.styles": "styles",
  "match.summary": "summary",
  "match.combinations": "combinations",
  "match.lords": "planets",
  "match.years": "periods",
  "match.wedding": "wedding",
  "chart.summary": "summary",
  "chart.combinations": "combinations",
  "chart.saturn": "saturn",
  "chart.ahead": "ahead",
  "chart.nature": "nature",
  "chart.planets": "planets",
  "chart.houses": "houses",
  "chart.work": "work",
  "chart.love": "love",
  "chart.family": "family",
  "chart.studies": "studies",
  "chart.abroad": "abroad",
  "chart.periods": "periods",
  "chart.mars": "mars",
  "chart.care": "care",
};

export const chapterPicture = (id: ChapterId): string | null =>
  CHAPTER_ART[id] ? `/images/chapters/${CHAPTER_ART[id]}.webp` : null;
