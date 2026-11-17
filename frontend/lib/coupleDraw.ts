/**
 * Draws the couple's road: the bride's road on the left and the groom's on the right, each
 * drawn by the same rules as the life road (lib/journeyDraw.ts).
 *
 * Before today the two roads run apart. From today they run side by side, tied by a gold
 * thread. Rain falls only when both are in hard going at once.
 */

import {
  type Couple,
  type CoupleStop,
  ROLES,
  type Role,
  ageOf,
  coupleYear,
  mistOf,
  periodOf,
  qualityOf,
} from "./coupleJourney";
import { ROAD_YEARS, fadeAt } from "./journey";
import {
  DARK,
  FAR,
  GOLD,
  INK,
  LAMP,
  MIST,
  NEAR,
  NIGHT,
  ROAD,
  ROAD_DARK,
  ROAD_LIT,
  type Rgb,
  SLICES,
  TONE,
  clamp,
  css,
  curve,
  drawLamp,
  drawMist,
  drawPlanet,
  drawRain,
  drawRock,
  drawSignpost,
  drawStars,
  hash,
  mix,
  slice,
  slope,
  toneAt,
} from "./journeyDraw";

export type CoupleText = {
  fonts: { display: string; body: string };
  names: Record<Role, string>;
  /** The line under each planet in the sky: the name and the main period. */
  sky: (role: Role, lord: string) => string;
  /** The word on a signpost. */
  short: (stop: CoupleStop) => string;
};

const SIDE: Record<Role, number> = { bride: -1, groom: 1 };
const THREAD = mix(GOLD, LAMP, 0.4);
/** How far apart the two lanes sit once they have joined, in road widths from the centre. */
const JOINED = 0.64;

type Thing =
  | { kind: "sign"; y: number; stop: CoupleStop }
  | { kind: "lamp"; y: number; role: Role }
  | { kind: "rock"; y: number; role: Role; k: number };

