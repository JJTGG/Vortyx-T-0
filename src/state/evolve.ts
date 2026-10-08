import type { Event } from "@/events/types"
import type { UserState } from "@/state/types"

const MAX_RECENT_EVENTS = 100

export function appendRecentEvent(
  state: UserState,
  event: Event,
): UserState {
  if (state.userId.trim().length === 0) {
    throw new Error("User state requires a user ID")
  }

  const recentEvents = [
    ...state.recentEvents,
    structuredClone(event),
  ].slice(-MAX_RECENT_EVENTS)

  return {
    ...state,
    recentEvents,
  }
}