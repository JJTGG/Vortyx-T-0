import type { UserState } from "@/state/types"

export interface UserStateStore {
  get(userId: string): Promise<UserState>
  save(state: UserState): Promise<void>
}