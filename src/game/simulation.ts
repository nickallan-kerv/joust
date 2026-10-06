import type { Bird, Egg, Enemy, GameState, InputState, Platform } from './types'

export const GAME_WIDTH = 960
export const GAME_HEIGHT = 540
export const BIRD_RADIUS = 19
export const PLATFORM_CONTACT_RADIUS = 28
export const LAVA_Y = 510
export const LAVA_SURFACE_START_Y = LAVA_Y - 2
export const LAVA_SURFACE_PLATFORM_TOP_Y = 442
export const LAVA_SURFACE_WAVE2_Y = 451
export const LAVA_SURFACE_WAVE3_Y = (LAVA_SURFACE_START_Y + LAVA_SURFACE_PLATFORM_TOP_Y) / 2
export const LAVA_SURFACE_MAX_Y = LAVA_SURFACE_WAVE2_Y
export const LAVA_RISE_SPEED = 24
export const WAVE_TRANSITION_PAUSE = 1.1
export const LAVA_BURN_LEFT_STOP_X = 241
export const LAVA_BURN_RIGHT_STOP_X = 719
export const LAVA_PITS = [
  { x: 0, width: 240 },
  { x: 720, width: 240 },
]
export const EGG_RADIUS = 8
export const EGG_HATCH_TIME = 7
export const PTERODACTYL_DELAY = 18
export const MOUNT_DEPARTURE_DURATION = 1.25
export const BIRD_MATERIALIZE_DURATION = 1
export const LAVA_PLATFORM_DISSOLVE_DURATION = 3
const GRAVITY = 1150
const MAX_FALL_SPEED = 540
const FLAP_COOLDOWN = 0.14
const AI_FLAP_COOLDOWN = 0.24
const FLAP_IMPULSE = 520
const MAX_RISE_SPEED = 520
const AI_FLAP_IMPULSE = 430
const AI_MAX_RISE_SPEED = 440
const BOUNDER_GROUNDED_TAKEOFF_DELAY = 1.8
const AI_GROUNDED_ATTACK_HEIGHT = 24
const AI_GROUNDED_ATTACK_DISTANCE = 120
export const LAVA_TROLL_ANIMATION_FPS = 12
export const LAVA_TROLL_GRAB_START_FRAME = 4
const LAVA_TROLL_TRIGGER_HEIGHT = 112
const LAVA_TROLL_GRAB_DURATION = 0.18
const LAVA_TROLL_DRAG_SPEED = 120
const HATCH_MOUNT_ARRIVAL_SPEED = 300
type EnemyBehavior = 'bounder' | 'hunter' | 'pterodactyl'

const AI_AIR_ACCELERATION: Record<EnemyBehavior, number> = {
  bounder: 105,
  hunter: 145,
  pterodactyl: 168,
}
const AI_TURN_HOLD: Record<EnemyBehavior, { minimum: number; range: number }> = {
  bounder: { minimum: 2.2, range: 3.4 },
  hunter: { minimum: 1.1, range: 1.8 },
  pterodactyl: { minimum: 1.8, range: 2.5 },
}

function getEnemyBehavior(enemy: Enemy): EnemyBehavior {
  if (enemy.kind === 'pterodactyl') return 'pterodactyl'
  return enemy.hatchLevel > 0 ? 'hunter' : 'bounder'
}
function enemyVariation(id: number, step: number, salt: number): number {
  const value = Math.sin((id + 1) * 127.1 + (step + 1) * 311.7 + salt * 74.7) * 43758.5453
  return value - Math.floor(value)
}

const PLATFORM_LAYOUT: Platform[] = [
  { x: 240, y: 442, width: 480, height: 7, sprite: 'platformLong', spawnMarkerArt: true },
  { x: 0, y: 125, width: 104, height: 22, sprite: 'platformCover' },
  { x: 812, y: 125, width: 148, height: 22, sprite: 'platformAlternate' },
  { x: 271, y: 145, width: 278, height: 28, sprite: 'platformSpawnWide', spawnMarkerArt: true },
  { x: 0, y: 292, width: 200, height: 25, sprite: 'platformSpawnNarrow', spawnMarkerArt: true },
  { x: 660, y: 256, width: 184, height: 35, sprite: 'platformSpawnTall', spawnMarkerArt: true },
  { x: 327, y: 312, width: 202, height: 25, sprite: 'platformNoSpawn' },
  { x: 815, y: 292, width: 145, height: 22, sprite: 'platformStandard' },
  { x: 241, y: 449, width: 51, height: 38, sprite: 'platformShortLeft' },
  { x: 668, y: 449, width: 51, height: 41, sprite: 'platformShortRight' },
]
export const SPAWN_POINTS = [
  { x: 378, y: 117, markerY: 145 },
  { x: 86, y: 264, markerY: 292 },
  { x: 773, y: 228, markerY: 256 },
  { x: 445, y: 414, markerY: 442 },
]
export const PLAYER_SPAWN_POINT = SPAWN_POINTS[3]
const ENEMY_SPAWN_POINTS = SPAWN_POINTS.slice(0, 3)
const LAVA_COVERS: Platform[] = [
  { x: 0, y: 442, width: 240, height: 15, burnsAway: true, sprite: 'platformCover' },
  { x: 720, y: 442, width: 240, height: 15, burnsAway: true, sprite: 'platformCover' },
]

