import type { Unit } from "../entities.ts"
import type { Team } from "../types.ts"

const BURNING_MAX_STACKS = 20
const SCORCH_MAX_STACKS = 5
const BURNING_TICK_SECONDS = 0.35

interface BurningState {
  stacks: number
  tickElapsed: number
  sourceId: string
  sourceTeam: Team
}

interface ScorchState {
  stacks: number
}

interface SurvivorUnitStatusState {
  burning: BurningState
  scorch: ScorchState
}

export interface SurvivorStatusSnapshot {
  burningStacks: number
  scorchStacks: number
}

export interface SurvivorBurningApplyResult {
  stacksApplied: number
  totalStacks: number
  ignited: boolean
}

export interface SurvivorBurnTick {
  targetId: string
  sourceId: string
  sourceTeam: Team
  stacks: number
  damage: number
}

export interface SurvivorStatusStepDeps {
  onBurnTick: (event: SurvivorBurnTick) => void
}

const createUnitStatusState = (): SurvivorUnitStatusState => {
  return {
    burning: {
      stacks: 0,
      tickElapsed: 0,
      sourceId: "",
      sourceTeam: "white",
    },
    scorch: {
      stacks: 0,
    },
  }
}

const burnTickDamage = (stacks: number) => {
  return Math.max(1, Math.round(stacks * 0.8))
}

export interface SurvivorStatusEngine {
  syncUnits: (units: readonly Unit[]) => void
  clearAll: () => void
  clearUnit: (unitId: string) => void
  snapshot: (unitId: string) => SurvivorStatusSnapshot
  applyBurning: (unitId: string, stacks: number, sourceId: string, sourceTeam: Team) => SurvivorBurningApplyResult
  applyScorch: (unitId: string, stacks: number) => number
  consumeScorch: (unitId: string) => number
  step: (dt: number, deps: SurvivorStatusStepDeps) => void
}

export const createSurvivorStatusEngine = (): SurvivorStatusEngine => {
  const byUnitId = new Map<string, SurvivorUnitStatusState>()
  let deterministicOrder: string[] = []

  const stateFor = (unitId: string) => {
    let state = byUnitId.get(unitId)
    if (state) {
      return state
    }
    state = createUnitStatusState()
    byUnitId.set(unitId, state)
    return state
  }

  return {
    syncUnits: (units) => {
      const nextOrder = units.map((unit) => unit.id).sort((left, right) => left.localeCompare(right))
      const nextSet = new Set(nextOrder)
      for (const unitId of byUnitId.keys()) {
        if (!nextSet.has(unitId)) {
          byUnitId.delete(unitId)
        }
      }
      for (const unitId of nextOrder) {
        stateFor(unitId)
      }
      deterministicOrder = nextOrder
    },
    clearAll: () => {
      byUnitId.clear()
      deterministicOrder = []
    },
    clearUnit: (unitId) => {
      byUnitId.set(unitId, createUnitStatusState())
    },
    snapshot: (unitId) => {
      const state = byUnitId.get(unitId)
      return {
        burningStacks: state?.burning.stacks ?? 0,
        scorchStacks: state?.scorch.stacks ?? 0,
      }
    },
    applyBurning: (unitId, stacks, sourceId, sourceTeam) => {
      const state = stateFor(unitId)
      const requested = Math.max(0, Math.floor(stacks))
      const room = Math.max(0, BURNING_MAX_STACKS - state.burning.stacks)
      const applied = Math.min(requested, room)
      const ignited = state.burning.stacks <= 0 && applied > 0
      if (applied > 0) {
        state.burning.stacks += applied
        state.burning.sourceId = sourceId
        state.burning.sourceTeam = sourceTeam
      }

      return {
        stacksApplied: applied,
        totalStacks: state.burning.stacks,
        ignited,
      }
    },
    applyScorch: (unitId, stacks) => {
      const state = stateFor(unitId)
      const requested = Math.max(0, Math.floor(stacks))
      if (requested <= 0) {
        return state.scorch.stacks
      }
      state.scorch.stacks = Math.min(SCORCH_MAX_STACKS, state.scorch.stacks + requested)
      return state.scorch.stacks
    },
    consumeScorch: (unitId) => {
      const state = stateFor(unitId)
      const consumed = state.scorch.stacks
      state.scorch.stacks = 0
      return consumed
    },
    step: (dt, deps) => {
      const stepSeconds = Math.max(0, dt)
      if (stepSeconds <= 0) {
        return
      }

      for (const unitId of deterministicOrder) {
        const state = byUnitId.get(unitId)
        if (!state || state.burning.stacks <= 0) {
          continue
        }

        state.burning.tickElapsed += stepSeconds
        while (state.burning.stacks > 0 && state.burning.tickElapsed >= BURNING_TICK_SECONDS) {
          state.burning.tickElapsed -= BURNING_TICK_SECONDS
          deps.onBurnTick({
            targetId: unitId,
            sourceId: state.burning.sourceId,
            sourceTeam: state.burning.sourceTeam,
            stacks: state.burning.stacks,
            damage: burnTickDamage(state.burning.stacks),
          })
          state.burning.stacks = Math.max(0, state.burning.stacks - 1)
          if (state.burning.stacks <= 0) {
            state.burning.tickElapsed = 0
          }
        }
      }
    },
  }
}
