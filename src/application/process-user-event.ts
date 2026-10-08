import type { Event } from "@/events/types"
import type { ProactivityEngine } from "@/engine/engine"
import type { InteractionDelivery } from "@/interaction/delivery"
import type { InteractionHistory } from "@/interaction/history"
import type { DecisionLog } from "@/decision-log/types"
import type { WaitQueue } from "@/wait/types"
import type { UserStateStore } from "@/state/store"
import type { UserState } from "@/state/types"
import {
  appendRecentEvent,
} from "@/state/evolve"
import {
  processEvent,
  type ProcessEventResult,
} from "@/application/process-event"

export type ProcessUserEventDependencies = {
  stateStore: UserStateStore
  engine: ProactivityEngine
  delivery: InteractionDelivery
  decisionLog?: DecisionLog
  interactionHistory?: InteractionHistory
  waitQueue?: WaitQueue
}

export type ProcessUserEventResult =
  ProcessEventResult & {
    state: UserState
  }

export async function processUserEvent(
  userId: string,
  event: Event,
  dependencies: ProcessUserEventDependencies,
): Promise<ProcessUserEventResult> {
  if (userId.trim().length === 0) {
    throw new Error(
      "User ID must not be empty",
    )
  }

  const state =
    await dependencies.stateStore.get(
      userId,
    )

  if (state.userId !== userId) {
    throw new Error(
      "State store returned state for a different user",
    )
  }

  const result =
    await processEvent(
      event,
      state,
      dependencies.engine,
      dependencies.delivery,
      dependencies.decisionLog,
      dependencies.interactionHistory,
      dependencies.waitQueue,
    )

  const nextState =
    appendRecentEvent(
      state,
      event,
    )

  await dependencies.stateStore.save(
    nextState,
  )

  return {
    ...result,
    state: nextState,
  }
}