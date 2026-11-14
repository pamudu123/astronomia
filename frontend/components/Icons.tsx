/** Small stroke icons from the design. All are decorative. */

export function ArrowRight({ size = 18 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9h12M10 4l5 5-5 5" />
    </svg>
  );
}

export function Download({ size = 18 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 2.5v9M5 8l4 4 4-4M3 15.5h12" />
    </svg>
  );
}

export function ShareIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="13.5" cy="4" r="2" />
      <circle cx="4.5" cy="9" r="2" />
      <circle cx="13.5" cy="14" r="2" />
      <path d="M6.3 8l5.4-3M6.3 10l5.4 3" />
    </svg>
  );
}

export function Lock({ size = 18, color = "var(--teal)" }: { size?: number; color?: string }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3.5" y="8" width="11" height="7.5" rx="1.5" />
      <path d="M6 8V5.5a3 3 0 0 1 6 0V8" />
    </svg>
  );
}

export function Eye() {
  return (
    <svg
      aria-hidden="true"
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      stroke="var(--gold)"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 14S6.7 6.5 14 6.5 25.5 14 25.5 14 21.3 21.5 14 21.5 2.5 14 2.5 14z" />
      <circle cx="14" cy="14" r="3.5" />
    </svg>
  );
}

export function Globe() {
  return (
    <svg
      aria-hidden="true"
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      stroke="var(--gold)"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="14" cy="14" r="11" />
      <path d="M3 14h22M14 3c3.5 3.2 3.5 18.8 0 22M14 3c-3.5 3.2-3.5 18.8 0 22" />
    </svg>
  );
}

const STAR = "M0,-13 L3.25,-3.25 L13,0 L3.25,3.25 L0,13 L-3.25,3.25 L-13,0 L-3.25,-3.25 Z";

/**
 * The Sidera mark: two great circles of the sky crossing (the solid one with a planet on it),
 * around a four pointed star. Strokes are sized for the header (about 56 px wide).
 * Below about 48 px use the bold single orbit in app/icon.svg instead.
 */
export function Logo({ width = 56 }: { width?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={width}
      height={(width * 64) / 120}
      viewBox="-60 -32 120 64"
      fill="none"
    >
      <ellipse
        rx="54"
        ry="17"
        transform="rotate(14)"
        stroke="var(--gold)"
        strokeWidth="2.4"
        strokeDasharray="6 5"
      />
      <g transform="rotate(-14)">
        <ellipse rx="54" ry="17" stroke="var(--gold)" strokeWidth="3.2" />
        <circle cx="-38.2" cy="-12" r="7" fill="var(--sky)" stroke="var(--night)" strokeWidth="3" data-planet />
      </g>
      <path d={STAR} fill="var(--ink)" />
    </svg>
  );
}
