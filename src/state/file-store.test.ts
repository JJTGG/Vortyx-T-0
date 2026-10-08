import {
  mkdtemp,
  readFile,
  rm,
} from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest"
import { FileUserStateStore } from "@/state/file-store"

const createdDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    createdDirectories.map((directory) =>
      rm(directory, {
        recursive: true,
        force: true,
      }),
    ),
  )

  createdDirectories.length = 0
})

async function createDirectory(): Promise<string> {
  const directory = await mkdtemp(
    path.join(
      os.tmpdir(),
      "vortyx-state-",
    ),
  )

  createdDirectories.push(directory)

  return directory
}

describe("FileUserStateStore", () => {
  it("creates default state for a new user", async () => {
    const directory =
      await createDirectory()

    const store =
      new FileUserStateStore(
        directory,
      )

    const state =
      await store.get("user-1")

    expect(state).toEqual({
      userId: "user-1",
      preferences: {
        proactiveEnabled: true,
      },
      recentEvents: [],
    })
  })

  it("persists state across store instances", async () => {
    const directory =
      await createDirectory()

    const firstStore =
      new FileUserStateStore(
        directory,
      )

    const original =
      await firstStore.get(
        "user-1",
      )

    original.preferences.proactiveEnabled =
      false

    original.recentEvents.push({
      id: "event-1",
      type: "test",
      timestamp:
        "2026-01-01T10:00:00.000Z",
      source: "test",
      data: {
        value: 42,
      },
    })

    await firstStore.save(
      original,
    )

    const secondStore =
      new FileUserStateStore(
        directory,
      )

    const restored =
      await secondStore.get(
        "user-1",
      )

    expect(restored).toEqual(
      original,
    )
  })

  it("writes a versioned state envelope", async () => {
    const directory =
      await createDirectory()

    const store =
      new FileUserStateStore(
        directory,
      )

    const state =
      await store.get("user-1")

    await store.save(state)

    const raw =
      await readFile(
        path.join(
          directory,
          "user-1.json",
        ),
        "utf8",
      )

    expect(
      JSON.parse(raw),
    ).toEqual({
      version: 1,
      state,
    })
  })

  it("rejects unsafe user IDs", async () => {
    const directory =
      await createDirectory()

    const store =
      new FileUserStateStore(
        directory,
      )

    await expect(
      store.get("../escape"),
    ).rejects.toThrow(
      "User ID contains invalid characters",
    )
  })
})