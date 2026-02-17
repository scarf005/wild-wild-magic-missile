export type TerrainTile =
  | "grass"
  | "clover"
  | "wild-grass"
  | "dirt"
  | "dirt-road"
  | "road-edge"
  | "gravel"
  | "concrete"

export interface MapObstacleBlueprint {
  kind: "warehouse" | "wall" | "box" | "high-tier-box" | "rock"
  x: number
  y: number
  width: number
  height: number
  tiles: boolean[][]
}

export interface PickupSpawnPoint {
  x: number
  y: number
}

export interface TerrainMap {
  size: number
  tiles: TerrainTile[][]
  obstacles: MapObstacleBlueprint[]
  pickupSpawnPoints: PickupSpawnPoint[]
}

const TILE_IDS: TerrainTile[] = [
  "dirt",
  "dirt-road",
  "road-edge",
  "gravel",
  "concrete",
]

const WEIGHTS: Record<TerrainTile, number> = {
  grass: 0,
  clover: 0,
  "wild-grass": 0,
  dirt: 38,
  "dirt-road": 22,
  "road-edge": 14,
  gravel: 18,
  concrete: 8,
}

const ALLOWED: Record<TerrainTile, TerrainTile[]> = {
  grass: ["dirt", "dirt-road", "road-edge", "gravel", "concrete"],
  clover: ["dirt", "dirt-road", "road-edge", "gravel", "concrete"],
  "wild-grass": ["dirt", "dirt-road", "road-edge", "gravel", "concrete"],
  dirt: ["grass", "clover", "wild-grass", "dirt", "dirt-road", "road-edge", "gravel", "concrete"],
  "dirt-road": ["dirt", "dirt-road", "road-edge", "gravel", "concrete"],
  "road-edge": ["grass", "clover", "wild-grass", "dirt", "dirt-road", "road-edge", "gravel"],
  gravel: ["grass", "wild-grass", "dirt", "dirt-road", "road-edge", "gravel", "concrete"],
  concrete: ["dirt", "dirt-road", "gravel", "concrete"],
}

const randomInt = (min: number, max: number) => Math.floor(min + Math.random() * (max - min + 1))

const gridToWorld = (index: number, size: number) => index - Math.floor(size * 0.5) + 0.5
const gridToWorldOrigin = (index: number, size: number) => index - Math.floor(size * 0.5)

const hasNeighbor = (mask: boolean[][], x: number, y: number) => {
  for (let oy = -1; oy <= 1; oy += 1) {
    for (let ox = -1; ox <= 1; ox += 1) {
      if (ox === 0 && oy === 0) {
        continue
      }

      const nx = x + ox
      const ny = y + oy
      if (ny < 0 || nx < 0 || ny >= mask.length || nx >= mask[ny].length) {
        continue
      }

      if (mask[ny][nx]) {
        return true
      }
    }
  }

  return false
}

const carveBrush = (mask: boolean[][], centerX: number, centerY: number, radius: number) => {
  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    if (y < 0 || y >= mask.length) {
      continue
    }
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      if (x < 0 || x >= mask[y].length) {
        continue
      }
      mask[y][x] = true
    }
  }
}

const connectPoints = (mask: boolean[][], fromX: number, fromY: number, toX: number, toY: number) => {
  let x = fromX
  let y = fromY
  carveBrush(mask, x, y, randomInt(0, 1))

  for (let guard = 0; guard < mask.length * mask.length; guard += 1) {
    if (x === toX && y === toY) {
      break
    }

    const dx = toX - x
    const dy = toY - y
    const preferHorizontal = Math.random() > 0.5
    if (dx !== 0 && (preferHorizontal || dy === 0)) {
      x += Math.sign(dx)
    } else if (dy !== 0) {
      y += Math.sign(dy)
    }

    carveBrush(mask, x, y, Math.random() > 0.88 ? 1 : 0)
  }
}

