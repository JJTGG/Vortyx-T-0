import { describe, expect, it } from "vitest"
import type { Event } from "@/events/types"
import type { Recommendation } from "@/engine/types"
import { ProactivityEngine } from "@/engine/engine"
import type { IntelligenceProvider } from "@/intelligence/provider"
import type { UserState } from "@/state/types"
import { InMemoryInteractionHistory } from "@/interaction/in-memory-history"

const unknownEvent: Event = {
  id: "event-1",
  type: "unknown",
  timestamp: "2026-01-01T10:00:00.000Z",
  source: "test",
  data: {},
}

const deterministicEvent: Event = {
  id: "event-2",
  type: "system",
  timestamp: "2026-01-01T10:00:00.000Z",
  source: "test",
  data: {},
}

const baseState: UserState = {
  userId: "user-1",
  preferences: {
    proactiveEnabled: true,
  },
  recentEvents: [],
}

class FixedProvider implements IntelligenceProvider {
  constructor(
    private readonly recommendation: Recommendation,
  ) {}

  async evaluate(): Promise<Recommendation> {
    return this.recommendation
  }
}

describe("ProactivityEngine", () => {
  it("returns SILENCE when proactive interactions are disabled", async () => {
    const engine = new ProactivityEngine()

    const decision = await engine.evaluate(
      unknownEvent,
      {
        ...baseState,
        preferences: {
          proactiveEnabled: false,
        },
      },
    )

    expect(decision).toEqual({
      action: "SILENCE",
      reason: "Proactive interactions are disabled",
      eventId: "event-1",
      source: "deterministic",
    })
  })

  it("returns SILENCE for duplicate events", async () => {
    const engine = new ProactivityEngine()

    const decision = await engine.evaluate(
      unknownEvent,
      {
        ...baseState,
        recentEvents: [
          {
            ...unknownEvent,
            id: "previous-event",
          },
        ],
      },
    )

    expect(decision).toEqual({
      action: "SILENCE",
      reason: "Duplicate event detected",
      eventId: "event-1",
      source: "deterministic",
    })
  })

  it("does not treat contradictory signals as duplicates", async () => {
    let calls = 0

    const provider: IntelligenceProvider = {
      async evaluate(
        event: Event,
      ): Promise<Recommendation> {
        calls += 1

        expect(event.data).toEqual({
          status: "active",
        })

        return {
          action: "SPEAK",
          reason: "The signal changed meaningfully",
          evidence: [
            "Current signal contradicts the previous signal",
          ],
          message: "The signal changed.",
        }
      },
    }

    const previousEvent: Event = {
      id: "previous-event",
      type: "user_signal",
      timestamp: "2026-01-01T09:59:00.000Z",
      source: "sensor",
      data: {
        status: "inactive",
      },
    }

    const currentEvent: Event = {
      id: "current-event",
      type: "user_signal",
      timestamp: "2026-01-01T10:00:00.000Z",
      source: "sensor",
      data: {
        status: "active",
      },
    }

    const engine = new ProactivityEngine(provider)

    const decision = await engine.evaluate(
      currentEvent,
      {
        ...baseState,
        recentEvents: [previousEvent],
      },
    )

    expect(calls).toBe(1)
    expect(decision.action).toBe("SPEAK")
    expect(decision.eventId).toBe("current-event")
  })

  it("evaluates a rapid sequence of distinct signals independently", async () => {
    let calls = 0

    const provider: IntelligenceProvider = {
      async evaluate(
        event: Event,
      ): Promise<Recommendation> {
        calls += 1

        expect(event.data).toEqual({
          value: calls,
        })

        return {
          action: "SPEAK",
          reason: "Distinct signal received",
          evidence: ["Signal contains a new value"],
          message: `Signal ${calls} received.`,
        }
      },
    }

    const events: Event[] = Array.from(
      { length: 10 },
      (_, index) => ({
        id: `flood-event-${index + 1}`,
        type: "user_signal",
        timestamp: `2026-01-01T10:00:00.${String(
          index,
        ).padStart(3, "0")}Z`,
        source: "sensor",
        data: {
          value: index + 1,
        },
      }),
    )

    const engine = new ProactivityEngine(provider)

    for (let index = 0; index < events.length; index += 1) {
      const decision = await engine.evaluate(
        events[index],
        {
          ...baseState,
          recentEvents: events.slice(0, index),
        },
      )

      expect(decision.action).toBe("SPEAK")
      expect(decision.eventId).toBe(events[index].id)
    }

    expect(calls).toBe(10)
  })

  it("evaluates concurrent distinct signals independently", async () => {
    const evaluatedEventIds: string[] = []

    const provider: IntelligenceProvider = {
      async evaluate(
        event: Event,
      ): Promise<Recommendation> {
        await new Promise((resolve) => {
          setTimeout(resolve, 0)
        })

        evaluatedEventIds.push(event.id)

        return {
          action: "SPEAK",
          reason: "Concurrent signal received",
          evidence: ["Signal was evaluated independently"],
          message: `Signal ${event.id} received.`,
        }
      },
    }

    const events: Event[] = Array.from(
      { length: 10 },
      (_, index) => ({
        id: `concurrent-event-${index + 1}`,
        type: "user_signal",
        timestamp: `2026-01-01T10:01:00.${String(
          index,
        ).padStart(3, "0")}Z`,
        source: "sensor",
        data: {
          value: index + 1,
        },
      }),
    )

    const engine = new ProactivityEngine(provider)

    const decisions = await Promise.all(
      events.map((event) =>
        engine.evaluate(event, baseState),
      ),
    )

    expect(decisions).toHaveLength(10)
    expect(evaluatedEventIds).toHaveLength(10)
    expect(new Set(evaluatedEventIds).size).toBe(10)

    for (let index = 0; index < events.length; index += 1) {
      expect(decisions[index].action).toBe("SPEAK")
      expect(decisions[index].eventId).toBe(
        events[index].id,
      )
    }
  })

  it("handles concurrent events with mixed outcomes independently", async () => {
    let providerCalls = 0

    const provider: IntelligenceProvider = {
      async evaluate(
        event: Event,
      ): Promise<Recommendation> {
        providerCalls += 1

        await new Promise((resolve) => {
          setTimeout(resolve, 0)
        })

        switch (event.data.mode) {
          case "speak":
            return {
              action: "SPEAK",
              reason: "Immediate interaction is justified",
              evidence: ["Concurrent event requires interaction"],
              message: "A proactive response is justified.",
            }

          case "wait":
            return {
              action: "WAIT",
              reason: "More information is needed",
              evidence: ["Timing is still uncertain"],
              reconsiderWhen: {
                type: "time",
                at: "2026-01-01T10:05:00.000Z",
              },
              expiresAt: "2026-01-01T11:00:00.000Z",
            }

          case "invalid":
            return {
              action: "SPEAK",
              reason: "",
              evidence: [],
              message: "",
            }

          case "fail":
            throw new Error("Concurrent provider failure")

          default:
            throw new Error(
              `Unexpected test mode: ${String(
                event.data.mode,
              )}`,
            )
        }
      },
    }

    const events: Event[] = [
      {
        id: "mixed-speak",
        type: "user_signal",
        timestamp: "2026-01-01T10:02:00.000Z",
        source: "sensor",
        data: {
          mode: "speak",
        },
      },
      {
        id: "mixed-wait",
        type: "user_signal",
        timestamp: "2026-01-01T10:02:01.000Z",
        source: "sensor",
        data: {
          mode: "wait",
        },
      },
      {
        id: "mixed-invalid",
        type: "user_signal",
        timestamp: "2026-01-01T10:02:02.000Z",
        source: "sensor",
        data: {
          mode: "invalid",
        },
      },
      {
        id: "mixed-fail",
        type: "user_signal",
        timestamp: "2026-01-01T10:02:03.000Z",
        source: "sensor",
        data: {
          mode: "fail",
        },
      },
      {
        id: "mixed-deterministic",
        type: "system",
        timestamp: "2026-01-01T10:02:04.000Z",
        source: "system",
        data: {},
      },
    ]

    const engine = new ProactivityEngine(provider)

    const decisions = await Promise.all(
      events.map((event) =>
        engine.evaluate(event, baseState),
      ),
    )

    expect(providerCalls).toBe(4)

    expect(decisions[0]).toEqual({
      action: "SPEAK",
      reason: "Immediate interaction is justified",
      eventId: "mixed-speak",
      source: "llm",
      recommendation: {
        action: "SPEAK",
        reason: "Immediate interaction is justified",
        evidence: ["Concurrent event requires interaction"],
        message: "A proactive response is justified.",
      },
    })

    expect(decisions[1]).toEqual({
      action: "WAIT",
      reason: "More information is needed",
      eventId: "mixed-wait",
      source: "llm",
      recommendation: {
        action: "WAIT",
        reason: "More information is needed",
        evidence: ["Timing is still uncertain"],
        reconsiderWhen: {
          type: "time",
          at: "2026-01-01T10:05:00.000Z",
        },
        expiresAt: "2026-01-01T11:00:00.000Z",
      },
    })

    expect(decisions[2]).toEqual({
      action: "SILENCE",
      reason:
        "Intelligence provider returned an invalid recommendation",
      eventId: "mixed-invalid",
      source: "deterministic",
    })

    expect(decisions[3].action).toBe("WAIT")
    expect(decisions[3].reason).toBe(
      "Intelligence provider failed",
    )
    expect(decisions[3].eventId).toBe("mixed-fail")
    expect(decisions[3].source).toBe("deterministic")
    expect(decisions[3].recommendation?.action).toBe("WAIT")

    expect(decisions[4]).toEqual({
      action: "SILENCE",
      reason:
        "System events can be handled deterministically",
      eventId: "mixed-deterministic",
      source: "deterministic",
    })
  })

  it("handles shared interaction history correctly across concurrent evaluations", async () => {
    const history = new InMemoryInteractionHistory()
    let providerCalls = 0

    const provider: IntelligenceProvider = {
      async evaluate(
        event: Event,
      ): Promise<Recommendation> {
        providerCalls += 1

        await new Promise((resolve) => {
          setTimeout(resolve, 0)
        })

        return {
          action: "SPEAK",
          reason: "Concurrent signal requires interaction",
          evidence: ["No interaction cooldown was active"],
          message: `Interaction for ${event.id}.`,
        }
      },
    }

    const engine = new ProactivityEngine(
      provider,
      undefined,
      history,
    )

    const initialEvents: Event[] = Array.from(
      { length: 10 },
      (_, index) => ({
        id: `history-event-${index + 1}`,
        type: "user_signal",
        timestamp: `2026-01-01T10:10:00.${String(
          index,
        ).padStart(3, "0")}Z`,
        source: "sensor",
        data: {
          value: index + 1,
        },
      }),
    )

    const initialDecisions = await Promise.all(
      initialEvents.map((event) =>
        engine.evaluate(event, baseState),
      ),
    )

    expect(initialDecisions).toHaveLength(10)
    expect(
      initialDecisions.every(
        (decision) => decision.action === "SPEAK",
      ),
    ).toBe(true)
    expect(providerCalls).toBe(10)

    history.record({
      eventId: "recorded-interaction",
      message: "Recent proactive interaction",
      reason: "Stress test interaction",
      initiatedAt: "2026-01-01T10:15:00.000Z",
    })

    const cooldownEvents: Event[] = Array.from(
      { length: 10 },
      (_, index) => ({
        id: `cooldown-event-${index + 1}`,
        type: "user_signal",
        timestamp: `2026-01-01T10:20:00.${String(
          index,
        ).padStart(3, "0")}Z`,
        source: "sensor",
        data: {
          value: index + 1,
        },
      }),
    )

    const cooldownDecisions = await Promise.all(
      cooldownEvents.map((event) =>
        engine.evaluate(event, baseState),
      ),
    )

    expect(cooldownDecisions).toHaveLength(10)
    expect(
      cooldownDecisions.every(
        (decision) =>
          decision.action === "SILENCE" &&
          decision.reason ===
            "Proactive interaction cooldown is active" &&
          decision.source === "deterministic",
      ),
    ).toBe(true)

    expect(providerCalls).toBe(10)
  })

  it("silences when the proactive interaction cooldown is active", async () => {
    const history = new InMemoryInteractionHistory()

    history.record({
      eventId: "previous-event",
      message: "Previous proactive message",
      reason: "Previous interaction",
      initiatedAt: "2026-01-01T09:45:00.000Z",
    })

    const provider: IntelligenceProvider = {
      async evaluate(): Promise<Recommendation> {
        throw new Error(
          "Provider should not be called during cooldown",
        )
      },
    }

    const engine = new ProactivityEngine(
      provider,
      undefined,
      history,
    )

    const decision = await engine.evaluate(
      unknownEvent,
      baseState,
    )

    expect(decision).toEqual({
      action: "SILENCE",
      reason: "Proactive interaction cooldown is active",
      eventId: "event-1",
      source: "deterministic",
    })
  })

  it("tests the exact proactive cooldown boundary", async () => {
    const history = new InMemoryInteractionHistory()
    let providerCalls = 0

    history.record({
      eventId: "boundary-interaction",
      message: "Boundary interaction",
      reason: "Cooldown boundary stress test",
      initiatedAt: "2026-01-01T10:00:00.000Z",
    })

    const provider: IntelligenceProvider = {
      async evaluate(
        event: Event,
      ): Promise<Recommendation> {
        providerCalls += 1

        return {
          action: "SPEAK",
          reason: "Cooldown has ended",
          evidence: ["Event is at or beyond the cooldown boundary"],
          message: `Boundary event ${event.id}.`,
        }
      },
    }

    const engine = new ProactivityEngine(
      provider,
      undefined,
      history,
    )

    const beforeBoundary: Event = {
      id: "boundary-before",
      type: "user_signal",
      timestamp: "2026-01-01T10:29:59.999Z",
      source: "sensor",
      data: {
        position: "before",
      },
    }

    const exactBoundary: Event = {
      id: "boundary-exact",
      type: "user_signal",
      timestamp: "2026-01-01T10:30:00.000Z",
      source: "sensor",
      data: {
        position: "exact",
      },
    }

    const afterBoundary: Event = {
      id: "boundary-after",
      type: "user_signal",
      timestamp: "2026-01-01T10:30:00.001Z",
      source: "sensor",
      data: {
        position: "after",
      },
    }

    const beforeDecision = await engine.evaluate(
      beforeBoundary,
      baseState,
    )

    expect(beforeDecision).toEqual({
      action: "SILENCE",
      reason: "Proactive interaction cooldown is active",
      eventId: "boundary-before",
      source: "deterministic",
    })

    expect(providerCalls).toBe(0)

    const exactDecision = await engine.evaluate(
      exactBoundary,
      baseState,
    )

    expect(exactDecision.action).toBe("SPEAK")
    expect(exactDecision.eventId).toBe("boundary-exact")
    expect(exactDecision.source).toBe("llm")
    expect(providerCalls).toBe(1)

    const afterDecision = await engine.evaluate(
      afterBoundary,
      baseState,
    )

    expect(afterDecision.action).toBe("SPEAK")
    expect(afterDecision.eventId).toBe("boundary-after")
    expect(afterDecision.source).toBe("llm")
    expect(providerCalls).toBe(2)
  })

  it("handles deterministic events without consulting intelligence", async () => {
    const provider = new FixedProvider({
      action: "SPEAK",
      reason: "Should not be used",
      evidence: ["test"],
      message: "Should not be used",
    })

    const engine = new ProactivityEngine(provider)

    const decision = await engine.evaluate(
      deterministicEvent,
      baseState,
    )

    expect(decision).toEqual({
      action: "SILENCE",
      reason: "System events can be handled deterministically",
      eventId: "event-2",
      source: "deterministic",
    })
  })

  it("uses the rule-based provider when no provider is supplied", async () => {
    const engine = new ProactivityEngine()

    const decision = await engine.evaluate(
      unknownEvent,
      baseState,
    )

    expect(decision).toEqual({
      action: "SILENCE",
      reason: "No relevant feedback is available",
      eventId: "event-1",
      source: "llm",
      recommendation: {
        action: "SILENCE",
        reason: "No relevant feedback is available",
        evidence: [
          "Event type: unknown",
          "Evaluation context contains no feedback",
        ],
      },
    })
  })

  it("preserves a valid WAIT recommendation from an intelligence provider", async () => {
    const recommendation: Recommendation = {
      action: "WAIT",
      reason: "Need more time",
      evidence: ["Timing is uncertain"],
      reconsiderWhen: {
        type: "time",
        at: "2026-01-01T10:05:00.000Z",
      },
      expiresAt: "2026-01-01T11:00:00.000Z",
    }

    const engine = new ProactivityEngine(
      new FixedProvider(recommendation),
    )

    const decision = await engine.evaluate(
      unknownEvent,
      baseState,
    )

    expect(decision).toEqual({
      action: "WAIT",
      reason: "Need more time",
      eventId: "event-1",
      source: "llm",
      recommendation,
    })
  })

  it("silences when the intelligence provider returns an invalid recommendation", async () => {
    const provider = {
      async evaluate(): Promise<Recommendation> {
        return {
          action: "SPEAK",
          reason: "",
          evidence: [],
          message: "",
        }
      },
    }

    const engine = new ProactivityEngine(provider)

    const decision = await engine.evaluate(
      unknownEvent,
      baseState,
    )

    expect(decision).toEqual({
      action: "SILENCE",
      reason:
        "Intelligence provider returned an invalid recommendation",
      eventId: "event-1",
      source: "deterministic",
    })
  })

  it("does not call the provider when a deterministic rule already resolves the event", async () => {
    let calls = 0

    const provider: IntelligenceProvider = {
      async evaluate(): Promise<Recommendation> {
        calls += 1

        return {
          action: "SPEAK",
          reason: "Should not be used",
          evidence: ["test"],
          message: "Should not be used",
        }
      },
    }

    const engine = new ProactivityEngine(provider)

    await engine.evaluate(
      deterministicEvent,
      baseState,
    )

    expect(calls).toBe(0)
  })

  it("returns a bounded WAIT when the intelligence provider fails", async () => {
    const provider: IntelligenceProvider = {
      async evaluate(): Promise<Recommendation> {
        throw new Error("Provider failed")
      },
    }

    const engine = new ProactivityEngine(provider)

    const decision = await engine.evaluate(
      unknownEvent,
      baseState,
    )

    expect(decision.action).toBe("WAIT")
    expect(decision.source).toBe("deterministic")
    expect(decision.recommendation?.action).toBe("WAIT")
  })

  it("silences when a provider fails and the event timestamp is invalid", async () => {
    const provider: IntelligenceProvider = {
      async evaluate(): Promise<Recommendation> {
        throw new Error("Provider failed")
      },
    }

    const malformedEvent: Event = {
      id: "malformed-timestamp",
      type: "unknown",
      timestamp: "not-a-timestamp",
      source: "test",
      data: {},
    }

    const engine = new ProactivityEngine(provider)

    const decision = await engine.evaluate(
      malformedEvent,
      baseState,
    )

    expect(decision).toEqual({
      action: "SILENCE",
      reason:
        "Cannot create bounded WAIT from an invalid event timestamp",
      eventId: "malformed-timestamp",
      source: "deterministic",
    })
  })

  it("handles hostile event data without throwing", async () => {
    const provider: IntelligenceProvider = {
      async evaluate(
        event: Event,
      ): Promise<Recommendation> {
        return {
          action: "SPEAK",
          reason: "Hostile data was handled safely",
          evidence: [
            `Received data of type ${typeof event.data}`,
          ],
          message: "The event was handled safely.",
        }
      },
    }

    const hostileEvents: Event[] = [
      {
        id: "hostile-null",
        type: "user_signal",
        timestamp: "2026-01-01T10:00:00.000Z",
        source: "test",
        data: {
          value: null,
        },
      },
      {
        id: "hostile-empty",
        type: "user_signal",
        timestamp: "2026-01-01T10:01:00.000Z",
        source: "test",
        data: {
          value: "",
        },
      },
      {
        id: "hostile-array",
        type: "user_signal",
        timestamp: "2026-01-01T10:02:00.000Z",
        source: "test",
        data: {
          value: [null, "", 42, true],
        },
      },
      {
        id: "hostile-nested",
        type: "user_signal",
        timestamp: "2026-01-01T10:03:00.000Z",
        source: "test",
        data: {
          value: {
            level1: {
              level2: {
                level3: {
                  value: "hostile",
                },
              },
            },
          },
        },
      },
      {
        id: "hostile-long",
        type: "user_signal",
        timestamp: "2026-01-01T10:04:00.000Z",
        source: "test",
        data: {
          value: "x".repeat(100_000),
        },
      },
    ]

    const engine = new ProactivityEngine(provider)

    for (const event of hostileEvents) {
      await expect(
        engine.evaluate(event, baseState),
      ).resolves.toMatchObject({
        action: "SPEAK",
        eventId: event.id,
        source: "llm",
      })
    }
  })

  it("keeps WAITING when the reconsideration condition has not been met", async () => {
    const wait: Recommendation = {
      action: "WAIT",
      reason: "Need more time",
      evidence: [],
      reconsiderWhen: {
        type: "time",
        at: "2026-01-01T10:05:00.000Z",
      },
      expiresAt: "2026-01-01T11:00:00.000Z",
    }

    const engine = new ProactivityEngine()

    const decision =
      await engine.evaluateReconsideredWait(
        wait,
        unknownEvent,
        baseState,
        "2026-01-01T10:02:00.000Z",
      )

    expect(decision.action).toBe("WAIT")
    expect(decision.source).toBe("deterministic")
    expect(decision.recommendation).toEqual(wait)
  })

  it("silences an expired WAIT", async () => {
    const wait: Recommendation = {
      action: "WAIT",
      reason: "Need more time",
      evidence: [],
      reconsiderWhen: {
        type: "time",
        at: "2026-01-01T10:05:00.000Z",
      },
      expiresAt: "2026-01-01T11:00:00.000Z",
    }

    const engine = new ProactivityEngine()

    const decision =
      await engine.evaluateReconsideredWait(
        wait,
        unknownEvent,
        baseState,
        "2026-01-01T11:00:00.000Z",
      )

    expect(decision.action).toBe("SILENCE")
    expect(decision.source).toBe("deterministic")
  })

  it("re-runs evaluation when a WAIT should be reconsidered", async () => {
    const wait: Recommendation = {
      action: "WAIT",
      reason: "Need more time",
      evidence: [],
      reconsiderWhen: {
        type: "time",
        at: "2026-01-01T10:05:00.000Z",
      },
      expiresAt: "2026-01-01T11:00:00.000Z",
    }

    const recommendation: Recommendation = {
      action: "SPEAK",
      reason: "Now is the right time",
      evidence: ["Reconsideration time reached"],
      message: "It is time to check in.",
    }

    const engine = new ProactivityEngine(
      new FixedProvider(recommendation),
    )

    const decision =
      await engine.evaluateReconsideredWait(
        wait,
        unknownEvent,
        baseState,
        "2026-01-01T10:05:00.000Z",
      )

    expect(decision).toEqual({
      action: "SPEAK",
      reason: "Now is the right time",
      eventId: "event-1",
      source: "llm",
      recommendation,
    })
  })

  it("does not call the provider after reconsideration if the new event is deterministic", async () => {
    let calls = 0

    const provider: IntelligenceProvider = {
      async evaluate(): Promise<Recommendation> {
        calls += 1

        return {
          action: "SPEAK",
          reason: "Should not be used",
          evidence: ["test"],
          message: "Should not be used",
        }
      },
    }

    const wait: Recommendation = {
      action: "WAIT",
      reason: "Waiting for a system event",
      evidence: [],
      reconsiderWhen: {
        type: "event",
        eventType: "system",
      },
      expiresAt: "2026-01-01T11:00:00.000Z",
    }

    const engine = new ProactivityEngine(provider)

    await engine.evaluateReconsideredWait(
      wait,
      deterministicEvent,
      baseState,
      "2026-01-01T10:05:00.000Z",
    )

    expect(calls).toBe(0)
  })

  it("keeps unrelated WAIT recommendations waiting when only one condition is satisfied", async () => {
    let providerCalls = 0

    const provider: IntelligenceProvider = {
      async evaluate(
        event: Event,
      ): Promise<Recommendation> {
        providerCalls += 1

        await new Promise((resolve) => {
          setTimeout(resolve, 0)
        })

        return {
          action: "SPEAK",
          reason: "The matching WAIT should be reconsidered",
          evidence: [
            `Reconsideration triggered by ${event.type}`,
          ],
          message: "The matching WAIT was reconsidered.",
        }
      },
    }

    const waitForSignal: Recommendation = {
      action: "WAIT",
      reason: "Waiting for a user signal",
      evidence: ["User signal is the relevant trigger"],
      reconsiderWhen: {
        type: "event",
        eventType: "user_signal",
      },
      expiresAt: "2026-01-01T11:00:00.000Z",
    }

    const waitForPayment: Recommendation = {
      action: "WAIT",
      reason: "Waiting for a payment event",
      evidence: ["Payment event is the relevant trigger"],
      reconsiderWhen: {
        type: "event",
        eventType: "payment",
      },
      expiresAt: "2026-01-01T11:00:00.000Z",
    }

    const signalEvent: Event = {
      id: "signal-trigger",
      type: "user_signal",
      timestamp: "2026-01-01T10:05:00.000Z",
      source: "test",
      data: {
        value: "new-signal",
      },
    }

    const engine = new ProactivityEngine(provider)

    const [signalResult, paymentResult] =
      await Promise.all([
        engine.evaluateReconsideredWait(
          waitForSignal,
          signalEvent,
          baseState,
          "2026-01-01T10:05:00.000Z",
        ),
        engine.evaluateReconsideredWait(
          waitForPayment,
          signalEvent,
          baseState,
          "2026-01-01T10:05:00.000Z",
        ),
      ])

    expect(providerCalls).toBe(1)

    expect(signalResult).toEqual({
      action: "SPEAK",
      reason: "The matching WAIT should be reconsidered",
      eventId: "signal-trigger",
      source: "llm",
      recommendation: {
        action: "SPEAK",
        reason: "The matching WAIT should be reconsidered",
        evidence: [
          "Reconsideration triggered by user_signal",
        ],
        message: "The matching WAIT was reconsidered.",
      },
    })

    expect(paymentResult).toEqual({
      action: "WAIT",
      reason: "WAIT reconsideration condition has not been met",
      eventId: "signal-trigger",
      source: "deterministic",
      recommendation: waitForPayment,
    })
  })

  it("can create a new bounded WAIT when reconsideration needs intelligence but the provider fails", async () => {
    const provider: IntelligenceProvider = {
      async evaluate(): Promise<Recommendation> {
        throw new Error("Provider failed")
      },
    }

    const wait: Recommendation = {
      action: "WAIT",
      reason: "Waiting for more evidence",
      evidence: [],
      reconsiderWhen: {
        type: "time",
        at: "2026-01-01T10:05:00.000Z",
      },
      expiresAt: "2026-01-01T11:00:00.000Z",
    }

    const engine = new ProactivityEngine(provider)

    const decision =
      await engine.evaluateReconsideredWait(
        wait,
        unknownEvent,
        baseState,
        "2026-01-01T10:05:00.000Z",
      )

    expect(decision.action).toBe("WAIT")
    expect(decision.source).toBe("deterministic")
    expect(decision.recommendation?.action).toBe("WAIT")
  })
})