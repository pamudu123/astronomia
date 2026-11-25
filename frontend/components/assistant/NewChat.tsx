"use client";

import { UseAgentUpdate, useAgent, useCopilotChatConfiguration } from "@copilotkit/react-core/v2";

/**
 * "New chat", in the panel's header: the messages leave the panel and are not sent again, the
 * same as the idle reset (IdleReset.tsx). Shown once there is something to clear, and off while
 * an answer is being written. It changes nothing about the chat limits: no question is used, and
 * none comes back.
 *
 * Rendered inside CopilotKit's chat (from the panel header), where `startNewThread` is available.
 */
export function NewChat({ agentId, label, onStart }: { agentId: string; label: string; onStart: () => void }) {
  const { agent } = useAgent({
    agentId,
    updates: [UseAgentUpdate.OnMessagesChanged, UseAgentUpdate.OnRunStatusChanged],
  });
  const chat = useCopilotChatConfiguration();
  if (!chat || agent.messages.length === 0) return null;
  return (
    <button
      type="button"
      className="sidera-panel-close sidera-panel-new"
      aria-label={label}
      title={label}
      disabled={agent.isRunning}
      onClick={() => {
        chat.startNewThread(); // clears the messages and the state kept with them
        onStart();
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-6M17.5 3.5a2.1 2.1 0 0 1 3 3L12.5 14.5 9 15l.5-3.5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