const buildRoadNetworkMask = (size: number) => {
  const mask = Array.from({ length: size }, () => Array.from({ length: size }, () => false))
  const center = Math.floor(size * 0.5)
  const hubCount = randomInt(3, 5)
  const hubs: [number, number][] = [[center, center]]

  for (let index = 1; index < hubCount; index += 1) {
    const ring = size * randomInt(18, 40) * 0.01
    const angle = (Math.PI * 2 * index) / hubCount + Math.random() * 0.9
    const x = Math.round(center + Math.cos(angle) * ring)
    const y = Math.round(center + Math.sin(angle) * ring)
    hubs.push([Math.max(4, Math.min(size - 5, x)), Math.max(4, Math.min(size - 5, y))])
  }

  for (let index = 1; index < hubs.length; index += 1) {
    const [fromX, fromY] = hubs[index - 1]
    const [toX, toY] = hubs[index]
    connectPoints(mask, fromX, fromY, toX, toY)
  }

  for (let index = 1; index < hubs.length; index += 1) {
    const [toX, toY] = hubs[index]
    connectPoints(mask, center, center, toX, toY)
  }

  return mask
}

const circleFitsArena = (gridX: number, gridY: number, size: number, margin: number) => {
  const wx = gridToWorld(gridX, size)
  const wy = gridToWorld(gridY, size)
  const radius = size * 0.5 - margin
  return wx * wx + wy * wy <= radius * radius
}

const rectsOverlap = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  padding: number,
) => {
  return !(
    a.x + a.width * 0.5 + padding <= b.x - b.width * 0.5 ||
    a.x - a.width * 0.5 - padding >= b.x + b.width * 0.5 ||
    a.y + a.height * 0.5 + padding <= b.y - b.height * 0.5 ||
    a.y - a.height * 0.5 - padding >= b.y + b.height * 0.5
  )
}

const rectFitsArena = (left: number, top: number, width: number, height: number, size: number, margin: number) => {
  for (let y = top; y < top + height; y += 1) {
    for (let x = left; x < left + width; x += 1) {
      if (!circleFitsArena(x, y, size, margin)) {
        return false
      }
    }
  }

  return true
}

const rectTouchesMask = (
  mask: boolean[][],
  left: number,
  top: number,
  width: number,
  height: number,
  padding: number,
) => {
  for (let y = top - padding; y < top + height + padding; y += 1) {
    if (y < 0 || y >= mask.length) {
      continue
    }

    for (let x = left - padding; x < left + width + padding; x += 1) {
      if (x < 0 || x >= mask[y].length) {
        continue
      }

      if (mask[y][x]) {
        return true
      }
    }
  }

  return false
}

const gridRectToWorldRect = (left: number, top: number, width: number, height: number, size: number) => {
  return {
    x: gridToWorldOrigin(left, size) + width * 0.5,
    y: gridToWorldOrigin(top, size) + height * 0.5,
    width,
    height,
  }
}

const applyRoadNetwork = (tiles: TerrainTile[][]) => {
  const size = tiles.length
  const roads = buildRoadNetworkMask(size)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (roads[y][x]) {
        tiles[y][x] = Math.random() > 0.18 ? "dirt-road" : "gravel"
        continue
      }

      if (
        hasNeighbor(roads, x, y) &&
        (tiles[y][x] === "grass" || tiles[y][x] === "clover" || tiles[y][x] === "wild-grass") &&
        Math.random() > 0.42
      ) {
        tiles[y][x] = "road-edge"
      }
    }
  }

  return roads
}

const createWarehouseBlueprints = (size: number, paths: boolean[][]) => {
  const obstacles: MapObstacleBlueprint[] = []
  const warehouseCount = 0

  for (let attempt = 0; attempt < 700 && obstacles.length < warehouseCount; attempt += 1) {
    const width = randomInt(4, 8)
    const height = randomInt(3, 6)
    const left = randomInt(3, size - width - 4)
    const top = randomInt(3, size - height - 4)
    if (!rectFitsArena(left, top, width, height, size, 2.8)) {
      continue
    }

    if (!rectTouchesMask(paths, left, top, width, height, 2)) {
      continue
    }

    const worldRect = gridRectToWorldRect(left, top, width, height, size)

    const blocked = obstacles.some((existing) => rectsOverlap(worldRect, existing, 2.2))
    if (blocked) {
      continue
    }

    const tiles = Array.from(
      { length: height },
      (_, row) =>
        Array.from({ length: width }, (_, col) => row === 0 || col === 0 || row === height - 1 || col === width - 1),
    )
    const entrance = randomInt(0, 3)
    if (entrance === 0) {
      tiles[0][Math.floor(width * 0.5)] = false
    }
    if (entrance === 1) {
      tiles[height - 1][Math.floor(width * 0.5)] = false
    }
    if (entrance === 2) {
      tiles[Math.floor(height * 0.5)][0] = false
    }
    if (entrance === 3) {
      tiles[Math.floor(height * 0.5)][width - 1] = false
    }

    obstacles.push({
      kind: "warehouse",
      x: worldRect.x,
      y: worldRect.y,
      width,
      height,
      tiles,
    })
  }

  return obstacles
}

