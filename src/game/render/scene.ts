import { drawFlameProjectileSprite, drawGrenadeSprite, drawItemPickupSprite, drawMolotovSprite, drawWeaponPickupSprite } from "./pixel-art.ts"
import { renderFlightTrailInstances, renderFlowerInstances, renderObstacleFxInstances } from "./flower-instanced.ts"
import { decideRenderFxCompositionPlan, recordRenderPathProfileFrame } from "./composition-plan.ts"
import { buildObstacleGridCullRange } from "./obstacle-cull.ts"
import { clamp, randomRange } from "../utils.ts"
import { buildCullBounds, isInsideCullBounds, type CullBounds } from "../cull.ts"
import { botPalette } from "../factions.ts"
import { VIEW_HEIGHT, VIEW_WIDTH, WORLD_SCALE } from "../world/constants.ts"
import grassBaseTextureUrl from "../../assets/tiles/grass-base-24.png"
import grassDarkTextureUrl from "../../assets/tiles/grass-dark-24.png"
import grassTransitionsTextureUrl from "../../assets/tiles/grass-transitions-24.png"
import flowerPetalMaskUrl from "../../assets/flowers/flower-petal-mask.png"
import flowerAccentMaskUrl from "../../assets/flowers/flower-accent-mask.png"
import {
  OBSTACLE_MATERIAL_BOX,
  OBSTACLE_MATERIAL_ROCK,
  OBSTACLE_MATERIAL_WALL,
  OBSTACLE_MATERIAL_WAREHOUSE,
  obstacleGridToWorldCenter,
} from "../world/obstacle-grid.ts"
import { terrainAt, type TerrainTile } from "../world/wfc-map.ts"
import type { WorldState } from "../world/state.ts"

export interface RenderSceneArgs {
  context: CanvasRenderingContext2D
  world: WorldState
  dt: number
}

type FogCullBounds = CullBounds

let grassWaveTime = Math.random() * Math.PI * 2

const GRASS_BASE_COLOR = "#8fa684"
const GRASS_TILE_PIXEL_SIZE = 24
const GRASS_TILE_WORLD_SIZE = 1
const GRASS_TRANSITION_COLS = 5
const GRASS_DARK_VARIANTS = 3
const GRASS_TRANSITION_MASK_ORDER = [1, 2, 4, 8, 3, 6, 12, 9, 5, 10, 7, 14, 13, 11, 15]
const GRASS_MASK_TO_TILE_INDEX = new Map(GRASS_TRANSITION_MASK_ORDER.map((mask, index) => [mask, index]))
const TERRAIN_TINTS: Record<TerrainTile, string> = {
  grass: "#8fa684",
  clover: "#85a37a",
  "wild-grass": "#7b9a70",
  dirt: "#8e7d62",
  "dirt-road": "#9f8965",
  "road-edge": "#8f8a6b",
  gravel: "#9a9a8f",
  concrete: "#8b908c",
}
const FLOWER_SPRITE_PIXEL_SIZE = 16
const GROUND_LAYER_PIXELS_PER_TILE = GRASS_TILE_PIXEL_SIZE
const FLOWER_LAYER_PIXELS_PER_TILE = 12
const FLOWER_LAYER_FLUSH_LIMIT = 1200
const SURVIVOR_BLOOD_SPLAT_COLOR = "#a6bf45"
const PRIMARY_RELOAD_RING_THICKNESS_WORLD = 2 / WORLD_SCALE
const PRIMARY_RELOAD_RING_OFFSET_WORLD = 0.22
const PRIMARY_RELOAD_RING_COLOR = "#ffffff"
const PRIMARY_RELOAD_PROGRESS_RING_COLOR = "#c1c8cf"

const buildFogCullBounds = (cameraX: number, cameraY: number, padding = 0): FogCullBounds => {
  return buildCullBounds(cameraX, cameraY, padding)
}

const isInsideFogCullBounds = (x: number, y: number, bounds: FogCullBounds, padding = 0) => {
  return isInsideCullBounds(x, y, bounds, padding)
}

let grassBaseTexture: HTMLImageElement | null = null
let grassDarkTexture: HTMLImageElement | null = null
let grassTransitionsTexture: HTMLImageElement | null = null
let grassBaseTextureLoaded = false
let grassDarkTextureLoaded = false
let grassTransitionsTextureLoaded = false
let flowerPetalMask: HTMLImageElement | null = null
let flowerAccentMask: HTMLImageElement | null = null
let flowerPetalMaskLoaded = false
let flowerAccentMaskLoaded = false
const flowerSpriteCache = new Map<string, HTMLCanvasElement>()
let flowerPetalMaskAlpha: Uint8ClampedArray | null = null
let flowerAccentMaskAlpha: Uint8ClampedArray | null = null

let groundPatchCache: {
  terrainMapRef: WorldState["terrainMap"] | null
  size: number
  cells: Uint8Array
} = {
  terrainMapRef: null,
  size: 0,
  cells: new Uint8Array(0),
}

let groundLayerCache: {
  terrainMapRef: WorldState["terrainMap"] | null
  size: number
  textureStateKey: string
  canvas: HTMLCanvasElement | null
  context: CanvasRenderingContext2D | null
} = {
  terrainMapRef: null,
  size: 0,
  textureStateKey: "",
  canvas: null,
  context: null,
}

let flowerLayerCache: {
  terrainMapRef: WorldState["terrainMap"] | null
  size: number
  canvas: HTMLCanvasElement | null
  context: CanvasRenderingContext2D | null
} = {
  terrainMapRef: null,
  size: 0,
  canvas: null,
  context: null,
}

if (typeof Image !== "undefined") {
  grassBaseTexture = new Image()
  grassBaseTexture.src = grassBaseTextureUrl
  grassBaseTexture.onload = () => {
    grassBaseTextureLoaded = true
  }
  if (grassBaseTexture.complete && grassBaseTexture.naturalWidth > 0) {
    grassBaseTextureLoaded = true
  }

  grassDarkTexture = new Image()
  grassDarkTexture.src = grassDarkTextureUrl
  grassDarkTexture.onload = () => {
    grassDarkTextureLoaded = true
  }
  if (grassDarkTexture.complete && grassDarkTexture.naturalWidth > 0) {
    grassDarkTextureLoaded = true
  }

  grassTransitionsTexture = new Image()
  grassTransitionsTexture.src = grassTransitionsTextureUrl
  grassTransitionsTexture.onload = () => {
    grassTransitionsTextureLoaded = true
  }
  if (grassTransitionsTexture.complete && grassTransitionsTexture.naturalWidth > 0) {
    grassTransitionsTextureLoaded = true
  }

  flowerPetalMask = new Image()
  flowerPetalMask.src = flowerPetalMaskUrl
  flowerPetalMask.onload = () => {
    flowerPetalMaskLoaded = true
  }
  if (flowerPetalMask.complete && flowerPetalMask.naturalWidth > 0) {
    flowerPetalMaskLoaded = true
  }

  flowerAccentMask = new Image()
  flowerAccentMask.src = flowerAccentMaskUrl
  flowerAccentMask.onload = () => {
    flowerAccentMaskLoaded = true
  }
  if (flowerAccentMask.complete && flowerAccentMask.naturalWidth > 0) {
    flowerAccentMaskLoaded = true
  }
}

const grassCellNoise = (x: number, y: number, seed: number) => {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed * 73.17) * 43758.5453123
  return value - Math.floor(value)
}

const patchAt = (cells: Uint8Array, size: number, x: number, y: number) => {
  if (x < 0 || y < 0 || x >= size || y >= size) {
    return 0
  }
  return cells[y * size + x]
}

const patchNeighborCount = (cells: Uint8Array, size: number, x: number, y: number) => {
  let count = 0
  for (let oy = -1; oy <= 1; oy += 1) {
    for (let ox = -1; ox <= 1; ox += 1) {
      if (ox === 0 && oy === 0) {
        continue
      }
      count += patchAt(cells, size, x + ox, y + oy)
    }
  }
  return count
}

const grassVariantIndex = (cellX: number, cellY: number) => {
  return Math.floor(grassCellNoise(cellX, cellY, 0.93) * GRASS_DARK_VARIANTS) % GRASS_DARK_VARIANTS
}

const isGrassTile = (tile: TerrainTile) => tile === "grass" || tile === "clover" || tile === "wild-grass"