function makeBird(x: number, y: number, facing: -1 | 1): Bird {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    facing,
    flapCooldown: 0,
    collisionCooldown: 0,
    reboundTimer: 0,
    invulnerability: 0,
    materializeTimer: BIRD_MATERIALIZE_DURATION,
  }
}

function platformsForWave(wave: number): Platform[] {
  return [...PLATFORM_LAYOUT, ...(wave <= 2 ? LAVA_COVERS : [])].map((platform) => ({ ...platform }))
}

export function createGameState(): GameState {
  return {
    mode: 'title',
    time: 0,
    wave: 0,
    waveDelay: 0,
    player: { ...makeBird(GAME_WIDTH / 2, 130, 1), materializeTimer: 0, score: 0, lives: 4 },
    enemies: [],
    eggs: [],
    mountDepartures: [],
    playerRespawnTimer: 0,
    platforms: platformsForWave(1),
    lavaSurfaceY: LAVA_SURFACE_START_Y,
    lavaRiseStarted: false,
    lavaBurnProgress: 0,
    message: '',
    messageTimer: 0,
    nextEnemyId: 0,
    nextEggId: 0,
    timeSinceKill: 0,
  }
}

function spawnWave(game: GameState) {
  game.wave += 1
  game.waveDelay = 0
  game.lavaRiseStarted = false
  game.platforms = platformsForWave(game.wave)
  const count = Math.min(2 + Math.floor((game.wave - 1) / 2), ENEMY_SPAWN_POINTS.length)

  game.enemies = Array.from({ length: count }, (_, index) => {
    const spawnPoint = ENEMY_SPAWN_POINTS[(game.wave - 1 + index) % ENEMY_SPAWN_POINTS.length]
    const facing: -1 | 1 = spawnPoint.x < GAME_WIDTH / 2 ? 1 : -1
    return {
      ...makeBird(spawnPoint.x, spawnPoint.y, facing),
      id: game.nextEnemyId++,
      kind: 'rider',
      hatchLevel: 0,
    }
  })
  game.message = `WAVE ${String(game.wave).padStart(2, '0')}`
  game.messageTimer = 1.4
}

export function startGame(game: GameState) {
  const fresh = createGameState()
  Object.assign(game, fresh)
  game.mode = 'playing'
  game.player.x = PLAYER_SPAWN_POINT.x
  game.player.y = PLAYER_SPAWN_POINT.y
  game.player.materializeTimer = BIRD_MATERIALIZE_DURATION
  spawnWave(game)
}

export function resolveJoust(playerY: number, enemyY: number): 'player' | 'enemy' | 'tie' {
  const heightAdvantage = 8
  if (playerY < enemyY - heightAdvantage) return 'player'
  if (enemyY < playerY - heightAdvantage) return 'enemy'
  return 'tie'
}

export function flapBird(bird: Bird, impulse = FLAP_IMPULSE, maxRiseSpeed = MAX_RISE_SPEED, cooldown = FLAP_COOLDOWN) {
  if (bird.flapCooldown > 0) return
  bird.vy = Math.max(bird.vy - impulse, -maxRiseSpeed)
  bird.flapCooldown = cooldown
}

function wrappedDelta(from: number, to: number) {
  let delta = to - from
  if (delta > GAME_WIDTH / 2) delta -= GAME_WIDTH
  if (delta < -GAME_WIDTH / 2) delta += GAME_WIDTH
  return delta
}

function isOverLava(x: number) {
  return LAVA_PITS.some((pit) => x + BIRD_RADIUS > pit.x && x - BIRD_RADIUS < pit.x + pit.width)
}