const createHighTierLootBoxBlueprints = (size: number, warehouses: MapObstacleBlueprint[]) => {
  const boxes: MapObstacleBlueprint[] = []

  for (const warehouse of warehouses) {
    const left = Math.floor(warehouse.x - warehouse.width * 0.5 + size * 0.5)
    const top = Math.floor(warehouse.y - warehouse.height * 0.5 + size * 0.5)
    const candidates: [number, number][] = []

    for (let row = 1; row < warehouse.tiles.length - 1; row += 1) {
      for (let col = 1; col < warehouse.tiles[row].length - 1; col += 1) {
        if (warehouse.tiles[row][col]) {
          continue
        }

        const gridX = left + col
        const gridY = top + row
        if (!circleFitsArena(gridX, gridY, size, 2.4)) {
          continue
        }

        candidates.push([gridX, gridY])
      }
    }

    if (candidates.length === 0) {
      continue
    }

    const [gridX, gridY] = candidates[randomInt(0, candidates.length - 1)]
    boxes.push({
      kind: "high-tier-box",
      x: gridToWorld(gridX, size),
      y: gridToWorld(gridY, size),
      width: 1,
      height: 1,
      tiles: [],
    })
  }

  return boxes
}

const createRoadsideStructureBlueprints = (size: number, paths: boolean[][], blocked: MapObstacleBlueprint[]) => {
  const compounds: MapObstacleBlueprint[] = []
  const structureCount = 0

  for (let attempt = 0; attempt < 1200 && compounds.length < structureCount; attempt += 1) {
    const width = randomInt(5, 9)
    const height = randomInt(5, 8)
    const left = randomInt(3, size - width - 4)
    const top = randomInt(3, size - height - 4)

    if (!rectFitsArena(left, top, width, height, size, 2.8)) {
      continue
    }
    if (rectTouchesMask(paths, left, top, width, height, 0)) {
      continue
    }
    if (!rectTouchesMask(paths, left, top, width, height, 2)) {
      continue
    }

    const worldRect = gridRectToWorldRect(left, top, width, height, size)
    const blockedByStructures = blocked.some((structure) => rectsOverlap(worldRect, structure, 2.2)) ||
      compounds.some((existing) => rectsOverlap(worldRect, existing, 2.2))
    if (blockedByStructures) {
      continue
    }

    const tiles = Array.from(
      { length: height },
      (_, row) =>
        Array.from({ length: width }, (_, col) => row === 0 || col === 0 || row === height - 1 || col === width - 1),
    )

    const firstEntrance = randomInt(0, 3)
    const secondEntrance = (firstEntrance + randomInt(1, 3)) % 4
    const carveEntrance = (side: number) => {
      if (side === 0) {
        tiles[0][Math.floor(width * 0.5)] = false
      }
      if (side === 1) {
        tiles[height - 1][Math.floor(width * 0.5)] = false
      }
      if (side === 2) {
        tiles[Math.floor(height * 0.5)][0] = false
      }
      if (side === 3) {
        tiles[Math.floor(height * 0.5)][width - 1] = false
      }
    }

    carveEntrance(firstEntrance)
    carveEntrance(secondEntrance)

    if (width >= 7 && height >= 6 && Math.random() > 0.6) {
      const divideHorizontally = Math.random() > 0.5
      if (divideHorizontally) {
        const row = Math.floor(height * 0.5)
        for (let col = 1; col < width - 1; col += 1) {
          if (col !== Math.floor(width * 0.5)) {
            tiles[row][col] = true
          }
        }
      } else {
        const col = Math.floor(width * 0.5)
        for (let row = 1; row < height - 1; row += 1) {
          if (row !== Math.floor(height * 0.5)) {
            tiles[row][col] = true
          }
        }
      }
    }

    compounds.push({
      kind: "warehouse",
      x: worldRect.x,
      y: worldRect.y,
      width,
      height,
      tiles,
    })
  }

  return compounds
}

