export type MagicSchoolId = "pyrogenics" | "neutral" | (string & {})

export type SurvivorPerkRarity = "common" | "uncommon" | "rare" | "legendary"

export type SurvivorTriggerEvent = "on_hit" | "on_kill" | "on_ignite" | "on_burn_tick" | "on_explosion"

export type SurvivorWaveEventType = "spawn-pack" | "spawn-elite" | "spawn-boss" | "difficulty-spike"

export interface MagicSchoolDefinition {
  id: MagicSchoolId
  label: string
  borderColor: string
}

export interface ArcanistWeaponMeleeProfile {
  shape: "sweep"
  sweepDegrees: number
  reach: number
  baseDamage: number
}

export interface ArcanistWeaponBallisticProfile {
  caliberMm: number
  action: "semi-auto"
  pressureClass: "low-pressure" | string
  magazineSize: number
  reloadSeconds: number
  baseDamage: number
}

export interface SurvivorWeaponDefinition {
  id: string
  label: string
  frame: string
  description: string
  melee: ArcanistWeaponMeleeProfile
  ballistic: ArcanistWeaponBallisticProfile
}

export interface SurvivorPlayerDefinition {
  id: string
  displayName: string
  portraitPath: string
  primarySchoolId: MagicSchoolId
  weaponId: string
}

export interface SurvivorStatusEffectDefinition {
  id: string
  label: string
  schoolId: MagicSchoolId
  maxStacks: number
  tickSeconds: number
  description: string
}

export interface SurvivorPerkTriggerDefinition {
  event: SurvivorTriggerEvent
  condition: string
  outcome: string
}

export interface SurvivorPerkCardDefinition {
  id: string
  label: string
  schoolId: MagicSchoolId
  rarity: SurvivorPerkRarity
  summary: string
  synergyHint: string
  triggers: SurvivorPerkTriggerDefinition[]
}

export interface SurvivorEnemyDefinition {
  id: string
  label: string
  species: "spider" | "mosquito" | "beetle" | "tick" | "wasp" | "other"
  role: "swarmer" | "bruiser" | "charger" | "controller" | "summoner"
  baseHp: number
  moveSpeed: number
  threatNotes: string[]
}

export interface SurvivorWaveEventDefinition {
  atSeconds: number
  type: SurvivorWaveEventType
  enemyId?: string
  count?: number
  note: string
}

export interface SurvivorCardDraftDefinition {
  cardsPerDraft: number
  rerollsPerDraft: number
  neutralSchoolId: MagicSchoolId
}

export interface SurvivorModeDefinition {
  title: string
  coreLoop: string[]
  player: SurvivorPlayerDefinition
  schools: MagicSchoolDefinition[]
  weapons: SurvivorWeaponDefinition[]
  statusEffects: SurvivorStatusEffectDefinition[]
  perkCards: SurvivorPerkCardDefinition[]
  enemies: SurvivorEnemyDefinition[]
  waveTimeline: SurvivorWaveEventDefinition[]
  cardDraft: SurvivorCardDraftDefinition
}

export interface SurvivorPerkCardView {
  id: string
  label: string
  schoolId: MagicSchoolId
  borderColor: string
  rarity: SurvivorPerkRarity
  summary: string
  synergyHint: string
}

export interface SurvivorDefinitionValidationError {
  path: string
  message: string
}

export const getMagicSchool = (schools: MagicSchoolDefinition[], schoolId: MagicSchoolId) => {
  const found = schools.find((school) => school.id === schoolId)
  if (found) {
    return found
  }

  return {
    id: schoolId,
    label: schoolId,
    borderColor: "#8b8567",
  }
}

export const getPerkCardBorderColor = (
  schools: MagicSchoolDefinition[],
  schoolId: MagicSchoolId,
) => {
  return getMagicSchool(schools, schoolId).borderColor
}

export const buildPerkCardView = (
  schools: MagicSchoolDefinition[],
  perk: SurvivorPerkCardDefinition,
): SurvivorPerkCardView => {
  return {
    id: perk.id,
    label: perk.label,
    schoolId: perk.schoolId,
    borderColor: getPerkCardBorderColor(schools, perk.schoolId),
    rarity: perk.rarity,
    summary: perk.summary,
    synergyHint: perk.synergyHint,
  }
}

const pushIfBlank = (
  errors: SurvivorDefinitionValidationError[],
  path: string,
  value: string,
) => {
  if (value.trim().length <= 0) {
    errors.push({
      path,
      message: "must not be blank",
    })
  }
}

const pushDuplicates = (
  errors: SurvivorDefinitionValidationError[],
  ids: string[],
  path: string,
) => {
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) {
      errors.push({
        path,
        message: `duplicate id ${id}`,
      })
      continue
    }
    seen.add(id)
  }
}

