"use client"

import {
  FormEvent,
  useEffect,
  useState,
} from "react"

type DecisionAction =
  | "SPEAK"
  | "WAIT"
  | "SILENCE"

type RuntimeResponse = {
  eventId: string
  decision: {
    action: DecisionAction
    reason: string
    source: string
    eventId: string
    recommendation?: unknown
  }
  interaction: {
    eventId: string
    message: string
    reason: string
  } | null
  lifecycle: string
  state: {
    userId: string
    preferences: {
      proactiveEnabled: boolean
    }
    recentEvents: Array<{
      id: string
      type: string
      timestamp: string
      source: string
      data: Record<string, unknown>
    }>
  }
}

const userId = "jayjay"

const initialEventData = JSON.stringify(
  {
    signal: "example",
  },
  null,
  2,
)

function actionLabel(
  action: DecisionAction,
): string {
  switch (action) {
    case "SPEAK":
      return "SPEAK"
    case "WAIT":
      return "WAIT"
    case "SILENCE":
      return "SILENCE"
  }
}

export default function Home() {
  const [eventType, setEventType] =
    useState("user_signal")

  const [source, setSource] =
    useState("control-room")

  const [eventData, setEventData] =
    useState(initialEventData)

  const [result, setResult] =
    useState<RuntimeResponse | null>(
      null,
    )

  const [savedState, setSavedState] =
    useState<
      RuntimeResponse["state"] | null
    >(null)

  const [loading, setLoading] =
    useState(false)

  const [stateLoading, setStateLoading] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  async function loadState() {
    setStateLoading(true)

    try {
      const response = await fetch(
        `/api/state?userId=${encodeURIComponent(
          userId,
        )}`,
      )

      const body = await response.json()

      if (!response.ok) {
        throw new Error(
          body.error ??
            "Unable to load state",
        )
      }

      setSavedState(body.state)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load state",
      )
    } finally {
      setStateLoading(false)
    }
  }

  useEffect(() => {
    void loadState()
  }, [])

  async function submitEvent(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setLoading(true)
    setError(null)

    try {
      let parsedData: Record<
        string,
        unknown
      >

      try {
        parsedData =
          JSON.parse(
            eventData,
          ) as Record<
            string,
            unknown
          >
      } catch {
        throw new Error(
          "Event data must be valid JSON",
        )
      }

      const response = await fetch(
        "/api/events",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            userId,
            event: {
              id: crypto.randomUUID(),
              type: eventType,
              timestamp:
                new Date().toISOString(),
              source,
              data: parsedData,
            },
          }),
        },
      )

      const body =
        (await response.json()) as
          | RuntimeResponse
          | { error?: string }

      if (!response.ok) {
        throw new Error(
          "error" in body
            ? body.error ??
                "Event processing failed"
            : "Event processing failed",
        )
      }

      setResult(
        body as RuntimeResponse,
      )

      setSavedState(
        (body as RuntimeResponse).state,
      )
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Event processing failed",
      )
    } finally {
      setLoading(false)
    }
  }

  const visibleState =
    savedState ??
    result?.state ??
    null

  return (
    <main className="shell">
      <header className="header">
        <div>
          <p className="eyebrow">
            VORTYX / T-1
          </p>

          <h1>Control Room</h1>

          <p className="subtitle">
            Feed the system a signal and
            watch the artificial brain decide.
          </p>
        </div>

        <div className="status">
          <span className="statusDot" />
          Local runtime
        </div>
      </header>

      <section className="grid">
        <div className="panel">
          <div className="panelHeader">
            <div>
              <p className="panelEyebrow">
                EVENT INPUT
              </p>

              <h2>Inject a signal</h2>
            </div>
          </div>

          <form
            className="form"
            onSubmit={submitEvent}
          >
            <label>
              Event type
              <input
                value={eventType}
                onChange={(event) =>
                  setEventType(
                    event.target.value,
                  )
                }
                placeholder="user_signal"
              />
            </label>

            <label>
              Source
              <input
                value={source}
                onChange={(event) =>
                  setSource(
                    event.target.value,
                  )
                }
                placeholder="control-room"
              />
            </label>

            <label>
              Data
              <textarea
                value={eventData}
                onChange={(event) =>
                  setEventData(
                    event.target.value,
                  )
                }
                spellCheck={false}
              />
            </label>

            <button
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Processing..."
                : "Send signal"}
            </button>
          </form>

          {error !== null && (
            <div className="error">
              {error}
            </div>
          )}
        </div>

        <div className="panel decisionPanel">
          <div className="panelHeader">
            <div>
              <p className="panelEyebrow">
                DECISION
              </p>

              <h2>What did Vortyx do?</h2>
            </div>
          </div>

          {result === null ? (
            <div className="empty">
              No event has been processed
              yet.
            </div>
          ) : (
            <div className="decision">
              <div
                className={`decisionAction action-${result.decision.action.toLowerCase()}`}
              >
                {actionLabel(
                  result.decision.action,
                )}
              </div>

              <p className="reason">
                {result.decision.reason}
              </p>

              <div className="metaGrid">
                <div>
                  <span>Lifecycle</span>
                  <strong>
                    {result.lifecycle}
                  </strong>
                </div>

                <div>
                  <span>Source</span>
                  <strong>
                    {result.decision.source}
                  </strong>
                </div>

                <div>
                  <span>Event</span>
                  <strong>
                    {result.eventId}
                  </strong>
                </div>
              </div>

              {result.interaction !==
                null && (
                <div className="interaction">
                  <span>Interaction</span>
                  <p>
                    {
                      result.interaction
                        .message
                    }
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="panel statePanel">
        <div className="panelHeader">
          <div>
            <p className="panelEyebrow">
              PERSISTENT STATE
            </p>

            <h2>What does Vortyx remember?</h2>
          </div>

          <button
            type="button"
            className="secondaryButton"
            onClick={() => {
              void loadState()
            }}
            disabled={stateLoading}
          >
            {stateLoading
              ? "Loading..."
              : "Refresh"}
          </button>
        </div>

        {visibleState === null ? (
          <div className="empty">
            No state available.
          </div>
        ) : (
          <>
            <div className="stateSummary">
              <div>
                <span>User</span>
                <strong>
                  {visibleState.userId}
                </strong>
              </div>

              <div>
                <span>Proactivity</span>
                <strong>
                  {visibleState.preferences
                    .proactiveEnabled
                    ? "Enabled"
                    : "Disabled"}
                </strong>
              </div>

              <div>
                <span>Recent events</span>
                <strong>
                  {
                    visibleState
                      .recentEvents
                      .length
                  }
                </strong>
              </div>
            </div>

            <div className="events">
              {visibleState.recentEvents
                .slice()
                .reverse()
                .map((event) => (
                  <article
                    className="eventRow"
                    key={event.id}
                  >
                    <div>
                      <strong>
                        {event.type}
                      </strong>

                      <span>
                        {event.source}
                      </span>
                    </div>

                    <time>
                      {new Date(
                        event.timestamp,
                      ).toLocaleTimeString()}
                    </time>
                  </article>
                ))}
            </div>
          </>
        )}
      </section>
    </main>
  )
}