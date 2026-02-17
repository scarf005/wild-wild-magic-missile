import { clamp, lerp, limitToArena, randomRange } from "../utils.ts"
import type { WorldState } from "../world/state.ts"

const parseBotIndex = (botId: string) => {
  const parsed = Number(botId.replace("bot-", ""))
  return Number.isFinite(parsed) ? parsed : 0
}

const SURVIVOR_MOSQUITO_ARCHETYPE = "mosquito_swarmer"
const SURVIVOR_SPIDER_ARCHETYPE = "giant_spider"

const updateBotAim = (
  bot: WorldState["bots"][number],
  botIndex: number,
  toTargetX: number,
  toTargetY: number,
  distanceToTarget: number,
  dt: number,
  nowMs: number,
  panic = 0,
) => {
  const baseAngle = Math.atan2(toTargetY, toTargetX)
  const farBias = clamp((distanceToTarget - 8) / 24, 0, 1)
  const movementFactor = clamp(bot.velocity.length() / (bot.speed || 1), 0, 1)
  const sway =
    Math.sin(nowMs * 0.006 + botIndex * 1.91) * (0.02 + farBias * 0.1 + movementFactor * 0.035 + panic * 0.05) +
    Math.cos(nowMs * 0.003 + botIndex * 0.67) * (0.015 + farBias * 0.07 + panic * 0.02)
  const targetAngle = baseAngle + sway
  const trackRate = clamp(dt * (11 - farBias * 6 - panic * 1.6), 0.1, 0.95)

  bot.aim.x = lerp(bot.aim.x, Math.cos(targetAngle), trackRate)
  bot.aim.y = lerp(bot.aim.y, Math.sin(targetAngle), trackRate)
  const aimLength = Math.hypot(bot.aim.x, bot.aim.y) || 1
  bot.aim.x /= aimLength
  bot.aim.y /= aimLength
}

const findNearestTarget = (
  world: WorldState,
  originId: string,
  originTeam: string,
  x: number,
  y: number,
  maxDistance = Number.POSITIVE_INFINITY,
) => {
  let targetId = ""
  let bestDistance = maxDistance
  let deltaX = 0
  let deltaY = 0

  for (const candidate of world.units) {
    if (candidate.id === originId || candidate.hp <= 0 || candidate.team === originTeam) {
      continue
    }

    const dx = candidate.position.x - x
    const dy = candidate.position.y - y
    const distance = Math.hypot(dx, dy)
    if (distance >= bestDistance) {
      continue
    }

    targetId = candidate.id
    bestDistance = distance
    deltaX = dx
    deltaY = dy
  }

  return {
    targetId,
    distance: bestDistance,
    deltaX,
    deltaY,
  }
}

export interface UpdateAIDeps {
  firePrimary: (botId: string) => void
  continueBurst: (botId: string) => void
  throwSecondary: (botId: string) => void
  finishReload: (botId: string) => void
  collectNearbyPickup: (botId: string) => void
  nowMs: () => number
}