const extractMaskAlpha = (image: HTMLImageElement) => {
  const maskCanvas = document.createElement("canvas")
  maskCanvas.width = FLOWER_SPRITE_PIXEL_SIZE
  maskCanvas.height = FLOWER_SPRITE_PIXEL_SIZE
  const maskContext = maskCanvas.getContext("2d")
  if (!maskContext) {
    return null
  }

  maskContext.imageSmoothingEnabled = false
  maskContext.clearRect(0, 0, FLOWER_SPRITE_PIXEL_SIZE, FLOWER_SPRITE_PIXEL_SIZE)
  maskContext.drawImage(image, 0, 0, FLOWER_SPRITE_PIXEL_SIZE, FLOWER_SPRITE_PIXEL_SIZE)
  return maskContext.getImageData(0, 0, FLOWER_SPRITE_PIXEL_SIZE, FLOWER_SPRITE_PIXEL_SIZE).data
}

const ensureFlowerMaskAlpha = () => {
  if (flowerPetalMaskAlpha && flowerAccentMaskAlpha) {
    return true
  }
  if (!flowerPetalMask || !flowerAccentMask || !flowerPetalMaskLoaded || !flowerAccentMaskLoaded) {
    return false
  }

  flowerPetalMaskAlpha = extractMaskAlpha(flowerPetalMask)
  flowerAccentMaskAlpha = extractMaskAlpha(flowerAccentMask)
  return !!flowerPetalMaskAlpha && !!flowerAccentMaskAlpha
}

const parseHexColor = (hex: string) => {
  const cleaned = hex.replace("#", "")
  if (cleaned.length !== 6) {
    return [255, 255, 255] as const
  }
  const red = Number.parseInt(cleaned.slice(0, 2), 16)
  const green = Number.parseInt(cleaned.slice(2, 4), 16)
  const blue = Number.parseInt(cleaned.slice(4, 6), 16)
  return [red, green, blue] as const
}

const toHex = (value: number) => {
  return Math.round(clamp(value, 0, 255)).toString(16).padStart(2, "0")
}

const tintHex = (hex: string, multiplier: number, lift = 0) => {
  const [red, green, blue] = parseHexColor(hex)
  return `#${toHex(red * multiplier + lift)}${toHex(green * multiplier + lift)}${toHex(blue * multiplier + lift)}`
}

const hashKey = (value: string) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash)
}

const paletteForUnit = (world: WorldState, unit: WorldState["units"][number]) => {
  const isFfa = world.player.team === world.player.id
  if (isFfa) {
    return unit.isPlayer ? { tone: "#f6f2df", edge: "#b8b49a" } : botPalette(unit.id)
  }

  const teamColor = world.factions.find((faction) => faction.id === unit.team)?.color ?? "#d8e8cb"
  return {
    tone: tintHex(teamColor, 0.82, 22),
    edge: tintHex(teamColor, 0.55, 4),
  }
}

const buildGroundPatchCache = (world: WorldState) => {
  const size = world.terrainMap.size
  const cells = new Uint8Array(size * size)
  const half = Math.floor(size * 0.5)

  for (let gridY = 0; gridY < size; gridY += 1) {
    for (let gridX = 0; gridX < size; gridX += 1) {
      const cellX = gridX - half
      const cellY = gridY - half
      const centerX = cellX + GRASS_TILE_WORLD_SIZE * 0.5
      const centerY = cellY + GRASS_TILE_WORLD_SIZE * 0.5
      const terrain = terrainAt(world.terrainMap, centerX, centerY)
      const terrainBias = terrain === "wild-grass"
        ? 0.34
        : terrain === "clover"
        ? 0.14
        : terrain === "grass"
        ? -0.06
        : -0.38
      const patchField = (
            Math.sin(cellX * 0.21 + cellY * 0.15 + 0.7) * 0.58 +
            Math.sin(cellX * 0.07 - cellY * 0.13 + 1.8) * 0.42
          ) * 0.5 + 0.5
      const grain = grassCellNoise(cellX, cellY, 0.31) * 0.16
      cells[gridY * size + gridX] = patchField + terrainBias + grain > 0.56 ? 1 : 0
    }
  }

  for (let pass = 0; pass < 2; pass += 1) {
    const smoothed = new Uint8Array(cells)
    for (let gridY = 0; gridY < size; gridY += 1) {
      for (let gridX = 0; gridX < size; gridX += 1) {
        const neighbors = patchNeighborCount(cells, size, gridX, gridY)
        if (neighbors >= 5) {
          smoothed[gridY * size + gridX] = 1
        } else if (neighbors <= 2) {
          smoothed[gridY * size + gridX] = 0
        }
      }
    }
    cells.set(smoothed)
  }

  groundPatchCache = {
    terrainMapRef: world.terrainMap,
    size,
    cells,
  }
}

const ensureGroundPatchCache = (world: WorldState) => {
  if (groundPatchCache.terrainMapRef === world.terrainMap && groundPatchCache.size === world.terrainMap.size) {
    return groundPatchCache
  }
  buildGroundPatchCache(world)
  return groundPatchCache
}

const groundTextureStateKey = () => {
  return `${grassBaseTextureLoaded ? 1 : 0}-${grassDarkTextureLoaded ? 1 : 0}-${grassTransitionsTextureLoaded ? 1 : 0}`
}

const buildGroundLayerCache = (world: WorldState) => {
  const size = world.terrainMap.size
  const textureStateKey = groundTextureStateKey()
  const canvas = document.createElement("canvas")
  canvas.width = size * GROUND_LAYER_PIXELS_PER_TILE
  canvas.height = size * GROUND_LAYER_PIXELS_PER_TILE
  const context = canvas.getContext("2d")
  if (!context) {
    groundLayerCache = {
      terrainMapRef: world.terrainMap,
      size,
      textureStateKey,
      canvas,
      context: null,
    }
    return groundLayerCache
  }

  context.imageSmoothingEnabled = false
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = GRASS_BASE_COLOR
  context.fillRect(0, 0, canvas.width, canvas.height)

  const patchCache = ensureGroundPatchCache(world)
  const patchCells = patchCache.cells
  const patchSize = patchCache.size
  const halfPatch = Math.floor(patchSize * 0.5)

  if (grassBaseTexture && grassBaseTextureLoaded) {
    for (let gridY = 0; gridY < patchSize; gridY += 1) {
      for (let gridX = 0; gridX < patchSize; gridX += 1) {
        const drawX = gridX * GROUND_LAYER_PIXELS_PER_TILE
        const drawY = gridY * GROUND_LAYER_PIXELS_PER_TILE
        context.drawImage(
          grassBaseTexture,
          drawX,
          drawY,
          GROUND_LAYER_PIXELS_PER_TILE,
          GROUND_LAYER_PIXELS_PER_TILE,
        )
      }
    }
  }

  if (grassTransitionsTexture && grassTransitionsTextureLoaded) {
    for (let gridY = 0; gridY < patchSize; gridY += 1) {
      for (let gridX = 0; gridX < patchSize; gridX += 1) {
        if (!patchAt(patchCells, patchSize, gridX, gridY)) {
          continue
        }

        const north = patchAt(patchCells, patchSize, gridX, gridY - 1)
        const east = patchAt(patchCells, patchSize, gridX + 1, gridY)
        const south = patchAt(patchCells, patchSize, gridX, gridY + 1)
        const west = patchAt(patchCells, patchSize, gridX - 1, gridY)
        let mask = 0
        if (north) mask |= 1
        if (east) mask |= 2
        if (south) mask |= 4
        if (west) mask |= 8

        if (mask === 0) {
          mask = 15
        }

        const drawX = gridX * GROUND_LAYER_PIXELS_PER_TILE
        const drawY = gridY * GROUND_LAYER_PIXELS_PER_TILE
        const cellX = gridX - halfPatch
        const cellY = gridY - halfPatch

        if (mask === 15 && grassDarkTexture && grassDarkTextureLoaded) {
          const variant = grassVariantIndex(cellX, cellY)
          const srcX = variant * GRASS_TILE_PIXEL_SIZE
          context.drawImage(
            grassDarkTexture,
            srcX,
            0,
            GRASS_TILE_PIXEL_SIZE,
            GRASS_TILE_PIXEL_SIZE,
            drawX,
            drawY,
            GROUND_LAYER_PIXELS_PER_TILE,
            GROUND_LAYER_PIXELS_PER_TILE,
          )
          continue
        }

        const tileIndex = GRASS_MASK_TO_TILE_INDEX.get(mask)
        if (tileIndex === undefined) {
          continue
        }

        const srcX = (tileIndex % GRASS_TRANSITION_COLS) * GRASS_TILE_PIXEL_SIZE
        const srcY = Math.floor(tileIndex / GRASS_TRANSITION_COLS) * GRASS_TILE_PIXEL_SIZE
        context.drawImage(
          grassTransitionsTexture,
          srcX,
          srcY,
          GRASS_TILE_PIXEL_SIZE,
          GRASS_TILE_PIXEL_SIZE,
          drawX,
          drawY,
          GROUND_LAYER_PIXELS_PER_TILE,
          GROUND_LAYER_PIXELS_PER_TILE,
        )
      }
    }
  }

  context.globalAlpha = 0.84
  for (let gridY = 0; gridY < patchSize; gridY += 1) {
    for (let gridX = 0; gridX < patchSize; gridX += 1) {
      const terrain = world.terrainMap.tiles[gridY][gridX]
      if (isGrassTile(terrain)) {
        continue
      }

      const drawX = gridX * GROUND_LAYER_PIXELS_PER_TILE
      const drawY = gridY * GROUND_LAYER_PIXELS_PER_TILE
      context.fillStyle = TERRAIN_TINTS[terrain]
      context.fillRect(drawX, drawY, GROUND_LAYER_PIXELS_PER_TILE, GROUND_LAYER_PIXELS_PER_TILE)

      if (terrain === "dirt-road") {
        context.globalAlpha = 0.18
        context.fillStyle = "#d4c19a"
        context.fillRect(
          drawX + GROUND_LAYER_PIXELS_PER_TILE * 0.12,
          drawY + GROUND_LAYER_PIXELS_PER_TILE * 0.18,
          GROUND_LAYER_PIXELS_PER_TILE * 0.76,
          GROUND_LAYER_PIXELS_PER_TILE * 0.14,
        )
        context.globalAlpha = 0.84
      }
    }
  }
  context.globalAlpha = 1

  groundLayerCache = {
    terrainMapRef: world.terrainMap,
    size,
    textureStateKey,
    canvas,
    context,
  }

  return groundLayerCache
}

