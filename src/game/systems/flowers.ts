import { clamp, limitToArena, randomInt } from "../utils.ts"
import type { WorldState } from "../world/state.ts"
import { BURNED_FACTION_ID, BURNED_FLOWER_ACCENT, BURNED_FLOWER_COLOR } from "../factions.ts"

const FLOWER_SPAWN_CONE_HALF_ANGLE = 0.42
const FLOWER_BACK_OFFSET = 0.26
const FLOWER_DISTANCE_MIN = 0.08
const FLOWER_DISTANCE_MAX = 1.85
const FLOWER_FORWARD_JITTER = 0.05
const FLOWER_LATERAL_JITTER = 0.03
const FLOWER_PUSH_ATTEMPTS = 9
const FLOWER_PUSH_DISTANCE_STEP = 0.34
const FLOWER_TILE_CAPACITY = 18
const FLOWER_SIZE_MIN = 0.14
const FLOWER_SIZE_MAX = 0.34

const FLOWER_AMOUNT_MIN = 10
const FLOWER_AMOUNT_MAX = 20
const FLOWER_AMOUNT_MULTIPLIER = 2
const FLOWER_AMOUNT_SCALE = 0.2
const FLOWER_DAMAGE_REFERENCE = 2.1
const FLOWER_IMPACT_SPEED_REFERENCE = 40
const FLOWER_COUNT_SCALE_MIN = 0.55
const FLOWER_COUNT_SCALE_MAX = 1.75
const FLOWER_SIZE_SCALE_MIN = 0.6
const FLOWER_SIZE_SCALE_MAX = 1.9
const FLOWER_BLOOM_DURATION_SECONDS = 0.066
const FLOWER_LIFETIME_MIN_SECONDS = 14
const FLOWER_LIFETIME_MAX_SECONDS = 28
const PLAYER_IMPACT_BLOOM_DELAYS = [0.05, 0.1, 0.15, 0.2, 0.25]
const SURVIVOR_BLOOD_COLOR = "#a6bf45"
const SURVIVOR_BLOOD_ACCENT = "#859a2f"

export interface FlowerBurstProfile {
  amount: number
  sizeScale: number
}

export interface FlowerSpawnDeps {
  allocFlower: () => WorldState["flowers"][number]
  playerId: string
  botPalette: (id: string) => { tone: string; edge: string }
  factionColor: (id: string) => string | null
  onCoverageUpdated: () => void
}

export interface FlowerSpawnOptions {
  staggeredBloom?: boolean
}

const toHex = (value: number) => {
  return Math.round(clamp(value, 0, 255)).toString(16).padStart(2, "0")
}

const bloodify = (hex: string, darkness = 0.62, redBoost = 34) => {
  const cleaned = hex.replace("#", "")
  if (cleaned.length !== 6) {
    return hex
  }

  const red = Number.parseInt(cleaned.slice(0, 2), 16)
  const green = Number.parseInt(cleaned.slice(2, 4), 16)
  const blue = Number.parseInt(cleaned.slice(4, 6), 16)
  const heavyRed = red * darkness + redBoost
  const heavyGreen = green * darkness * 0.34
  const heavyBlue = blue * darkness * 0.26

  return `#${toHex(heavyRed)}${toHex(heavyGreen)}${toHex(heavyBlue)}`
}

const shiftHex = (hex: string, offset: number) => {
  const cleaned = hex.replace("#", "")
  if (cleaned.length !== 6) {
    return hex
  }

  const red = Number.parseInt(cleaned.slice(0, 2), 16)
  const green = Number.parseInt(cleaned.slice(2, 4), 16)
  const blue = Number.parseInt(cleaned.slice(4, 6), 16)

  return `#${toHex(red + offset)}${toHex(green + offset)}${toHex(blue + offset)}`
}