export const validateSurvivorModeDefinition = (definition: SurvivorModeDefinition): SurvivorDefinitionValidationError[] => {
  const errors: SurvivorDefinitionValidationError[] = []

  pushIfBlank(errors, "title", definition.title)
  if (definition.coreLoop.length <= 0) {
    errors.push({
      path: "coreLoop",
      message: "must include at least one step",
    })
  }
  for (let index = 0; index < definition.coreLoop.length; index += 1) {
    pushIfBlank(errors, `coreLoop[${index}]`, definition.coreLoop[index] ?? "")
  }

  const schoolIds = definition.schools.map((school) => school.id)
  pushDuplicates(errors, schoolIds, "schools")
  for (let index = 0; index < definition.schools.length; index += 1) {
    const school = definition.schools[index]
    pushIfBlank(errors, `schools[${index}].label`, school.label)
    pushIfBlank(errors, `schools[${index}].borderColor`, school.borderColor)
  }
  const schoolSet = new Set(definition.schools.map((school) => school.id))

  const weaponIds = definition.weapons.map((weapon) => weapon.id)
  pushDuplicates(errors, weaponIds, "weapons")
  const weaponSet = new Set(weaponIds)
  if (!weaponSet.has(definition.player.weaponId)) {
    errors.push({
      path: "player.weaponId",
      message: `unknown weapon id ${definition.player.weaponId}`,
    })
  }
  if (!schoolSet.has(definition.player.primarySchoolId)) {
    errors.push({
      path: "player.primarySchoolId",
      message: `unknown school id ${definition.player.primarySchoolId}`,
    })
  }

  const statusIds = definition.statusEffects.map((effect) => effect.id)
  pushDuplicates(errors, statusIds, "statusEffects")
  for (let index = 0; index < definition.statusEffects.length; index += 1) {
    const effect = definition.statusEffects[index]
    if (!schoolSet.has(effect.schoolId)) {
      errors.push({
        path: `statusEffects[${index}].schoolId`,
        message: `unknown school id ${effect.schoolId}`,
      })
    }
  }

  const perkIds = definition.perkCards.map((perk) => perk.id)
  pushDuplicates(errors, perkIds, "perkCards")
  for (let index = 0; index < definition.perkCards.length; index += 1) {
    const perk = definition.perkCards[index]
    if (!schoolSet.has(perk.schoolId)) {
      errors.push({
        path: `perkCards[${index}].schoolId`,
        message: `unknown school id ${perk.schoolId}`,
      })
    }
    if (perk.triggers.length <= 0) {
      errors.push({
        path: `perkCards[${index}].triggers`,
        message: "must include at least one trigger",
      })
    }
    for (let triggerIndex = 0; triggerIndex < perk.triggers.length; triggerIndex += 1) {
      const trigger = perk.triggers[triggerIndex]
      pushIfBlank(errors, `perkCards[${index}].triggers[${triggerIndex}].condition`, trigger.condition)
      pushIfBlank(errors, `perkCards[${index}].triggers[${triggerIndex}].outcome`, trigger.outcome)
    }
  }

  const enemyIds = definition.enemies.map((enemy) => enemy.id)
  pushDuplicates(errors, enemyIds, "enemies")
  const enemySet = new Set(enemyIds)

  if (!schoolSet.has(definition.cardDraft.neutralSchoolId)) {
    errors.push({
      path: "cardDraft.neutralSchoolId",
      message: `unknown school id ${definition.cardDraft.neutralSchoolId}`,
    })
  }
  if (definition.cardDraft.cardsPerDraft <= 0) {
    errors.push({
      path: "cardDraft.cardsPerDraft",
      message: "must be greater than 0",
    })
  }
  if (definition.cardDraft.rerollsPerDraft < 0) {
    errors.push({
      path: "cardDraft.rerollsPerDraft",
      message: "must be 0 or greater",
    })
  }

  let previousWaveSecond = -1
  for (let index = 0; index < definition.waveTimeline.length; index += 1) {
    const wave = definition.waveTimeline[index]
    if (wave.atSeconds < 0) {
      errors.push({
        path: `waveTimeline[${index}].atSeconds`,
        message: "must be 0 or greater",
      })
    }
    if (wave.atSeconds < previousWaveSecond) {
      errors.push({
        path: `waveTimeline[${index}].atSeconds`,
        message: "must be sorted in ascending order",
      })
    }
    previousWaveSecond = wave.atSeconds

    if (wave.enemyId && !enemySet.has(wave.enemyId)) {
      errors.push({
        path: `waveTimeline[${index}].enemyId`,
        message: `unknown enemy id ${wave.enemyId}`,
      })
    }

    if (wave.type === "spawn-pack" || wave.type === "spawn-elite" || wave.type === "spawn-boss") {
      if (!wave.enemyId) {
        errors.push({
          path: `waveTimeline[${index}].enemyId`,
          message: "required for spawn event types",
        })
      }
      if (!wave.count || wave.count <= 0) {
        errors.push({
          path: `waveTimeline[${index}].count`,
          message: "must be greater than 0 for spawn event types",
        })
      }
    }
  }

  return errors
}