const ensureGroundLayerCache = (world: WorldState) => {
  const textureStateKey = groundTextureStateKey()
  if (
    groundLayerCache.terrainMapRef === world.terrainMap &&
    groundLayerCache.size === world.terrainMap.size &&
    groundLayerCache.textureStateKey === textureStateKey &&
    groundLayerCache.canvas &&
    groundLayerCache.context
  ) {
    return groundLayerCache
  }

  return buildGroundLayerCache(world)
}

const flowerSpriteForPalette = (color: string, accent: string) => {
  if (!ensureFlowerMaskAlpha() || !flowerPetalMaskAlpha || !flowerAccentMaskAlpha) {
    return null
  }

  const key = `${color}|${accent}`
  const cached = flowerSpriteCache.get(key)
  if (cached) {
    return cached
  }

  const sprite = document.createElement("canvas")
  sprite.width = FLOWER_SPRITE_PIXEL_SIZE
  sprite.height = FLOWER_SPRITE_PIXEL_SIZE
  const spriteContext = sprite.getContext("2d")
  if (!spriteContext) {
    return null
  }

  spriteContext.imageSmoothingEnabled = false
  const imageData = spriteContext.createImageData(FLOWER_SPRITE_PIXEL_SIZE, FLOWER_SPRITE_PIXEL_SIZE)
  const pixels = imageData.data

  const [petalRed, petalGreen, petalBlue] = parseHexColor(color)
  const accentColor = accent === "#29261f" ? "#6d5e42" : accent
  const [accentRed, accentGreen, accentBlue] = parseHexColor(accentColor)
  const splatterSeed = hashKey(key)

  for (let index = 0; index < pixels.length; index += 4) {
    const petalAlpha = flowerPetalMaskAlpha[index + 3]
    const accentAlpha = flowerAccentMaskAlpha[index + 3]
    const maskAlpha = Math.max(petalAlpha * 0.95, accentAlpha)
    if (maskAlpha <= 0) {
      continue
    }

    const pixel = index / 4
    const pixelX = pixel % FLOWER_SPRITE_PIXEL_SIZE
    const pixelY = Math.floor(pixel / FLOWER_SPRITE_PIXEL_SIZE)
    const grain = Math.sin(pixelX * 12.9898 + pixelY * 78.233 + splatterSeed * 0.0163) * 43758.5453123
    const grain01 = grain - Math.floor(grain)
    const drip = Math.sin(pixelX * 19.131 + pixelY * 3.711 + splatterSeed * 0.0091) * 25671.3511121
    const drip01 = drip - Math.floor(drip)
    const keepThreshold = 0.2 + (petalAlpha > 0 ? 0.5 : 0.24) + (accentAlpha > 0 ? 0.18 : 0)
    if (grain01 > keepThreshold) {
      continue
    }

    const accentMix = accentAlpha > 0 ? 0.72 : 0.28
    const darkMix = pixelY > FLOWER_SPRITE_PIXEL_SIZE * 0.56 && drip01 > 0.86 ? 0.44 : 0.18
    const rawRed = petalRed * (1 - accentMix) + accentRed * accentMix
    const rawGreen = petalGreen * (1 - accentMix) + accentGreen * accentMix
    const rawBlue = petalBlue * (1 - accentMix) + accentBlue * accentMix
    pixels[index] = clamp(rawRed * (1 - darkMix), 0, 255)
    pixels[index + 1] = clamp(rawGreen * (0.8 - darkMix * 0.42), 0, 255)
    pixels[index + 2] = clamp(rawBlue * (0.7 - darkMix * 0.54), 0, 255)
    pixels[index + 3] = clamp(maskAlpha * (0.56 + grain01 * 0.6), 0, 255)
  }

  spriteContext.putImageData(imageData, 0, 0)

  flowerSpriteCache.set(key, sprite)
  return sprite
}

const ensureFlowerLayerCache = (world: WorldState) => {
  if (
    flowerLayerCache.terrainMapRef === world.terrainMap &&
    flowerLayerCache.size === world.terrainMap.size &&
    flowerLayerCache.canvas &&
    flowerLayerCache.context
  ) {
    return flowerLayerCache
  }

  const size = world.terrainMap.size
  const canvas = document.createElement("canvas")
  canvas.width = size * FLOWER_LAYER_PIXELS_PER_TILE
  canvas.height = size * FLOWER_LAYER_PIXELS_PER_TILE
  const context = canvas.getContext("2d")
  if (!context) {
    flowerLayerCache = {
      terrainMapRef: world.terrainMap,
      size,
      canvas,
      context: null,
    }
    return flowerLayerCache
  }

  context.imageSmoothingEnabled = false
  context.clearRect(0, 0, canvas.width, canvas.height)

  flowerLayerCache = {
    terrainMapRef: world.terrainMap,
    size,
    canvas,
    context,
  }

  world.flowerDirtyIndices.clear()
  for (const flower of world.flowers) {
    if (!flower.active) {
      continue
    }
    flower.renderDirty = true
    if (flower.slotIndex >= 0) {
      world.flowerDirtyIndices.add(flower.slotIndex)
    }
  }
  world.flowerDirtyCount = world.flowerDirtyIndices.size

  return flowerLayerCache
}

const drawFlowerToLayer = (
  layerContext: CanvasRenderingContext2D,
  mapSize: number,
  flower: WorldState["flowers"][number],
  isSurvivorMode: boolean,
) => {
  const sprite = flowerSpriteForPalette(flower.color, flower.accent)
  if (!sprite) {
    return false
  }

  const halfMap = Math.floor(mapSize * 0.5)
  const worldX = flower.position.x + halfMap
  const worldY = flower.position.y + halfMap
  if (worldX < 0 || worldY < 0 || worldX >= mapSize || worldY >= mapSize) {
    return true
  }

  const pixelsPerWorld = FLOWER_LAYER_PIXELS_PER_TILE
  const px = worldX * pixelsPerWorld
  const py = worldY * pixelsPerWorld
  const sizeWorld = Math.max(0.14, flower.size * (isSurvivorMode ? 2.35 : 2.05))
  const sizePx = sizeWorld * pixelsPerWorld
  const drawX = px - sizePx * 0.5
  const drawY = py - sizePx * 0.5
  layerContext.drawImage(sprite, drawX, drawY, sizePx, sizePx)
  return true
}

const flushFlowerLayer = (world: WorldState) => {
  if (world.flowerDirtyIndices.size <= 0) {
    return
  }

  const layer = ensureFlowerLayerCache(world)
  if (!layer.context) {
    return
  }

  let budget = FLOWER_LAYER_FLUSH_LIMIT
  for (const flowerIndex of world.flowerDirtyIndices) {
    const flower = world.flowers[flowerIndex]
    if (!flower || !flower.active || !flower.renderDirty) {
      world.flowerDirtyIndices.delete(flowerIndex)
      continue
    }

    const drawn = drawFlowerToLayer(layer.context, layer.size, flower, world.player.team === "arcanist")
    if (!drawn) {
      continue
    }

    flower.renderDirty = false
    world.flowerDirtyIndices.delete(flowerIndex)
    budget -= 1
    if (budget <= 0) {
      break
    }
  }

  world.flowerDirtyCount = world.flowerDirtyIndices.size
}

