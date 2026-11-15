"use client";

import "@copilotkit/react-core/v2/styles.css";
import "./assistant.css";

import {
  CopilotKitProvider,
  CopilotSidebar,
  useAgentContext,
  useConfigureSuggestions,
  useCopilotKit,
} from "@copilotkit/react-core/v2";
import { usePathname } from "next/navigation";
import {
  type ReactElement,
  createContext,
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
import { fill } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";

// The agent's name, shared with app/api/copilotkit/route.ts.
const AGENT_ID = "guide";
// Wide enough for a match card later; the page keeps the rest on a laptop screen.
const PANEL_WIDTH = 400;

type Text = Dictionary["assistant"];
type Tools = Dictionary["allTools"];

type Panel = { t: Text; reading: string | null; close: () => void };
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

/** Sends the current page context to the agent with every message, and sets the suggestions. */
function ContextBridge({ value, t, chipsKey }: { value: PageContext; t: Text; chipsKey: PageKey | null }) {
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
  return null;
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
  const value = page ?? { page: pageFromPath(pathname), language: lang };
  const key = pageKey(value.page);
  const panel = useMemo<Panel>(
    () => ({
      t,
      reading: readingLabel(key, value.page, t, tools, Boolean(value.shared)),
      close: () => setOpen(false),
    }),
    [t, tools, key, value.page, value.shared],
  );

  return (
    <CopilotKitProvider runtimeUrl="/api/copilotkit" useSingleEndpoint agentId={AGENT_ID} enableInspector={false}>
      <ContextBridge value={value} t={t} chipsKey={key} />
      <PanelContext value={panel}>
        {/* "dark" switches CopilotKit to light text; assistant.css sets the site colours. */}
        <div className="dark assistant-theme">
          {!open && (
            <button ref={launcher} type="button" className="sidera-launcher" onClick={() => setOpen(true)}>
              <Sparkle size={18} />
              <span>{t.open}</span>
            </button>
          )}
          <CopilotSidebar
            open={open}
            onOpenChange={setOpen}
            width={PANEL_WIDTH}
            position="right"
            header={Header}
            // The launcher above replaces CopilotKit's round toggle button.
            toggleButton="sidera-hidden"
            welcomeScreen={Welcome}
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
