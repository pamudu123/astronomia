import { RASHI } from "@/lib/rashi";

import styles from "./ZodiacWheel.module.css";

const C = 240;
const round = (value: number) => Math.round(value * 100) / 100;

/** A point on a circle around the centre, measured clockwise from the top. */
function polar(r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [round(C + r * Math.sin(rad)), round(C - r * Math.cos(rad))];
}

const labels = RASHI.map((rashi, index) => {
  const [x, y] = polar(200, 15 + index * 30);
  return { key: rashi.key, text: rashi.si, x, y };
});

/** Degree scale: a short tick every 5°, a long one with its value every 30°. */
const ticks = Array.from({ length: 72 }, (_, index) => {
  const deg = index * 5;
  const major = deg % 30 === 0;
  return { deg, major, from: polar(231, deg), to: polar(major ? 244 : 237, deg) };
});
const degreeLabels = Array.from({ length: 12 }, (_, index) => {
  const [x, y] = polar(258, index * 30);
  return { deg: index * 30, x, y };
});

/** The 27 nakshatra, 13°20′ each, as thin ticks inside the rashi ring. */
const nakshatraTicks = Array.from({ length: 27 }, (_, index) => {
  const deg = (index * 360) / 27;
  return { index, from: polar(160, deg), to: polar(170, deg) };
});
const nakshatraLabel = polar(150, 360 / 54);

/**
 * Three sample bodies on one circle. A and C sit exactly opposite each other, so by Thales'
 * theorem the angle at B is a right angle. The chords A–B and B–C span 120° and 60°.
 */
const A_DEG = 47.2;
const A = polar(145, A_DEG);
const B = polar(145, A_DEG + 120);
const D = polar(145, A_DEG + 180);

function towards(from: [number, number], to: [number, number], length: number): [number, number] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const norm = Math.hypot(dx, dy);
  return [(dx / norm) * length, (dy / norm) * length];
}
const toA = towards(B, A, 14);
const toD = towards(B, D, 14);
const square = [
  [B[0] + toA[0], B[1] + toA[1]],
  [B[0] + toA[0] + toD[0], B[1] + toA[1] + toD[1]],
  [B[0] + toD[0], B[1] + toD[1]],
].map(([x, y]) => `${round(x)} ${round(y)}`);
const rightLabel = [round(B[0] + (toA[0] + toD[0]) * 1.6), round(B[1] + (toA[1] + toD[1]) * 1.6)];
const midpoint = (p: [number, number], q: [number, number]) => [round((p[0] + q[0]) / 2), round((p[1] + q[1]) / 2)];
const chordAB = midpoint(A, B);
const chordBD = midpoint(B, D);

/** The arc from 0° to body A, with its value. */
const arcStart = polar(58, 0);
const arcEnd = polar(58, A_DEG);
const arcLabel = polar(84, A_DEG / 2);

const mono = { fontFamily: "var(--font-mono)" };

/**
 * The hero wheel: rashi ring, degree scale and nakshatra grid, with a worked angle, a right-angled
 * triangle of aspects, a faint orbit and faint formulas, and slowly orbiting bodies. Every value is
 * an example, not anyone's chart.
 */
