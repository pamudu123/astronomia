"use client";

import { useAgent, useCopilotChatConfiguration } from "@copilotkit/react-core/v2";
import { useEffect, useRef } from "react";

import { IDLE_CHECK_MS, isIdle } from "@/lib/assistant/idle";

/**
 * Starts a new chat once the conversation has been idle for the time limit (lib/assistant/idle.ts),
 * the same limit after which the AI service has deleted it. The old messages leave the panel and
 * are not sent again; the welcome screen says why (`onReset`).
 *
 * Rendered inside CopilotKit's chat (from the panel header), where `startNewThread` is available.
 */
export function IdleReset({ agentId, onReset }: { agentId: string; onReset: () => void }) {
  const { agent } = useAgent({ agentId, updates: [] });
  const chat = useCopilotChatConfiguration();
  const lastUsed = useRef(0);

  useEffect(() => {
    const touch = () => {
      lastUsed.current = Date.now();
    };
    touch();
    const subscription = agent.subscribe({ onMessagesChanged: touch, onRunFinalized: touch });
    return () => subscription.unsubscribe();
  }, [agent]);

  useEffect(() => {
    if (!chat) return;
    const check = () => {
      if (agent.isRunning || agent.messages.length === 0) return;
      if (!isIdle(lastUsed.current, Date.now())) return;
      chat.startNewThread();
      onReset();
    };
    const timer = window.setInterval(check, IDLE_CHECK_MS);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [agent, chat, onReset]);

  return null;
}
