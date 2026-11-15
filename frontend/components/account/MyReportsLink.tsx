"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { hasSavedReports, onSavedChange } from "@/lib/account";

/**
 * "My reports" in the header, only while this browser keeps saved reports. It reads a small
 * cookie the backend sets, so showing it never wakes the backend. Visitors who never saved
 * anything see no change.
 */
export function MyReportsLink({ href, label, className }: { href: string; label: string; className: string }) {
  const show = useSyncExternalStore(onSavedChange, hasSavedReports, () => false);
  if (!show) return null;
  return (
    <Link href={href} className={className} data-my-reports>
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 18 18" fill="currentColor">
        <path d="M4.5 2.5h9v13L9 12l-4.5 3.5z" />
      </svg>
      {label}
    </Link>
  );
}
