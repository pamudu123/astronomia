// Turns data/raw/*.json into data/contexts/*.json with the website's own code
// (frontend/lib/assistant), loaded as it is through the frontend's vite. Run by step 1.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const frontend = join(here, "..", "frontend");
const require = createRequire(join(frontend, "package.json"));
const vite = await import(pathToFileURL(require.resolve("vite")).href);

const server = await vite.createServer({
  root: frontend,
  configFile: false,
  logLevel: "error",
  appType: "custom",
  cacheDir: join(here, "data", ".vite"),
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
  resolve: { alias: { "@": frontend } },
});
const pages = await server.ssrLoadModule("/lib/assistant/pages.ts");
const ctx = await server.ssrLoadModule("/lib/assistant/context.ts");
const panel = await server.ssrLoadModule("/lib/assistant/panel.ts");
const followups = await server.ssrLoadModule("/lib/assistant/followups.ts");

const out = join(here, "data", "contexts");

// `node build_contexts.mjs followups in.json out.json`: the browser's own safety net for the
// follow-up buttons, run on what the model wrote (step 3 uses it).
if (process.argv[2] === "followups") {
  const items = JSON.parse(readFileSync(process.argv[3], "utf8"));
  const kept = items.map(({ chips, context }) => chips.map((chip) => followups.answerable(chip, context)));
  writeFileSync(process.argv[4], JSON.stringify(kept));
  await server.close();
  process.exit(0);
}

const raw = (name) => JSON.parse(readFileSync(join(here, "data", "raw", `${name}.json`), "utf8"));
mkdirSync(out, { recursive: true });
const save = (name, value) => writeFileSync(join(out, `${name}.json`), JSON.stringify(value, null, 1) + "\n");

for (const lang of ["en", "si"]) {
  const r = (name) => raw(`${name}-${lang}`);
  const labels = r("labels");
  const chart = pages.chartReadingContext(r("hadahan"), labels, lang);
  const match = pages.matchReadingContext(r("match_full"), labels, lang, false, true);
  // What the chat gets.
  save(`chat-chart-${lang}`, pages.chartContext(r("hadahan"), labels, lang));
  save(`chat-chart_kasun-${lang}`, pages.chartContext(r("hadahan_kasun"), labels, lang));
  save(`chat-chart_dilki-${lang}`, pages.chartContext(r("hadahan_dilki"), labels, lang));
  save(`explain-chart_dilki-${lang}`, pages.chartReadingContext(r("hadahan_dilki"), labels, lang));
  save(`chat-match_full-${lang}`, ctx.matchContext(r("match_full"), labels, lang, false, true));
  save(`chat-match_quick-${lang}`, ctx.matchContext(r("match_quick"), labels, lang, false, true));
  save(`chat-match_shared-${lang}`, ctx.matchContext(r("match_full"), labels, lang, true));
  save(`chat-day-${lang}`, pages.dayContext(r("day"), null, lang));
  save(`chat-month-${lang}`, pages.monthContext(r("month"), lang));
  save(`chat-avurudu-${lang}`, pages.avuruduContext(r("avurudu"), lang));
  for (const page of ["home", "hadahan", "porondam", "nakath", "baby-names", "changes", "forecast", "kendara"])
    save(`chat-${page}-${lang}`, { page, language: lang });
  // What the written chapters get.
  save(`explain-chart-${lang}`, chart);
  save(`explain-chart_extra-${lang}`, pages.chartExtrasContext(chart, { journey: r("journey").journey, upcoming: r("upcoming") }));
  save(`explain-match-${lang}`, match);
  // For the held-out questions (2b_holdout.py).
  const kasun = pages.chartReadingContext(r("hadahan_kasun"), labels, lang);
  save(`explain-chart_kasun-${lang}`, kasun);
  save(
    `explain-chart_extra_kasun-${lang}`,
    pages.chartExtrasContext(kasun, { journey: r("journey_kasun").journey, upcoming: r("upcoming_kasun") }),
  );
  save(`explain-day2-${lang}`, pages.dayContext(r("day2"), null, lang));
  save(`explain-match_years-${lang}`, pages.coupleYearsContext(match, r("timeline").timeline, labels));
  save(`explain-day-${lang}`, pages.dayContext(r("day"), null, lang));
  save(`explain-avurudu-${lang}`, pages.avuruduContext(r("avurudu"), lang));
  save(`explain-change-${lang}`, pages.personalChangeContext(r("change"), lang));
}
save("chat-chart_unstable-en", pages.chartContext(raw("hadahan_unstable-en"), raw("labels-en"), "en"));
// How the page names its context, and what it asks the follow-up suggester for.
save("meta", {
  context_description: ctx.CONTEXT_DESCRIPTION,
  followups: { en: panel.followUpInstructions("en"), si: panel.followUpInstructions("si") },
});
await server.close();
process.exit(0);
