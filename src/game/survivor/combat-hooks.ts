import type { Team } from "../types.ts"

export type SurvivorCombatHookType = "onHit" | "onKill" | "onIgnite" | "onExplosion"

interface SurvivorCombatHookBase {
  type: SurvivorCombatHookType
  sourceId: string
  sourceTeam: Team
  x: number
  y: number
  chainDepth: number
  order: number
}

export interface SurvivorHitHookEvent extends SurvivorCombatHookBase {
  type: "onHit"
  targetId: string
  damage: number
  damageSource: "projectile" | "throwable" | "molotov" | "arena" | "other"
}

export interface SurvivorKillHookEvent extends SurvivorCombatHookBase {
  type: "onKill"
  targetId: string
  targetWasBurning: boolean
}

export interface SurvivorIgniteHookEvent extends SurvivorCombatHookBase {
  type: "onIgnite"
  targetId: string
  stacksApplied: number
}

export interface SurvivorExplosionHookEvent extends SurvivorCombatHookBase {
  type: "onExplosion"
  radius: number
  hits: number
}

export type SurvivorCombatHookEvent =
  | SurvivorHitHookEvent
  | SurvivorKillHookEvent
  | SurvivorIgniteHookEvent
  | SurvivorExplosionHookEvent

export type SurvivorHitHookInput = Omit<SurvivorHitHookEvent, "order">
export type SurvivorKillHookInput = Omit<SurvivorKillHookEvent, "order">
export type SurvivorIgniteHookInput = Omit<SurvivorIgniteHookEvent, "order">
export type SurvivorExplosionHookInput = Omit<SurvivorExplosionHookEvent, "order">

export type SurvivorCombatHookInput =
  | SurvivorHitHookInput
  | SurvivorKillHookInput
  | SurvivorIgniteHookInput
  | SurvivorExplosionHookInput

export interface SurvivorCombatHookQueue {
  enqueue: (event: SurvivorCombatHookInput) => SurvivorCombatHookEvent
  shift: () => SurvivorCombatHookEvent | null
  clear: () => void
  hasPending: () => boolean
}

export const createSurvivorCombatHookQueue = (): SurvivorCombatHookQueue => {
  const queue: SurvivorCombatHookEvent[] = []
  let cursor = 0
  let nextOrder = 1

  const normalize = (event: SurvivorCombatHookInput): SurvivorCombatHookEvent => {
    const common = {
      chainDepth: Math.max(0, Math.floor(event.chainDepth)),
      order: nextOrder++,
    }
    if (event.type === "onHit") {
      return { ...event, ...common }
    }
    if (event.type === "onKill") {
      return { ...event, ...common }
    }
    if (event.type === "onIgnite") {
      return { ...event, ...common }
    }
    return { ...event, ...common }
  }

  return {
    enqueue: (event) => {
      const normalized = normalize(event)
      queue.push(normalized)
      return normalized
    },
    shift: () => {
      if (cursor >= queue.length) {
        queue.length = 0
        cursor = 0
        return null
      }

      const event = queue[cursor]
      cursor += 1
      if (cursor >= queue.length) {
        queue.length = 0
        cursor = 0
      }
      return event
    },
    clear: () => {
      queue.length = 0
      cursor = 0
      nextOrder = 1
    },
    hasPending: () => cursor < queue.length,
  }
}
