import type { PerkId, Team } from "../types.ts"
import type { SurvivorCombatHookEvent, SurvivorCombatHookQueue } from "./combat-hooks.ts"

const MAX_TRIGGER_EVENTS_PER_FRAME = 256
const MAX_CHAIN_DEPTH = 10
const PRESSURE_BLOOM_IGNITE_THRESHOLD = 5

interface SurvivorTriggerResolverState {
  ignitionCounter: number
}

export interface SurvivorTriggerResolverDeps {
  playerId: string
  hasPerk: (perkId: PerkId) => boolean
  triggerMicroExplosion: (
    x: number,
    y: number,
    sourceId: string,
    sourceTeam: Team,
    chainDepth: number,
    scale: number,
  ) => void
  igniteNearestEnemies: (
    x: number,
    y: number,
    sourceId: string,
    sourceTeam: Team,
    chainDepth: number,
    count: number,
    stacks: number,
  ) => number
}

interface SurvivorTriggerRuntimeContext extends SurvivorTriggerResolverDeps {
  queue: SurvivorCombatHookQueue
  state: SurvivorTriggerResolverState
}

interface SurvivorTriggerDefinition {
  id: string
  event: SurvivorCombatHookEvent["type"]
  priority: number
  run: (event: SurvivorCombatHookEvent, context: SurvivorTriggerRuntimeContext) => void
}

const clampChainDepth = (depth: number) => {
  return Math.min(MAX_CHAIN_DEPTH, Math.max(0, Math.floor(depth)))
}

const TRIGGERS: SurvivorTriggerDefinition[] = [
  {
    id: "pressure_bloom_micro_burst",
    event: "onIgnite",
    priority: 10,
    run: (event, context) => {
      if (event.type !== "onIgnite") {
        return
      }
      if (event.sourceId !== context.playerId) {
        return
      }
      if (!context.hasPerk("proximity_grenades")) {
        return
      }

      context.state.ignitionCounter += 1
      if (context.state.ignitionCounter % PRESSURE_BLOOM_IGNITE_THRESHOLD !== 0) {
        return
      }

      context.triggerMicroExplosion(
        event.x,
        event.y,
        event.sourceId,
        event.sourceTeam,
        clampChainDepth(event.chainDepth + 1),
        0.62,
      )
    },
  },
  {
    id: "red_funeral_seed",
    event: "onExplosion",
    priority: 20,
    run: (event, context) => {
      if (event.type !== "onExplosion") {
        return
      }
      if (event.sourceId !== context.playerId) {
        return
      }
      if (!context.hasPerk("heavy_pellets")) {
        return
      }
      context.igniteNearestEnemies(
        event.x,
        event.y,
        event.sourceId,
        event.sourceTeam,
        clampChainDepth(event.chainDepth + 1),
        1,
        2,
      )
    },
  },
]

const sortedTriggers = [...TRIGGERS].sort((left, right) => {
  if (left.event !== right.event) {
    return left.event.localeCompare(right.event)
  }
  if (left.priority !== right.priority) {
    return left.priority - right.priority
  }
  return left.id.localeCompare(right.id)
})

const triggersByEvent = new Map<SurvivorCombatHookEvent["type"], SurvivorTriggerDefinition[]>()
for (const trigger of sortedTriggers) {
  const bucket = triggersByEvent.get(trigger.event)
  if (bucket) {
    bucket.push(trigger)
  } else {
    triggersByEvent.set(trigger.event, [trigger])
  }
}

export interface SurvivorPerkTriggerResolver {
  reset: () => void
  resolvePending: (queue: SurvivorCombatHookQueue, deps: SurvivorTriggerResolverDeps) => number
}

export const createSurvivorPerkTriggerResolver = (): SurvivorPerkTriggerResolver => {
  const state: SurvivorTriggerResolverState = {
    ignitionCounter: 0,
  }

  return {
    reset: () => {
      state.ignitionCounter = 0
    },
    resolvePending: (queue, deps) => {
      let handled = 0
      while (queue.hasPending() && handled < MAX_TRIGGER_EVENTS_PER_FRAME) {
        const event = queue.shift()
        if (!event) {
          break
        }
        handled += 1
        if (event.chainDepth > MAX_CHAIN_DEPTH) {
          continue
        }

        const triggers = triggersByEvent.get(event.type)
        if (!triggers || triggers.length <= 0) {
          continue
        }

        const context: SurvivorTriggerRuntimeContext = {
          ...deps,
          queue,
          state,
        }
        for (const trigger of triggers) {
          trigger.run(event, context)
        }
      }

      return handled
    },
  }
}
