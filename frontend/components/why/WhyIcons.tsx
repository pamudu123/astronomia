const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** Line icons for the Why Sidera page. Decorative: the text beside each one says the same. */
export function WhyIcon({ name, size = 28 }: { name: string; size?: number }) {
  const svg = { ...base, width: size, height: size, viewBox: "0 0 32 32" };
  switch (name) {
    case "maths":
      return (
        <svg {...svg}>
          <path d="M6 9h8M10 5v8M19 9h7M19 21h7M19 25h7M7 20l6 6M13 20l-6 6" />
        </svg>
      );
    case "sky":
      return (
        <svg {...svg}>
          <circle cx="16" cy="16" r="6" />
          <ellipse cx="16" cy="16" rx="13" ry="5" transform="rotate(-20 16 16)" />
        </svg>
      );
    case "rules":
      return (
        <svg {...svg}>
          <path d="M6 6.5A2.5 2.5 0 0 1 8.5 4H16v22H8.5A2.5 2.5 0 0 0 6 28.5zM26 6.5A2.5 2.5 0 0 0 23.5 4H16v22h7.5a2.5 2.5 0 0 1 2.5 2.5z" />
          <path d="M9 10h4M9 14h4M19 10h4M19 14h4" />
        </svg>
      );
    case "ai":
      return (
        <svg {...svg}>
          <path d="M14 4l2.2 6.3L22.5 12.5l-6.3 2.2L14 21l-2.2-6.3L5.5 12.5l6.3-2.2zM24 19l1 2.8 2.8 1-2.8 1-1 2.8-1-2.8-2.8-1 2.8-1z" />
        </svg>
      );
    case "check":
      return (
        <svg {...svg}>
          <path d="M16 3l10 4v8c0 6.5-4.2 11-10 14C10.2 26 6 21.5 6 15V7z" />
          <path d="M11 16l3.5 3.5L21 12.5" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...svg}>
          <rect x="5" y="7" width="22" height="19" rx="3" />
          <path d="M5 13h22M11 4v5M21 4v5M11 18h4M17 18h4" />
        </svg>
      );
    case "share":
      return (
        <svg {...svg}>
          <path d="M6 5h20v16H14l-6 5v-5H6z" />
          <path d="M11 11h10M11 15h6" />
        </svg>
      );
    default:
      return (
        <svg {...svg}>
          <circle cx="16" cy="16" r="11" />
          <path d="M11 16.5l3.5 3.5L21 13" />
        </svg>
      );
  }
}
