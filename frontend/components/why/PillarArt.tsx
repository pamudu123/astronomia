const round = (value: number) => Math.round(value * 100) / 100;

/** A point on a circle, measured clockwise from the top (the way the zodiac wheel counts). */
function point(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: round(cx + r * Math.sin(rad)), y: round(cy - r * Math.cos(rad)) };
}

/** Maths: a round dial measuring 47°12′ from 0°, with the exact reading beside it. */
function MathsArt() {
  const cx = 62;
  const cy = 62;
  const r = 46;
  const angle = 47.2;
  const ticks = Array.from({ length: 36 }, (_, k) => {
    const major = k % 3 === 0;
    return { k, major, from: point(cx, cy, r - 3, k * 10), to: point(cx, cy, r - (major ? 11 : 7), k * 10) };
  });
  const arcEnd = point(cx, cy, r, angle);
  const needle = point(cx, cy, r - 14, angle);
  return (
    <svg viewBox="0 0 220 124" width="100%" height="100%" aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--line)" strokeWidth="3" />
      <path d={`M${cx} ${cy - r} A${r} ${r} 0 0 1 ${arcEnd.x} ${arcEnd.y}`} fill="none" stroke="var(--gold)" strokeWidth="3" strokeLinecap="round" />
      <g stroke="var(--ink-soft)" strokeLinecap="round">
        {ticks.map((tick) => (
          <line key={tick.k} x1={tick.from.x} y1={tick.from.y} x2={tick.to.x} y2={tick.to.y} strokeOpacity={tick.major ? 0.9 : 0.4} />
        ))}
      </g>
      <line x1={cx} y1={cy} x2={cx} y2={cy - r + 14} stroke="var(--ink-soft)" strokeOpacity=".5" strokeDasharray="2 3" />
      <line x1={cx} y1={cy} x2={needle.x} y2={needle.y} stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="4.5" fill="var(--gold)" />
      <circle cx={arcEnd.x} cy={arcEnd.y} r="3.5" fill="var(--gold)" />
      <g fontFamily="var(--font-mono)">
        <text x="128" y="44" fontSize="12" fill="var(--gold)">
          λ
        </text>
        <text x="128" y="70" fontSize="17" fill="var(--ink)">
          47°12′08″
        </text>
        <text x="128" y="90" fontSize="11" fill="var(--ink-soft)">
          = 47.2022°
        </text>
      </g>
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
