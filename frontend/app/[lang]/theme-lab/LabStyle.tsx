import { Cormorant_Garamond } from "next/font/google";

const display = Cormorant_Garamond({ weight: ["500", "600"], subsets: ["latin"], display: "swap" });

/**
 * Swaps the display font for a more editorial serif and drops the code-style mono font, on
 * every page that holds [data-lab-theme]. The font name is generated, so it is set here, not in the css file.
 */
export function LabStyle() {
  const serif = `${display.style.fontFamily}, serif`;
  const css = `body:has([data-lab-theme]){--font-display:${serif},var(--font-serif-sinhala);--font-marcellus:${serif};--font-mono:var(--font-dm-sans),system-ui,sans-serif}`;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
