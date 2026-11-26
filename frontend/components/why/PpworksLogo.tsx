/* The PP WORKS wordmark (concept 7a, "Refined original", from ppworks/assets/logo/concepts/spark).
   Drawn inline so it follows the site theme: the Ps take --pp-indigo, the spark takes --pp-cyan,
   and WORKS takes the current text colour. The parent sets those two variables. */

const P = "M0 0H38A33 33 0 0 1 38 66H20V100H0ZM20 20V46H38A13 13 0 0 0 38 20Z";

export function PpworksLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="-14 -14 690.7 128"
      role="img"
      aria-label="ppworks"
      className={className}
    >
      <g fill="var(--pp-indigo)">
        <path d={P} fillRule="evenodd" />
        <path d={P} fillRule="evenodd" transform="translate(83 0)" />
      </g>
      <g transform="translate(194 0)">
        <g fill="currentColor">
          <path d="M0 0H21.3L36.5 62L51 0H69L83.5 62L98.7 0H120L94.5 100H73L60 45L47 100H25.5Z" />
          <g transform="translate(232 0)">
            <path d={P} fillRule="evenodd" />
            <path d="M26 56H49.3L75.7 100H52.4Z" />
          </g>
          <g transform="translate(317.7 0)">
            <path d="M0 0H20V100H0Z" />
            <path d="M47 0H73L20 62.4V31.8Z" />
            <path d="M51 100H75L30.4 38H6.4Z" />
          </g>
          <path
            transform="translate(398.7 0)"
            d="M64 0H30A30 30 0 0 0 30 60H40A10 10 0 0 1 40 80H5V100H40A30 30 0 0 0 40 40H30A10 10 0 0 1 30 20H64Z"
          />
        </g>
        <path fill="var(--pp-cyan)" transform="translate(127 0)" d="M46 0Q54 42 96 50Q54 58 46 100Q38 58 -4 50Q38 42 46 0Z" />
      </g>
    </svg>
  );
}
