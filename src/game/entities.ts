import type { AIState, PerkId, PrimaryWeaponId, SecondaryMode, SurvivorEnemyArchetype, Team } from "./types.ts"
import { UNIT_BASE_HP } from "./world/constants.ts"

export interface PrimaryWeaponSlot {
  weaponId: PrimaryWeaponId
  primaryAmmo: number
  reserveAmmo: number
  magazineSize: number
  acquiredAt: number
}

export class Vec2 {
  x: number
  y: number

  constructor(x = 0, y = 0) {
    this.x = x
    this.y = y
  }

  set(x: number, y: number) {
    this.x = x
    this.y = y
    return this
  }

  copy(v: Vec2) {
    this.x = v.x
    this.y = v.y
    return this
  }

  clone() {
    return new Vec2(this.x, this.y)
  }

  add(v: Vec2) {
    this.x += v.x
    this.y += v.y
    return this
  }

  subtract(v: Vec2) {
    this.x -= v.x
    this.y -= v.y
    return this
  }

  scale(s: number) {
    this.x *= s
    this.y *= s
    return this
  }

  length() {
    return Math.hypot(this.x, this.y)
  }

  normalize() {
    const len = this.length() || 1
    this.x /= len
    this.y /= len
    return this
  }

  dot(v: Vec2) {
    return this.x * v.x + this.y * v.y
  }
}

export class Unit {
  id: string
  isPlayer: boolean
  team: Team
  position = new Vec2()
  velocity = new Vec2()
  aim = new Vec2(1, 0)
  radius = 14
  speed = 175
  maxHp = UNIT_BASE_HP
  hp = UNIT_BASE_HP
  shootCooldown = 0
  secondaryCooldown = 0
  secondaryCooldownMax = 0
  reloadCooldown = 0
  reloadCooldownMax = 0
  primaryWeapon: PrimaryWeaponId = "pistol"
  primaryAmmo = Number.POSITIVE_INFINITY
  reserveAmmo = Number.POSITIVE_INFINITY
  magazineSize = Number.POSITIVE_INFINITY
  primarySlots: PrimaryWeaponSlot[] = []
  primarySlotIndex = 0
  primarySlotSequence = 0
  secondaryMode: SecondaryMode = "grenade"
  damageMultiplier = 1
  fireRateMultiplier = 1
  bulletSizeMultiplier = 1
  aiState: AIState = "wander"
  aiDecisionTimer = 0
  aiMove = new Vec2(1, 0)
  grenadeTimer = 2
  reloadSpeedMultiplier = 1
  damageTakenMultiplier = 1
  damageReductionFlat = 0
  explosiveRadiusMultiplier = 1
  aimAssistRadians = 0
  shotgunRicochet = false
  proximityGrenades = false
  laserSight = false
  perkStacks: Partial<Record<PerkId, number>> = {}
  matchKills = 0
  hitFlash = 0
  recoil = 0
  arenaBoundaryDamageCooldown = 0
  burstShotsRemaining = 0
  burstTotalShots = 0
  burstShotIndex = 0
  burstSpread = 0
  burstInterval = 0
  burstWeaponId: PrimaryWeaponId | null = null
  survivorArchetype: SurvivorEnemyArchetype = "none"

  constructor(id: string, isPlayer: boolean, team: Team) {
    this.id = id
    this.isPlayer = isPlayer
    this.team = team
  }

  respawn(position: Vec2) {
    this.position.copy(position)
    this.velocity.set(0, 0)
    this.hp = this.maxHp
    this.shootCooldown = 0
    this.secondaryCooldown = 0
    this.secondaryCooldownMax = 0
    this.reloadCooldown = 0
    this.reloadCooldownMax = 0
    this.aiDecisionTimer = 0
    this.hitFlash = 0
    this.recoil = 0
    this.arenaBoundaryDamageCooldown = 0
    this.burstShotsRemaining = 0
    this.burstTotalShots = 0
    this.burstShotIndex = 0
    this.burstSpread = 0
    this.burstInterval = 0
    this.burstWeaponId = null
  }
}