/** Returns the blur, in pixels, the canvas should carry at this place. */
export function drawCoupleRoad(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  couple: Couple,
  pos: number,
  text: CoupleText,
  /** Where the road's centre sits, as a share of the width (the card can cover the left). */
  centre = 0.5,
): number {
  const W = width;
  const H = height;
  const horizon = H * 0.4;
  const RW = Math.min(W * 0.3, 300);
  const LW = Math.max(RW, 230);
  const CX = W * centre;
  const bend = slope(pos);
  const here = curve(pos);
  const yOf = (d: number) => horizon + (H - horizon) * (NEAR / d);
  const xOf = (d: number) => CX + (curve(pos + d) - here - bend * d) * RW * 0.5 * (NEAR / d);
  const tone = (role: Role, y: number) => toneAt(couple.roads[role], Math.max(0, ageOf(couple, role, y)));
  const quality = (role: Role, y: number) => qualityOf(couple, role, y);
  // The two roads lean together over the five years before today, and stay joined after it.
  const apart = (y: number) =>
    JOINED + (y >= couple.today ? 0 : 0.95 * Math.pow(clamp((couple.today - y) / 5, 0, 1), 1.3));
  const half = (role: Role, y: number) => 0.5 * (1 + 0.22 * quality(role, y));

  const qb = quality("bride", pos);
  const qg = quality("groom", pos);
  const average = (qb + qg) / 2;
  const hardNow = Math.max(0, -average);
  const goodNow = Math.max(0, average);
  const bothHard = Math.max(0, -Math.max(qb, qg));
  const mist = (mistOf(couple, "bride", pos) + mistOf(couple, "groom", pos)) / 2;
  const fadeNow = fadeAt(pos + 1.5);
  const colour = mix(tone("bride", pos), tone("groom", pos), 0.5);

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

  // Sky: darker and emptier when the two roads are hard, brighter when they are good.
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, css(mix(mix(NIGHT, DARK, hardNow * 0.7), GLOW, fadeNow * 0.45)));
  sky.addColorStop(1, css(HORIZ));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, horizon + 1);
  const starAlpha = clamp((1 - 0.65 * mist) * (1 - 0.85 * hardNow) * (0.7 + 0.6 * goodNow) * (1 - fadeNow), 0, 1.3);
  drawStars(ctx, W, horizon, -bend * 14, starAlpha, goodNow);

  // Each person's planet, on their own side of the sky.
  const pr = clamp(Math.min(W, H) * 0.045, 12, 28);
  const spread = Math.min(W - CX, CX) * 0.52;
  ctx.globalAlpha = 1 - fadeNow * 0.8;
  for (const role of ROLES) {
    const lord = periodOf(couple, role, pos).lord;
    const px = CX + SIDE[role] * spread;
    const py = horizon * 0.3;
    drawPlanet(ctx, lord, px, py, pr, tone(role, pos));
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = css(INK, 0.85);
    ctx.font = `500 12px ${text.fonts.body}`;
    ctx.fillText(text.names[role], px, py + pr * 1.9 + 3, spread * 1.8);
    ctx.fillStyle = css(INK, 0.6);
    ctx.fillText(text.sky(role, lord), px, py + pr * 1.9 + 19, spread * 1.8);
  }
  ctx.globalAlpha = 1;

  // Ground and both roads, far to near.
  for (let i = SLICES - 1; i >= 0; i--) {
    const dn = slice(i);
    const df = slice(i + 1);
    const year = pos + (dn + df) / 2;
    const yN = yOf(dn);
    const yF = yOf(df);
    const xN = xOf(dn);
    const xF = xOf(df);
    const sN = NEAR / dn;
    const sF = NEAR / df;
    if (year > ROAD_YEARS) {
      ctx.fillStyle = css(GLOW);
      ctx.fillRect(0, yF, W, yN - yF + 1);
      continue;
    }
    const stripe = Math.floor(year * 3) % 2 === 0;
    const fade = 1 - fadeAt(year);
    const middle = (xN + xF) / 2;
    for (const role of ROLES) {
      const q = quality(role, year);
      const ground = mix(
        mix(mix(NIGHT, tone(role, year), (stripe ? 0.13 : 0.09) + 0.1 * Math.max(0, q)), DARK, Math.max(0, -q) * 0.55),
        MIST,
        mistOf(couple, role, year) * 0.22,
      );
      ctx.fillStyle = css(far(ground, year));
      if (role === "bride") ctx.fillRect(0, yF, middle + 1, yN - yF + 1);
      else ctx.fillRect(middle, yF, W - middle, yN - yF + 1);
    }
    for (const role of ROLES) {
      const q = quality(role, year);
      const hard = Math.max(0, -q);
      const good = Math.max(0, q);
      const era = mistOf(couple, role, year);
      const ragged = 1 + hard * (hash(Math.floor(year * 12) + (role === "groom" ? 31 : 0)) - 0.5) * 0.18;
      const cN = xN + SIDE[role] * apart(pos + dn) * RW * sN;
      const cF = xF + SIDE[role] * apart(pos + df) * RW * sF;
      const wN = RW * sN * half(role, pos + dn) * ragged;
      const wF = RW * sF * half(role, pos + df) * ragged;
      const surface = mix(mix(ROAD[stripe ? 0 : 1], ROAD_LIT, good * 0.6), ROAD_DARK, hard * 0.7);
      ctx.fillStyle = css(far(mix(surface, MIST, era * 0.14), year));
      quad(cF - wF, yF, cF + wF, yF, cN + wN, yN + 1, cN - wN, yN + 1);
      ctx.fillStyle = css(mix(tone(role, year), MIST, era * 0.55), (stripe ? 0.95 : 0.6) * (1 - 0.5 * hard) * fade);
      quad(cF - wF * 1.1, yF, cF - wF, yF, cN - wN, yN + 1, cN - wN * 1.1, yN + 1);
      quad(cF + wF, yF, cF + wF * 1.1, yF, cN + wN * 1.1, yN + 1, cN + wN, yN + 1);
    }
    // The thread that ties the two roads from today on.
    if (year >= couple.today) {
      const tN = RW * 0.03 * sN;
      const tF = RW * 0.03 * sF;
      ctx.fillStyle = css(THREAD, (stripe ? 0.95 : 0.7) * fade);
      quad(xF - tF, yF, xF + tF, yF, xN + tN, yN + 1, xN - tN, yN + 1);
    }
  }
  const haze = ctx.createLinearGradient(0, horizon, 0, horizon + (H - horizon) * 0.16);
  haze.addColorStop(0, css(HORIZ, 1));
  haze.addColorStop(1, css(HORIZ, 0));
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizon, W, (H - horizon) * 0.16);

  // Each name on its own road, a little way ahead.
  const ahead = 0.95;
  for (const role of ROLES) {
    const scale = NEAR / ahead;
    const lane = RW * scale * half(role, pos + ahead);
    ctx.fillStyle = css(INK, 0.55 * (1 - fadeNow));
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${clamp(lane * 0.42, 12, 22)}px ${text.fonts.display}`;
    ctx.fillText(text.names[role], xOf(ahead) + SIDE[role] * apart(pos + ahead) * RW * scale, yOf(ahead), lane * 1.8);
  }

  // Everything standing on the roads, collected and then drawn far to near.
  const from = pos + NEAR + 0.03;
  const to = pos + FAR;
  const things: Thing[] = [];
  for (const stop of couple.stops) {
    if (stop.y > from && stop.y < to && stop.kind !== "today") things.push({ kind: "sign", y: stop.y, stop });
  }
  ROLES.forEach((role, index) => {
    for (let k = Math.ceil(from * 4); k / 4 < to; k++) {
      const y = k / 4 + 0.06;
      if (quality(role, y) > 0.3) things.push({ kind: "lamp", y, role });
    }
    for (let k = Math.ceil(from * 8); k / 8 < to; k++) {
      const y = k / 8 + 0.04;
      const hard = -quality(role, y);
      if (hard > 0.25 && hash(k + index * 57) < hard * 0.95) things.push({ kind: "rock", y, role, k: k + index * 57 });
    }
  });
  things.sort((a, b) => b.y - a.y);

  for (const thing of things) {
    const d = thing.y - pos;
    const scale = NEAR / d;
    const x = xOf(d);
    const yb = yOf(d);
    const w = RW * scale;
    const alpha = clamp((FAR - d) / 2.5, 0, 1) * clamp((d - NEAR - 0.03) / 0.2, 0, 1) * (1 - fadeAt(thing.y));
    if (alpha <= 0.01) continue;
    ctx.globalAlpha = alpha;
    const role = thing.kind === "sign" ? (thing.stop.who === "both" ? null : thing.stop.who) : thing.role;
    const lane = role ? x + SIDE[role] * apart(thing.y) * w : x;
    const laneHalf = role ? w * half(role, thing.y) : 0;
    if (thing.kind === "lamp") {
      drawLamp(ctx, lane + SIDE[thing.role] * laneHalf * 1.3, yb, w);
    } else if (thing.kind === "rock") {
      drawRock(ctx, lane, yb, laneHalf, thing.k);
    } else {
      // A person's own stops stand on their outer side. Shared stops stand between the roads.
      const sx = role ? lane + SIDE[role] * laneHalf * 1.7 : x;
      drawSignpost(ctx, sx, yb, w, role ? TONE[thing.stop.tone] : THREAD, {
        label: text.short(thing.stop),
        year: String(coupleYear(couple, thing.stop.y)),
        size: Math.min(LW * 0.19 * scale, 19),
        font: text.fonts.body,
        width: W,
      });
    }
    ctx.globalAlpha = 1;
  }

  if (bothHard > 0.25) drawRain(ctx, W, H, pos, bothHard);
  if (mist > 0.01) drawMist(ctx, W, H, horizon, mist);
  // The far end: a soft light, never a stop.
  if (fadeNow > 0.01) {
    ctx.fillStyle = css(GLOW, 0.3 * fadeNow);
    ctx.fillRect(0, 0, W, H);
  }
  return Math.round(fadeNow * 6 * 2) / 2;
}
