import { notFound } from "next/navigation";

/** Every address no other page answers, so not-found.tsx shows inside the site's layout. */
export default function MissingPage() {
  notFound();
}
