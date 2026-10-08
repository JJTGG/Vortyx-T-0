import type { Event } from "@/events/types"

export function validateEvent(
  value: unknown,
): Event {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error(
      "Event must be an object",
    )
  }

  const candidate =
    value as Record<
      string,
      unknown
    >

  if (
    typeof candidate.id !== "string" ||
    candidate.id.trim().length === 0
  ) {
    throw new Error(
      "Event ID must be a non-empty string",
    )
  }

  if (
    typeof candidate.type !== "string" ||
    candidate.type.trim().length === 0
  ) {
    throw new Error(
      "Event type must be a non-empty string",
    )
  }

  if (
    typeof candidate.timestamp !== "string" ||
    Number.isNaN(
      Date.parse(
        candidate.timestamp,
      ),
    )
  ) {
    throw new Error(
      "Event timestamp must be a valid date string",
    )
  }

  if (
    typeof candidate.source !== "string" ||
    candidate.source.trim().length === 0
  ) {
    throw new Error(
      "Event source must be a non-empty string",
    )
  }

  if (
    typeof candidate.data !== "object" ||
    candidate.data === null ||
    Array.isArray(candidate.data)
  ) {
    throw new Error(
      "Event data must be an object",
    )
  }

  return {
    id: candidate.id,
    type: candidate.type,
    timestamp: candidate.timestamp,
    source: candidate.source,
    data:
      candidate.data as Record<
        string,
        unknown
      >,
  }
}