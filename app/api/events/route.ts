import {
  NextResponse,
} from "next/server"
import {
  processUserEvent,
} from "@/application/process-user-event"
import {
  getVortyxRuntime,
} from "@/application/runtime"
import {
  validateEvent,
} from "@/events/validate"

type EventRequestBody = {
  userId?: unknown
  event?: unknown
}

export async function POST(
  request: Request,
): Promise<Response> {
  try {
    const body =
      (await request.json()) as EventRequestBody

    if (
      typeof body.userId !== "string" ||
      body.userId.trim().length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "userId must be a non-empty string",
        },
        {
          status: 400,
        },
      )
    }

    const event =
      validateEvent(body.event)

    const runtime =
      getVortyxRuntime()

    const result =
      await processUserEvent(
        body.userId,
        event,
        runtime.dependencies,
      )

    return NextResponse.json(
      {
        eventId: event.id,
        decision: result.decision,
        interaction:
          result.interaction,
        lifecycle:
          result.lifecycle,
        state: result.state,
      },
    )
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Invalid event request"

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 400,
      },
    )
  }
}