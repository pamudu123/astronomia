"use client";

import "@copilotkit/react-core/v2/styles.css";
import "./assistant.css";

import {
  CopilotChatSuggestionView,
  CopilotKitProvider,
  CopilotSidebar,
  useAgentContext,
  useConfigureSuggestions,
  useCopilotKit,
} from "@copilotkit/react-core/v2";
import { usePathname } from "next/navigation";
import {
  type CSSProperties,
  type ComponentProps,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { CONTEXT_DESCRIPTION, type PageContext, type PageKey, pageFromPath, pageKey } from "@/lib/assistant/context";
import { pickFollowUps } from "@/lib/assistant/followups";
import { PANEL_MAX, PANEL_MIN, PANEL_WIDTH, clampWidth, followUpInstructions } from "@/lib/assistant/panel";
import { fill } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";

import { ToolCards } from "./ToolCards";

// The agents' names, shared with app/api/copilotkit/route.ts: the guide answers, the
// suggester writes the follow-up questions under each answer.
const AGENT_ID = "guide";
const SUGGEST_ID = "suggest";
// Where the width the person chose is remembered, in this browser only.
const WIDTH_KEY = "sidera.assistant.width";

type Text = Dictionary["assistant"];
type Tools = Dictionary["allTools"];

type Panel = { t: Text; reading: string | null; close: () => void; page: PageContext; fixed: ReadonlySet<string> };
const PanelContext = createContext<Panel | null>(null);

function usePanel(): Panel {
  const panel = useContext(PanelContext);
  if (!panel) throw new Error("usePanel outside the chat panel");
  return panel;
}

/** The four-point star used for the assistant everywhere: brass fading to sky blue. */
function Sparkle({ size = 20 }: { size?: number }) {
  // Each star has its own gradient: a shared id breaks when the star that defines it unmounts.
  const gradient = useId();
  return (
    <svg className="sidera-sparkle" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          {/* CSS variables work in style, not in SVG presentation attributes. */}
          <stop offset="0" style={{ stopColor: "var(--gold-hover)" }} />
          <stop offset="0.55" style={{ stopColor: "var(--gold)" }} />
          <stop offset="1" style={{ stopColor: "var(--sky)" }} />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gradient})`}
        d="M12 1.5c.5 4.9 2.4 8.4 9.9 10.5-7.5 2.1-9.4 5.6-9.9 10.5-.5-4.9-2.4-8.4-9.9-10.5 7.5-2.1 9.4-5.6 9.9-10.5Z"
      />
    </svg>
  );
}

/** Name, what the assistant is reading, and close. Replaces CopilotKit's header. */
function Header() {
  const { t, reading, close } = usePanel();
  return (
    <div className="sidera-panel-header">
      <Sparkle size={22} />
      <div className="sidera-panel-heading">
        <h2>{t.title}</h2>
        {reading && <p>{fill(t.reading, { page: reading })}</p>}
      </div>
      <button type="button" className="sidera-panel-close" aria-label={t.close} onClick={close}>
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

/** Before the first message: a greeting in the middle, suggestions, then the input. */
function Welcome({ input, suggestionView }: { input: ReactElement; suggestionView: ReactElement }) {
  const { t } = usePanel();
  return (
    <div className="sidera-welcome">
      <div className="sidera-welcome-hero">
        <Sparkle size={40} />
        <h3>{t.greeting}</h3>
        <p>{t.welcome}</p>
      </div>
      <div className="sidera-welcome-chips">{suggestionView}</div>
      <div className="sidera-welcome-input">{input}</div>
    </div>
  );
}

type SuggestionViewProps = ComponentProps<typeof CopilotChatSuggestionView>;

/**
 * The chips under an answer: only those Astro can answer in full from this page, as many as
 * that leaves, which may be none (lib/assistant/followups.ts). With none, nothing is drawn.
 */
const FollowUps = forwardRef<HTMLDivElement, SuggestionViewProps>(function FollowUps(
  { suggestions, loadingIndexes, onSelectSuggestion, ...rest },
  ref,
) {
  const { page, fixed } = usePanel();
  const picked = pickFollowUps(suggestions, page, loadingIndexes, fixed);
  if (picked.chips.length === 0) return null;
  return (
    <CopilotChatSuggestionView
      {...rest}
      ref={ref}
      suggestions={picked.chips}
      loadingIndexes={picked.loading}
      onSelectSuggestion={(suggestion, index) => onSelectSuggestion?.(suggestion, picked.original[index])}
    />
  );
});

/** The page's name for the "Reading: …" line: the tool's own name, as the tools page shows it. */
function readingLabel(key: PageKey | null, page: string, t: Text, tools: Tools, shared: boolean): string | null {
  if (shared) return t.shared;
  if (!key) return null;
  if (key === "home") return t.home;
  if (key === "tools") return tools.title;
  const year = page.match(/\b(19|20)\d\d\b/)?.[0] ?? String(new Date().getFullYear());
  return fill(tools.items[key].name, { year });
}

/**
 * Whether the agent has registered with CopilotKit. Static suggestions only load for a known
 * agent, and the agent list arrives from the runtime a moment after the chat mounts.
 */
function useAgentReady(): boolean {
  const { copilotkit } = useCopilotKit();
  return useSyncExternalStore(
    useCallback(
      (onChange: () => void) => {
        const subscription = copilotkit.subscribe({ onAgentsChanged: onChange });
        return () => subscription.unsubscribe();
      },
      [copilotkit],
    ),
    () => Boolean(copilotkit.getAgent(AGENT_ID)),
    () => false,
  );
}

/**
 * Sends the current page context to the agent with every message, and sets the suggestions:
 * the page's own questions before the first message, then follow-ups written after each answer.
 */
function ContextBridge({
  value,
  t,
  lang,
  chipsKey,
}: {
  value: PageContext;
  t: Text;
  lang: Locale;
  chipsKey: PageKey | null;
}) {
  useAgentContext({ description: CONTEXT_DESCRIPTION, value });
  const ready = useAgentReady();
  const chips = useMemo(() => {
    const own = chipsKey && chipsKey in t.chips ? t.chips[chipsKey as keyof Text["chips"]] : [];
    // The page's own questions and "What can you do?"; pages without their own get both general ones.
    const list = own.length ? [...own, t.chips.any[0]] : t.chips.any;
    return list.slice(0, 3).map((message) => ({ title: message, message }));
  }, [chipsKey, t]);
  useConfigureSuggestions(
    { suggestions: chips, available: "before-first-message", consumerAgentId: AGENT_ID },
    [chips, ready],
  );
  const instructions = useMemo(() => followUpInstructions(lang), [lang]);
  useConfigureSuggestions(
    {
      instructions,
      // No fixed count: only questions Astro can answer in full, usually one to three, and
      // none when nothing fits (FollowUps filters again on the page).
      minSuggestions: 0,
      maxSuggestions: 3,
      available: "after-first-message",
      providerAgentId: SUGGEST_ID,
      consumerAgentId: AGENT_ID,
    },
    [instructions, ready],
  );
  return null;
}

/** The width the person last chose, or the default. Storage can be missing or blocked. */
function savedWidth(): number {
  try {
    const saved = Number(window.localStorage.getItem(WIDTH_KEY));
    if (saved) return clampWidth(saved, window.innerWidth);
  } catch {
    // Private windows and blocked storage: use the default.
  }
  return PANEL_WIDTH;
}

/**
 * The panel's left edge, which people drag to make the chat wider or narrower (laptops only;
 * on a phone the panel covers the screen). Arrow keys move it too, Home goes back to the default.
 */
function ResizeHandle({ width, onChange, label }: { width: number; onChange: (w: number) => void; label: string }) {
  const frame = useRef(0);
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    // While dragging, the page follows the edge at once instead of easing after it.
    document.documentElement.classList.toggle("sidera-resizing", dragging);
    return () => document.documentElement.classList.remove("sidera-resizing");
  }, [dragging]);
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const next = clampWidth(window.innerWidth - event.clientX, window.innerWidth);
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => onChange(next));
  };
  const key = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 80 : 24;
    const next =
      event.key === "ArrowLeft"
        ? width + step
        : event.key === "ArrowRight"
          ? width - step
          : event.key === "Home"
            ? PANEL_WIDTH
            : null;
    if (next === null) return;
    event.preventDefault();
    onChange(clampWidth(next, window.innerWidth));
  };
  return (
    <div
      className="sidera-resize"
      data-dragging={dragging || undefined}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={PANEL_MIN}
      aria-valuemax={PANEL_MAX}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
      }}
      onPointerMove={move}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      onDoubleClick={() => onChange(PANEL_WIDTH)}
      onKeyDown={key}
    />
  );
}

/**
 * The CopilotKit chat, as a panel on the right like a browser's side panel. On a laptop it
 * pushes the page aside; on a phone it covers the screen. Loaded in the browser only, after
 * the page (see Assistant.tsx), so CopilotKit never runs during server rendering.
 */
export default function Chat({
  lang,
  t,
  tools,
  page,
}: {
  lang: Locale;
  t: Text;
  tools: Tools;
  page: PageContext | null;
}) {
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(savedWidth);
  const resize = useCallback((next: number) => {
    setWidth(next);
    try {
      window.localStorage.setItem(WIDTH_KEY, String(next));
    } catch {
      // Not remembered in private windows; the panel still resizes.
    }
  }, []);
  // A smaller window can leave a wide panel too wide: bring it back inside the limits.
  useEffect(() => {
    const fit = () => setWidth((current) => clampWidth(current, window.innerWidth));
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  const launcher = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  // Keyboard: Escape closes; opening moves focus to the input (laptops only, so phones don't
  // pop up the keyboard); closing returns focus to the launcher.
  useEffect(() => {
    if (!open) {
      if (wasOpen.current) launcher.current?.focus();
      return;
    }
    wasOpen.current = true;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const focus = window.setTimeout(() => {
      if (window.matchMedia("(min-width: 768px)").matches) {
        document.querySelector<HTMLElement>(".copilotKitSidebar textarea")?.focus();
      }
    }, 50);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(focus);
    };
  }, [open]);
  const pathname = usePathname();
  const value = useMemo(() => page ?? { page: pageFromPath(pathname), language: lang }, [page, pathname, lang]);
  const key = pageKey(value.page);
  const panel = useMemo<Panel>(
    () => ({
      t,
      reading: readingLabel(key, value.page, t, tools, Boolean(value.shared)),
      close: () => setOpen(false),
      page: value,
      // The site's own page questions, shown before the first message: never filtered.
      fixed: new Set(Object.values(t.chips).flat()),
    }),
    [t, tools, key, value],
  );

  return (
    <CopilotKitProvider runtimeUrl="/api/copilotkit" useSingleEndpoint agentId={AGENT_ID} enableInspector={false}>
      <ContextBridge value={value} t={t} lang={lang} chipsKey={key} />
      <ToolCards lang={lang} t={t.cards} />
      <PanelContext value={panel}>
        {/* "dark" switches CopilotKit to light text; assistant.css sets the site colours.
            The panel's width is a CSS variable: CopilotKit reads its width prop only once,
            but it measures the panel, so the page's margin follows the variable. */}
        <div className="dark assistant-theme" style={{ "--sidera-panel-width": `${width}px` } as CSSProperties}>
          {open && <ResizeHandle width={width} onChange={resize} label={t.resize} />}
          {!open && (
            <button ref={launcher} type="button" className="sidera-launcher" onClick={() => setOpen(true)}>
              <Sparkle size={18} />
              <span>{t.open}</span>
            </button>
          )}
          <CopilotSidebar
            open={open}
            onOpenChange={setOpen}
            position="right"
            header={Header}
            // The launcher above replaces CopilotKit's round toggle button.
            toggleButton="sidera-hidden"
            welcomeScreen={Welcome}
            suggestionView={FollowUps}
            labels={{
              modalHeaderTitle: t.title,
              sidebarLabel: t.title,
              welcomeMessageText: t.welcome,
              chatInputPlaceholder: t.placeholder,
              chatDisclaimerText: t.note,
              chatToggleOpenLabel: t.open,
              chatToggleCloseLabel: t.close,
            }}
            // No attachments or tools menu yet, so no "+" button.
            input={{ addMenuButton: () => null }}
          />
        </div>
      </PanelContext>
    </CopilotKitProvider>
  );
}
