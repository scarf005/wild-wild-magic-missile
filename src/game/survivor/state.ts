import type { SurvivorModeDefinition } from "./schema.ts"

const BASE_LEVEL_COST = 12
const LEVEL_COST_GROWTH = 1.14

export interface SurvivorChainState {
  currentDepth: number
  peakDepth: number
}

export interface SurvivorProgressState {
  elapsedSeconds: number
  level: number
  essence: number
  nextLevelEssence: number
  kills: number
  selectedPerkIds: string[]
}

export interface SurvivorWaveState {
  nextTimelineIndex: number
  activePressure: number
}

export interface SurvivorModeState {
  title: string
  playerId: string
  chain: SurvivorChainState
  progress: SurvivorProgressState
  wave: SurvivorWaveState
}

const essenceCostForLevel = (level: number) => {
  return Math.max(1, Math.round(BASE_LEVEL_COST * (LEVEL_COST_GROWTH ** Math.max(0, level - 1))))
}

export const createSurvivorModeState = (definition: SurvivorModeDefinition): SurvivorModeState => {
  return {
    title: definition.title,
    playerId: definition.player.id,
    chain: {
      currentDepth: 0,
      peakDepth: 0,
    },
    progress: {
      elapsedSeconds: 0,
      level: 1,
      essence: 0,
      nextLevelEssence: essenceCostForLevel(1),
      kills: 0,
      selectedPerkIds: [],
    },
    wave: {
      nextTimelineIndex: 0,
      activePressure: 1,
    },
  }
}

export const addSurvivorEssence = (state: SurvivorModeState, amount: number) => {
  state.progress.essence += Math.max(0, amount)

  while (state.progress.essence >= state.progress.nextLevelEssence) {
    state.progress.essence -= state.progress.nextLevelEssence
    state.progress.level += 1
    state.progress.nextLevelEssence = essenceCostForLevel(state.progress.level)
  }
}

export const registerSurvivorKill = (state: SurvivorModeState, chainDepth = 1) => {
  state.progress.kills += 1
  const depth = Math.max(1, Math.floor(chainDepth))
  state.chain.currentDepth = depth
  if (depth > state.chain.peakDepth) {
    state.chain.peakDepth = depth
  }
}

export const advanceSurvivorClock = (state: SurvivorModeState, dtSeconds: number) => {
  state.progress.elapsedSeconds = Math.max(0, state.progress.elapsedSeconds + dtSeconds)
}

export const resetSurvivorChainDepth = (state: SurvivorModeState) => {
  state.chain.currentDepth = 0
}