export const renderScene = ({ context, world, dt }: RenderSceneArgs) => {
  grassWaveTime += dt * 0.18

  context.save()
  context.imageSmoothingEnabled = false

  context.fillStyle = "#889684"
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)

  const renderCameraX = world.camera.x + world.cameraOffset.x
  const renderCameraY = world.camera.y + world.cameraOffset.y
  const fogCullBounds = buildFogCullBounds(renderCameraX, renderCameraY, 2.25)

  renderArenaGround(context, world, grassWaveTime, renderCameraX, renderCameraY)

  context.translate(VIEW_WIDTH * 0.5, VIEW_HEIGHT * 0.5)
  context.scale(WORLD_SCALE, WORLD_SCALE)
  context.translate(-renderCameraX, -renderCameraY)

  context.save()
  context.beginPath()
  context.arc(0, 0, Math.max(0.1, world.arenaRadius - 0.05), 0, Math.PI * 2)
  context.clip()

  renderMolotovZones(context, world, fogCullBounds)
  renderFlowers(context, world, renderCameraX, renderCameraY)
  renderObstacles(context, world)
  const hasVisiblePickupLayer = hasVisiblePickups(world, fogCullBounds)
  const compositionPlan = decideRenderFxCompositionPlan(hasVisiblePickupLayer, true)
  const renderedObstacleFxWithWebGl = renderObstacleFxInstances({
    context,
    world,
    cameraX: renderCameraX,
    cameraY: renderCameraY,
    drawToContext: compositionPlan.renderObstacleToContext,
    clearCanvas: true,
  })
  const resolvedPlan = decideRenderFxCompositionPlan(hasVisiblePickupLayer, renderedObstacleFxWithWebGl)

  let renderedFlightTrailsWithWebGl = false
  if (resolvedPlan.runCombinedTrailComposite) {
    renderedFlightTrailsWithWebGl = renderFlightTrailInstances({
      context,
      world,
      cameraX: renderCameraX,
      cameraY: renderCameraY,
      drawToContext: true,
      clearCanvas: false,
      forceComposite: true,
    })
  }

  if (!renderedObstacleFxWithWebGl) {
    renderObstacleDebris(context, world, fogCullBounds)
    renderShellCasings(context, world, fogCullBounds)
  }
  renderPickups(context, world, dt, fogCullBounds)
  if (resolvedPlan.runPostPickupTrailPass) {
    renderedFlightTrailsWithWebGl = renderFlightTrailInstances({
      context,
      world,
      cameraX: renderCameraX,
      cameraY: renderCameraY,
    })
  }
  recordRenderPathProfileFrame(
    world.renderPathProfile,
    hasVisiblePickupLayer,
    renderedObstacleFxWithWebGl,
    renderedFlightTrailsWithWebGl,
    resolvedPlan,
  )
  renderThrowables(context, world, !renderedFlightTrailsWithWebGl, fogCullBounds)
  renderProjectiles(context, world, !renderedFlightTrailsWithWebGl, fogCullBounds)
  renderAimLasers(context, world, fogCullBounds)
  renderUnits(context, world, fogCullBounds)
  renderExplosions(context, world, fogCullBounds)
  renderDamagePopups(context, world, fogCullBounds)

  context.restore()
  renderArenaBoundary(context, world)
  context.restore()

  renderOffscreenEnemyIndicators(context, world, renderCameraX, renderCameraY)
  renderAtmosphere(context)
}

const renderArenaGround = (
  context: CanvasRenderingContext2D,
  world: WorldState,
  waveTime: number,
  renderCameraX: number,
  renderCameraY: number,
) => {
  context.save()
  context.translate(VIEW_WIDTH * 0.5, VIEW_HEIGHT * 0.5)
  context.scale(WORLD_SCALE, WORLD_SCALE)
  context.translate(-renderCameraX, -renderCameraY)

  context.fillStyle = "#a3c784"
  context.beginPath()
  context.arc(0, 0, world.arenaRadius, 0, Math.PI * 2)
  context.fill()

  context.save()
  context.beginPath()
  context.arc(0, 0, world.arenaRadius - 0.12, 0, Math.PI * 2)
  context.clip()

  const groundCullBounds = buildCullBounds(renderCameraX, renderCameraY, 3)
  const minWorldX = groundCullBounds.minX
  const maxWorldX = groundCullBounds.maxX
  const minWorldY = groundCullBounds.minY
  const maxWorldY = groundCullBounds.maxY

  const groundLayer = ensureGroundLayerCache(world)
  if (groundLayer.canvas) {
    const mapSize = groundLayer.size
    const halfMap = Math.floor(mapSize * 0.5)
    context.drawImage(groundLayer.canvas, -halfMap, -halfMap, mapSize, mapSize)
  } else {
    context.fillStyle = GRASS_BASE_COLOR
    context.fillRect(minWorldX, minWorldY, maxWorldX - minWorldX, maxWorldY - minWorldY)
  }

  if (grassTransitionsTextureLoaded) {
    context.globalAlpha = 0.08
    const stripeHeight = 2.4
    for (let stripeY = minWorldY - stripeHeight; stripeY < maxWorldY + stripeHeight; stripeY += stripeHeight) {
      const alpha = clamp((Math.sin(stripeY * 0.34 + waveTime * 0.7) * 0.5 + 0.5) * 0.16, 0.03, 0.16)
      context.fillStyle = `rgba(81, 99, 75, ${alpha})`
      context.fillRect(minWorldX - 1, stripeY, maxWorldX - minWorldX + 2, stripeHeight)
    }
    context.globalAlpha = 1
  }

  context.restore()
  context.restore()
}

const renderArenaBoundary = (context: CanvasRenderingContext2D, world: WorldState) => {
  context.strokeStyle = "#bcc1bd"
  context.lineWidth = 0.45
  context.beginPath()
  context.arc(0, 0, world.arenaRadius, 0, Math.PI * 2)
  context.stroke()

  context.strokeStyle = "#7e8681"
  context.lineWidth = 0.2
  context.beginPath()
  context.arc(0, 0, world.arenaRadius - 0.5, 0, Math.PI * 2)
  context.stroke()
}

const renderFlowers = (
  context: CanvasRenderingContext2D,
  world: WorldState,
  renderCameraX: number,
  renderCameraY: number,
) => {
  const isSurvivorMode = world.player.team === "arcanist"

  if (isSurvivorMode) {
    for (const flower of world.flowers) {
      if (!flower.active || flower.size <= 0.005) {
        continue
      }

      const alpha = clamp(flower.alpha, 0, 1)
      if (alpha <= 0.01) {
        continue
      }

      const radius = Math.max(0.04, flower.size * 1.35)

      context.save()
      context.globalAlpha = alpha * 0.8
      context.fillStyle = SURVIVOR_BLOOD_SPLAT_COLOR
      context.beginPath()
      context.arc(flower.position.x, flower.position.y, radius, 0, Math.PI * 2)
      context.fill()
      context.restore()
    }
    return
  }

  const renderedWithWebGl = renderFlowerInstances({
    context,
    world,
    cameraX: renderCameraX,
    cameraY: renderCameraY,
  })
  if (renderedWithWebGl) {
    return
  }

  flushFlowerLayer(world)

  const layer = ensureFlowerLayerCache(world)
  if (!layer.canvas) {
    return
  }

  const mapSize = layer.size
  const halfMap = Math.floor(mapSize * 0.5)
  context.drawImage(layer.canvas, -halfMap, -halfMap, mapSize, mapSize)
}

const pickupGlowColor = (pickup: WorldState["pickups"][number]) => {
  if (pickup.kind === "xp") {
    return "132, 215, 255"
  }

  if (pickup.kind === "perk") {
    return "255, 118, 118"
  }

  if (pickup.highTier) {
    return "244, 248, 255"
  }

  return "255, 214, 104"
}

