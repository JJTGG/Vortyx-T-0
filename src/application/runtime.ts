import path from "node:path"
import { ProactivityEngine } from "@/engine/engine"
import { InMemoryInteractionDelivery } from "@/interaction/in-memory-delivery"
import { InMemoryInteractionHistory } from "@/interaction/in-memory-history"
import { InMemoryDecisionLog } from "@/decision-log/in-memory"
import { InMemoryWaitQueue } from "@/wait/in-memory"
import { FileUserStateStore } from "@/state/file-store"
import type { ProcessUserEventDependencies } from "@/application/process-user-event"

export type VortyxRuntime = {
  dependencies: ProcessUserEventDependencies
}

function createRuntime(): VortyxRuntime {
  const stateStore = new FileUserStateStore(
    path.join(
      process.cwd(),
      ".vortyx",
      "state",
    ),
  )

  const interactionHistory =
    new InMemoryInteractionHistory()

  const dependencies: ProcessUserEventDependencies = {
    stateStore,
    engine: new ProactivityEngine(
      undefined,
      undefined,
      interactionHistory,
    ),
    delivery:
      new InMemoryInteractionDelivery(),
    decisionLog:
      new InMemoryDecisionLog(),
    interactionHistory,
    waitQueue:
      new InMemoryWaitQueue(),
  }

  return {
    dependencies,
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __vortyxRuntime:
    | VortyxRuntime
    | undefined
}

export function getVortyxRuntime(): VortyxRuntime {
  globalThis.__vortyxRuntime ??=
    createRuntime()

  return globalThis.__vortyxRuntime
}