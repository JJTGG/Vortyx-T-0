import {
  describe,
  expect,
  it,
} from "vitest"
import type { Event } from "@/events/types"
import type { UserState } from "@/state/types"
import {
  appendRecentEvent,
} from "@/state/evolve"

const state: UserState = {
  userId: "user-1",
  preferences: {
    proactiveEnabled: true,
  },
  recentEvents: [],
}

function createEvent(
  id: string,
): Event {
  return {
    id,
    type: "user_signal",
    timestamp:
      "2026-01-01T10:00:00.000Z",
    source: "test",
    data: {
      id,
    },
  }
}

describe("appendRecentEvent", () => {
  it("adds an event without mutating the original state", () => {
    const event =
      createEvent("event-1")

    const next =
      appendRecentEvent(
        state,
        event,
      )

    expect(next).toEqual({
      ...state,
      recentEvents: [
        event,
      ],
    })

    expect(state.recentEvents).toEqual([])
  })

  it("stores a cloned event", () => {
    const event =
      createEvent("event-1")

    const next =
      appendRecentEvent(
        state,
        event,
      )

    event.data.id = "mutated"

    expect(
      next.recentEvents[0].data,
    ).toEqual({
      id: "event-1",
    })
  })

  it("keeps only the most recent 100 events", () => {
    const initialState: UserState = {
      ...state,
      recentEvents: Array.from(
        { length: 100 },
        (_, index) =>
          createEvent(
            `event-${index + 1}`,
          ),
      ),
    }

    const next =
      appendRecentEvent(
        initialState,
        createEvent(
          "event-101",
        ),
      )

    expect(
      next.recentEvents,
    ).toHaveLength(100)

    expect(
      next.recentEvents[0].id,
    ).toBe("event-2")

    expect(
      next.recentEvents[99].id,
    ).toBe("event-101")
  })

  it("rejects state without a user ID", () => {
    expect(() =>
      appendRecentEvent(
        {
          ...state,
          userId: "",
        },
        createEvent(
          "event-1",
        ),
      ),
    ).toThrow(
      "User state requires a user ID",
    )
  })
})