const drawXpCrystal = (context: CanvasRenderingContext2D, x: number, y: number, pulse: number, rotation: number) => {
  const scale = 0.75
  const width = (0.2 + pulse * 0.06) * scale
  const height = (0.34 + pulse * 0.08) * scale
  context.save()
  context.translate(x, y)
  context.rotate(rotation)
  context.fillStyle = "#8be0ff"
  context.beginPath()
  context.moveTo(0, -height)
  context.lineTo(width, -0.04)
  context.lineTo(width * 0.62, height * 0.72)
  context.lineTo(-width * 0.62, height * 0.72)
  context.lineTo(-width, -0.04)
  context.closePath()
  context.fill()

  context.fillStyle = "rgba(227, 250, 255, 0.8)"
  context.beginPath()
  context.moveTo(0, -height * 0.82)
  context.lineTo(width * 0.35, -0.05)
  context.lineTo(0, height * 0.54)
  context.lineTo(-width * 0.35, -0.05)
  context.closePath()
  context.fill()
  context.restore()
}

const hasVisiblePickups = (world: WorldState, fogCullBounds: FogCullBounds) => {
  for (const pickup of world.pickups) {
    if (!pickup.active) {
      continue
    }
    if (isInsideFogCullBounds(pickup.position.x, pickup.position.y, fogCullBounds, pickup.radius + 0.5)) {
      return true
    }
  }

  return false
}

const renderPickups = (
  context: CanvasRenderingContext2D,
  world: WorldState,
  dt: number,
  fogCullBounds: FogCullBounds,
) => {
  for (const pickup of world.pickups) {
    if (!pickup.active) {
      continue
    }

    if (!isInsideFogCullBounds(pickup.position.x, pickup.position.y, fogCullBounds, pickup.radius + 0.5)) {
      continue
    }

    const bobOffset = Math.sin(pickup.bob + dt * 4) * 0.14
    const pulse = 0.35 + (Math.sin(pickup.bob * 1.6) * 0.5 + 0.5) * 0.35
    if (pickup.kind !== "xp") {
      const glow = pickupGlowColor(pickup)

      context.fillStyle = `rgba(${glow}, ${0.18 + pulse * 0.2})`
      context.beginPath()
      context.arc(pickup.position.x, pickup.position.y + bobOffset, 0.68 + pulse * 0.22, 0, Math.PI * 2)
      context.fill()

      context.strokeStyle = `rgba(${glow}, ${0.28 + pulse * 0.35})`
      context.lineWidth = 0.08
      context.beginPath()
      context.arc(pickup.position.x, pickup.position.y + bobOffset, 0.5 + pulse * 0.14, 0, Math.PI * 2)
      context.stroke()
    }

    context.fillStyle = "rgba(0, 0, 0, 0.2)"
    context.beginPath()
    context.ellipse(pickup.position.x, pickup.position.y + 0.55, 0.45, 0.2, 0, 0, Math.PI * 2)
    context.fill()

    if (pickup.kind === "xp") {
      drawXpCrystal(context, pickup.position.x, pickup.position.y + bobOffset, pulse, pickup.rotation)
      continue
    }

    const spriteId = pickup.kind === "perk" && pickup.perkId ? pickup.perkId : pickup.weapon
    drawItemPickupSprite(context, spriteId, pickup.position.x, pickup.position.y + bobOffset, 0.1)
  }
}

const renderThrowables = (
  context: CanvasRenderingContext2D,
  world: WorldState,
  renderTrails: boolean,
  fogCullBounds: FogCullBounds,
) => {
  for (const throwable of world.throwables) {
    if (!throwable.active) {
      continue
    }

    if (!isInsideFogCullBounds(throwable.position.x, throwable.position.y, fogCullBounds, throwable.radius + 0.8)) {
      continue
    }

    if (throwable.mode === "grenade") {
      const speed = Math.hypot(throwable.velocity.x, throwable.velocity.y)
      if (renderTrails && speed > 0.45) {
        const directionX = throwable.velocity.x / speed
        const directionY = throwable.velocity.y / speed
        const trailLength = clamp(speed * 0.045, 0.12, 0.58)
        for (let index = 0; index < 4; index += 1) {
          const t = index / 3
          const alpha = (1 - t) * 0.16
          const spread = 0.02 + t * 0.05
          context.fillStyle = `rgba(238, 244, 222, ${alpha})`
          context.beginPath()
          context.ellipse(
            throwable.position.x - directionX * trailLength * (0.4 + t * 0.9),
            throwable.position.y - directionY * trailLength * (0.4 + t * 0.9),
            0.09 + spread,
            0.05 + spread * 0.7,
            0,
            0,
            Math.PI * 2,
          )
          context.fill()
        }
      }

      context.fillStyle = "rgba(0, 0, 0, 0.28)"
      context.beginPath()
      context.ellipse(throwable.position.x, throwable.position.y + 0.22, 0.2, 0.11, 0, 0, Math.PI * 2)
      context.fill()

      context.save()
      context.translate(throwable.position.x, throwable.position.y)
      context.rotate(throwable.rotation)
      drawGrenadeSprite(context, 0, 0, 0.08)
      context.restore()
      continue
    }

    context.fillStyle = "rgba(0, 0, 0, 0.24)"
    context.beginPath()
    context.ellipse(throwable.position.x, throwable.position.y + 0.2, 0.18, 0.1, 0, 0, Math.PI * 2)
    context.fill()

    context.save()
    context.translate(throwable.position.x, throwable.position.y)
    context.rotate(throwable.rotation)
    drawMolotovSprite(context, 0, 0, 0.08)
    context.restore()
  }
}

const renderMolotovZones = (context: CanvasRenderingContext2D, world: WorldState, fogCullBounds: FogCullBounds) => {
  for (const zone of world.molotovZones) {
    if (!zone.active) {
      continue
    }

    if (!isInsideFogCullBounds(zone.position.x, zone.position.y, fogCullBounds, zone.radius + 0.5)) {
      continue
    }

    const fullLife = zone.source === "flame" ? 3 : 2.2
    const alpha = clamp(zone.life / fullLife, 0, 1)
    if (zone.source === "flame") {
      context.fillStyle = `rgba(40, 34, 27, ${0.46 * alpha})`
      context.beginPath()
      context.arc(zone.position.x, zone.position.y, zone.radius * 1.06, 0, Math.PI * 2)
      context.fill()
    }

    context.fillStyle = zone.source === "flame"
      ? `rgba(214, 108, 40, ${0.3 * alpha})`
      : `rgba(244, 120, 46, ${0.24 * alpha})`
    context.beginPath()
    context.arc(zone.position.x, zone.position.y, zone.radius, 0, Math.PI * 2)
    context.fill()
    context.strokeStyle = zone.source === "flame"
      ? `rgba(255, 193, 132, ${0.55 * alpha})`
      : `rgba(255, 176, 84, ${0.5 * alpha})`
    context.lineWidth = 0.15
    context.beginPath()
    context.arc(zone.position.x, zone.position.y, Math.max(0.06, zone.radius - 0.2), 0, Math.PI * 2)
    context.stroke()
  }
}

const renderObstacles = (context: CanvasRenderingContext2D, world: WorldState) => {
  const grid = world.obstacleGrid
  const cullRange = buildObstacleGridCullRange(grid.size, world.camera.x, world.camera.y, 2)

  if (cullRange.maxX < cullRange.minX || cullRange.maxY < cullRange.minY) {
    return
  }

  for (let gy = cullRange.minY; gy <= cullRange.maxY; gy += 1) {
    for (let gx = cullRange.minX; gx <= cullRange.maxX; gx += 1) {
      const index = gy * grid.size + gx
      if (grid.solid[index] <= 0) {
        continue
      }

      const material = grid.material[index]
      const center = obstacleGridToWorldCenter(grid.size, gx, gy)
      const tileX = center.x - 0.5
      const tileY = center.y - 0.5

      if (material === OBSTACLE_MATERIAL_WAREHOUSE) {
        context.fillStyle = "#5f655d"
        context.fillRect(tileX, tileY, 1, 1)
        context.fillStyle = "#9ca293"
        context.fillRect(tileX + 0.08, tileY + 0.08, 0.84, 0.84)
        context.fillStyle = "#757b70"
        context.fillRect(tileX + 0.08, tileY + 0.46, 0.84, 0.12)
      } else if (material === OBSTACLE_MATERIAL_WALL) {
        context.fillStyle = "#874b39"
        context.fillRect(tileX, tileY, 1, 1)
        context.fillStyle = "#ab6850"
        context.fillRect(tileX + 0.06, tileY + 0.06, 0.88, 0.88)
        context.fillStyle = "#6e3528"
        context.fillRect(tileX + 0.06, tileY + 0.46, 0.88, 0.08)
      } else if (material === OBSTACLE_MATERIAL_BOX) {
        const isHighTierBox = grid.highTierLoot[index] > 0
        if (isHighTierBox) {
          context.fillStyle = "#4d535b"
          context.fillRect(tileX, tileY, 1, 1)
          context.fillStyle = "#d7dde6"
          context.fillRect(tileX + 0.06, tileY + 0.06, 0.88, 0.88)
          context.fillStyle = "#f4f8ff"
          context.fillRect(tileX + 0.12, tileY + 0.12, 0.76, 0.24)
          context.fillStyle = "#ffffff"
          context.fillRect(tileX + 0.44, tileY + 0.08, 0.12, 0.84)
          context.fillStyle = "#96a0ad"
          context.fillRect(tileX + 0.08, tileY + 0.54, 0.84, 0.1)
        } else {
          context.fillStyle = "#6f2d2b"
          context.fillRect(tileX, tileY, 1, 1)
          context.fillStyle = "#df6f3f"
          context.fillRect(tileX + 0.06, tileY + 0.06, 0.88, 0.88)
          context.fillStyle = "#ffd36e"
          context.fillRect(tileX + 0.12, tileY + 0.12, 0.76, 0.24)
          context.fillStyle = "#f6e5a8"
          context.fillRect(tileX + 0.44, tileY + 0.08, 0.12, 0.84)
          context.fillStyle = "#a1402e"
          context.fillRect(tileX + 0.08, tileY + 0.54, 0.84, 0.1)
        }
      } else if (material === OBSTACLE_MATERIAL_ROCK) {
        context.fillStyle = "#676a64"
        context.fillRect(tileX, tileY, 1, 1)
        context.fillStyle = "#8f948b"
        context.fillRect(tileX + 0.08, tileY + 0.08, 0.84, 0.84)
        context.fillStyle = "#5d605a"
        context.fillRect(tileX + 0.14, tileY + 0.14, 0.72, 0.08)
      }

      const flash = grid.flash[index]
      if (flash > 0.01) {
        const flicker = 0.42 + Math.sin((1 - flash) * 42) * 0.38
        context.fillStyle = `rgba(255, 96, 96, ${clamp(flash * flicker, 0, 1) * 0.55})`
        context.fillRect(tileX + 0.04, tileY + 0.04, 0.92, 0.92)
      }
    }
  }
}