export function isGrounded(bird: Bird, platforms: Platform[], platformContactRadius = PLATFORM_CONTACT_RADIUS) {
  return bird.vy >= 0 && platforms.some((platform) =>
    Math.abs(bird.y + platformContactRadius - platform.y) <= 1 &&
    bird.x >= platform.x - BIRD_RADIUS &&
    bird.x <= platform.x + platform.width + BIRD_RADIUS,
  )
}

function landOnPlatforms(bird: Bird, previousX: number, previousY: number, platforms: Platform[], platformContactRadius: number) {
  const horizontalDelta = bird.x - previousX
  const canCheckSides = horizontalDelta !== 0 && Math.abs(horizontalDelta) <= GAME_WIDTH / 2
  const movingRight = horizontalDelta > 0
  let sideCollision = false

  for (const platform of platforms) {
    if (bird.vy < 0) {
      const crossedUnderside = previousY - platformContactRadius >= platform.y + platform.height && bird.y - platformContactRadius <= platform.y + platform.height
      const underPlatform = bird.x >= platform.x - BIRD_RADIUS && bird.x <= platform.x + platform.width + BIRD_RADIUS
      if (crossedUnderside && underPlatform) {
        bird.y = platform.y + platform.height + platformContactRadius
        bird.vy = Math.max(90, Math.abs(bird.vy) * 0.42)
        return
      }
    } else {
      const crossedPlatform = previousY + platformContactRadius <= platform.y && bird.y + platformContactRadius >= platform.y
      const abovePlatform = bird.x >= platform.x - BIRD_RADIUS && bird.x <= platform.x + platform.width + BIRD_RADIUS
      if (crossedPlatform && abovePlatform) {
        bird.y = platform.y - platformContactRadius
        bird.vy = 0
        return
      }
    }

    if (!canCheckSides || sideCollision) continue
    const previousEdge = previousX + (movingRight ? BIRD_RADIUS : -BIRD_RADIUS)
    const currentEdge = bird.x + (movingRight ? BIRD_RADIUS : -BIRD_RADIUS)
    const platformEdge = movingRight ? platform.x : platform.x + platform.width
    const crossedSide = movingRight
      ? previousEdge <= platformEdge && currentEdge >= platformEdge
      : previousEdge >= platformEdge && currentEdge <= platformEdge
    if (!crossedSide) continue

    const impactTime = (platformEdge - previousEdge) / horizontalDelta
    const impactY = previousY + (bird.y - previousY) * impactTime
    const overlapsVertically = impactY + platformContactRadius > platform.y &&
      impactY - platformContactRadius < platform.y + platform.height
    if (!overlapsVertically) continue

    bird.x = movingRight ? platform.x - BIRD_RADIUS : platform.x + platform.width + BIRD_RADIUS
    bird.vx = 0
    sideCollision = true
  }
}

function moveBird(
  bird: Bird,
  input: Pick<InputState, 'left' | 'right' | 'flap' | 'facingPress'>,
  dt: number,
  platforms: Platform[],
  speedMultiplier = 1,
  platformContactRadius = PLATFORM_CONTACT_RADIUS,
  flapImpulse = FLAP_IMPULSE,
  maxRiseSpeed = MAX_RISE_SPEED,
  flapCooldown = FLAP_COOLDOWN,
  airAcceleration = 260,
) {
  if (bird.lavaGrab) return
  if (bird.materializeTimer > 0) {
    bird.materializeTimer = Math.max(0, bird.materializeTimer - dt)
    bird.vx = 0
    bird.vy = 0
    return
  }

  const previousX = bird.x
  const previousY = bird.y
  const grounded = isGrounded(bird, platforms, platformContactRadius)
  const heldDirection = Number(input.right) - Number(input.left)
  const direction = heldDirection !== 0 ? heldDirection : input.facingPress ?? 0

  if (direction !== 0) {
    const acceleration = grounded ? 1200 : airAcceleration
    bird.vx += direction * acceleration * speedMultiplier * dt
    bird.facing = direction < 0 ? -1 : 1
    if (grounded && bird.vx * direction > 0) bird.vx *= Math.exp(-0.35 * dt)
  } else {
    bird.vx *= Math.exp(-(grounded ? 8.5 : 0.9) * dt)
  }

  const normalMaxSpeed = (grounded ? 320 : 190) * speedMultiplier
  bird.reboundTimer = Math.max(0, bird.reboundTimer - dt)
  const reboundMaxSpeed = Math.min(Math.abs(bird.vx), 620 * speedMultiplier)
  const maxSpeed = bird.reboundTimer > 0 ? Math.max(normalMaxSpeed, reboundMaxSpeed) : normalMaxSpeed
  bird.vx = Math.max(-maxSpeed, Math.min(maxSpeed, bird.vx))
  if (input.flap) flapBird(bird, flapImpulse, maxRiseSpeed, flapCooldown)
  bird.flapCooldown = Math.max(0, bird.flapCooldown - dt)
  bird.collisionCooldown = Math.max(0, bird.collisionCooldown - dt)
  bird.invulnerability = Math.max(0, bird.invulnerability - dt)
  bird.materializeTimer = Math.max(0, bird.materializeTimer - dt)
  bird.vy = Math.min(MAX_FALL_SPEED, bird.vy + GRAVITY * dt)
  bird.x += bird.vx * dt
  bird.y += bird.vy * dt

  if (bird.x < -BIRD_RADIUS) bird.x = GAME_WIDTH + BIRD_RADIUS
  if (bird.x > GAME_WIDTH + BIRD_RADIUS) bird.x = -BIRD_RADIUS
  if (bird.y < BIRD_RADIUS + 5) {
    bird.y = BIRD_RADIUS + 5
    bird.vy = Math.max(90, Math.abs(bird.vy) * 0.42)
  }

  landOnPlatforms(bird, previousX, previousY, platforms, platformContactRadius)
}

