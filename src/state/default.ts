import type { UserState } from "@/state/types"

export function createDefaultUserState(
  userId: string,
): UserState {
  if (userId.trim().length === 0) {
    throw new Error("User ID must not be empty")
  }

  return {
    userId,
    preferences: {
      proactiveEnabled: true,
    },
    recentEvents: [],
  }
}