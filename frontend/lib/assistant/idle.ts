/**
 * The chat's idle time limit (legal review, docs/09-launch.md). The AI service deletes a
 * conversation after this many minutes without a message (agent/app/memory.py,
 * ASTRONOMIA_AGENT_CONVERSATION_IDLE_MINUTES). The chat starts a new conversation after the
 * same time (components/assistant/IdleReset.tsx), so it never sends the old messages back.
 * Change both together, and the privacy notice with them.
 */
export const CONVERSATION_IDLE_MINUTES = 30;

/** How often the open page checks, as well as when the tab comes back into view. */
export const IDLE_CHECK_MS = 15_000;

/** True when a conversation last used at `lastUsed` (ms) has been idle for the full limit. */
export function isIdle(lastUsed: number, now: number, minutes: number = CONVERSATION_IDLE_MINUTES): boolean {
  return now - lastUsed >= minutes * 60_000;
}
