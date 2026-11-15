"use client";

import "@copilotkit/react-core/v2/styles.css";
import "./assistant.css";

import { CopilotKitProvider, CopilotPopup, useAgentContext } from "@copilotkit/react-core/v2";
import { usePathname } from "next/navigation";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { CONTEXT_DESCRIPTION, type PageContext, pageFromPath } from "@/lib/assistant/context";
import type { Locale } from "@/lib/i18n";

// The agent's name, shared with app/api/copilotkit/route.ts.
const AGENT_ID = "guide";

/** Sends the current page context to the agent with every message. */
function ContextBridge({ lang, page }: { lang: Locale; page: PageContext | null }) {
  const pathname = usePathname();
  const value = page ?? { page: pageFromPath(pathname), language: lang };
  useAgentContext({ description: CONTEXT_DESCRIPTION, value });
  return null;
}

/**
 * The CopilotKit chat. Loaded in the browser only, after the page (see Assistant.tsx), so
 * CopilotKit never runs during server rendering and stays out of the first page load.
 */
export default function Chat({
  lang,
  t,
  page,
}: {
  lang: Locale;
  t: Dictionary["assistant"];
  page: PageContext | null;
}) {
  return (
    <CopilotKitProvider
      runtimeUrl="/api/copilotkit"
      useSingleEndpoint
      agentId={AGENT_ID}
      enableInspector={false}
    >
      <ContextBridge lang={lang} page={page} />
      {/* "dark" switches CopilotKit to light text; assistant.css sets the site colours. */}
      <div className="dark assistant-theme">
        <CopilotPopup
          defaultOpen={false}
          labels={{
            modalHeaderTitle: t.title,
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
    </CopilotKitProvider>
  );
}
