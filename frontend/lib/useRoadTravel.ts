"use client";

import { type KeyboardEvent, type PointerEvent, useCallback, useEffect, useRef, useState } from "react";

export type RoadFonts = { display: string; body: string };

type Options = {
  /** Where the viewer starts, and the two ends they can travel between. */
  start: number;
  min: number;
  max: number;
  /** Draws the road as seen from a position, and returns the blur the canvas should carry. */
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number, pos: number, fonts: RoadFonts) => number;
  /** Called after every paint, so the page around the road can keep up. */
  onMove: (pos: number) => void;
};

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/**
 * Travelling along a road drawn on a canvas: by dragging, by the arrow keys, or by go().
 * The life road and the couple's road both use it.
 *
 * The position is kept outside React, so moving does not re-render the page on every frame.
 */
export function useRoadTravel({ start, min, max, draw, onMove }: Options) {
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const pos = useRef(start);
  const target = useRef(start);
  const frame = useRef(0);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [moved, setMoved] = useState(false);

  const paint = useCallback(() => {
    const element = canvas.current;
    const holder = stage.current;
    if (!element || !holder) return;
    // The canvas fills the stage on a laptop and sits above the card on a phone.
    const { width, height } = element.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (element.width !== Math.round(width * ratio) || element.height !== Math.round(height * ratio)) {
      element.width = Math.round(width * ratio);
      element.height = Math.round(height * ratio);
    }
    const context = element.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const fonts = {
      display: title.current ? getComputedStyle(title.current).fontFamily : "serif",
      body: getComputedStyle(holder).fontFamily,
    };
    const blur = draw(context, width, height, pos.current, fonts);
    element.style.filter = blur ? `blur(${blur}px)` : "none";
    onMove(pos.current);
  }, [draw, onMove]);

  const go = useCallback(
    (to: number) => {
      setMoved(true);
      target.current = clamp(to, min, max);
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const tick = () => {
        const gap = target.current - pos.current;
        if (still || Math.abs(gap) < 0.003) {
          pos.current = target.current;
          frame.current = 0;
        } else {
          pos.current += gap * 0.12;
          frame.current = requestAnimationFrame(tick);
        }
        paint();
      };
      if (!frame.current) frame.current = requestAnimationFrame(tick);
    },
    [min, max, paint],
  );

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const observer = new ResizeObserver(paint);
    observer.observe(element);
    // The web fonts can arrive after the first paint.
    void document.fonts?.ready.then(paint);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [paint]);

  const onKey = (event: KeyboardEvent<HTMLElement>) => {
    const step = event.shiftKey ? 5 : 0.5;
    if (event.key === "ArrowUp" || event.key === "ArrowRight") go(target.current + step);
    else if (event.key === "ArrowDown" || event.key === "ArrowLeft") go(target.current - step);
    else if (event.key === "Home") go(min);
    else if (event.key === "End") go(max);
    else return;
    event.preventDefault();
  };

  // Dragging the road: left or up moves forward. Vertical swipes on a phone still scroll the page.
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("[data-card]")) return;
    drag.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    go(target.current + (drag.current.x - event.clientX + (drag.current.y - event.clientY)) * 0.02);
    drag.current = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = () => {
    drag.current = null;
    setDragging(false);
  };

  return {
    stage,
    canvas,
    title,
    /** Where the viewer is heading. Read it in handlers, not while rendering. */
    target,
    go,
    dragging,
    /** Whether the viewer has travelled yet, by any means. */
    moved,
    onKey,
    /** Spread onto the stage element. */
    stageHandlers: { onKeyDown: onKey, onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}
