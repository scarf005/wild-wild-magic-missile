import { Pickup, type Unit } from "../entities.ts"
import { clamp, distSquared, limitToArena, randomPointInArena, randomRange } from "../utils.ts"
import { isHighTierPrimary, pickupAmmoForWeapon } from "../weapons.ts"
import type { PerkId, PrimaryWeaponId, Team } from "../types.ts"
import type { WorldState } from "../world/state.ts"
import { LOOT_PICKUP_INTERVAL_MAX_SECONDS, LOOT_PICKUP_INTERVAL_MIN_SECONDS } from "../world/constants.ts"
import { isObstacleCellSolid } from "../world/obstacle-grid.ts"

const EJECTED_PICKUP_THROW_SPEED = 24
const EJECTED_PICKUP_DRAG = 3.1
const EJECTED_PICKUP_STOP_SPEED = 2.2
const EJECTED_PICKUP_DAMAGE = 1

const collidesWithObstacleGrid = (world: WorldState, x: number, y: number, radius: number) => {
  const grid = world.obstacleGrid
  const half = Math.floor(grid.size * 0.5)
  const minX = Math.max(0, Math.floor(x - radius) + half)
  const maxX = Math.min(grid.size - 1, Math.floor(x + radius) + half)
  const minY = Math.max(0, Math.floor(y - radius) + half)
  const maxY = Math.min(grid.size - 1, Math.floor(y + radius) + half)
  const radiusSquared = radius * radius

  for (let gy = minY; gy <= maxY; gy += 1) {
    const centerY = gy - half + 0.5
    const dy = Math.max(0, Math.abs(y - centerY) - 0.5)
    if (dy > radius) {
      continue
    }

    for (let gx = minX; gx <= maxX; gx += 1) {
      if (!isObstacleCellSolid(grid, gx, gy)) {
        continue
      }

      const centerX = gx - half + 0.5
      const dx = Math.max(0, Math.abs(x - centerX) - 0.5)
      if (dx > radius) {
        continue
      }

      if (dx * dx + dy * dy < radiusSquared) {
        return true
      }
    }
  }

  return false
}

export interface PickupDeps {
  randomLootablePrimary: () => PrimaryWeaponId
  randomHighTierPrimary?: () => PrimaryWeaponId
  highTierChance?: number
  force?: boolean
  disableAutoSpawn?: boolean
}

export interface PerkPickupDeps {
  randomPerk: () => PerkId
  force?: boolean
}

export interface XpPickupDeps {
  value: number
  force?: boolean
}

export const spawnPickupAt = (world: WorldState, position: { x: number; y: number }, deps: PickupDeps) => {
  let slot = world.pickups.find((pickup) => !pickup.active)
  if (!slot && deps.force) {
    slot = new Pickup()
    world.pickups.push(slot)
  }

  if (!slot) {
    return
  }

  slot.active = true
  slot.kind = "weapon"
  slot.position.set(position.x, position.y)
  const highTierRoll = (deps.highTierChance ?? 0) > 0 && Math.random() < (deps.highTierChance ?? 0)
  if (highTierRoll && deps.randomHighTierPrimary) {
    slot.weapon = deps.randomHighTierPrimary()
    slot.highTier = true
  } else {
    slot.weapon = deps.randomLootablePrimary()
    slot.highTier = false
  }
  slot.radius = 0.8
  slot.bob = randomRange(0, Math.PI * 2)
  slot.rotation = randomRange(0, Math.PI * 2)
  slot.perkId = null
  slot.xpValue = 0
  slot.velocity.set(0, 0)
  slot.throwOwnerId = ""
  slot.throwOwnerTeam = "white"
  slot.throwDamageArmed = false
}

export const spawnPerkPickupAt = (world: WorldState, position: { x: number; y: number }, deps: PerkPickupDeps) => {
  let slot = world.pickups.find((pickup) => !pickup.active)
  if (!slot && deps.force) {
    slot = new Pickup()
    world.pickups.push(slot)
  }

  if (!slot) {
    return
  }

  slot.active = true
  slot.kind = "perk"
  slot.position.set(position.x, position.y)
  slot.perkId = deps.randomPerk()
  slot.weapon = "assault"
  slot.highTier = false
  slot.radius = 0.8
  slot.bob = randomRange(0, Math.PI * 2)
  slot.rotation = randomRange(0, Math.PI * 2)
  slot.velocity.set(0, 0)
  slot.throwOwnerId = ""
  slot.throwOwnerTeam = "white"
  slot.throwDamageArmed = false
  slot.xpValue = 0
}

