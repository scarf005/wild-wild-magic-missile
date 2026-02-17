import { buildPerkCardView, type SurvivorModeDefinition } from "./schema.ts"

interface SurvivorPressureCurvePoint {
  atMinute: number
  targetRatio: number
  spawnIntervalSeconds: number
  spawnBatch: number
}

interface SurvivorPressureSpikeWindow {
  startMinute: number
  durationSeconds: number
  targetRatioBonus: number
  spawnBatchBonus: number
  intervalScale: number
}

export interface SurvivorPressureDirectorSample {
  activeBotTarget: number
  spawnIntervalSeconds: number
  spawnBatch: number
}

const SURVIVOR_PRESSURE_CURVE: SurvivorPressureCurvePoint[] = [
  { atMinute: 0, targetRatio: 0.18, spawnIntervalSeconds: 7.8, spawnBatch: 1 },
  { atMinute: 2, targetRatio: 0.32, spawnIntervalSeconds: 6.2, spawnBatch: 1 },
  { atMinute: 4, targetRatio: 0.48, spawnIntervalSeconds: 5.1, spawnBatch: 2 },
  { atMinute: 7, targetRatio: 0.62, spawnIntervalSeconds: 4.2, spawnBatch: 2 },
  { atMinute: 10, targetRatio: 0.78, spawnIntervalSeconds: 3.4, spawnBatch: 3 },
  { atMinute: 14, targetRatio: 0.91, spawnIntervalSeconds: 2.8, spawnBatch: 3 },
  { atMinute: 18, targetRatio: 1, spawnIntervalSeconds: 2.4, spawnBatch: 4 },
]

const SURVIVOR_PRESSURE_SPIKES: SurvivorPressureSpikeWindow[] = [
  { startMinute: 1.5, durationSeconds: 20, targetRatioBonus: 0.08, spawnBatchBonus: 1, intervalScale: 0.72 },
  { startMinute: 5.5, durationSeconds: 24, targetRatioBonus: 0.1, spawnBatchBonus: 1, intervalScale: 0.66 },
  { startMinute: 9.5, durationSeconds: 28, targetRatioBonus: 0.12, spawnBatchBonus: 2, intervalScale: 0.58 },
  { startMinute: 13.5, durationSeconds: 32, targetRatioBonus: 0.14, spawnBatchBonus: 2, intervalScale: 0.52 },
  { startMinute: 17.5, durationSeconds: 36, targetRatioBonus: 0.18, spawnBatchBonus: 2, intervalScale: 0.46 },
]

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value))
}

const lerp = (from: number, to: number, t: number) => {
  return from + (to - from) * t
}

const samplePressureCurve = (elapsedSeconds: number) => {
  const elapsedMinutes = Math.max(0, elapsedSeconds) / 60

  let previous = SURVIVOR_PRESSURE_CURVE[0]
  for (let index = 1; index < SURVIVOR_PRESSURE_CURVE.length; index += 1) {
    const current = SURVIVOR_PRESSURE_CURVE[index]
    if (elapsedMinutes <= current.atMinute) {
      const span = Math.max(0.0001, current.atMinute - previous.atMinute)
      const t = clamp((elapsedMinutes - previous.atMinute) / span, 0, 1)
      return {
        targetRatio: lerp(previous.targetRatio, current.targetRatio, t),
        spawnIntervalSeconds: lerp(previous.spawnIntervalSeconds, current.spawnIntervalSeconds, t),
        spawnBatch: Math.round(lerp(previous.spawnBatch, current.spawnBatch, t)),
      }
    }
    previous = current
  }

  return {
    targetRatio: previous.targetRatio,
    spawnIntervalSeconds: previous.spawnIntervalSeconds,
    spawnBatch: previous.spawnBatch,
  }
}

const samplePressureSpike = (elapsedSeconds: number) => {
  for (const spike of SURVIVOR_PRESSURE_SPIKES) {
    const start = spike.startMinute * 60
    const end = start + spike.durationSeconds
    if (elapsedSeconds < start || elapsedSeconds >= end) {
      continue
    }
    return spike
  }

  return null
}