const flowerPalette = (
  world: WorldState,
  ownerId: string,
  scoreOwnerId: string,
  deps: FlowerSpawnDeps,
  isBurnt: boolean,
) => {
  const isSurvivorMode = world.player.team === "arcanist"

  if (ownerId === deps.playerId) {
    return {
      team: "white" as const,
      color: isSurvivorMode ? SURVIVOR_BLOOD_COLOR : "#9a1e1e",
      accent: isSurvivorMode ? SURVIVOR_BLOOD_ACCENT : "#d84b35",
      fromPlayer: true,
    }
  }

  if (isBurnt || ownerId === BURNED_FACTION_ID) {
    return {
      team: "white" as const,
      color: BURNED_FLOWER_COLOR,
      accent: BURNED_FLOWER_ACCENT,
      fromPlayer: false,
    }
  }

  if (scoreOwnerId !== ownerId) {
    const factionColor = deps.factionColor(scoreOwnerId)
    if (factionColor) {
      return {
        team: scoreOwnerId,
        color: isSurvivorMode ? SURVIVOR_BLOOD_COLOR : bloodify(factionColor, 0.82, 26),
        accent: isSurvivorMode ? SURVIVOR_BLOOD_ACCENT : "#4b1613",
        fromPlayer: scoreOwnerId === deps.playerId,
      }
    }
  }

  const botIdCandidate = ownerId.replace("bot-", "")
  const botIndex = Number(botIdCandidate)
  if (!Number.isInteger(botIndex) || botIndex <= 0) {
    return {
      team: "white" as const,
      color: isSurvivorMode ? SURVIVOR_BLOOD_COLOR : "#5a1b1b",
      accent: isSurvivorMode ? SURVIVOR_BLOOD_ACCENT : "#2f0f0f",
      fromPlayer: false,
    }
  }

  const palette = deps.botPalette(ownerId)
  return {
    team: "blue" as const,
    color: isSurvivorMode ? SURVIVOR_BLOOD_COLOR : bloodify(palette.tone, 0.72, 30),
    accent: isSurvivorMode ? SURVIVOR_BLOOD_ACCENT : "#2a0e0e",
    fromPlayer: false,
  }
}

const flowerScoreBucket = (flower: WorldState["flowers"][number]) => {
  return flower.scorched ? BURNED_FACTION_ID : flower.ownerId
}

const ownerSeed = (ownerId: string) => {
  let seed = 2166136261
  for (let index = 0; index < ownerId.length; index += 1) {
    seed ^= ownerId.charCodeAt(index)
    seed = Math.imul(seed, 16777619)
  }
  return Math.abs(seed)
}

const seeded01 = (seed: number) => {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453123
  return value - Math.floor(value)
}

const seededRange = (seed: number, min: number, max: number) => {
  return min + seeded01(seed) * (max - min)
}

const FLOWER_COLOR_VARIANTS = [-28, -16, -7, 5]

const flowerCellIndexAt = (world: WorldState, x: number, y: number) => {
  const size = world.terrainMap.size
  const half = Math.floor(size * 0.5)
  const gridX = Math.floor(x) + half
  const gridY = Math.floor(y) + half
  if (gridX < 0 || gridY < 0 || gridX >= size || gridY >= size) {
    return -1
  }

  return gridY * size + gridX
}

const linkFlowerToCell = (world: WorldState, flower: WorldState["flowers"][number], cellIndex: number) => {
  if (cellIndex < 0 || cellIndex >= world.flowerCellHead.length) {
    flower.bloomCell = -1
    flower.prevInCell = -1
    flower.nextInCell = -1
    return
  }

  const flowerIndex = flower.slotIndex
  if (flowerIndex < 0 || flowerIndex >= world.flowers.length) {
    flower.bloomCell = -1
    flower.prevInCell = -1
    flower.nextInCell = -1
    return
  }

  const currentHead = world.flowerCellHead[cellIndex]
  flower.bloomCell = cellIndex
  flower.prevInCell = -1
  flower.nextInCell = currentHead
  if (currentHead >= 0 && currentHead < world.flowers.length) {
    world.flowers[currentHead].prevInCell = flowerIndex
  }
  world.flowerCellHead[cellIndex] = flowerIndex
}