export const spawnXpPickupAt = (world: WorldState, position: { x: number; y: number }, deps: XpPickupDeps) => {
  let slot = world.pickups.find((pickup) => !pickup.active)
  if (!slot && deps.force) {
    slot = new Pickup()
    world.pickups.push(slot)
  }

  if (!slot) {
    return
  }

  slot.active = true
  slot.kind = "xp"
  slot.position.set(position.x, position.y)
  slot.perkId = null
  slot.weapon = "assault"
  slot.highTier = false
  slot.radius = 0.55
  slot.bob = randomRange(0, Math.PI * 2)
  slot.rotation = randomRange(0, Math.PI * 2)
  slot.velocity.set(0, 0)
  slot.throwOwnerId = ""
  slot.throwOwnerTeam = "white"
  slot.throwDamageArmed = false
  slot.xpValue = Math.max(1, Math.floor(deps.value))
}

export const spawnPickup = (world: WorldState, deps: PickupDeps) => {
  const spawnRadius = Math.max(0, world.arenaRadius * 0.5)
  const pickupRadius = 0.8
  let spawn = randomPointInArena(spawnRadius, 0)

  for (let attempt = 0; attempt < 32; attempt += 1) {
    if (!collidesWithObstacleGrid(world, spawn.x, spawn.y, pickupRadius)) {
      break
    }
    spawn = randomPointInArena(spawnRadius, 0)
  }

  if (collidesWithObstacleGrid(world, spawn.x, spawn.y, pickupRadius)) {
    return
  }

  spawnPickupAt(world, spawn, deps)
}

export interface PickupImpactDamageDeps {
  applyDamage: (
    targetId: string,
    amount: number,
    sourceId: string,
    sourceTeam: Team,
    hitX: number,
    hitY: number,
    impactX: number,
    impactY: number,
  ) => void
}

export const updatePickups = (world: WorldState, dt: number, deps: PickupDeps & PickupImpactDamageDeps) => {
  world.pickupTimer -= dt

  for (const pickup of world.pickups) {
    if (!pickup.active) {
      continue
    }

    const speed = Math.hypot(pickup.velocity.x, pickup.velocity.y)
    if (speed > 0.001) {
      const previousX = pickup.position.x
      const previousY = pickup.position.y
      pickup.position.x += pickup.velocity.x * dt
      pickup.position.y += pickup.velocity.y * dt

      const collidedArena = limitToArena(pickup.position, pickup.radius, world.arenaRadius)
      const collidedObstacle = collidesWithObstacleGrid(world, pickup.position.x, pickup.position.y, pickup.radius)
      if (collidedArena || collidedObstacle) {
        pickup.position.x = previousX
        pickup.position.y = previousY
        pickup.velocity.set(0, 0)
        pickup.throwDamageArmed = false
      } else if (pickup.throwDamageArmed) {
        for (const unit of world.units) {
          if (unit.id === pickup.throwOwnerId) {
            continue
          }

          const hitRadius = pickup.radius + unit.radius
          const hitRadiusSq = hitRadius * hitRadius
          if (distSquared(unit.position.x, unit.position.y, pickup.position.x, pickup.position.y) > hitRadiusSq) {
            continue
          }

          deps.applyDamage(
            unit.id,
            EJECTED_PICKUP_DAMAGE,
            pickup.throwOwnerId,
            pickup.throwOwnerTeam,
            unit.position.x,
            unit.position.y,
            pickup.velocity.x,
            pickup.velocity.y,
          )
          pickup.throwDamageArmed = false
          pickup.velocity.set(0, 0)
          break
        }
      }

      const dragFactor = clamp(1 - EJECTED_PICKUP_DRAG * dt, 0, 1)
      pickup.velocity.scale(dragFactor)
      if (pickup.velocity.length() <= EJECTED_PICKUP_STOP_SPEED) {
        pickup.velocity.set(0, 0)
      }
    }

    pickup.bob += dt * 2.3
  }

  if (!deps.disableAutoSpawn && world.pickupTimer <= 0) {
    spawnPickup(world, deps)
    world.pickupTimer = randomRange(LOOT_PICKUP_INTERVAL_MIN_SECONDS, LOOT_PICKUP_INTERVAL_MAX_SECONDS)
  }
}