const renderObstacleDebris = (context: CanvasRenderingContext2D, world: WorldState, fogCullBounds: FogCullBounds) => {
  for (const debris of world.obstacleDebris) {
    if (!debris.active || debris.maxLife <= 0) {
      continue
    }

    if (!isInsideFogCullBounds(debris.position.x, debris.position.y, fogCullBounds, debris.size + 0.35)) {
      continue
    }

    const lifeRatio = clamp(debris.life / debris.maxLife, 0, 1)
    const alpha = lifeRatio * lifeRatio
    const size = debris.size * (0.7 + (1 - lifeRatio) * 0.5)

    context.save()
    context.globalAlpha = alpha
    context.translate(debris.position.x, debris.position.y)
    context.rotate(debris.rotation)
    context.fillStyle = debris.color
    context.fillRect(-size * 0.5, -size * 0.5, size, size)
    context.fillStyle = "rgba(24, 18, 16, 0.34)"
    context.fillRect(-size * 0.5, size * 0.1, size, size * 0.2)
    context.restore()
  }
}

const renderShellCasings = (context: CanvasRenderingContext2D, world: WorldState, fogCullBounds: FogCullBounds) => {
  for (const casing of world.shellCasings) {
    if (!casing.active || casing.maxLife <= 0) {
      continue
    }

    if (!isInsideFogCullBounds(casing.position.x, casing.position.y, fogCullBounds, casing.size + 0.3)) {
      continue
    }

    const lifeRatio = clamp(casing.life / casing.maxLife, 0, 1)
    context.save()
    context.globalAlpha = lifeRatio * 0.9
    context.translate(casing.position.x, casing.position.y)
    context.rotate(casing.rotation)
    context.fillStyle = "#e7c66a"
    context.fillRect(-casing.size * 0.5, -casing.size * 0.28, casing.size, casing.size * 0.56)
    context.fillStyle = "#b18b34"
    context.fillRect(-casing.size * 0.5, casing.size * 0.03, casing.size, casing.size * 0.16)
    context.restore()
  }
}

const renderExplosions = (context: CanvasRenderingContext2D, world: WorldState, fogCullBounds: FogCullBounds) => {
  for (const explosion of world.explosions) {
    if (!explosion.active) {
      continue
    }

    if (!isInsideFogCullBounds(explosion.position.x, explosion.position.y, fogCullBounds, explosion.radius + 0.85)) {
      continue
    }

    const alpha = clamp(explosion.life / 0.24, 0, 1)
    const radius = explosion.radius * (1 + (1 - alpha) * 0.45)
    if (explosion.radius <= 0.18) {
      const pulse = 1 + (1 - alpha) * 0.25
      context.fillStyle = `rgba(255, 86, 86, ${0.62 * alpha})`
      context.fillRect(
        explosion.position.x - explosion.radius * pulse,
        explosion.position.y - explosion.radius * pulse,
        explosion.radius * 2 * pulse,
        explosion.radius * 2 * pulse,
      )
      continue
    }

    context.fillStyle = `rgba(255, 192, 74, ${0.24 * alpha})`
    context.beginPath()
    context.arc(explosion.position.x, explosion.position.y, radius, 0, Math.PI * 2)
    context.fill()

    context.fillStyle = `rgba(255, 132, 56, ${0.72 * alpha})`
    for (let i = 0; i < 10; i += 1) {
      const angle = (Math.PI * 2 * i) / 10 + (1 - alpha) * 0.8
      const spike = radius * randomRange(0.16, 1)
      context.fillRect(
        explosion.position.x + Math.cos(angle) * spike - 0.08,
        explosion.position.y + Math.sin(angle) * spike - 0.08,
        0.16,
        0.16,
      )
    }
  }
}

const renderProjectiles = (
  context: CanvasRenderingContext2D,
  world: WorldState,
  renderTrails: boolean,
  fogCullBounds: FogCullBounds,
) => {
  for (const projectile of world.projectiles) {
    if (!projectile.active) {
      continue
    }

    if (!isInsideFogCullBounds(projectile.position.x, projectile.position.y, fogCullBounds, projectile.radius * 3.2 + 0.7)) {
      continue
    }

    const speed = Math.hypot(projectile.velocity.x, projectile.velocity.y)
    const angle = Math.atan2(projectile.velocity.y, projectile.velocity.x)
    const stretch = clamp(speed / 25, 1.1, projectile.kind === "flame" ? 2.2 : 2.9)
    const length = projectile.radius * 2.6 * stretch
    const width = projectile.radius * 1.4
    const glow = projectile.radius * (2.2 + projectile.glow)

    context.fillStyle = "rgba(0, 0, 0, 0.26)"
    context.beginPath()
    context.ellipse(
      projectile.position.x,
      projectile.position.y + 0.26,
      projectile.radius * 0.8,
      projectile.radius * 0.45,
      0,
      0,
      Math.PI * 2,
    )
    context.fill()

    if (projectile.kind === "flame") {
      context.fillStyle = "rgba(255, 148, 72, 0.36)"
      context.beginPath()
      context.arc(projectile.position.x, projectile.position.y, glow, 0, Math.PI * 2)
      context.fill()
    } else {
      context.fillStyle = "rgba(255, 245, 208, 0.16)"
      context.beginPath()
      context.arc(projectile.position.x, projectile.position.y, projectile.radius * 1.05, 0, Math.PI * 2)
      context.fill()
    }

    if (renderTrails) {
      context.save()
      context.translate(projectile.position.x, projectile.position.y)
      context.rotate(angle)

      const trailLength = projectile.kind === "flame" ? length * 1.1 : length * 1.65
      for (let index = 0; index < 6; index += 1) {
        const t = index / 5
        const alpha = projectile.kind === "flame" ? (1 - t) * 0.2 : (1 - t) * 0.22
        context.fillStyle = projectile.kind === "flame"
          ? `rgba(255, 177, 122, ${alpha})`
          : `rgba(255, 230, 170, ${alpha})`
        context.beginPath()
        context.ellipse(
          -trailLength * (0.3 + t * 0.58),
          0,
          width * (0.9 - t * 0.36),
          width * (0.56 - t * 0.24),
          0,
          0,
          Math.PI * 2,
        )
        context.fill()
      }

      context.restore()
    }

    if (projectile.kind === "flame") {
      drawFlameProjectileSprite(context, projectile.position.x, projectile.position.y, 0.07)
      continue
    }

    context.save()
    context.translate(projectile.position.x, projectile.position.y)
    context.rotate(angle)

    context.fillStyle = "rgba(255, 181, 72, 0.35)"
    context.beginPath()
    context.ellipse(-length * 0.2, 0, length * 0.55, width * 0.86, 0, 0, Math.PI * 2)
    context.fill()

    context.fillStyle = "#ffc248"
    context.beginPath()
    context.moveTo(-length * 0.52, 0)
    context.quadraticCurveTo(-length * 0.2, -width * 0.65, length * 0.45, 0)
    context.quadraticCurveTo(-length * 0.2, width * 0.65, -length * 0.52, 0)
    context.fill()

    context.fillStyle = "#fff2aa"
    context.beginPath()
    context.ellipse(length * 0.18, 0, width * 0.4, width * 0.3, 0, 0, Math.PI * 2)
    context.fill()

    context.restore()
  }
}