function respawnPlayer(game: GameState) {
  delete game.player.lavaGrab
  Object.assign(game.player, makeBird(PLAYER_SPAWN_POINT.x, PLAYER_SPAWN_POINT.y, 1), {
    score: game.player.score,
    lives: game.player.lives,
    invulnerability: 1.3,
  })
}

function addMountDeparture(game: GameState, bird: Bird, mountClass: GameState['mountDepartures'][number]['mountClass']) {
  game.mountDepartures.push({
    x: bird.x,
    y: bird.y,
    facing: bird.facing,
    mountClass,
    age: 0,
  })
}

function updateMountDepartures(game: GameState, dt: number) {
  for (const departure of game.mountDepartures) departure.age += dt
  game.mountDepartures = game.mountDepartures.filter((departure) => departure.age < MOUNT_DEPARTURE_DURATION)

  if (game.playerRespawnTimer <= 0) return
  game.playerRespawnTimer = Math.max(0, game.playerRespawnTimer - dt)
  if (game.playerRespawnTimer === 0 && game.mode === 'playing') respawnPlayer(game)
}

function loseLife(game: GameState, message: string, flyMountOff = false) {
  game.player.lives -= 1
  game.message = game.player.lives > 0 ? message : 'GAME OVER'
  game.messageTimer = 1.5

  if (flyMountOff) {
    addMountDeparture(game, game.player, 'player')
    game.playerRespawnTimer = MOUNT_DEPARTURE_DURATION
  }

  if (game.player.lives <= 0) {
    game.player.lives = 0
    game.mode = 'gameover'
    return
  }

  if (!flyMountOff) respawnPlayer(game)
}

