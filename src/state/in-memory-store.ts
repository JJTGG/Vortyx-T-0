import type { UserStateStore } from "@/state/store"
import type { UserState } from "@/state/types"
import { createDefaultUserState } from "@/state/default"

export class InMemoryUserStateStore
  implements UserStateStore
{
  private readonly states = new Map<
    string,
    UserState
  >()

  async get(userId: string): Promise<UserState> {
    const state = this.states.get(userId)

    if (state === undefined) {
      const defaultState =
        createDefaultUserState(userId)

      this.states.set(
        userId,
        structuredClone(defaultState),
      )

      return structuredClone(defaultState)
    }

    return structuredClone(state)
  }

  async save(state: UserState): Promise<void> {
    if (state.userId.trim().length === 0) {
      throw new Error("User ID must not be empty")
    }

    this.states.set(
      state.userId,
      structuredClone(state),
    )
  }

  clear(): void {
    this.states.clear()
  }
}