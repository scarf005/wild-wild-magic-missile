import "./app.css"

import { useRef } from "preact/hooks"

import { SurvivorHud } from "./game/survivor-hud.tsx"
import { useFlowerArena } from "./game/use-flower-arena.ts"

export const App = () => {
  const canvasNode = useRef<HTMLCanvasElement>(null)

  useFlowerArena(canvasNode, "survivor")

  return (
    <main class="survivor-shell">
      <div class="survivor-frame">
        <canvas
          ref={canvasNode}
          class="survivor-canvas"
          aria-label="Wild Wild Magic Missile"
        />
        <SurvivorHud />
      </div>
    </main>
  )
}