function updateEnemy(game: GameState, enemy: Enemy, dt: number) {
  if (enemy.lavaGrab) return
  if (enemy.mountArrivalX !== undefined && enemy.mountArrivalDirection !== undefined) {
    const arrivalX = enemy.mountArrivalX + enemy.mountArrivalDirection * HATCH_MOUNT_ARRIVAL_SPEED * dt
    const hasArrived = enemy.mountArrivalDirection > 0 ? arrivalX >= enemy.x : arrivalX <= enemy.x
    if (hasArrived) {
      delete enemy.mountArrivalX
      delete enemy.mountArrivalDirection
      enemy.vx = 0
      enemy.vy = 0
    } else {
      enemy.mountArrivalX = arrivalX
      return
    }
  }

  const behavior = getEnemyBehavior(enemy)
  const platformContactRadius = enemy.kind === 'pterodactyl' ? BIRD_RADIUS : PLATFORM_CONTACT_RADIUS
  const deltaX = enemy.kind === 'pterodactyl' ? game.player.x - enemy.x : wrappedDelta(enemy.x, game.player.x)
  const currentDirection = Math.abs(enemy.vx) > 12 ? Math.sign(enemy.vx) : enemy.facing
  let horizontal = enemy.flightDirection ?? currentDirection
  let flightTimer = enemy.flightTimer ?? 0
  let flightDecision = enemy.flightDecision ?? 0
  if (flightTimer <= 0) {
    flightDecision += 1
    const variation = enemyVariation(enemy.id, flightDecision, 1)
    const targetDirection = Math.abs(deltaX) < 56 ? 0 : Math.sign(deltaX)
    if (targetDirection === 0) {
      horizontal = Math.abs(enemy.vx) > 12 ? currentDirection : variation < 0.5 ? -1 : 1
    } else {
      const wanderChance = behavior === 'bounder' ? 0.45 : behavior === 'hunter' ? 0.05 : 0
      horizontal = variation < wanderChance ? currentDirection : targetDirection
    }

    const hold = AI_TURN_HOLD[behavior]
    flightTimer = hold.minimum + enemyVariation(enemy.id, flightDecision, 4) * hold.range
  }
  flightTimer = Math.max(0, flightTimer - dt)
  enemy.flightDirection = horizontal as -1 | 1
  enemy.flightTimer = flightTimer
  enemy.flightDecision = flightDecision

  const grounded = isGrounded(enemy, game.platforms, platformContactRadius)
  const groundedLowPlayer = game.player.y > GAME_HEIGHT * 0.65 && isGrounded(game.player, game.platforms)
  const horizontalDistance = Math.abs(deltaX)
  if (behavior === 'bounder' && grounded && enemy.y > GAME_HEIGHT * 0.65) {
    enemy.groundedTime = (enemy.groundedTime ?? 0) + dt
  } else {
    enemy.groundedTime = 0
  }
  const forcedTakeoff = behavior === 'bounder' && enemy.groundedTime >= BOUNDER_GROUNDED_TAKEOFF_DELAY
  if (behavior === 'bounder') {
    if (!groundedLowPlayer || enemy.y <= game.player.y - AI_GROUNDED_ATTACK_HEIGHT) {
      enemy.attackClimbing = false
    } else if (enemy.attackClimbing || horizontalDistance < AI_GROUNDED_ATTACK_DISTANCE && (forcedTakeoff || !grounded)) {
      enemy.attackClimbing = true
    }
  } else {
    enemy.attackClimbing = false
  }
  const climbingForAttack = behavior === 'bounder' && Boolean(enemy.attackClimbing)
  const needsAttackAltitude = groundedLowPlayer && (behavior === 'pterodactyl' || behavior === 'bounder') &&
    horizontalDistance < AI_GROUNDED_ATTACK_DISTANCE && enemy.y > game.player.y - AI_GROUNDED_ATTACK_HEIGHT
  if (climbingForAttack) {
    horizontal = deltaX === 0 ? currentDirection : deltaX > 0 ? -1 : 1
    enemy.flightDirection = horizontal as -1 | 1
    enemy.flightTimer = 0.2
  }
  let shouldFlap = !grounded || forcedTakeoff || climbingForAttack || needsAttackAltitude
  const platformUnderEnemy = game.platforms.find((platform) =>
    Math.abs(enemy.y + platformContactRadius - platform.y) <= 1 &&
    enemy.x >= platform.x - BIRD_RADIUS &&
    enemy.x <= platform.x + platform.width + BIRD_RADIUS,
  )

  if (platformUnderEnemy && game.player.y > platformUnderEnemy.y + PLATFORM_CONTACT_RADIUS &&
      game.player.x >= platformUnderEnemy.x && game.player.x <= platformUnderEnemy.x + platformUnderEnemy.width) {
    const distanceToLeft = enemy.x - platformUnderEnemy.x
    const distanceToRight = platformUnderEnemy.x + platformUnderEnemy.width - enemy.x
    horizontal = distanceToLeft < distanceToRight ? -1 : 1
    enemy.flightDirection = horizontal as -1 | 1
    enemy.flightTimer = 0.55
    shouldFlap = forcedTakeoff || climbingForAttack || needsAttackAltitude
  }

  const blockedByPlatform = game.platforms.some((platform) => {
    const verticalOverlap = enemy.y + platformContactRadius > platform.y &&
      enemy.y - platformContactRadius < platform.y + platform.height
    const blockedFromLeft = horizontal > 0 && enemy.x <= platform.x && enemy.x + BIRD_RADIUS >= platform.x
    const blockedFromRight = horizontal < 0 && enemy.x >= platform.x + platform.width && enemy.x - BIRD_RADIUS <= platform.x + platform.width
    return verticalOverlap && (blockedFromLeft || blockedFromRight)
  })

  const baseFlapBias = enemy.kind === 'pterodactyl' ? -0.2 : enemy.hatchLevel > 0 ? 0 : 0.12
  const flapBias = baseFlapBias + (enemyVariation(enemy.id, 0, 6) - 0.5) * 0.28
  const flap = blockedByPlatform || (shouldFlap && (
    forcedTakeoff || climbingForAttack || needsAttackAltitude || enemy.y > game.player.y + 6 ||
    Math.sin(game.time * 1.7 + enemy.id * 0.8) > flapBias
  ))
  const baseSpeedMultiplier = enemy.kind === 'pterodactyl' ? 1.4 : 1 + enemy.hatchLevel * 0.18
  const speedStep = Math.floor(game.time / 2)
  const speedMultiplier = baseSpeedMultiplier * (0.78 + enemyVariation(enemy.id, speedStep, 2) * 0.44)
  const airAcceleration = AI_AIR_ACCELERATION[behavior] * (0.75 + enemyVariation(enemy.id, speedStep, 5) * 0.5)
  moveBird(enemy, { left: horizontal < -0.2, right: horizontal > 0.2, flap }, dt, game.platforms, speedMultiplier, platformContactRadius, AI_FLAP_IMPULSE, AI_MAX_RISE_SPEED, AI_FLAP_COOLDOWN, airAcceleration)
}