export function ZodiacWheel({ label }: { label: string }) {
  return (
    <svg className={styles.wheel} role="img" aria-label={label} viewBox="-30 -30 540 540">
      <defs>
        <radialGradient id="zw-sun" cx="38%" cy="35%">
          <stop offset="0" stopColor="#FBE7B5" />
          <stop offset="1" stopColor="#D79B3C" />
        </radialGradient>
        <radialGradient id="zw-teal" cx="35%" cy="30%">
          <stop offset="0" stopColor="#C9F3E9" />
          <stop offset="1" stopColor="#3E9C8A" />
        </radialGradient>
        <radialGradient id="zw-coral" cx="35%" cy="30%">
          <stop offset="0" stopColor="#FBC9B1" />
          <stop offset="1" stopColor="#D2603A" />
        </radialGradient>
        <radialGradient id="zw-moon" cx="35%" cy="30%">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#B8B4AA" />
        </radialGradient>
      </defs>

      {/* Rashi ring */}
      <circle cx={C} cy={C} r="222" fill="var(--night-raised)" stroke="var(--line)" />
      <circle cx={C} cy={C} r="170" fill="var(--night)" stroke="var(--line)" />
      <g stroke="var(--line)">
        {Array.from({ length: 12 }, (_, index) => (
          <line key={index} x1={C} y1="18" x2={C} y2="70" transform={`rotate(${index * 30} ${C} ${C})`} />
        ))}
      </g>
      <g fill="var(--gold)" fontFamily="var(--font-sinhala)" fontSize="14" textAnchor="middle" dominantBaseline="middle">
        {labels.map((item) => (
          <text key={item.key} x={item.x} y={item.y}>
            {item.text}
          </text>
        ))}
      </g>

      {/* Degree scale */}
      <g stroke="var(--gold)" strokeLinecap="round">
        {ticks.map((tick) => (
          <line
            key={tick.deg}
            x1={tick.from[0]}
            y1={tick.from[1]}
            x2={tick.to[0]}
            y2={tick.to[1]}
            strokeOpacity={tick.major ? 0.9 : 0.4}
            strokeWidth={tick.major ? 1.4 : 1}
          />
        ))}
      </g>
      <g {...mono} fill="var(--ink-soft)" fontSize="11" textAnchor="middle" dominantBaseline="middle">
        {degreeLabels.map((item) => (
          <text key={item.deg} x={item.x} y={item.y}>
            {item.deg}°
          </text>
        ))}
      </g>

      {/* Nakshatra grid */}
      <g stroke="var(--teal)" strokeOpacity=".7">
        {nakshatraTicks.map((tick) => (
          <line key={tick.index} x1={tick.from[0]} y1={tick.from[1]} x2={tick.to[0]} y2={tick.to[1]} />
        ))}
      </g>
      <text x={nakshatraLabel[0]} y={nakshatraLabel[1]} {...mono} fill="var(--teal)" fontSize="10" textAnchor="middle">
        13°20′
      </text>

      {/* Crosshairs, orbits and a faint ellipse */}
      <g stroke="var(--line)" strokeDasharray="2 6">
        <line x1={C} y1="76" x2={C} y2="404" />
        <line x1="76" y1={C} x2="404" y2={C} />
      </g>
      <circle cx={C} cy={C} r="145" fill="none" stroke="var(--line)" />
      <circle cx={C} cy={C} r="120" fill="none" stroke="var(--line)" strokeDasharray="3 7" />
      <circle cx={C} cy={C} r="70" fill="none" stroke="var(--line)" strokeDasharray="3 7" />
      <g className={styles.measure}>
        <ellipse cx={C + 18} cy={C} rx="132" ry="104" fill="none" stroke="var(--ink-soft)" strokeOpacity=".5" strokeDasharray="1 5" />
        <circle cx={C + 36} cy={C} r="2" fill="var(--ink-soft)" />
        <text x={C + 36} y={C + 14} {...mono} fill="var(--ink-soft)" fontSize="10" textAnchor="middle">
          F₂
        </text>
        <text x="132" y="262" {...mono} fill="var(--ink-soft)" fontSize="10">
          e = 0.0167
        </text>
      </g>

      {/* Faint formulas */}
      <g className={styles.measure} {...mono} fill="var(--ink)" fillOpacity=".3" fontSize="11">
        <text x="96" y="214">E − e·sin E = M</text>
        <text x="292" y="306">Δλ = λ₂ − λ₁</text>
      </g>

      {/* Worked angle from 0° to A */}
      <g className={styles.measure}>
        <line x1={C} y1={C} x2={C} y2={C - 145} stroke="var(--gold)" strokeOpacity=".5" />
        <path d={`M${arcStart[0]} ${arcStart[1]} A58 58 0 0 1 ${arcEnd[0]} ${arcEnd[1]}`} fill="none" stroke="var(--gold)" strokeWidth="1.6" />
        <text x={arcLabel[0]} y={arcLabel[1]} {...mono} fill="var(--gold)" fontSize="12" textAnchor="middle" dominantBaseline="middle">
          47°12′
        </text>
      </g>

      {/* Aspect triangle with its right angle */}
      <g className={styles.measure}>
        <line x1={A[0]} y1={A[1]} x2={D[0]} y2={D[1]} stroke="var(--ink-soft)" strokeOpacity=".45" strokeDasharray="2 5" />
        <line x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} stroke="var(--gold)" strokeOpacity=".85" />
        <line x1={B[0]} y1={B[1]} x2={D[0]} y2={D[1]} stroke="var(--teal)" strokeOpacity=".85" />
        <path d={`M${square[0]} L${square[1]} L${square[2]}`} fill="var(--gold)" fillOpacity=".15" stroke="var(--gold)" strokeWidth="1.4" />
        <text x={rightLabel[0]} y={rightLabel[1]} {...mono} fill="var(--gold)" fontSize="12" textAnchor="middle" dominantBaseline="middle">
          90°
        </text>
        <text x={chordAB[0] + 16} y={chordAB[1] - 6} {...mono} fill="var(--gold)" fontSize="11">
          120°
        </text>
        <text x={chordBD[0] - 10} y={chordBD[1] + 4} {...mono} fill="var(--teal)" fontSize="11" textAnchor="end">
          60°
        </text>
        {[A, B, D].map((point) => (
          <g key={point.join()}>
            <circle cx={point[0]} cy={point[1]} r="8" fill="none" stroke="var(--gold)" />
            <circle cx={point[0]} cy={point[1]} r="2.5" fill="var(--gold)" />
          </g>
        ))}
      </g>

      {/* Sun and moving bodies */}
      <circle className={styles.glow} cx={C} cy={C} r="44" fill="var(--gold)" opacity=".12" />
      <circle cx={C} cy={C} r="26" fill="url(#zw-sun)" />
      <g className={styles.orbitA}>
        <circle cx={C} cy="120" r="10" fill="url(#zw-teal)" />
      </g>
      <g className={styles.orbitB}>
        <circle cx={C} cy="170" r="6.5" fill="url(#zw-coral)" />
      </g>
      <g className={styles.orbitC}>
        <circle cx="360" cy={C} r="5.5" fill="url(#zw-moon)" />
      </g>

      {/* Readouts in the corners */}
      <g className={styles.measure} {...mono} fontSize="12" fill="var(--ink-soft)">
        <text x="-26" y="-12">
          <tspan fill="var(--gold)">λ</tspan> 047°12′08″
        </text>
        <text x="506" y="-12" textAnchor="end">
          <tspan fill="var(--gold)">t</tspan> 06:42 +05:30
        </text>
        <text x="-26" y="504">
          <tspan fill="var(--gold)">lat</tspan> 6.93° N
        </text>
        <text x="506" y="504" textAnchor="end">
          <tspan fill="var(--gold)">lon</tspan> 79.86° E
        </text>
      </g>
    </svg>
  );
}
