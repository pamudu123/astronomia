/** How long a page that has just opened may still move: sections load, the router scrolls up. */
const SETTLE_MS = 3000;
const CHECK_MS = 100;
const TOUCHED = ["wheel", "touchstart", "pointerdown", "keydown"] as const;

/**
 * Scrolls to an element and keeps it in the top half of the screen while the page settles. Stops
 * as soon as the visitor scrolls, taps or types. Returns a way to stop it sooner.
 */
export function holdInView(element: HTMLElement): () => void {
  const show = () => {
    const { top } = element.getBoundingClientRect();
    if (top < 0 || top > window.innerHeight / 2) element.scrollIntoView({ block: "start" });
  };
  show();
  const checking = setInterval(show, CHECK_MS);
  const settled = setTimeout(stop, SETTLE_MS);
  function stop() {
    clearInterval(checking);
    clearTimeout(settled);
    for (const event of TOUCHED) window.removeEventListener(event, stop);
  }
  for (const event of TOUCHED) window.addEventListener(event, stop, { passive: true });
  return stop;
}