function updateLavaGrab(game: GameState, bird: Bird, dt: number, platformContactRadius: number, variationId: number) {
  if (bird.lavaGrab) {
    bird.lavaGrab.age += dt
    bird.x = bird.lavaGrab.trollX
    bird.vx = 0
    if (bird.lavaGrab.age >= LAVA_TROLL_GRAB_DURATION) {
      bird.vy = LAVA_TROLL_DRAG_SPEED
      bird.y = Math.min(LAVA_Y - BIRD_RADIUS, bird.y + LAVA_TROLL_DRAG_SPEED * dt)
    } else {
      bird.vy = 0
    }
    return
  }

  const pit = LAVA_PITS.find(({ x, width }) => bird.x >= x && bird.x <= x + width)
  const exposed = pit && !game.platforms.some((platform) =>
    platform.burnsAway && platform.dissolveTimer === undefined && bird.x >= platform.x && bird.x <= platform.x + platform.width,
  )
  const lowAndFlying = bird.materializeTimer <= 0 && !isGrounded(bird, game.platforms, platformContactRadius) &&
    bird.y + BIRD_RADIUS >= LAVA_Y - LAVA_TROLL_TRIGGER_HEIGHT
  if (!pit || !exposed || !lowAndFlying) {
    bird.lavaTrollAttempted = false
    delete bird.lavaTrollWarning
    return
  }

  const trollX = Math.max(pit.x + 16, Math.min(pit.x + pit.width - 16, bird.x))
  if (bird.lavaTrollWarning) {
    bird.lavaTrollWarning.age += dt
    bird.lavaTrollWarning.trollX = trollX
    if (bird.lavaTrollWarning.age >= LAVA_TROLL_GRAB_START_FRAME / LAVA_TROLL_ANIMATION_FPS) {
      bird.lavaGrab = { trollX, age: 0 }
      delete bird.lavaTrollWarning
      bird.vx = 0
      bird.vy = 0
    }
    return
  }
  if (bird.lavaTrollAttempted) return
  bird.lavaTrollAttempted = true
  if (enemyVariation(variationId, Math.floor(game.time * 10), 11) >= 1 / 3) return

  bird.lavaTrollWarning = {
    trollX,
    age: 0,
  }
}

function dropEgg(game: GameState, enemy: Enemy) {
  const inheritedVelocity = enemy.vx * 0.25
  game.eggs.push({
    id: game.nextEggId++,
    x: enemy.x,
    y: enemy.y,
    vx: Math.abs(inheritedVelocity) > 1 ? inheritedVelocity : enemy.facing * 3,
    vy: -45,
    timer: EGG_HATCH_TIME,
    hatchLevel: enemy.hatchLevel,
  })
}

function hatchEgg(game: GameState, egg: Egg) {
  const facing: -1 | 1 = wrappedDelta(egg.x, game.player.x) < 0 ? -1 : 1
  const mountArrivalDirection: -1 | 1 = egg.id % 2 === 0 ? 1 : -1
  game.enemies.push({
    ...makeBird(egg.x, Math.max(BIRD_RADIUS + 10, egg.y - BIRD_RADIUS), facing),
    materializeTimer: 0,
    id: game.nextEnemyId++,
    kind: 'rider',
    hatchLevel: egg.hatchLevel + 1,
    mountArrivalX: mountArrivalDirection > 0 ? 0 : GAME_WIDTH,
    mountArrivalDirection,
  })
  game.message = 'EGG HATCHED  RIDER RETURNED'
  game.messageTimer = 1.1
}

