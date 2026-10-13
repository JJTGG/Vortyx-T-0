import { describe, expect, it } from "vitest"
import type { Event } from "@/events/types"
import type { UserState } from "@/state/types"
import { ProactivityEngine } from "@/engine/engine"

const event: Event = {
  id: "event-1",
  type: "unknown",
  timestamp: "2026-09-22T04:00:00.000Z",
  source: "test",
  data: {},
}

const state: UserState = {
  userId: "user-1",
  preferences: {
    proactiveEnabled: true,
  },
  recentEvents: [],
}

describe("engine default intelligence provider", () => {
  it("uses the rule-based provider when none is supplied", async () => {
    const engine = new ProactivityEngine()

    const decision = await engine.evaluate(
      event,
      state,
    )

    expect(decision.action).toBe("SILENCE")
    expect(decision.source).toBe("llm")
    expect(decision.reason).toBe(
      "No relevant feedback is available",
    )
  })
})