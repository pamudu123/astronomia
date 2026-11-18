const round = (value: number) => Math.round(value * 100) / 100;

/** A point on a circle, with 0° pointing right and angles going anticlockwise (maths convention). */
function point(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: round(cx + r * Math.cos(rad)), y: round(cy - r * Math.sin(rad)) };
}

/** Maths: a measuring gauge with a needle and an exact reading. */
function MathsArt() {
  const cx = 110;
  const cy = 92;
  const ticks = Array.from({ length: 13 }, (_, k) => {
    const deg = 180 - k * 15;
    const major = k % 3 === 0;
    return { k, major, from: point(cx, cy, 74, deg), to: point(cx, cy, major ? 62 : 68, deg) };
  });
  const gaugeEnd = point(cx, cy, 80, 108);
  const needle = point(cx, cy, 56, 108);
  return (
    <svg viewBox="0 0 220 124" width="100%" height="100%" aria-hidden="true">
      <path d={`M${cx - 80} ${cy} A80 80 0 0 1 ${cx + 80} ${cy}`} fill="none" stroke="var(--line)" strokeWidth="4" strokeLinecap="round" />
      <path d={`M${cx - 80} ${cy} A80 80 0 0 1 ${gaugeEnd.x} ${gaugeEnd.y}`} fill="none" stroke="var(--gold)" strokeWidth="4" strokeLinecap="round" />
      <g stroke="var(--ink-soft)" strokeLinecap="round">
        {ticks.map((tick) => (
          <line key={tick.k} x1={tick.from.x} y1={tick.from.y} x2={tick.to.x} y2={tick.to.y} strokeOpacity={tick.major ? 0.9 : 0.45} />
        ))}
      </g>
      <line x1={cx} y1={cy} x2={needle.x} y2={needle.y} stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="5" fill="var(--gold)" />
      <text x={cx} y="118" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="13" fill="var(--ink)">
        18° 05′ 32″
      </text>
    </svg>
  );
}

/** Tuned AI: a question and an answer, in two languages, with a spark. */
function AiArt() {
  return (
    <svg viewBox="0 0 220 124" width="100%" height="100%" aria-hidden="true">
      <rect x="18" y="12" width="122" height="42" rx="14" fill="var(--panel-raised)" stroke="var(--line)" />
      <rect x="32" y="26" width="78" height="6" rx="3" fill="var(--line)" />
      <rect x="32" y="38" width="52" height="6" rx="3" fill="var(--line)" />
      <rect x="72" y="66" width="130" height="46" rx="14" fill="none" stroke="var(--gold)" />
      <rect x="86" y="80" width="94" height="6" rx="3" fill="var(--gold)" fillOpacity=".55" />
      <rect x="86" y="92" width="64" height="6" rx="3" fill="var(--gold)" fillOpacity=".35" />
      <path d="M170 14l3.2 9 9 3.2-9 3.2-3.2 9-3.2-9-9-3.2 9-3.2z" fill="var(--gold)" />
      <g fill="none" stroke="var(--line)">
        <rect x="18" y="66" width="42" height="20" rx="10" />
        <rect x="18" y="92" width="42" height="20" rx="10" />
      </g>
      <g fontSize="11" fill="var(--ink-soft)" textAnchor="middle" dominantBaseline="central">
        <text x="39" y="76" fontFamily="var(--font-sinhala)">
          සිං
        </text>
        <text x="39" y="102" fontFamily="var(--font-body)">
          EN
        </text>
      </g>
    </svg>
  );
}

/** Verified: a short checklist, every row ticked. */
function CheckArt() {
  const rows = [
    { y: 24, width: 112 },
    { y: 62, width: 88 },
    { y: 100, width: 100 },
  ];
  return (
    <svg viewBox="0 0 220 124" width="100%" height="100%" aria-hidden="true">
      {rows.map((row) => (
        <g key={row.y}>
          <circle cx="46" cy={row.y} r="12" fill="none" stroke="var(--teal)" strokeWidth="1.6" />
          <path d={`M40 ${row.y}l4 4 8-8`} fill="none" stroke="var(--teal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="70" y={row.y - 4} width={row.width} height="8" rx="4" fill="var(--line)" />
        </g>
      ))}
    </svg>
  );
}

/** The picture at the top of each pillar card. Decorative: the title beside it says the same. */
export function PillarArt({ name }: { name: string }) {
  if (name === "maths") return <MathsArt />;
  if (name === "ai") return <AiArt />;
  return <CheckArt />;
}