const renderAimLasers = (context: CanvasRenderingContext2D, world: WorldState, fogCullBounds: FogCullBounds) => {
  const LASER_LENGTH_WORLD = 9.5
  const pulse = 0.7 + (Math.sin(grassWaveTime * 6.5) * 0.5 + 0.5) * 0.3
  context.save()

  for (const unit of world.units) {
    const unitHasLaserSight = unit.laserSight || (unit.perkStacks.laser_sight ?? 0) > 0
    if (!unitHasLaserSight) {
      continue
    }

    if (!isInsideFogCullBounds(unit.position.x, unit.position.y, fogCullBounds, unit.radius + 10)) {
      continue
    }

    const aimLength = Math.hypot(unit.aim.x, unit.aim.y)
    if (aimLength <= 0.0001) {
      continue
    }

    const dirX = unit.aim.x / aimLength
    const dirY = unit.aim.y / aimLength
    const startX = unit.position.x + dirX * (unit.radius + 0.12)
    const startY = unit.position.y + dirY * (unit.radius + 0.12)
    const endX = startX + dirX * LASER_LENGTH_WORLD
    const endY = startY + dirY * LASER_LENGTH_WORLD
    const normalX = -dirY
    const normalY = dirX
    const halfBaseWidth = (unit.isPlayer ? 0.03 : 0.022) * pulse
    const baseLeftX = startX + normalX * halfBaseWidth
    const baseLeftY = startY + normalY * halfBaseWidth
    const baseRightX = startX - normalX * halfBaseWidth
    const baseRightY = startY - normalY * halfBaseWidth
    const alpha = unit.isPlayer ? 0.72 * pulse : 0.48 * pulse

    context.fillStyle = unit.isPlayer
      ? `rgba(255, 106, 106, ${alpha})`
      : `rgba(255, 80, 80, ${alpha})`
    context.beginPath()
    context.moveTo(baseLeftX, baseLeftY)
    context.lineTo(baseRightX, baseRightY)
    context.lineTo(endX, endY)
    context.closePath()
    context.fill()
  }

  context.restore()
}

const renderUnitStatusRings = (
  context: CanvasRenderingContext2D,
  unit: WorldState["units"][number],
  drawX: number,
  drawY: number,
  body: number,
) => {
  const isReloading = unit.reloadCooldown > 0 && unit.reloadCooldownMax > 0
  const progress = isReloading
    ? clamp(1 - unit.reloadCooldown / unit.reloadCooldownMax, 0, 1)
    : Number.isFinite(unit.primaryAmmo) && Number.isFinite(unit.magazineSize) && unit.magazineSize > 0
    ? clamp(unit.primaryAmmo / unit.magazineSize, 0, 1)
    : 1
  const radius = body + PRIMARY_RELOAD_RING_OFFSET_WORLD

  context.save()
  context.lineCap = "butt"
  context.beginPath()
  context.arc(drawX, drawY, radius, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * progress)
  context.strokeStyle = isReloading ? PRIMARY_RELOAD_PROGRESS_RING_COLOR : PRIMARY_RELOAD_RING_COLOR
  context.lineWidth = PRIMARY_RELOAD_RING_THICKNESS_WORLD
  context.stroke()

  context.restore()
}

const renderUnits = (context: CanvasRenderingContext2D, world: WorldState, fogCullBounds: FogCullBounds) => {
  const isSurvivorMode = world.player.team === "arcanist"
  for (const unit of world.units) {
    const isSurvivorSwarmEnemy = isSurvivorMode && !unit.isPlayer && unit.team === "swarm"
    const isSurvivorSpider = isSurvivorSwarmEnemy && unit.survivorArchetype === "giant_spider"
    const bodyScale = isSurvivorSwarmEnemy
      ? isSurvivorSpider
        ? 1.2
        : 0.82
      : 1
    const drawX = unit.position.x - unit.aim.x * unit.recoil * 0.32
    const drawY = unit.position.y - unit.aim.y * unit.recoil * 0.32
    const body = unit.radius * 1.2 * bodyScale
    const ear = unit.radius * 0.42 * bodyScale

    if (!isInsideFogCullBounds(drawX, drawY, fogCullBounds, body * 2.8)) {
      continue
    }

    if (!isSurvivorSwarmEnemy) {
      renderUnitStatusRings(context, unit, drawX, drawY, body)
    }

    const moveSpeed = Math.hypot(unit.velocity.x, unit.velocity.y)
    const skew = clamp(moveSpeed / 12, 0, 1)
    context.fillStyle = "rgba(0, 0, 0, 0.24)"
    context.beginPath()
    context.ellipse(
      drawX - unit.velocity.x * 0.012,
      drawY + body * 1.26,
      body * (0.68 + skew * 0.12),
      body * (0.37 - skew * 0.05),
      0,
      0,
      Math.PI * 2,
    )
    context.fill()

    const palette = paletteForUnit(world, unit)
    const tone = palette.tone
    const edge = palette.edge
    const earLeftX = drawX - body * 0.7
    const earRightX = drawX + body * 0.7
    const earY = drawY - body * 0.95

    context.fillStyle = edge
    context.fillRect(earLeftX - ear * 0.5, earY - ear, ear, ear * 1.2)
    context.fillRect(earRightX - ear * 0.5, earY - ear, ear, ear * 1.2)
    context.fillStyle = tone
    context.fillRect(earLeftX - ear * 0.25, earY - ear * 0.55, ear * 0.5, ear * 0.55)
    context.fillRect(earRightX - ear * 0.25, earY - ear * 0.55, ear * 0.5, ear * 0.55)

    context.fillStyle = edge
    context.fillRect(drawX - body * 0.85, drawY - body, body * 1.7, body * 2)
    context.fillStyle = tone
    context.fillRect(drawX - body * 0.68, drawY - body * 0.82, body * 1.36, body * 1.64)

    if (!isSurvivorSwarmEnemy) {
      const gunLength = unit.radius * 1.25 + unit.recoil * 0.24
      const weaponAngle = Math.atan2(unit.aim.y, unit.aim.x)
      const weaponScale = Math.max(0.09, unit.radius * 0.36)
      context.save()
      context.translate(drawX, drawY)
      context.rotate(weaponAngle)
      drawWeaponPickupSprite(context, unit.primaryWeapon, gunLength, 0, weaponScale)
      context.restore()
    }

    if (unit.hitFlash > 0) {
      const flicker = 0.42 + Math.sin((1 - unit.hitFlash) * 42) * 0.38
      context.globalAlpha = clamp(unit.hitFlash * flicker, 0, 1)
      context.fillStyle = unit.isPlayer ? "#ff8a8a" : "#ff5454"
      context.fillRect(drawX - body * 0.75, drawY - body * 0.85, body * 1.5, body * 1.7)
      context.fillRect(earLeftX - body * 0.18, earY - body * 0.25, body * 1.36, body * 0.32)
      context.globalAlpha = 1
    }

    const hpRatio = clamp(unit.hp / unit.maxHp, 0, 1)
    context.fillStyle = "rgba(0, 0, 0, 0.4)"
    context.fillRect(drawX - body, drawY - body * 1.28, body * 2, body * 0.24)
    context.fillStyle = unit.isPlayer ? "#e8ffdb" : "#8fc0ff"
    context.fillRect(drawX - body, drawY - body * 1.28, body * 2 * hpRatio, body * 0.24)
  }
}