const removeFlowerFromDensity = (world: WorldState, flower: WorldState["flowers"][number]) => {
  if (flower.bloomCell < 0 || flower.bloomCell >= world.flowerDensityGrid.length) {
    flower.bloomCell = -1
    flower.prevInCell = -1
    flower.nextInCell = -1
    return
  }

  const cellIndex = flower.bloomCell
  const prev = flower.prevInCell
  const next = flower.nextInCell
  if (prev >= 0 && prev < world.flowers.length) {
    world.flowers[prev].nextInCell = next
  } else {
    world.flowerCellHead[cellIndex] = next
  }
  if (next >= 0 && next < world.flowers.length) {
    world.flowers[next].prevInCell = prev
  }

  world.flowerDensityGrid[cellIndex] = Math.max(0, world.flowerDensityGrid[cellIndex] - flower.bloomWeight)
  flower.bloomCell = -1
  flower.bloomWeight = 1
  flower.prevInCell = -1
  flower.nextInCell = -1
}

const retireFlower = (world: WorldState, flower: WorldState["flowers"][number]) => {
  if (!flower.active) {
    return
  }

  const bucket = flowerScoreBucket(flower)
  if (bucket in world.factionFlowerCounts) {
    world.factionFlowerCounts[bucket] = Math.max(0, world.factionFlowerCounts[bucket] - 1)
  }

  removeFlowerFromDensity(world, flower)
  flower.active = false
  flower.size = 0
  flower.targetSize = 0
  flower.life = 0
  flower.maxLife = 0
  flower.alpha = 0
  flower.renderDirty = false
}

const pickFlowerPosition = (
  world: WorldState,
  originX: number,
  originY: number,
  angle: number,
  angleDeltaNormalized: number,
  occupancyWeight: number,
  seed: number,
) => {
  const spreadX = Math.cos(angle)
  const spreadY = Math.sin(angle)
  const lateralX = -spreadY
  const lateralY = spreadX
  const centerBias = 1 - clamp(Math.abs(angleDeltaNormalized), 0, 1)
  const directionalScale = 0.5 + centerBias * 0.7
  let chosenX = originX + spreadX * FLOWER_DISTANCE_MAX
  let chosenY = originY + spreadY * FLOWER_DISTANCE_MAX
  let lowestCount = Number.POSITIVE_INFINITY

  for (let attempt = 0; attempt < FLOWER_PUSH_ATTEMPTS; attempt += 1) {
    const rawDistanceFactor = seeded01(seed + attempt * 1.13)
    const biasedDistanceFactor = Math.pow(rawDistanceFactor, 0.65)
    const distance = (
          FLOWER_DISTANCE_MIN +
          biasedDistanceFactor * (FLOWER_DISTANCE_MAX - FLOWER_DISTANCE_MIN)
        ) * directionalScale + attempt * FLOWER_PUSH_DISTANCE_STEP
    const forwardJitter = seededRange(seed + attempt * 2.31, -FLOWER_FORWARD_JITTER, FLOWER_FORWARD_JITTER)
    const lateralJitter = seededRange(seed + attempt * 3.41, -FLOWER_LATERAL_JITTER, FLOWER_LATERAL_JITTER)
    const candidateX = originX + spreadX * (distance + forwardJitter) + lateralX * lateralJitter
    const candidateY = originY + spreadY * (distance + forwardJitter) + lateralY * lateralJitter
    const cellIndex = flowerCellIndexAt(world, candidateX, candidateY)
    const cellCount = cellIndex < 0 ? 0 : world.flowerDensityGrid[cellIndex]
    const projectedCount = cellCount + occupancyWeight
    if (projectedCount < lowestCount) {
      lowestCount = projectedCount
      chosenX = candidateX
      chosenY = candidateY
    }

    if (projectedCount <= FLOWER_TILE_CAPACITY) {
      return { x: candidateX, y: candidateY }
    }
  }

  return { x: chosenX, y: chosenY }
}

