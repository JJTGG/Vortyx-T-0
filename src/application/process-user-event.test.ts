import {
  describe,
  expect,
  it,
} from "vitest"
import type { Event } from "@/events/types"
import {
  ProactivityEngine,
} from "@/engine/engine"
import type {
  Recommendation,
} from "@/engine/types"
import type {
  IntelligenceProvider,
} from "@/intelligence/provider"
import {
  InMemoryInteractionDelivery,
} from "@/interaction/in-memory-delivery"
import {
  InMemoryUserStateStore,
} from "@/state/in-memory-store"
import {
  processUserEvent,
} from "@/application/process-user-event"

const event: Event = {
  id: "event-1",
  type: "user_signal",
  timestamp:
    "2026-09-22T04:00:00.000Z",
  source: "test",
  data: {
    value: "example",
  },
}

function createProvider(): IntelligenceProvider {
  const recommendation: Recommendation = {
    action: "SPEAK",
    reason: "Interaction is justified",
    evidence: [
      "Test evidence",
    ],
    message:
      "A proactive message.",
  }

  return {
    async evaluate() {
      return recommendation
    },
  }
}

describe("processUserEvent", () => {
  it("loads, processes, evolves, and persists user state", async () => {
    const stateStore =
      new InMemoryUserStateStore()

    const engine =
      new ProactivityEngine(
        createProvider(),
      )

    const delivery =
      new InMemoryInteractionDelivery()

    const result =
      await processUserEvent(
        "user-1",
        event,
        {
          stateStore,
          engine,
          delivery,
        },
      )

    expect(
      result.decision.action,
    ).toBe("SPEAK")

    expect(
      result.lifecycle,
    ).toBe("INITIATED")

    expect(
      result.state.recentEvents,
    ).toEqual([
      event,
    ])

    const persisted =
      await stateStore.get(
        "user-1",
      )

    expect(persisted).toEqual(
      result.state,
    )
  })

  it("uses persisted recent events on subsequent processing", async () => {
    const stateStore =
      new InMemoryUserStateStore()

    const engine =
      new ProactivityEngine(
        createProvider(),
      )

    const delivery =
      new InMemoryInteractionDelivery()

    const first =
      await processUserEvent(
        "user-1",
        event,
        {
          stateStore,
          engine,
          delivery,
        },
      )

    expect(
      first.decision.action,
    ).toBe("SPEAK")

    const second =
      await processUserEvent(
        "user-1",
        {
          ...event,
          id: "event-2",
        },
        {
          stateStore,
          engine,
          delivery,
        },
      )

    expect(
      second.decision.action,
    ).toBe("SILENCE")

    expect(
      second.decision.reason,
    ).toBe(
      "Duplicate event detected",
    )

    expect(
      second.state.recentEvents,
    ).toHaveLength(2)
  })

  it("does not process state belonging to another user", async () => {
    const stateStore =
      new InMemoryUserStateStore()

    await stateStore.save({
      userId: "different-user",
      preferences: {
        proactiveEnabled: true,
      },
      recentEvents: [],
    })

    const originalGet =
      stateStore.get.bind(
        stateStore,
      )

    stateStore.get = async () =>
      originalGet(
        "different-user",
      )

    const engine =
      new ProactivityEngine()

    const delivery =
      new InMemoryInteractionDelivery()

    await expect(
      processUserEvent(
        "user-1",
        event,
        {
          stateStore,
          engine,
          delivery,
        },
      ),
    ).rejects.toThrow(
      "State store returned state for a different user",
    )
  })

  it("rejects an empty user ID", async () => {
    const stateStore =
      new InMemoryUserStateStore()

    const engine =
      new ProactivityEngine()

    const delivery =
      new InMemoryInteractionDelivery()

    await expect(
      processUserEvent(
        "",
        event,
        {
          stateStore,
          engine,
          delivery,
        },
      ),
    ).rejects.toThrow(
      "User ID must not be empty",
    )
  })
})