const renderOffscreenEnemyIndicators = (
  context: CanvasRenderingContext2D,
  world: WorldState,
  renderCameraX: number,
  renderCameraY: number,
) => {
  if (!world.running || world.finished) {
    return
  }

  const margin = 24
  const innerLeft = margin
  const innerTop = margin
  const innerRight = VIEW_WIDTH - margin
  const innerBottom = VIEW_HEIGHT - margin
  const centerX = VIEW_WIDTH * 0.5
  const centerY = VIEW_HEIGHT * 0.5
  const markerSpacing = 34
  const cornerPadding = 24
  const sideMinY = Math.min(innerBottom, innerTop + cornerPadding)
  const sideMaxY = Math.max(sideMinY, innerBottom - cornerPadding)
  const sideMinX = Math.min(innerRight, innerLeft + cornerPadding)
  const sideMaxX = Math.max(sideMinX, innerRight - cornerPadding)

  type OffscreenMarkerSide = "left" | "right" | "top" | "bottom"

  interface OffscreenMarker {
    enemy: WorldState["units"][number]
    x: number
    y: number
    angle: number
    side: OffscreenMarkerSide
    sideAxis: number
    distanceMeters: number
  }

  const distributeSideMarkers = (
    markers: OffscreenMarker[],
    minAxis: number,
    maxAxis: number,
    spacing: number,
    side: OffscreenMarkerSide,
  ) => {
    if (markers.length <= 0) {
      return [] as OffscreenMarker[]
    }

    const sorted = markers
      .slice()
      .sort((left, right) => left.sideAxis - right.sideAxis)
      .map((marker) => ({ ...marker, sideAxis: clamp(marker.sideAxis, minAxis, maxAxis) }))

    const availableRange = Math.max(0, maxAxis - minAxis)
    const requiredRange = spacing * Math.max(0, sorted.length - 1)

    if (requiredRange > availableRange && sorted.length > 1) {
      const spreadStep = availableRange / (sorted.length - 1)
      for (let index = 0; index < sorted.length; index += 1) {
        sorted[index].sideAxis = minAxis + spreadStep * index
      }
    } else {
      for (let index = 1; index < sorted.length; index += 1) {
        sorted[index].sideAxis = Math.max(sorted[index].sideAxis, sorted[index - 1].sideAxis + spacing)
      }

      if (sorted[sorted.length - 1].sideAxis > maxAxis) {
        sorted[sorted.length - 1].sideAxis = maxAxis
        for (let index = sorted.length - 2; index >= 0; index -= 1) {
          sorted[index].sideAxis = Math.min(sorted[index].sideAxis, sorted[index + 1].sideAxis - spacing)
        }

        if (sorted[0].sideAxis < minAxis) {
          sorted[0].sideAxis = minAxis
          for (let index = 1; index < sorted.length; index += 1) {
            sorted[index].sideAxis = Math.max(sorted[index].sideAxis, sorted[index - 1].sideAxis + spacing)
          }
        }
      }
    }

    for (const marker of sorted) {
      if (side === "left" || side === "right") {
        marker.y = clamp(marker.sideAxis, sideMinY, sideMaxY)
      } else {
        marker.x = clamp(marker.sideAxis, sideMinX, sideMaxX)
      }
    }

    return sorted
  }

  const sideMarkers: Record<OffscreenMarkerSide, OffscreenMarker[]> = {
    left: [],
    right: [],
    top: [],
    bottom: [],
  }

  context.save()
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.font = "bold 11px monospace"

  const isSurvivorMode = world.player.team === "arcanist"
  const isBossEnemy = (enemy: WorldState["units"][number]) => enemy.maxHp >= 220

  for (const enemy of world.units) {
    if (enemy.id === world.player.id || enemy.team === world.player.team) {
      continue
    }
    if (!isBossEnemy(enemy)) {
      continue
    }
    if (isSurvivorMode && enemy.team !== "swarm") {
      continue
    }

    const screenX = (enemy.position.x - renderCameraX) * WORLD_SCALE + centerX
    const screenY = (enemy.position.y - renderCameraY) * WORLD_SCALE + centerY
    const isOnScreen = screenX >= 0 && screenX <= VIEW_WIDTH && screenY >= 0 && screenY <= VIEW_HEIGHT
    if (isOnScreen) {
      continue
    }

    const dx = screenX - centerX
    const dy = screenY - centerY
    const angle = Math.atan2(dy, dx)
    const horizontalRatio = Math.abs(dx) / Math.max(1, VIEW_WIDTH * 0.5 - margin)
    const verticalRatio = Math.abs(dy) / Math.max(1, VIEW_HEIGHT * 0.5 - margin)
    const dominantHorizontal = horizontalRatio >= verticalRatio
    let side: OffscreenMarkerSide = "right"
    let markerX = centerX
    let markerY = centerY

    if (dominantHorizontal) {
      if (dx >= 0) {
        side = "right"
        markerX = innerRight
        markerY = centerY + dy * ((innerRight - centerX) / Math.max(0.001, dx))
      } else {
        side = "left"
        markerX = innerLeft
        markerY = centerY + dy * ((innerLeft - centerX) / Math.min(-0.001, dx))
      }
      markerY = clamp(markerY, innerTop, innerBottom)
    } else {
      if (dy >= 0) {
        side = "bottom"
        markerY = innerBottom
        markerX = centerX + dx * ((innerBottom - centerY) / Math.max(0.001, dy))
      } else {
        side = "top"
        markerY = innerTop
        markerX = centerX + dx * ((innerTop - centerY) / Math.min(-0.001, dy))
      }
      markerX = clamp(markerX, innerLeft, innerRight)
    }

    const distanceMeters = Math.hypot(
      enemy.position.x - world.player.position.x,
      enemy.position.y - world.player.position.y,
    )

    sideMarkers[side].push({
      enemy,
      x: markerX,
      y: markerY,
      angle,
      side,
      sideAxis: side === "left" || side === "right" ? markerY : markerX,
      distanceMeters,
    })
  }

  const placedMarkers: OffscreenMarker[] = [
    ...distributeSideMarkers(sideMarkers.left, sideMinY, sideMaxY, markerSpacing, "left"),
    ...distributeSideMarkers(sideMarkers.right, sideMinY, sideMaxY, markerSpacing, "right"),
    ...distributeSideMarkers(sideMarkers.top, sideMinX, sideMaxX, markerSpacing, "top"),
    ...distributeSideMarkers(sideMarkers.bottom, sideMinX, sideMaxX, markerSpacing, "bottom"),
  ]

  for (const marker of placedMarkers) {
    const { enemy, x: markerX, y: markerY, angle, distanceMeters } = marker
    const palette = paletteForUnit(world, enemy)

    context.save()
    context.translate(markerX, markerY)
    context.rotate(angle)

    context.fillStyle = "rgba(0, 0, 0, 0.4)"
    context.beginPath()
    context.moveTo(13, 0)
    context.lineTo(-2, -8)
    context.lineTo(-2, 8)
    context.closePath()
    context.fill()

    context.fillStyle = palette.tone
    context.beginPath()
    context.moveTo(11, 0)
    context.lineTo(-3, -7)
    context.lineTo(-3, 7)
    context.closePath()
    context.fill()

    context.fillStyle = palette.edge
    context.fillRect(-17, -5, 8, 8)
    context.fillStyle = "#eff3ff"
    context.fillRect(-15, -3, 4, 4)

    context.rotate(-angle)
    context.fillStyle = "rgba(8, 16, 10, 0.72)"
    context.fillRect(-7, 9, 30, 14)
    context.fillStyle = "#eaf5e1"
    context.fillText(`${distanceMeters.toFixed(1)}m`, 8, 16)
    context.restore()
  }

  context.restore()
}

const renderDamagePopups = (context: CanvasRenderingContext2D, world: WorldState, fogCullBounds: FogCullBounds) => {
  context.textAlign = "center"
  context.font = "0.9px monospace"
  for (const popup of world.damagePopups) {
    if (!popup.active) {
      continue
    }

    if (!isInsideFogCullBounds(popup.position.x, popup.position.y, fogCullBounds, 0.9)) {
      continue
    }

    const alpha = clamp(popup.life / 0.62, 0, 1)
    const scale = 1 + (1 - alpha) * 0.14
    context.fillStyle = `rgba(0, 0, 0, ${0.5 * alpha})`
    context.fillText(popup.text, popup.position.x + 0.05, popup.position.y + 0.05)

    context.save()
    context.globalAlpha = alpha
    context.fillStyle = popup.color
    context.translate(popup.position.x, popup.position.y)
    context.scale(scale, scale)
    context.fillText(popup.text, 0, 0)
    context.restore()
  }
}

const renderAtmosphere = (context: CanvasRenderingContext2D) => {
  const gradient = context.createRadialGradient(
    VIEW_WIDTH * 0.5,
    VIEW_HEIGHT * 0.5,
    60,
    VIEW_WIDTH * 0.5,
    VIEW_HEIGHT * 0.5,
    VIEW_WIDTH * 0.75,
  )
  gradient.addColorStop(0, "rgba(212, 216, 214, 0)")
  gradient.addColorStop(1, "rgba(64, 69, 67, 0.24)")
  context.fillStyle = gradient
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT)
}