export class Projectile {
  active = false
  kind: "ballistic" | "flame" | "grenade" | "rocket" = "ballistic"
  ownerId = ""
  ownerTeam: Team = "white"
  position = new Vec2()
  velocity = new Vec2()
  radius = 6
  damage = 10
  maxRange = 500
  traveled = 0
  ttl = 0
  glow = 0.5
  trailCooldown = 0
  trailX = 0
  trailY = 0
  trailDirX = 1
  trailDirY = 0
  trailReady = false
  ricochets = 0
  ballisticRicochetRemaining = 0
  contactFuse = false
  explosiveRadiusMultiplier = 1
}

export class Throwable {
  active = false
  ownerId = ""
  ownerTeam: Team = "white"
  mode: SecondaryMode = "grenade"
  position = new Vec2()
  velocity = new Vec2()
  rotation = 0
  angularVelocity = 0
  life = 0.9
  maxLife = 0.9
  radius = 7
  ricochets = 0
  rolled = false
  trailCooldown = 0
  trailX = 0
  trailY = 0
  trailDirX = 1
  trailDirY = 0
  trailReady = false
  contactFuse = false
  explosiveRadiusMultiplier = 1
}

export class FlightTrailSegment {
  active = false
  position = new Vec2()
  direction = new Vec2(1, 0)
  length = 1
  width = 0.06
  alpha = 1
  life = 0
  maxLife = 0
  color = "#ffffff"
}

export class Flower {
  active = false
  slotIndex = -1
  renderDirty = false
  team: Team = "white"
  ownerId = ""
  bloomCell = -1
  bloomWeight = 1
  prevInCell = -1
  nextInCell = -1
  color = "#f7ffef"
  accent = "#e5efcf"
  scorched = false
  position = new Vec2()
  size = 0
  targetSize = 4
  bloomDelay = 0
  pop = 0
  life = 0
  maxLife = 0
  alpha = 1
}

export class KillPetal {
  active = false
  position = new Vec2()
  velocity = new Vec2()
  rotation = 0
  angularVelocity = 0
  size = 0.12
  life = 0
  maxLife = 0
  color = "#8ef29a"
}

export class DamagePopup {
  active = false
  position = new Vec2()
  velocity = new Vec2()
  text = ""
  color = "#fff"
  life = 0
}

export class Pickup {
  active = false
  kind: "weapon" | "perk" | "xp" = "weapon"
  weapon: PrimaryWeaponId = "assault"
  perkId: PerkId | null = null
  xpValue = 0
  highTier = false
  position = new Vec2()
  velocity = new Vec2()
  throwOwnerId = ""
  throwOwnerTeam: Team = "white"
  throwDamageArmed = false
  radius = 16
  bob = 0
  rotation = 0
}

export class MolotovZone {
  active = false
  ownerId = ""
  ownerTeam: Team = "white"
  source: "molotov" | "flame" = "molotov"
  position = new Vec2()
  radius = 16
  life = 2
  tick = 0
  tickInterval = 0.22
  damagePerTick = 1
}

export class Obstacle {
  active = false
  id = ""
  kind: "box" | "warehouse" | "wall" | "high-tier-box" = "box"
  position = new Vec2()
  width = 2
  height = 2
  hp = 0
  maxHp = 0
  lootDropped = false
  tiles: boolean[][] = []
}

export class ObstacleDebris {
  active = false
  position = new Vec2()
  velocity = new Vec2()
  rotation = 0
  angularVelocity = 0
  size = 0.12
  life = 0
  maxLife = 0
  color = "#ffffff"
}

export class ShellCasing {
  active = false
  position = new Vec2()
  velocity = new Vec2()
  rotation = 0
  angularVelocity = 0
  size = 0.08
  life = 0
  maxLife = 0
  bounceCount = 0
}
