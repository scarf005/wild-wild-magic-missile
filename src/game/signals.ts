import { signal } from "@preact/signals"
import { GAME_SPEED, MATCH_DURATION_SECONDS, UNIT_BASE_HP } from "./world/constants.ts"
import type { GameModeId, PerkId, PrimaryWeaponId, SecondaryMode } from "./types.ts"
import { preferredLocale, type LocaleId } from "../i18n.ts"

export interface CoverageSlice {
  id: string
  label: string
  color: string
  percent: number
}

export interface MatchResultHud {
  visible: boolean
  winnerLabel: string
  winnerColor: string
  pieGradient: string
  stats: { label: string; value: string }[]
  standings: { id: string; label: string; color: string; flowers: number; percent: number }[]
}

export interface PrimaryWeaponHudItem {
  label: string
  icon: WeaponHudIcon
  ammo: string
  selected: boolean
}

export interface PlayerPerkHudItem {
  id: PerkId
  label: string
  detail: string
  icon: WeaponHudIcon
  stacks: number
}

export interface XpHudState {
  level: number
  xp: number
  nextLevelXp: number
}

export interface LevelUpChoiceHudItem {
  perkId: PerkId
  label: string
  detail: string
  hint: string
  school: "pyrogenics" | "neutral"
  icon: WeaponHudIcon
  stacks: number
  maxStacks: number
}

export interface RenderPathProfileHud {
  frames: number
  pickupVisibleFrames: number
  pickupHiddenFrames: number
  obstacleFxWebGlFrames: number
  trailWebGlFrames: number
  mergedCompositeFrames: number
  splitCompositeFrames: number
}

export interface RenderPathRatesHud {
  sampleFrames: number
  mergedPercent: number
  splitPercent: number
  pickupVisiblePercent: number
  pickupHiddenPercent: number
}

const DEBUG_OPTIONS_STORAGE_KEY = "head-full-of-flowers.debug-options"
const AUDIO_OPTIONS_STORAGE_KEY = "head-full-of-flowers.audio-options"
const DEBUG_GAME_SPEED_MIN = 0.4
const DEBUG_GAME_SPEED_MAX = 1.5

interface DebugOptions {
  infiniteHp: boolean
  infiniteReload: boolean
  gameSpeed: number
  impactFeelLevel: number
}

interface AudioOptions {
  musicVolume: number
  effectsVolume: number
}

const clampGameSpeed = (value: number) => {
  return Math.max(DEBUG_GAME_SPEED_MIN, Math.min(DEBUG_GAME_SPEED_MAX, value))
}

const clampImpactFeelLevel = (value: number) => {
  return Math.max(1, Math.min(2, value))
}

const readStoredDebugOptions = (): DebugOptions => {
  const fallback: DebugOptions = {
    infiniteHp: false,
    infiniteReload: false,
    gameSpeed: GAME_SPEED,
    impactFeelLevel: 1,
  }

  if (typeof window === "undefined") {
    return fallback
  }

  try {
    const raw = window.localStorage.getItem(DEBUG_OPTIONS_STORAGE_KEY)
    if (!raw) {
      return fallback
    }

    const parsed = JSON.parse(raw) as Partial<DebugOptions>
    return {
      infiniteHp: typeof parsed.infiniteHp === "boolean" ? parsed.infiniteHp : fallback.infiniteHp,
      infiniteReload: typeof parsed.infiniteReload === "boolean" ? parsed.infiniteReload : fallback.infiniteReload,
      gameSpeed: typeof parsed.gameSpeed === "number" ? clampGameSpeed(parsed.gameSpeed) : fallback.gameSpeed,
      impactFeelLevel: typeof parsed.impactFeelLevel === "number"
        ? clampImpactFeelLevel(parsed.impactFeelLevel)
        : fallback.impactFeelLevel,
    }
  } catch {
    return fallback
  }
}

const storedDebugOptions = readStoredDebugOptions()

const clampVolume = (value: number) => {
  return Math.max(0, Math.min(1, value))
}

const readStoredAudioOptions = (): AudioOptions => {
  const fallback: AudioOptions = {
    musicVolume: 0.75,
    effectsVolume: 0.9,
  }

  if (typeof window === "undefined") {
    return fallback
  }

  try {
    const raw = window.localStorage.getItem(AUDIO_OPTIONS_STORAGE_KEY)
    if (!raw) {
      return fallback
    }

    const parsed = JSON.parse(raw) as Partial<AudioOptions>
    return {
      musicVolume: typeof parsed.musicVolume === "number" ? clampVolume(parsed.musicVolume) : fallback.musicVolume,
      effectsVolume: typeof parsed.effectsVolume === "number"
        ? clampVolume(parsed.effectsVolume)
        : fallback.effectsVolume,
    }
  } catch {
    return fallback
  }
}

