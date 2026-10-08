import {
  NextResponse,
} from "next/server"
import {
  getVortyxRuntime,
} from "@/application/runtime"

export async function GET(
  request: Request,
): Promise<Response> {
  const url =
    new URL(request.url)

  const userId =
    url.searchParams.get(
      "userId",
    )

  if (
    userId === null ||
    userId.trim().length === 0
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

  try {
    const state =
      await getVortyxRuntime()
        .dependencies.stateStore.get(
          userId,
        )

    return NextResponse.json(
      {
        state,
      },
    )
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to load user state"

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 500,
      },
    )
  }
}