const flowerOccupancyWeight = (targetSize: number) => {
  const normalized = clamp((targetSize - FLOWER_SIZE_MIN) / Math.max(0.001, FLOWER_SIZE_MAX - FLOWER_SIZE_MIN), 0, 1)
  return 1 + Math.floor(normalized * 2.999)
}

export const spawnFlowers = (
  world: WorldState,
  ownerId: string,
  scoreOwnerId: string,
  x: number,
  y: number,
  dirX: number,
  dirY: number,
  amount: number,
  sizeScale: number,
  deps: FlowerSpawnDeps,
  isBurnt = false,
  options: FlowerSpawnOptions = {},
) => {
  const palette = flowerPalette(world, ownerId, scoreOwnerId, deps, isBurnt)
  const dirLength = Math.hypot(dirX, dirY) || 1
  const nx = dirX / dirLength
  const ny = dirY / dirLength
  const baseAngle = Math.atan2(ny, nx)
  const originX = x + nx * FLOWER_BACK_OFFSET
  const originY = y + ny * FLOWER_BACK_OFFSET
  const bloomScale = clamp(sizeScale, FLOWER_SIZE_SCALE_MIN, FLOWER_SIZE_SCALE_MAX)
  const baseSeed = ownerSeed(ownerId) * 0.0001 +
    x * 0.73 +
    y * 1.17 +
    nx * 2.11 +
    ny * 2.67 +
    world.playerFlowerTotal * 0.0023

  for (let index = 0; index < amount; index += 1) {
    const flowerSeed = baseSeed + index * 0.619
    const angleSeed = seededRange(flowerSeed + 0.91, -1, 1)
    const angleBias = Math.sign(angleSeed) * Math.pow(Math.abs(angleSeed), 1.6)
    const angleOffset = angleBias * FLOWER_SPAWN_CONE_HALF_ANGLE
    const angle = baseAngle + angleOffset
    const targetSize = seededRange(flowerSeed + 1.47, FLOWER_SIZE_MIN, FLOWER_SIZE_MAX) * bloomScale
    const bloomWeight = flowerOccupancyWeight(targetSize)
    const spawn = pickFlowerPosition(
      world,
      originX,
      originY,
      angle,
      angleOffset / FLOWER_SPAWN_CONE_HALF_ANGLE,
      bloomWeight,
      flowerSeed + 2.03,
    )
    let spawnX = spawn.x
    let spawnY = spawn.y
    const spawnLength = Math.hypot(spawnX, spawnY)
    const maxRadius = world.arenaRadius - 0.2
    if (spawnLength > maxRadius && spawnLength > 0) {
      const scale = maxRadius / spawnLength
      spawnX *= scale
      spawnY *= scale
    }
    const bloomCell = flowerCellIndexAt(world, spawnX, spawnY)

    if (bloomCell >= 0) {
      world.flowerDensityGrid[bloomCell] = Math.min(65535, world.flowerDensityGrid[bloomCell] + bloomWeight)
    }

    const flower = deps.allocFlower()
    if (flower.active) {
      const previousOwner = flower.ownerId
      const previousBucket = flowerScoreBucket(flower)
      if (previousBucket in world.factionFlowerCounts) {
        world.factionFlowerCounts[previousBucket] = Math.max(0, world.factionFlowerCounts[previousBucket] - 1)
      }
      removeFlowerFromDensity(world, flower)
    }

    flower.active = true
    if (!flower.renderDirty) {
      flower.renderDirty = true
      world.flowerDirtyIndices.add(flower.slotIndex)
      world.flowerDirtyCount = world.flowerDirtyIndices.size
    }
    flower.team = palette.team
    flower.ownerId = scoreOwnerId
    const colorVariantIndex = Math.floor(seeded01(flowerSeed + 6.43) * FLOWER_COLOR_VARIANTS.length) %
      FLOWER_COLOR_VARIANTS.length
    const colorOffset = FLOWER_COLOR_VARIANTS[colorVariantIndex]
    flower.color = shiftHex(palette.color, colorOffset)
    flower.accent = shiftHex(palette.accent, Math.round(colorOffset * 0.6))
    flower.scorched = isBurnt
    flower.position.set(
      spawnX,
      spawnY,
    )
    limitToArena(flower.position, 0.2, world.arenaRadius)
    flower.bloomWeight = bloomWeight
    flower.prevInCell = -1
    flower.nextInCell = -1
    if (bloomCell >= 0) {
      linkFlowerToCell(world, flower, bloomCell)
    } else {
      flower.bloomCell = -1
    }
    flower.targetSize = targetSize
    flower.bloomDelay = options.staggeredBloom
      ? PLAYER_IMPACT_BLOOM_DELAYS[index % PLAYER_IMPACT_BLOOM_DELAYS.length]
      : 0
    flower.pop = 0
    flower.size = 0
    flower.maxLife = seededRange(flowerSeed + 8.77, FLOWER_LIFETIME_MIN_SECONDS, FLOWER_LIFETIME_MAX_SECONDS)
    flower.life = flower.maxLife
    flower.alpha = 1

    if (scoreOwnerId in world.factionFlowerCounts) {
      world.factionFlowerCounts[scoreOwnerId] += 1
    }
  }

  if (palette.fromPlayer) {
    world.playerFlowerTotal += amount
  }

  deps.onCoverageUpdated()
}