const storedAudioOptions = readStoredAudioOptions()

const writeStoredDebugOptions = () => {
  if (typeof window === "undefined") {
    return
  }

  const payload: DebugOptions = {
    infiniteHp: debugInfiniteHpSignal.value,
    infiniteReload: debugInfiniteReloadSignal.value,
    gameSpeed: clampGameSpeed(debugGameSpeedSignal.value),
    impactFeelLevel: clampImpactFeelLevel(debugImpactFeelLevelSignal.value),
  }

  try {
    window.localStorage.setItem(DEBUG_OPTIONS_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // noop
  }
}

const writeStoredAudioOptions = () => {
  if (typeof window === "undefined") {
    return
  }

  const payload: AudioOptions = {
    musicVolume: clampVolume(musicVolumeSignal.value),
    effectsVolume: clampVolume(effectsVolumeSignal.value),
  }

  try {
    window.localStorage.setItem(AUDIO_OPTIONS_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // noop
  }
}

export const debugInfiniteHpSignal = signal(storedDebugOptions.infiniteHp)
export const debugInfiniteReloadSignal = signal(storedDebugOptions.infiniteReload)
export const debugGameSpeedSignal = signal(storedDebugOptions.gameSpeed)
export const debugImpactFeelLevelSignal = signal(storedDebugOptions.impactFeelLevel)
export const debugSkipToMatchEndSignal = signal(false)
export const persistDebugOptions = () => writeStoredDebugOptions()
export const persistAudioOptions = () => writeStoredAudioOptions()

export const selectedGameModeSignal = signal<GameModeId>("survivor")
export const ffaPlayerCountSignal = signal(4)
export const tdmTeamSizeSignal = signal(4)
export const duoTeamCountSignal = signal(4)
export const squadTeamCountSignal = signal(2)
export const menuVisibleSignal = signal(true)
export const languageSignal = signal<LocaleId>(preferredLocale)
export const musicVolumeSignal = signal(storedAudioOptions.musicVolume)
export const effectsVolumeSignal = signal(storedAudioOptions.effectsVolume)

export const timeRemainingSignal = signal(MATCH_DURATION_SECONDS)
export const fpsSignal = signal(0)
export const enemyCountSignal = signal(0)
export const pausedSignal = signal(false)
export const coverageSlicesSignal = signal<CoverageSlice[]>([])
export const matchResultSignal = signal<MatchResultHud>({
  visible: false,
  winnerLabel: "",
  winnerColor: "#f2ffe8",
  pieGradient: "conic-gradient(#f2ffe8 0deg 360deg)",
  stats: [],
  standings: [],
})

export const primaryWeaponSignal = signal("Pistol")
export const primaryWeaponIconSignal = signal<WeaponHudIcon>("pistol")
export const primaryAmmoSignal = signal("∞")
export const primaryWeaponSlotsSignal = signal<PrimaryWeaponHudItem[]>([
  {
    label: "Pistol",
    icon: "pistol",
    ammo: "∞",
    selected: true,
  },
])
export const secondaryModeSignal = signal<SecondaryMode>("grenade")
export const secondaryWeaponCooldownSignal = signal("RMB to throw")
export const hpSignal = signal({ hp: UNIT_BASE_HP, maxHp: UNIT_BASE_HP })
export const playerPerksSignal = signal<PlayerPerkHudItem[]>([])
export const xpSignal = signal<XpHudState>({
  level: 1,
  xp: 0,
  nextLevelXp: 12,
})
export const levelUpChoicesSignal = signal<LevelUpChoiceHudItem[]>([])
export const levelUpSelectionSignal = signal<PerkId | "skip" | null>(null)
export const renderPathProfileSignal = signal<RenderPathProfileHud>({
  frames: 0,
  pickupVisibleFrames: 0,
  pickupHiddenFrames: 0,
  obstacleFxWebGlFrames: 0,
  trailWebGlFrames: 0,
  mergedCompositeFrames: 0,
  splitCompositeFrames: 0,
})
export const renderPathRatesSignal = signal<RenderPathRatesHud>({
  sampleFrames: 0,
  mergedPercent: 0,
  splitPercent: 0,
  pickupVisiblePercent: 0,
  pickupHiddenPercent: 0,
})

export const statusMessageSignal = signal("Click to begin")

export const crosshairSignal = signal({ x: 0, y: 0, visible: false })
export type WeaponHudIcon = PrimaryWeaponId | SecondaryMode | PerkId