export const sampleSurvivorPressureDirector = (
  elapsedSeconds: number,
  maxActiveBots: number,
): SurvivorPressureDirectorSample => {
  const curve = samplePressureCurve(elapsedSeconds)
  const spike = samplePressureSpike(elapsedSeconds)

  const ratio = clamp(
    curve.targetRatio + (spike?.targetRatioBonus ?? 0),
    0,
    1,
  )
  const activeBotTarget = clamp(
    Math.round(maxActiveBots * ratio),
    1,
    Math.max(1, maxActiveBots),
  )
  const spawnIntervalSeconds = clamp(
    curve.spawnIntervalSeconds * (spike?.intervalScale ?? 1),
    0.6,
    12,
  )
  const spawnBatch = clamp(
    curve.spawnBatch + (spike?.spawnBatchBonus ?? 0),
    1,
    8,
  )

  return {
    activeBotTarget,
    spawnIntervalSeconds,
    spawnBatch,
  }
}

export const SURVIVOR_MODE_DEFINITION: SurvivorModeDefinition = {
  title: "Wild Wild Magic Missile",
  coreLoop: [
    "Defeat insect swarms to gain essence and level quickly",
    "Draft perk cards to build school-based trigger chains",
    "Amplify chain reactions until one kill detonates whole packs",
  ],
  player: {
    id: "arcanist",
    displayName: "Arcanist",
    portraitPath: "./assets/concept.png",
    primarySchoolId: "pyrogenics",
    weaponId: "arcanic_staff",
  },
  schools: [
    {
      id: "pyrogenics",
      label: "Pyrogenics",
      borderColor: "#c23a2b",
    },
    {
      id: "neutral",
      label: "Neutral",
      borderColor: "#8b8567",
    },
  ],
  weapons: [
    {
      id: "arcanic_staff",
      label: "Arcanic Staff",
      frame: "halberd + 20mm semi-auto low-pressure gun",
      description: "Hybrid melee firearm tuned for pyrogenic trigger setups",
      melee: {
        shape: "sweep",
        sweepDegrees: 110,
        reach: 2.2,
        baseDamage: 22,
      },
      ballistic: {
        caliberMm: 20,
        action: "semi-auto",
        pressureClass: "low-pressure",
        magazineSize: 8,
        reloadSeconds: 1.35,
        baseDamage: 28,
      },
    },
  ],
  statusEffects: [
    {
      id: "burning",
      label: "Burning",
      schoolId: "pyrogenics",
      maxStacks: 20,
      tickSeconds: 0.35,
      description: "Deals periodic fire damage and enables ignition synergies",
    },
    {
      id: "scorch_mark",
      label: "Scorch Mark",
      schoolId: "pyrogenics",
      maxStacks: 5,
      tickSeconds: 0,
      description: "Detonation marker consumed by explosion-trigger perks",
    },
  ],
  perkCards: [
    {
      id: "ember_wake",
      label: "Ember Wake",
      schoolId: "pyrogenics",
      rarity: "common",
      summary: "Kills leave short-lived burning ground",
      synergyHint: "Starts ignition chains in dense swarms",
      triggers: [
        {
          event: "on_kill",
          condition: "enemy dies to arcanist damage",
          outcome: "spawn burning ground patch at death position",
        },
      ],
    },
    {
      id: "cinder_relay",
      label: "Cinder Relay",
      schoolId: "pyrogenics",
      rarity: "uncommon",
      summary: "Burning deaths ignite nearby enemies",
      synergyHint: "Pairs with Ember Wake for chain spread",
      triggers: [
        {
          event: "on_kill",
          condition: "killed enemy was burning",
          outcome: "apply burning to nearest 3 enemies",
        },
      ],
    },
    {
      id: "pressure_bloom",
      label: "Pressure Bloom",
      schoolId: "pyrogenics",
      rarity: "rare",
      summary: "Every 5 ignitions causes a micro-explosion",
      synergyHint: "Converts spread into burst wave clear",
      triggers: [
        {
          event: "on_ignite",
          condition: "ignition counter reaches 5",
          outcome: "trigger micro-explosion around ignited target",
        },
      ],
    },
    {
      id: "red_funeral",
      label: "Red Funeral",
      schoolId: "pyrogenics",
      rarity: "legendary",
      summary: "Explosions launch homing embers",
      synergyHint: "Turns each blast into another ignition source",
      triggers: [
        {
          event: "on_explosion",
          condition: "explosion hits at least one enemy",
          outcome: "spawn 4 homing embers toward nearest enemies",
        },
      ],
    },
    {
      id: "furnace_crown",
      label: "Furnace Crown",
      schoolId: "pyrogenics",
      rarity: "legendary",
      summary: "Ember kills refund reload and cooldown",
      synergyHint: "Sustains loop once ember chain starts",
      triggers: [
        {
          event: "on_kill",
          condition: "enemy dies to ember projectile",
          outcome: "refund partial reload and secondary cooldown",
        },
      ],
    },
    {
      id: "combat_drill",
      label: "Combat Drill",
      schoolId: "neutral",
      rarity: "common",
      summary: "Increase staff sweep speed",
      synergyHint: "Neutral baseline for safer early game",
      triggers: [
        {
          event: "on_hit",
          condition: "halberd sweep connects",
          outcome: "grant temporary move speed",
        },
      ],
    },
  ],
  enemies: [
    {
      id: "mosquito_swarmer",
      label: "Mosquito Swarmer",
      species: "mosquito",
      role: "swarmer",
      baseHp: 24,
      moveSpeed: 5.3,
      threatNotes: ["Very high pack pressure", "Best countered by ignition spread"],
    },
    {
      id: "giant_spider",
      label: "Giant Spider",
      species: "spider",
      role: "controller",
      baseHp: 180,
      moveSpeed: 1.6,
      threatNotes: ["Leap attack", "Web zone slows movement"],
    },
    {
      id: "carrion_beetle",
      label: "Carrion Beetle",
      species: "beetle",
      role: "bruiser",
      baseHp: 140,
      moveSpeed: 2,
      threatNotes: ["Armored front", "Weak rear exposure"],
    },
    {
      id: "bloat_tick",
      label: "Bloat Tick",
      species: "tick",
      role: "charger",
      baseHp: 100,
      moveSpeed: 1.7,
      threatNotes: ["Explodes into larvae on death", "Forces spacing discipline"],
    },
    {
      id: "wasp_lancer",
      label: "Wasp Lancer",
      species: "wasp",
      role: "charger",
      baseHp: 90,
      moveSpeed: 4.1,
      threatNotes: ["Dash-through attack", "Punishes stationary play"],
    },
  ],
  waveTimeline: [
    {
      atSeconds: 0,
      type: "spawn-pack",
      enemyId: "mosquito_swarmer",
      count: 28,
      note: "Open with manageable swarm pressure",
    },
    {
      atSeconds: 45,
      type: "spawn-pack",
      enemyId: "giant_spider",
      count: 2,
      note: "Introduce slow-zone control pressure",
    },
    {
      atSeconds: 90,
      type: "difficulty-spike",
      note: "Increase swarm density and elite chance",
    },
    {
      atSeconds: 180,
      type: "spawn-elite",
      enemyId: "giant_spider",
      count: 1,
      note: "First elite checkpoint",
    },
    {
      atSeconds: 600,
      type: "spawn-boss",
      enemyId: "giant_spider",
      count: 1,
      note: "Mid-run broodmother proxy encounter",
    },
  ],
  cardDraft: {
    cardsPerDraft: 3,
    rerollsPerDraft: 1,
    neutralSchoolId: "neutral",
  },
}

export const SURVIVOR_PERK_CARD_VIEWS = SURVIVOR_MODE_DEFINITION.perkCards.map((perk) => {
  return buildPerkCardView(SURVIVOR_MODE_DEFINITION.schools, perk)
})