function landEggOnPlatforms(egg: Egg, previousY: number, platforms: Platform[]) {
  if (egg.vy < 0) return

  for (const platform of platforms) {
    const crossedPlatform = previousY + EGG_RADIUS <= platform.y && egg.y + EGG_RADIUS >= platform.y
    const abovePlatform = egg.x >= platform.x - EGG_RADIUS && egg.x <= platform.x + platform.width + EGG_RADIUS
    if (!crossedPlatform || !abovePlatform) continue
    egg.y = platform.y - EGG_RADIUS
    egg.vy = 0
    return
  }
}

function updateEggs(game: GameState, dt: number) {
  for (let index = game.eggs.length - 1; index >= 0; index -= 1) {
    const egg = game.eggs[index]
    const previousY = egg.y
    egg.timer -= dt
    egg.vy = Math.min(300, egg.vy + GRAVITY * dt)
    egg.x += egg.vx * dt
    egg.y += egg.vy * dt
    if (egg.x < -EGG_RADIUS) egg.x = GAME_WIDTH + EGG_RADIUS
    if (egg.x > GAME_WIDTH + EGG_RADIUS) egg.x = -EGG_RADIUS
    landEggOnPlatforms(egg, previousY, game.platforms)

    const distance = Math.hypot(wrappedDelta(game.player.x, egg.x), game.player.y - egg.y)
    if (distance <= BIRD_RADIUS + EGG_RADIUS) {
      const points = 250 * game.wave
      game.player.score += points
      game.eggs.splice(index, 1)
      game.message = `EGG COLLECTED  +${points}`
      game.messageTimer = 1.1
    } else if (egg.y + EGG_RADIUS >= LAVA_Y) {
      game.eggs.splice(index, 1)
    } else if (egg.timer <= 0) {
      game.eggs.splice(index, 1)
      hatchEgg(game, egg)
    }
  }
}

function spawnPterodactyl(game: GameState) {
  if (game.enemies.some((enemy) => enemy.kind === 'pterodactyl')) return
  const x = game.player.x < GAME_WIDTH / 2 ? GAME_WIDTH : 0
  const facing: -1 | 1 = x === 0 ? 1 : -1
  game.enemies.push({
    ...makeBird(x, Math.max(70, game.player.y - 65), facing),
    materializeTimer: 0,
    id: game.nextEnemyId++,
    kind: 'pterodactyl',
    hatchLevel: 0,
  })
  game.message = 'PTERODACTYL INBOUND'
  game.messageTimer = 1.4
  game.timeSinceKill = 0
}

function checkJousts(game: GameState) {
  if (game.player.lavaGrab || game.player.invulnerability > 0 || game.playerRespawnTimer > 0 || game.player.materializeTimer > 0) return

  for (let index = game.enemies.length - 1; index >= 0; index -= 1) {
    const enemy = game.enemies[index]
    if (enemy.lavaGrab || enemy.materializeTimer > 0) continue
    const horizontalDistance = Math.abs(wrappedDelta(game.player.x, enemy.x))
    if (horizontalDistance > BIRD_RADIUS * 1.7 || Math.abs(game.player.y - enemy.y) > BIRD_RADIUS * 1.65) continue
    if (enemy.collisionCooldown > 0) continue

    const result = resolveJoust(game.player.y, enemy.y)
    game.player.collisionCooldown = 0.56
    enemy.collisionCooldown = 0.56

    if (result === 'player') {
      const points = enemy.kind === 'pterodactyl' ? 500 * game.wave : (100 + enemy.hatchLevel * 50) * game.wave
      game.player.score += points
      game.message = `${enemy.kind === 'pterodactyl' ? 'PTERODACTYL DOWN' : 'RIDER DOWN'}  +${points}`
      game.messageTimer = 1.05
      if (enemy.kind !== 'pterodactyl' && enemy.mountArrivalX === undefined) {
        addMountDeparture(game, enemy, enemy.hatchLevel > 0 ? 'hunter' : 'bounder')
      }
      game.enemies.splice(index, 1)
      if (enemy.kind === 'rider') dropEgg(game, enemy)
      game.timeSinceKill = 0
      continue
    }

    if (result === 'enemy') {
      loseLife(game, 'STRIKE LOST', true)
      if (game.mode === 'gameover') return
      break
    }

    const pushDirection = wrappedDelta(game.player.x, enemy.x) >= 0 ? -1 : 1
    game.player.vx = pushDirection * 620
    enemy.vx = -pushDirection * 620
    game.player.vy = -460
    enemy.vy = -460
    game.player.reboundTimer = 0.72
    enemy.reboundTimer = 0.72
    game.player.collisionCooldown = 0.9
    enemy.collisionCooldown = 0.9
    game.message = 'LANCES CLASH'
    game.messageTimer = 0.65
  }
}

