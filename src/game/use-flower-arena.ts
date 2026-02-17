import type { RefObject } from "preact"
import { useEffect } from "preact/hooks"

import { createGameRuntime, type RuntimeModeId } from "./runtime.ts"

export const useFlowerArena = (
  canvasRef: RefObject<HTMLCanvasElement>,
  mode: RuntimeModeId = "arena",
) => {
  useEffect(() => {
    if (!canvasRef.current) {
      return
    }

    const game = createGameRuntime({
      canvas: canvasRef.current,
      mode,
    })
    game.start()

    return () => {
      game.destroy()
    }
  }, [canvasRef, mode])
}
