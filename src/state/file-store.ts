import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import type { UserStateStore } from "@/state/store"
import type { UserState } from "@/state/types"
import { createDefaultUserState } from "@/state/default"

type PersistedState = {
  version: 1
  state: UserState
}

function validateUserId(userId: string): void {
  if (userId.trim().length === 0) {
    throw new Error("User ID must not be empty")
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(userId)) {
    throw new Error("User ID contains invalid characters")
  }
}

export class FileUserStateStore
  implements UserStateStore
{
  private readonly directory: string

  constructor(directory: string) {
    if (directory.trim().length === 0) {
      throw new Error(
        "State directory must not be empty",
      )
    }

    this.directory = directory
  }

  private getFilePath(userId: string): string {
    validateUserId(userId)

    return path.join(
      this.directory,
      `${userId}.json`,
    )
  }

  async get(userId: string): Promise<UserState> {
    const filePath = this.getFilePath(userId)

    try {
      const raw = await readFile(
        filePath,
        "utf8",
      )

      const persisted = JSON.parse(
        raw,
      ) as PersistedState

      if (
        persisted?.version !== 1 ||
        persisted.state?.userId !== userId ||
        !persisted.state.preferences ||
        !Array.isArray(
          persisted.state.recentEvents,
        )
      ) {
        throw new Error(
          "Persisted user state is invalid",
        )
      }

      return structuredClone(
        persisted.state,
      )
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        const defaultState =
          createDefaultUserState(userId)

        await this.save(defaultState)

        return structuredClone(
          defaultState,
        )
      }

      throw error
    }
  }

  async save(state: UserState): Promise<void> {
    validateUserId(state.userId)

    await mkdir(this.directory, {
      recursive: true,
    })

    const persisted: PersistedState = {
      version: 1,
      state: structuredClone(state),
    }

    const filePath = this.getFilePath(
      state.userId,
    )

    const temporaryPath = `${filePath}.tmp`

    await writeFile(
      temporaryPath,
      JSON.stringify(
        persisted,
        null,
        2,
      ),
      "utf8",
    )

    await rename(
      temporaryPath,
      filePath,
    )
  }
}