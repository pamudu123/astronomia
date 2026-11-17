/**
 * Draws the life road on a canvas: a night road running to the horizon, seen from one age.
 *
 * Good going is wide, bright and lined with lamps. Hard going is narrow and broken, under a
 * dark sky with rain. Erashtaka lies over the road as mist. Past 92 the road softens into
 * light: it never stops, and it is the same length for everyone.
 */

import {
  ROAD_YEARS,
  type Road,
  type Tone,
  fadeAt,
  mistAt,
  periodIndex,
  qualityAt,
  yearAt,
} from "./journey";

export type Rgb = [number, number, number];

// The site's colours (app/globals.css), as numbers so they can be mixed.
export const TONE: Record<Tone, Rgb> = { good: [127, 214, 194], mixed: [127, 167, 217], careful: [240, 138, 93] };
export const NIGHT: Rgb = [11, 16, 38];
export const MIST: Rgb = [166, 174, 208];
export const GOLD: Rgb = [201, 164, 92];
export const INK: Rgb = [244, 241, 234];
export const DARK: Rgb = [4, 5, 12];
export const LAMP: Rgb = [255, 226, 160];

export const NEAR = 0.35; // years ahead of the viewer where the road meets the bottom edge
export const FAR = 11; // how many years ahead can be seen
export const SLICES = 150;

export type RoadText = {
  fonts: { display: string; body: string };
  /** The planet's name on a gate, and its short form on a sub period marker. */
  planet: (lord: string) => { name: string; short: string };
  /** "Jupiter main period", written under the planet in the sky. */
  sky: (lord: string) => string;
  /** The word on a signpost, by the kind of stop. */
  short: (kind: string) => string;
};