const createWallBlueprints = (size: number, paths: boolean[][], blockedStructures: MapObstacleBlueprint[]) => {
  const walls: MapObstacleBlueprint[] = []
  const wallCount = 0

  for (let attempt = 0; attempt < 5200 && walls.length < wallCount; attempt += 1) {
    const centerX = randomInt(2, size - 3)
    const centerY = randomInt(2, size - 3)
    const onRoad = paths[centerY][centerX]
    const nearRoad = onRoad || hasNeighbor(paths, centerX, centerY)

    if (!nearRoad && Math.random() > 0.72) {
      continue
    }

    if (!circleFitsArena(centerX, centerY, size, 2.3)) {
      continue
    }

    let width = 1
    let height = 1
    const shapeRoll = Math.random()
    if (onRoad) {
      if (shapeRoll > 0.66) {
        if (Math.random() > 0.5) {
          width = 2
        } else {
          height = 2
        }
      }
    } else if (nearRoad) {
      if (shapeRoll > 0.76) {
        if (Math.random() > 0.5) {
          width = randomInt(3, 5)
        } else {
          height = randomInt(3, 5)
        }
      } else if (shapeRoll > 0.46) {
        width = randomInt(2, 3)
        height = randomInt(2, 3)
      } else if (shapeRoll > 0.24) {
        if (Math.random() > 0.5) {
          width = randomInt(2, 4)
        } else {
          height = randomInt(2, 4)
        }
      }
    } else {
      if (shapeRoll > 0.84) {
        if (Math.random() > 0.5) {
          width = randomInt(2, 4)
        } else {
          height = randomInt(2, 4)
        }
      } else if (shapeRoll > 0.58) {
        width = randomInt(2, 3)
        height = randomInt(1, 2)
      }
    }

    if (onRoad && width > 1 && height > 1) {
      if (Math.random() > 0.5) {
        width = 1
      } else {
        height = 1
      }
    }

    const left = centerX - Math.floor(width * 0.5)
    const top = centerY - Math.floor(height * 0.5)
    if (left < 2 || top < 2 || left + width > size - 2 || top + height > size - 2) {
      continue
    }
    if (!rectFitsArena(left, top, width, height, size, 2.3)) {
      continue
    }

    if (!nearRoad && Math.random() > 0.42 && !rectTouchesMask(paths, left, top, width, height, 2)) {
      continue
    }

    const wallRect = gridRectToWorldRect(left, top, width, height, size)
    const blockedByStructure = blockedStructures.some((structure) =>
      rectsOverlap(wallRect, structure, onRoad ? 0.35 : 0.55)
    )
    if (blockedByStructure) {
      continue
    }

    const blockedByWall = walls.some((existing) => rectsOverlap(wallRect, existing, onRoad ? 0.05 : 0.14))
    if (blockedByWall) {
      continue
    }

    if (onRoad && Math.random() > 0.5) {
      continue
    }

    walls.push({
      kind: "wall",
      x: wallRect.x,
      y: wallRect.y,
      width,
      height,
      tiles: [],
    })
  }

  return walls
}

const createRockBlueprints = (size: number, paths: boolean[][], blocked: MapObstacleBlueprint[]) => {
  const rocks: MapObstacleBlueprint[] = []
  const rockCount = randomInt(56, 92)

  for (let attempt = 0; attempt < 3400 && rocks.length < rockCount; attempt += 1) {
    const gridX = randomInt(3, size - 4)
    const gridY = randomInt(3, size - 4)
    if (!circleFitsArena(gridX, gridY, size, 2.3)) {
      continue
    }

    if (!paths[gridY][gridX] && Math.random() > 0.78) {
      continue
    }

    const rock = {
      kind: "rock" as const,
      x: gridToWorld(gridX, size),
      y: gridToWorld(gridY, size),
      width: 1,
      height: 1,
      tiles: [] as boolean[][],
    }

    const overlapsBlocked = blocked.some((obstacle) => rectsOverlap(rock, obstacle, 0.9))
    if (overlapsBlocked) {
      continue
    }

    const overlapsRock = rocks.some((existing) => rectsOverlap(rock, existing, 0.45))
    if (overlapsRock) {
      continue
    }

    rocks.push(rock)
  }

  return rocks
}