export interface CollectPickupDeps {
  equipPrimary: (
    unit: Unit,
    weaponId: PrimaryWeaponId,
    ammo: number,
  ) => PrimaryWeaponId | null
  applyPerk: (unit: Unit, perkId: PerkId) => { applied: boolean; stacks: number }
  perkStacks: (unit: Unit, perkId: PerkId) => number
  onPlayerPickup: (weaponId: PrimaryWeaponId) => void
  onPlayerPerkPickup: (perkId: PerkId, stacks: number) => void
  onPlayerXpPickup: (value: number) => void
}

export const collectNearbyPickup = (world: WorldState, unit: Unit, deps: CollectPickupDeps) => {
  for (const pickup of world.pickups) {
    if (!pickup.active) {
      continue
    }

    const limit = unit.radius + pickup.radius
    const dsq = distSquared(unit.position.x, unit.position.y, pickup.position.x, pickup.position.y)
    if (dsq > limit * limit) {
      continue
    }

    if (pickup.kind === "perk") {
      if (!pickup.perkId) {
        pickup.active = false
        continue
      }

      const result = deps.applyPerk(unit, pickup.perkId)
      if (!result.applied) {
        continue
      }

      const perkId = pickup.perkId
      pickup.active = false
      pickup.highTier = false
      pickup.velocity.set(0, 0)
      pickup.throwOwnerId = ""
      pickup.throwOwnerTeam = "white"
      pickup.throwDamageArmed = false
      pickup.kind = "weapon"
      pickup.perkId = null

      if (unit.isPlayer) {
        deps.onPlayerPerkPickup(perkId, deps.perkStacks(unit, perkId))
      }

      break
    }

    if (pickup.kind === "xp") {
      const value = Math.max(1, pickup.xpValue || 1)
      pickup.active = false
      pickup.highTier = false
      pickup.velocity.set(0, 0)
      pickup.throwOwnerId = ""
      pickup.throwOwnerTeam = "white"
      pickup.throwDamageArmed = false
      pickup.kind = "weapon"
      pickup.perkId = null
      pickup.xpValue = 0

      if (unit.isPlayer) {
        deps.onPlayerXpPickup(value)
      }

      break
    }

    const collectedWeapon = pickup.weapon
    const ejectedWeapon = deps.equipPrimary(unit, collectedWeapon, pickupAmmoForWeapon(collectedWeapon))

    if (ejectedWeapon && ejectedWeapon !== "pistol") {
      pickup.weapon = ejectedWeapon
      pickup.kind = "weapon"
      pickup.perkId = null
      pickup.highTier = isHighTierPrimary(ejectedWeapon)
      pickup.active = true
      const dropDistance = unit.radius + pickup.radius + 0.5
      const aimLength = Math.hypot(unit.aim.x, unit.aim.y)
      const fallbackAngle = randomRange(0, Math.PI * 2)
      const throwDirX = aimLength > 0.0001 ? -unit.aim.x / aimLength : Math.cos(fallbackAngle)
      const throwDirY = aimLength > 0.0001 ? -unit.aim.y / aimLength : Math.sin(fallbackAngle)
      pickup.position.set(
        unit.position.x + throwDirX * dropDistance,
        unit.position.y + throwDirY * dropDistance,
      )
      pickup.velocity.set(throwDirX * EJECTED_PICKUP_THROW_SPEED, throwDirY * EJECTED_PICKUP_THROW_SPEED)
      pickup.throwOwnerId = unit.id
      pickup.throwOwnerTeam = unit.team
      pickup.throwDamageArmed = true
      pickup.bob = randomRange(0, Math.PI * 2)
      pickup.rotation = randomRange(0, Math.PI * 2)
      pickup.xpValue = 0
    } else {
      pickup.active = false
      pickup.highTier = false
      pickup.velocity.set(0, 0)
      pickup.throwOwnerId = ""
      pickup.throwOwnerTeam = "white"
      pickup.throwDamageArmed = false
      pickup.kind = "weapon"
      pickup.perkId = null
      pickup.xpValue = 0
    }

    if (unit.isPlayer) {
      deps.onPlayerPickup(collectedWeapon)
    }

    break
  }
}