export const updateFlowers = (world: WorldState, dt: number) => {
  const bloomStep = dt / FLOWER_BLOOM_DURATION_SECONDS
  for (const flower of world.flowers) {
    if (!flower.active) {
      continue
    }

    if (flower.bloomDelay > 0) {
      flower.bloomDelay = Math.max(0, flower.bloomDelay - dt)
      if (flower.bloomDelay > 0) {
        flower.size = 0
        continue
      }
    }

    if (flower.pop >= 1) {
      flower.size = flower.targetSize
    } else {
      flower.pop = clamp(flower.pop + bloomStep, 0, 1)
      const easedBloom = Math.pow(flower.pop, 0.16)
      flower.size = flower.targetSize * easedBloom
    }

    if (flower.maxLife > 0) {
      flower.life = Math.max(0, flower.life - dt)
      flower.alpha = clamp(flower.life / flower.maxLife, 0, 1)
      if (flower.life <= 0 || flower.alpha <= 0.001) {
        retireFlower(world, flower)
      }
    }
  }
}

export const randomFlowerBurst = (damage: number, impactSpeed: number): FlowerBurstProfile => {
  const damageFactor = clamp(damage / FLOWER_DAMAGE_REFERENCE, 0.35, 2.4)
  const speedFactor = clamp(impactSpeed / FLOWER_IMPACT_SPEED_REFERENCE, 0.2, 2.2)

  const amountScale = clamp(
    1 + (speedFactor - 1) * 0.65 - (damageFactor - 1) * 0.5,
    FLOWER_COUNT_SCALE_MIN,
    FLOWER_COUNT_SCALE_MAX,
  )
  const sizeScale = clamp(
    1 + (damageFactor - 1) * 0.7 - (speedFactor - 1) * 0.45,
    FLOWER_SIZE_SCALE_MIN,
    FLOWER_SIZE_SCALE_MAX,
  )

  return {
    amount: Math.max(
      2,
      Math.round(randomInt(FLOWER_AMOUNT_MIN, FLOWER_AMOUNT_MAX) * amountScale * FLOWER_AMOUNT_MULTIPLIER * FLOWER_AMOUNT_SCALE),
    ),
    sizeScale,
  }
}

export const updateDamagePopups = (world: WorldState, dt: number) => {
  for (const popup of world.damagePopups) {
    if (!popup.active) {
      continue
    }

    popup.life -= dt
    popup.position.x += popup.velocity.x * dt
    popup.position.y += popup.velocity.y * dt
    popup.velocity.y -= dt * 3.2
    popup.velocity.x *= clamp(1 - dt * 1.7, 0, 1)

    if (popup.life <= 0) {
      popup.active = false
    }
  }
}
