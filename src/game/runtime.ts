import { FlowerArenaGame } from "./game.ts"
import { SURVIVOR_MODE_DEFINITION } from "./survivor/config.ts"
import { validateSurvivorModeDefinition } from "./survivor/schema.ts"
import { createSurvivorModeState, type SurvivorModeState } from "./survivor/state.ts"

export type RuntimeModeId = "arena" | "survivor"

export interface GameRuntime {
  start: () => void
  destroy: () => void
}

export interface RuntimeFactoryOptions {
  canvas: HTMLCanvasElement
  mode: RuntimeModeId
}

class SurvivorRuntime implements GameRuntime {
  private arenaFallback: FlowerArenaGame
  readonly state: SurvivorModeState

  constructor(canvas: HTMLCanvasElement) {
    const errors = validateSurvivorModeDefinition(SURVIVOR_MODE_DEFINITION)
    if (errors.length > 0) {
      throw new Error(
        `Survivor definition is invalid: ${errors.map((error) => `${error.path} ${error.message}`).join("; ")}`,
      )
    }

    this.state = createSurvivorModeState(SURVIVOR_MODE_DEFINITION)
    this.arenaFallback = new FlowerArenaGame(canvas)
  }

  start() {
    this.arenaFallback.start()
  }

  destroy() {
    this.arenaFallback.destroy()
  }
}

export const createGameRuntime = ({ canvas, mode }: RuntimeFactoryOptions): GameRuntime => {
  if (mode === "survivor") {
    return new SurvivorRuntime(canvas)
  }

  return new FlowerArenaGame(canvas)
}
