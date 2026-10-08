import {
  describe,
  expect,
  it,
} from "vitest"
import {
  validateEvent,
} from "@/events/validate"

const validEvent = {
  id: "event-1",
  type: "user_signal",
  timestamp:
    "2026-10-08T10:00:00.000Z",
  source: "test",
  data: {
    value: 42,
  },
}

describe("validateEvent", () => {
  it("accepts a valid event", () => {
    expect(
      validateEvent(
        validEvent,
      ),
    ).toEqual(
      validEvent,
    )
  })

  it("rejects non-object input", () => {
    expect(() =>
      validateEvent(null),
    ).toThrow(
      "Event must be an object",
    )
  })

  it("rejects an empty event ID", () => {
    expect(() =>
      validateEvent({
        ...validEvent,
        id: "",
      }),
    ).toThrow(
      "Event ID must be a non-empty string",
    )
  })

  it("rejects an empty event type", () => {
    expect(() =>
      validateEvent({
        ...validEvent,
        type: "",
      }),
    ).toThrow(
      "Event type must be a non-empty string",
    )
  })

  it("rejects an invalid timestamp", () => {
    expect(() =>
      validateEvent({
        ...validEvent,
        timestamp: "garbage",
      }),
    ).toThrow(
      "Event timestamp must be a valid date string",
    )
  })

  it("rejects empty event source", () => {
    expect(() =>
      validateEvent({
        ...validEvent,
        source: "",
      }),
    ).toThrow(
      "Event source must be a non-empty string",
    )
  })

  it("rejects array event data", () => {
    expect(() =>
      validateEvent({
        ...validEvent,
        data: [],
      }),
    ).toThrow(
      "Event data must be an object",
    )
  })
})