const createPickupSpawnPoints = (_size: number, _paths: boolean[][], _obstacles: MapObstacleBlueprint[]) => [] as PickupSpawnPoint[]

const pickWeighted = (choices: TerrainTile[]) => {
  let total = 0
  for (const tile of choices) {
    total += WEIGHTS[tile]
  }

  let roll = Math.random() * total
  for (const tile of choices) {
    roll -= WEIGHTS[tile]
    if (roll <= 0) {
      return tile
    }
  }

  return choices[0] ?? "grass"
}

const neighbors = (x: number, y: number, size: number) => {
  const out: [number, number][] = []
  if (x > 0) out.push([x - 1, y])
  if (x < size - 1) out.push([x + 1, y])
  if (y > 0) out.push([x, y - 1])
  if (y < size - 1) out.push([x, y + 1])
  return out
}

export const createBarrenGardenMap = (size: number) => {
  const wave = Array.from({ length: size }, () => Array.from({ length: size }, () => new Set<TerrainTile>(TILE_IDS)))

  const collapse = (startX: number, startY: number) => {
    const queue: [number, number][] = [[startX, startY]]
    while (queue.length > 0) {
      const next = queue.shift()
      if (!next) {
        continue
      }

      const [x, y] = next
      const self = wave[y][x]
      for (const [nx, ny] of neighbors(x, y, size)) {
        const allowedSet = new Set<TerrainTile>()
        for (const selfTile of self) {
          for (const allowedTile of ALLOWED[selfTile]) {
            allowedSet.add(allowedTile)
          }
        }

        const neighborSet = wave[ny][nx]
        const before = neighborSet.size
        for (const option of [...neighborSet]) {
          if (!allowedSet.has(option)) {
            neighborSet.delete(option)
          }
        }

        if (neighborSet.size === 0) {
          neighborSet.add("dirt")
        }

        if (neighborSet.size < before) {
          queue.push([nx, ny])
        }
      }
    }
  }

  for (let iter = 0; iter < size * size; iter += 1) {
    let pickX = -1
    let pickY = -1
    let minEntropy = Number.POSITIVE_INFINITY

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const entropy = wave[y][x].size
        if (entropy <= 1 || entropy >= minEntropy) {
          continue
        }

        minEntropy = entropy
        pickX = x
        pickY = y
      }
    }

    if (pickX < 0 || pickY < 0) {
      break
    }

    const options = [...wave[pickY][pickX]]
    const chosen = pickWeighted(options)
    wave[pickY][pickX] = new Set([chosen])
    collapse(pickX, pickY)
  }

  const tiles = Array.from(
    { length: size },
    (_, y) => Array.from({ length: size }, (_, x) => [...wave[y][x]][0] ?? "grass"),
  )

  const roads = applyRoadNetwork(tiles)
  const paths = roads
  const warehouseBlueprints = createWarehouseBlueprints(size, paths)
  const highTierLootBoxBlueprints = createHighTierLootBoxBlueprints(size, warehouseBlueprints)
  const roadsideStructureBlueprints = createRoadsideStructureBlueprints(size, paths, warehouseBlueprints)
  const wallBlueprints = createWallBlueprints(size, paths, [...warehouseBlueprints, ...roadsideStructureBlueprints])
  const rockBlueprints = createRockBlueprints(size, paths, [
    ...warehouseBlueprints,
    ...roadsideStructureBlueprints,
    ...highTierLootBoxBlueprints,
    ...wallBlueprints,
  ])
  const structuralObstacles = [
    ...warehouseBlueprints,
    ...roadsideStructureBlueprints,
    ...highTierLootBoxBlueprints,
    ...wallBlueprints,
    ...rockBlueprints,
  ]
  const obstacles = structuralObstacles
  const pickupSpawnPoints = createPickupSpawnPoints(size, paths, structuralObstacles)

  return {
    size,
    tiles,
    obstacles,
    pickupSpawnPoints,
  } satisfies TerrainMap
}

export const terrainAt = (map: TerrainMap, worldX: number, worldY: number): TerrainTile => {
  const half = Math.floor(map.size * 0.5)
  const gridX = Math.floor(worldX) + half
  const gridY = Math.floor(worldY) + half
  if (gridX < 0 || gridY < 0 || gridX >= map.size || gridY >= map.size) {
    return "grass"
  }

  return map.tiles[gridY][gridX]
}