export const updateAI = (world: WorldState, dt: number, deps: UpdateAIDeps) => {
  const nowMs = deps.nowMs()
  for (const bot of world.bots) {
    const isSurvivorSwarm = world.player.team === "arcanist" && bot.team === "swarm"
    const isSurvivorMosquito = bot.survivorArchetype === SURVIVOR_MOSQUITO_ARCHETYPE
    const isSurvivorSpider = bot.survivorArchetype === SURVIVOR_SPIDER_ARCHETYPE
    const botIndex = parseBotIndex(bot.id)
    bot.shootCooldown = Math.max(0, bot.shootCooldown - dt)
    bot.secondaryCooldown = Math.max(0, bot.secondaryCooldown - dt)
    if (bot.secondaryCooldown <= 0) {
      bot.secondaryCooldownMax = 0
    }
    bot.reloadCooldown = Math.max(0, bot.reloadCooldown - dt)
    deps.continueBurst(bot.id)
    if (bot.reloadCooldown <= 0) {
      deps.finishReload(bot.id)
    }
    bot.aiDecisionTimer -= dt
    let desiredVelocityX = bot.velocity.x
    let desiredVelocityY = bot.velocity.y

    const nearestTarget = findNearestTarget(world, bot.id, bot.team, bot.position.x, bot.position.y, 36)
    const hasTarget = nearestTarget.targetId !== ""
    const distanceToTarget = nearestTarget.distance
    const toTargetX = nearestTarget.deltaX
    const toTargetY = nearestTarget.deltaY

    if (isSurvivorSwarm) {
      bot.aiState = "aggro"
      if (isSurvivorSpider && hasTarget && distanceToTarget < 2.6) {
        bot.aiState = "flee"
      }
    } else if (bot.hp <= bot.maxHp * 0.32) {
      bot.aiState = "flee"
    } else if (hasTarget && distanceToTarget < 24) {
      bot.aiState = "aggro"
    } else {
      bot.aiState = "wander"
    }

    if (bot.aiDecisionTimer <= 0) {
      bot.aiDecisionTimer = randomRange(0.4, 1.4)
      const angle = randomRange(0, Math.PI * 2)
      bot.aiMove.x = Math.cos(angle)
      bot.aiMove.y = Math.sin(angle)
    }

    if (bot.aiState === "wander") {
      desiredVelocityX = bot.aiMove.x * bot.speed * 0.7
      desiredVelocityY = bot.aiMove.y * bot.speed * 0.7
    }

    if (bot.aiState === "aggro") {
      if (!hasTarget) {
        bot.aiState = "wander"
        continue
      }

      const distanceSafe = distanceToTarget || 1
      const towardX = toTargetX / distanceSafe
      const towardY = toTargetY / distanceSafe
      const strafe = isSurvivorSwarm
        ? isSurvivorSpider
          ? Math.sin(nowMs * 0.0016 + botIndex * 0.5) * 0.012
          : Math.sin(nowMs * 0.0032 + botIndex * 1.9) * 0.065
        : Math.sin(nowMs * 0.001 + botIndex)
      const homingSpeedScale = isSurvivorSwarm
        ? isSurvivorSpider
          ? 0.96
          : 0.98
        : 1
      const pursuitBias = isSurvivorSwarm
        ? isSurvivorSpider
          ? 0.95 + clamp((8 - distanceToTarget) / 8, 0, 0.08)
          : 1.1 + clamp((16 - distanceToTarget) / 16, 0, 0.22)
        : 1
      desiredVelocityX = (towardX * pursuitBias + -towardY * strafe * 0.45) * bot.speed * homingSpeedScale
      desiredVelocityY = (towardY * pursuitBias + towardX * strafe * 0.45) * bot.speed * homingSpeedScale

      updateBotAim(
        bot,
        botIndex,
        toTargetX,
        toTargetY,
        distanceToTarget,
        dt,
        nowMs,
        isSurvivorSwarm ? isSurvivorSpider ? 0.12 : 0.06 : 0,
      )
      const farBias = clamp((distanceToTarget - 8) / 24, 0, 1)
      const aimAlignment = bot.aim.x * towardX + bot.aim.y * towardY
      const requiredAlignment = isSurvivorSwarm
        ? isSurvivorSpider
          ? lerp(0.72, 0.82, farBias)
          : lerp(0.82, 0.92, farBias)
        : lerp(0.8, 0.91, farBias)
      const hesitationChance = isSurvivorSwarm
        ? isSurvivorSpider
          ? lerp(0.04, 0.2, farBias)
          : lerp(0.015, 0.12, farBias)
        : lerp(0.02, 0.16, farBias)
      const attackRange = isSurvivorSwarm
        ? isSurvivorSpider
          ? 18
          : 30
        : 32

      if (distanceToTarget < attackRange && aimAlignment > requiredAlignment && Math.random() > hesitationChance) {
        deps.firePrimary(bot.id)
      }

      const throwChance = isSurvivorSwarm
        ? isSurvivorMosquito ? 0.007 : 0.002
        : 0.014
      if (distanceToTarget < 12 && Math.random() < throwChance) {
        deps.throwSecondary(bot.id)
      }
    }

    if (bot.aiState === "flee") {
      if (!hasTarget) {
        bot.aiState = "wander"
        continue
      }

      const distanceSafe = distanceToTarget || 1
      const fromX = -toTargetX / distanceSafe
      const fromY = -toTargetY / distanceSafe
      desiredVelocityX = fromX * bot.speed * 1.15
      desiredVelocityY = fromY * bot.speed * 1.15
      const towardX = toTargetX / distanceSafe
      const towardY = toTargetY / distanceSafe
      updateBotAim(bot, botIndex, toTargetX, toTargetY, distanceToTarget, dt, nowMs, 0.45)
      const farBias = clamp((distanceToTarget - 8) / 24, 0, 1)
      const aimAlignment = bot.aim.x * towardX + bot.aim.y * towardY
      const requiredAlignment = lerp(0.78, 0.89, farBias)
      const hesitationChance = lerp(0.06, 0.22, farBias)

      if (distanceToTarget < 24 && aimAlignment > requiredAlignment && Math.random() > hesitationChance) {
        deps.firePrimary(bot.id)
      }
    }

    const velocityResponse = isSurvivorSwarm
      ? isSurvivorSpider
        ? 13
        : 18
      : 16
    bot.velocity.x = lerp(bot.velocity.x, desiredVelocityX, clamp(dt * velocityResponse, 0, 1))
    bot.velocity.y = lerp(bot.velocity.y, desiredVelocityY, clamp(dt * velocityResponse, 0, 1))

    bot.position.x += bot.velocity.x * dt
    bot.position.y += bot.velocity.y * dt
    limitToArena(bot.position, bot.radius, world.arenaRadius)

    deps.collectNearbyPickup(bot.id)
  }
}