export const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
export const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
export const css = (c: Rgb, alpha = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${alpha})`;
export const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
export const slice = (i: number) => NEAR * Math.pow(FAR / NEAR, i / SLICES);
// The road's bends, so the way ahead is not a straight line.
export const curve = (y: number) => 5 * Math.sin(0.45 * y) + 3 * Math.sin(0.17 * y + 1);
export const slope = (y: number) => 2.25 * Math.cos(0.45 * y) + 0.51 * Math.cos(0.17 * y + 1);

// Stars and rain, placed once.
let seed = 7;
const random = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const STARS = Array.from({ length: 170 }, () => ({
  x: random(),
  y: Math.pow(random(), 1.4),
  r: 0.5 + random() * 1.1,
  a: 0.35 + random() * 0.65,
}));
const RAIN = Array.from({ length: 80 }, () => ({ x: random(), y: random(), l: 10 + random() * 14 }));

/** The period's colour at an age, easing into the next period's just before it begins. */
export function toneAt(road: Road, age: number): Rgb {
  const index = periodIndex(road, age);
  const period = road.periods[index];
  const next = road.periods[index + 1];
  const colour = TONE[period.tone];
  return next && period.e - age < 0.4 ? mix(colour, TONE[next.tone], 1 - (period.e - age) / 0.4) : colour;
}

type Thing =
  | { kind: "gate" | "sign"; y: number; index: number }
  | { kind: "mile"; y: number; lord: string }
  | { kind: "lamp"; y: number }
  | { kind: "rock"; y: number; k: number };

/** Returns the blur, in pixels, the canvas should carry at this age. */
export function drawRoad(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  road: Road,
  pos: number,
  text: RoadText,
  /** Where the road's centre sits, as a share of the width (the card can cover the left). */
  centre = 0.5,
): number {
  const W = width;
  const H = height;
  const horizon = H * 0.4;
  const RW = Math.min(W * 0.42, 400);
  const LW = Math.max(RW, 270);
  const CX = W * centre;
  const colour = toneAt(road, pos);
  const mist = mistAt(road, pos);
  const bend = slope(pos);
  const here = curve(pos);
  const quality = qualityAt(road, pos);
  const hardNow = Math.max(0, -quality);
  const goodNow = Math.max(0, quality);
  const fadeNow = fadeAt(pos + 1.5);
  const yOf = (d: number) => horizon + (H - horizon) * (NEAR / d);
  const xOf = (d: number) => CX + (curve(pos + d) - here - bend * d) * RW * 0.5 * (NEAR / d);
  const wide = (y: number) => 1 + 0.25 * qualityAt(road, y);

  let HORIZ = mix(NIGHT, mix(colour, MIST, mist * 0.6), clamp(0.3 + 0.22 * goodNow - 0.15 * hardNow, 0.1, 0.6));
  const GLOW = mix(mix(HORIZ, mix(INK, GOLD, 0.25), 0.4), INK, fadeNow * 0.3);
  HORIZ = mix(HORIZ, GLOW, fadeNow);
  const far = (c: Rgb, y: number) => mix(c, GLOW, fadeAt(y));
  const quad = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.lineTo(x4, y4);
    ctx.closePath();
    ctx.fill();
  };

  // Sky: darker and emptier in hard going, brighter in good going.
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, css(mix(mix(NIGHT, DARK, hardNow * 0.7), GLOW, fadeNow * 0.45)));
  sky.addColorStop(1, css(HORIZ));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, horizon + 1);
  const starAlpha = clamp((1 - 0.65 * mist) * (1 - 0.85 * hardNow) * (0.7 + 0.6 * goodNow) * (1 - fadeNow), 0, 1.3);
  drawStars(ctx, W, horizon, -bend * 14, starAlpha, goodNow);

  // The period's planet, in the sky.
  const lord = road.periods[periodIndex(road, pos)].lord;
  const pr = clamp(Math.min(W, H) * 0.055, 14, 34);
  const px = W * 0.86;
  const py = horizon * 0.3;
  ctx.globalAlpha = 1 - fadeNow * 0.8;
  drawPlanet(ctx, lord, px, py, pr, colour);
  ctx.fillStyle = css(INK, 0.8);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = `500 12px ${text.fonts.body}`;
  ctx.fillText(text.sky(lord), clamp(px, 70, W - 70), py + pr * 1.9 + 4);
  ctx.globalAlpha = 1;

  // Ground and road, far to near. Width, surface and edges follow the road's quality.
  for (let i = SLICES - 1; i >= 0; i--) {
    const dn = slice(i);
    const df = slice(i + 1);
    const year = pos + (dn + df) / 2;
    const yN = yOf(dn);
    const yF = yOf(df);
    const xN = xOf(dn);
    const xF = xOf(df);
    if (year > ROAD_YEARS) {
      ctx.fillStyle = css(GLOW);
      ctx.fillRect(0, yF, W, yN - yF + 1);
      continue;
    }
    const q = qualityAt(road, year);
    const hard = Math.max(0, -q);
    const good = Math.max(0, q);
    const ragged = 1 + hard * (hash(Math.floor(year * 12)) - 0.5) * 0.16;
    const wN = RW * (NEAR / dn) * wide(pos + dn) * ragged;
    const wF = RW * (NEAR / df) * wide(pos + df) * ragged;
    const tone = toneAt(road, Math.min(year, ROAD_YEARS - 0.01));
    const era = mistAt(road, year);
    const stripe = Math.floor(year * 3) % 2 === 0;
    const ground = mix(mix(mix(NIGHT, tone, (stripe ? 0.13 : 0.09) + 0.1 * good), DARK, hard * 0.55), MIST, era * 0.2);
    ctx.fillStyle = css(far(ground, year));
    ctx.fillRect(0, yF, W, yN - yF + 1);
    const base: Rgb = stripe ? [19, 26, 58] : [23, 31, 68];
    const surface = mix(mix(base, [50, 64, 126], good * 0.6), [8, 9, 19], hard * 0.7);
    ctx.fillStyle = css(far(mix(surface, MIST, era * 0.12), year));
    quad(xF - wF, yF, xF + wF, yF, xN + wN, yN + 1, xN - wN, yN + 1);
    const fade = 1 - fadeAt(year);
    ctx.fillStyle = css(mix(tone, MIST, era * 0.55), (stripe ? 0.95 : 0.6) * (1 - 0.5 * hard) * fade);
    quad(xF - wF * 1.07, yF, xF - wF, yF, xN - wN, yN + 1, xN - wN * 1.07, yN + 1);
    quad(xF + wF, yF, xF + wF * 1.07, yF, xN + wN * 1.07, yN + 1, xN + wN, yN + 1);
    if (stripe && hard < 0.5) {
      ctx.fillStyle = css(GOLD, (0.3 + 0.55 * good) * fade);
      quad(xF - wF * 0.025, yF, xF + wF * 0.025, yF, xN + wN * 0.025, yN + 1, xN - wN * 0.025, yN + 1);
    }
  }
  const haze = ctx.createLinearGradient(0, horizon, 0, horizon + (H - horizon) * 0.16);
  haze.addColorStop(0, css(HORIZ, 1));
  haze.addColorStop(1, css(HORIZ, 0));
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizon, W, (H - horizon) * 0.16);

  // Everything standing on the road, collected and then drawn far to near.
  const from = pos + NEAR + 0.03;
  const to = pos + FAR;
  const things: Thing[] = [];
  road.stops.forEach((stop, index) => {
    if (stop.y > from && stop.y < to && stop.kind !== "today") {
      things.push({ kind: stop.kind === "period" ? "gate" : "sign", y: stop.y, index });
    }
  });
  for (const sub of road.subs) {
    // The first sub period of a main period begins at its gate.
    if (sub.s > from && sub.s < to && sub.s > road.periods[sub.main].s + 0.05) {
      things.push({ kind: "mile", y: sub.s, lord: sub.lord });
    }
  }
  for (let k = Math.ceil(from * 4); k / 4 < to; k++) {
    const y = k / 4 + 0.06;
    if (qualityAt(road, y) > 0.3) things.push({ kind: "lamp", y });
  }
  for (let k = Math.ceil(from * 8); k / 8 < to; k++) {
    const y = k / 8 + 0.04;
    const hard = -qualityAt(road, y);
    if (hard > 0.25 && hash(k) < hard * 0.95) things.push({ kind: "rock", y, k });
  }
  things.sort((a, b) => b.y - a.y);

  for (const thing of things) {
    const d = thing.y - pos;
    const scale = NEAR / d;
    const x = xOf(d);
    const yb = yOf(d);
    const w = RW * scale * wide(thing.y);
    const alpha = clamp((FAR - d) / 2.5, 0, 1) * clamp((d - NEAR - 0.03) / 0.2, 0, 1) * (1 - fadeAt(thing.y));
    if (alpha <= 0.01) continue;
    ctx.globalAlpha = alpha;
    if (thing.kind === "lamp") {
      for (const side of [-1, 1]) drawLamp(ctx, x + side * w * 1.2, yb, w);
    } else if (thing.kind === "rock") {
      drawRock(ctx, x, yb, w, thing.k);
    } else if (thing.kind === "mile") {
      // A milestone at each change of sub period.
      drawMilestone(ctx, x + w * 1.14, yb, w, text.planet(thing.lord).short, text.fonts.body);
    } else {
      const stop = road.stops[thing.index];
      const tone = TONE[stop.tone];
      const year = String(yearAt(road, stop.y));
      if (thing.kind === "gate") {
        // A gate across the road where a main period begins.
        const gh = w * 1.5;
        const pw = Math.max(2, w * 0.08);
        const bh = Math.max(4, w * 0.3);
        ctx.fillStyle = css(mix(tone, NIGHT, 0.35));
        ctx.fillRect(x - w * 1.22 - pw / 2, yb - gh, pw, gh);
        ctx.fillRect(x + w * 1.22 - pw / 2, yb - gh, pw, gh);
        ctx.fillStyle = css([19, 26, 58]);
        ctx.strokeStyle = css(tone);
        ctx.lineWidth = Math.max(1, w * 0.02);
        ctx.fillRect(x - w * 1.32, yb - gh - bh, w * 2.64, bh);
        ctx.strokeRect(x - w * 1.32, yb - gh - bh, w * 2.64, bh);
        const size = Math.min(bh * 0.56, 30);
        if (size >= 6) {
          ctx.fillStyle = css(INK);
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = `${size}px ${text.fonts.display}`;
          const name = stop.lord ? text.planet(stop.lord).name.toUpperCase() : "";
          ctx.fillText(`${name}  ${year}`, x, yb - gh - bh / 2, w * 2.5);
        }
      } else {
        const side = thing.index % 2 ? 1 : -1;
        drawSignpost(ctx, x + side * w * 1.38, yb, w, tone, {
          label: text.short(stop.kind),
          year,
          size: Math.min(LW * 0.15 * scale, 19),
          font: text.fonts.body,
          width: W,
        });
      }
    }
    ctx.globalAlpha = 1;
  }

  if (hardNow > 0.3) drawRain(ctx, W, H, pos, hardNow);
  if (mist > 0.01) drawMist(ctx, W, H, horizon, mist);
  // The far end: a soft light, never a stop.
  if (fadeNow > 0.01) {
    ctx.fillStyle = css(GLOW, 0.3 * fadeNow);
    ctx.fillRect(0, 0, W, H);
  }
  return Math.round(fadeNow * 6 * 2) / 2;
}

/** The stars, shifted a little as the road bends. */
export function drawStars(
  ctx: CanvasRenderingContext2D,
  W: number,
  horizon: number,
  shift: number,
  alpha: number,
  grow: number,
): void {
  for (const star of STARS) {
    const x = (((star.x * W + shift) % W) + W) % W;
    ctx.fillStyle = css(INK, Math.min(1, star.a * alpha));
    ctx.beginPath();
    ctx.arc(x, star.y * horizon * 0.92, star.r * (1 + 0.35 * grow), 0, 6.3);
    ctx.fill();
  }
}

/** A period's planet in the sky: a disc with a halo. Rahu and Ketu are rings, Saturn has one. */
export function drawPlanet(
  ctx: CanvasRenderingContext2D,
  lord: string,
  px: number,
  py: number,
  pr: number,
  colour: Rgb,
): void {
  const halo = ctx.createRadialGradient(px, py, pr * 0.6, px, py, pr * 3.2);
  halo.addColorStop(0, css(colour, 0.35));
  halo.addColorStop(1, css(colour, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(px, py, pr * 3.2, 0, 6.3);
  ctx.fill();
  if (lord === "rahu" || lord === "ketu") {
    // The shadow planets: a ring, like an eclipse.
    ctx.strokeStyle = css(colour, 0.95);
    ctx.lineWidth = Math.max(2, pr * 0.16);
    ctx.beginPath();
    ctx.arc(px, py, pr * 0.9, 0, 6.3);
    ctx.stroke();
    return;
  }
  const disc = ctx.createRadialGradient(px - pr * 0.35, py - pr * 0.35, pr * 0.1, px, py, pr);
  disc.addColorStop(0, css(mix(colour, INK, 0.55)));
  disc.addColorStop(1, css(mix(colour, NIGHT, 0.25)));
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(px, py, pr, 0, 6.3);
  ctx.fill();
  if (lord === "saturn") {
    ctx.strokeStyle = css(mix(colour, INK, 0.4), 0.9);
    ctx.lineWidth = Math.max(1.5, pr * 0.1);
    ctx.beginPath();
    ctx.ellipse(px, py, pr * 1.75, pr * 0.45, -0.35, 0, 6.3);
    ctx.stroke();
  }
}

/** A lamp beside the road, where the going is good. w is the road's half width there. */
export function drawLamp(ctx: CanvasRenderingContext2D, lx: number, yb: number, w: number): void {
  const lh = w * 0.5;
  ctx.strokeStyle = css([96, 86, 66]);
  ctx.lineWidth = Math.max(1, w * 0.018);
  ctx.beginPath();
  ctx.moveTo(lx, yb);
  ctx.lineTo(lx, yb - lh);
  ctx.stroke();
  const glow = ctx.createRadialGradient(lx, yb - lh, 0, lx, yb - lh, w * 0.3);
  glow.addColorStop(0, css(LAMP, 0.55));
  glow.addColorStop(1, css(LAMP, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(lx, yb - lh, w * 0.3, 0, 6.3);
  ctx.fill();
  ctx.fillStyle = css(LAMP);
  ctx.beginPath();
  ctx.arc(lx, yb - lh, Math.max(1.2, w * 0.035), 0, 6.3);
  ctx.fill();
}

/** A crack across the road and a rock on it, where the going is hard. k picks their shape. */
export function drawRock(ctx: CanvasRenderingContext2D, x: number, yb: number, w: number, k: number): void {
  const h1 = hash(k + 0.3);
  const h2 = hash(k + 0.7);
  const h3 = hash(k + 1.9);
  ctx.strokeStyle = css(DARK, 0.9);
  ctx.lineWidth = Math.max(1, w * 0.02);
  const left = x - w * 0.9 * h1;
  const right = x + w * 0.9 * h2;
  ctx.beginPath();
  ctx.moveTo(left, yb);
  for (let step = 1; step <= 6; step++) {
    ctx.lineTo(left + ((right - left) * step) / 6, yb + (hash(k * 7 + step) - 0.5) * w * 0.07);
  }
  ctx.stroke();
  const rx = x + (h3 * 2 - 1) * w * 0.8;
  const rr = w * (0.06 + 0.08 * h1);
  ctx.fillStyle = css([7, 9, 20]);
  ctx.beginPath();
  ctx.moveTo(rx - rr, yb);
  ctx.lineTo(rx - rr * 0.6, yb - rr * 0.8);
  ctx.lineTo(rx + rr * 0.1, yb - rr * 1.1);
  ctx.lineTo(rx + rr * 0.8, yb - rr * 0.6);
  ctx.lineTo(rx + rr, yb);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = css(MIST, 0.4);
  ctx.lineWidth = Math.max(0.8, w * 0.01);
  ctx.beginPath();
  ctx.moveTo(rx - rr * 0.6, yb - rr * 0.8);
  ctx.lineTo(rx + rr * 0.1, yb - rr * 1.1);
  ctx.lineTo(rx + rr * 0.8, yb - rr * 0.6);
  ctx.stroke();
}

/** A milestone with a short word on it. mx is its left edge. */
export function drawMilestone(
  ctx: CanvasRenderingContext2D,
  mx: number,
  yb: number,
  w: number,
  label: string,
  font: string,
): void {
  const mw = w * 0.24;
  const mh = w * 0.3;
  ctx.fillStyle = css([27, 36, 80]);
  ctx.strokeStyle = css(MIST, 0.7);
  ctx.lineWidth = Math.max(0.8, w * 0.012);
  ctx.beginPath();
  ctx.moveTo(mx, yb);
  ctx.lineTo(mx, yb - mh * 0.7);
  ctx.quadraticCurveTo(mx + mw / 2, yb - mh * 1.15, mx + mw, yb - mh * 0.7);
  ctx.lineTo(mx + mw, yb);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  const size = Math.min(mw * 0.5, 16);
  if (size >= 7) {
    ctx.fillStyle = css(INK);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `500 ${size}px ${font}`;
    ctx.fillText(label, mx + mw / 2, yb - mh * 0.42);
  }
}

/** A signpost: a post with a light on top, and a word and a year above it once it is near. */
export function drawSignpost(
  ctx: CanvasRenderingContext2D,
  sx: number,
  yb: number,
  w: number,
  colour: Rgb,
  words: { label: string; year: string; size: number; font: string; width: number },
): void {
  const ph = w * 0.6;
  const r = Math.max(2, w * 0.1);
  ctx.strokeStyle = css(mix(colour, NIGHT, 0.4));
  ctx.lineWidth = Math.max(1, w * 0.03);
  ctx.beginPath();
  ctx.moveTo(sx, yb);
  ctx.lineTo(sx, yb - ph);
  ctx.stroke();
  ctx.shadowColor = css(colour, 0.9);
  ctx.shadowBlur = r * 2.2;
  ctx.fillStyle = css(colour);
  ctx.beginPath();
  ctx.arc(sx, yb - ph - r, r, 0, 6.3);
  ctx.fill();
  ctx.shadowBlur = 0;
  if (words.size >= 8) {
    const lx = clamp(sx, 56, words.width - 56);
    const ly = yb - ph - r * 2 - 6;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = css(INK);
    ctx.font = `500 ${words.size}px ${words.font}`;
    ctx.fillText(words.label, lx, ly);
    ctx.fillStyle = css(colour);
    ctx.font = `${words.size * 0.82}px ${words.font}`;
    ctx.fillText(words.year, lx, ly - words.size * 1.15);
  }
}

/** Rain across the whole picture, in hard going. */
export function drawRain(ctx: CanvasRenderingContext2D, W: number, H: number, pos: number, strength: number): void {
  ctx.strokeStyle = css(MIST, 0.3 * strength);
  ctx.lineWidth = 1;
  ctx.beginPath();
  const offset = (pos * 700) % H;
  for (const drop of RAIN) {
    const x = drop.x * (W + 60) - 30;
    const y = (drop.y * H + offset) % H;
    ctx.moveTo(x, y);
    ctx.lineTo(x - drop.l * 0.3, y + drop.l);
  }
  ctx.stroke();
}

/** Mist over the road, while inside Erashtaka. */
export function drawMist(ctx: CanvasRenderingContext2D, W: number, H: number, horizon: number, mist: number): void {
  const veil = ctx.createLinearGradient(0, horizon - H * 0.08, 0, H);
  veil.addColorStop(0, css(MIST, 0));
  veil.addColorStop(0.22, css(MIST, 0.34 * mist));
  veil.addColorStop(1, css(MIST, 0.07 * mist));
  ctx.fillStyle = veil;
  ctx.fillRect(0, horizon - H * 0.08, W, H);
}