export function stepGame(game: GameState, input: InputState, dt: number) {
  if (dt <= 0) return
  game.time += dt
  game.messageTimer = Math.max(0, game.messageTimer - dt)
  updateMountDepartures(game, dt)

  if (game.mode === 'title') {
    if (input.start) startGame(game)
    return
  }
  if (game.mode === 'gameover') {
    if (input.start) startGame(game)
    return
  }

  if (game.playerRespawnTimer <= 0) moveBird(game.player, input, dt, game.platforms)
  updateLavaGrab(game, game.player, dt, PLATFORM_CONTACT_RADIUS, -1)
  for (const enemy of game.enemies) updateEnemy(game, enemy, dt)
  for (const enemy of game.enemies) {
    updateLavaGrab(game, enemy, dt, enemy.kind === 'pterodactyl' ? BIRD_RADIUS : PLATFORM_CONTACT_RADIUS, enemy.id)
  }
  game.timeSinceKill += dt

  for (let index = game.enemies.length - 1; index >= 0; index -= 1) {
    if (game.enemies[index].y + BIRD_RADIUS >= LAVA_Y) game.enemies.splice(index, 1)
  }

  if (game.timeSinceKill >= PTERODACTYL_DELAY) spawnPterodactyl(game)
  updateEggs(game, dt)

  if (game.playerRespawnTimer <= 0 && ((game.player.y + BIRD_RADIUS >= LAVA_Y && isOverLava(game.player.x)) || game.player.y > GAME_HEIGHT + BIRD_RADIUS)) {
    loseLife(game, 'FELL INTO THE LAVA')
  } else {
    checkJousts(game)
  }

  if (game.mode !== 'playing') return
  if (game.enemies.length === 0 && game.eggs.length === 0) {
    if (!game.lavaRiseStarted) {
      game.lavaRiseStarted = true
    }
    const requestedRiseTargetY = game.wave === 2 ? LAVA_SURFACE_WAVE2_Y : LAVA_SURFACE_WAVE3_Y
    const lavaRiseTargetY = Math.min(game.lavaSurfaceY, requestedRiseTargetY)
    game.lavaSurfaceY = Math.max(lavaRiseTargetY, game.lavaSurfaceY - LAVA_RISE_SPEED * dt)
    if (game.lavaSurfaceY - lavaRiseTargetY < 1e-6) game.lavaSurfaceY = lavaRiseTargetY
    const lavaCovers = game.platforms.filter((platform) => platform.burnsAway)
    if (game.wave === 2 && lavaCovers.length > 0) {
      const startingDissolve = lavaCovers.some((platform) => platform.dissolveTimer === undefined)
      if (startingDissolve) {
        for (const platform of lavaCovers) platform.dissolveTimer = LAVA_PLATFORM_DISSOLVE_DURATION
        game.lavaBurnProgress = 0
        game.message = 'LAVA PLATFORMS CRUMBLING'
        game.messageTimer = LAVA_PLATFORM_DISSOLVE_DURATION
      } else {
        for (const platform of lavaCovers) {
          platform.dissolveTimer = Math.max(0, platform.dissolveTimer! - dt)
        }
        game.lavaBurnProgress = Math.min(1, 1 - Math.max(...lavaCovers.map((platform) => platform.dissolveTimer!)) / LAVA_PLATFORM_DISSOLVE_DURATION)
        if (lavaCovers.every((platform) => platform.dissolveTimer === 0)) {
          game.lavaBurnProgress = 1
          game.platforms = game.platforms.filter((platform) => !platform.burnsAway)
        }
      }
    }
    const coversCleared = game.wave !== 2 || !game.platforms.some((platform) => platform.burnsAway)
    if (game.lavaSurfaceY === lavaRiseTargetY && coversCleared) {
      game.waveDelay += dt
      if (game.waveDelay >= WAVE_TRANSITION_PAUSE) spawnWave(game)
    }
  } else {
    game.waveDelay = 0
    game.lavaRiseStarted = false
  }
}