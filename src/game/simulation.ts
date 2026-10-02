import type { Bird, Egg, Enemy, GameState, InputState, Platform } from './types'

export const GAME_WIDTH = 960
export const GAME_HEIGHT = 540
export const BIRD_RADIUS = 19
export const LAVA_Y = 510
export const LAVA_PITS = [
  { x: 0, width: 240 },
  { x: 720, width: 240 },
]
export const EGG_RADIUS = 8
export const EGG_HATCH_TIME = 7
export const PTERODACTYL_DELAY = 18
const GRAVITY = 780
const MAX_FALL_SPEED = 430
const FLAP_COOLDOWN = 0.16
const PLATFORM_LAYOUT: Platform[] = [
  { x: 240, y: 442, width: 480, height: 16 },
  { x: 0, y: 165, width: 160, height: 14 },
  { x: 260, y: 185, width: 440, height: 14 },
  { x: 800, y: 165, width: 160, height: 14 },
  { x: 0, y: 292, width: 200, height: 14 },
  { x: 760, y: 276, width: 200, height: 14 },
  { x: 333, y: 330, width: 294, height: 14 },
]
export const SPAWN_POINTS = [
  { x: 410, y: 150, markerY: 185 },
  { x: 105, y: 257, markerY: 292 },
  { x: 820, y: 241, markerY: 276 },
  { x: 480, y: 407, markerY: 442 },
]
const LAVA_COVERS: Platform[] = [
  { x: 0, y: 442, width: 240, height: 16, burnsAway: true },
  { x: 720, y: 442, width: 240, height: 16, burnsAway: true },
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
    player: { ...makeBird(GAME_WIDTH / 2, 130, 1), score: 0, lives: 3 },
    enemies: [],
    eggs: [],
    platforms: platformsForWave(1),
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
  game.platforms = platformsForWave(game.wave)
  const count = Math.min(2 + Math.floor((game.wave - 1) / 2), SPAWN_POINTS.length)

  game.enemies = Array.from({ length: count }, (_, index) => {
    const spawnPoint = SPAWN_POINTS[(game.wave - 1 + index) % SPAWN_POINTS.length]
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
  spawnWave(game)
}

export function resolveJoust(playerY: number, enemyY: number): 'player' | 'enemy' | 'tie' {
  const heightAdvantage = 8
  if (playerY < enemyY - heightAdvantage) return 'player'
  if (enemyY < playerY - heightAdvantage) return 'enemy'
  return 'tie'
}

export function flapBird(bird: Bird) {
  if (bird.flapCooldown > 0) return
  bird.vy = Math.max(bird.vy - 320, -360)
  bird.flapCooldown = FLAP_COOLDOWN
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

export function isGrounded(bird: Bird, platforms: Platform[]) {
  return bird.vy >= 0 && platforms.some((platform) =>
    Math.abs(bird.y + BIRD_RADIUS - platform.y) <= 1 &&
    bird.x >= platform.x - BIRD_RADIUS &&
    bird.x <= platform.x + platform.width + BIRD_RADIUS,
  )
}

function landOnPlatforms(bird: Bird, previousY: number, platforms: Platform[]) {
  if (bird.vy < 0) {
    for (const platform of platforms) {
      const crossedUnderside = previousY - BIRD_RADIUS >= platform.y + platform.height && bird.y - BIRD_RADIUS <= platform.y + platform.height
      const underPlatform = bird.x >= platform.x - BIRD_RADIUS && bird.x <= platform.x + platform.width + BIRD_RADIUS
      if (!crossedUnderside || !underPlatform) continue
      bird.y = platform.y + platform.height + BIRD_RADIUS
      bird.vy = Math.max(90, Math.abs(bird.vy) * 0.42)
      return
    }
    return
  }

  for (const platform of platforms) {
    const crossedPlatform = previousY + BIRD_RADIUS <= platform.y && bird.y + BIRD_RADIUS >= platform.y
    const abovePlatform = bird.x >= platform.x - BIRD_RADIUS && bird.x <= platform.x + platform.width + BIRD_RADIUS
    if (!crossedPlatform || !abovePlatform) continue
    bird.y = platform.y - BIRD_RADIUS
    bird.vy = 0
    return
  }
}

function moveBird(
  bird: Bird,
  input: Pick<InputState, 'left' | 'right' | 'flap' | 'facingPress'>,
  dt: number,
  platforms: Platform[],
  speedMultiplier = 1,
) {
  const previousY = bird.y
  const grounded = isGrounded(bird, platforms)
  const heldDirection = Number(input.right) - Number(input.left)
  const direction = heldDirection !== 0 ? heldDirection : input.facingPress ?? 0

  if (direction !== 0) {
    const acceleration = grounded ? 1200 : 520
    bird.vx += direction * acceleration * speedMultiplier * dt
    bird.facing = direction < 0 ? -1 : 1
    if (grounded && bird.vx * direction > 0) bird.vx *= Math.exp(-0.35 * dt)
  } else {
    bird.vx *= Math.exp(-(grounded ? 8.5 : 1.4) * dt)
  }

  const normalMaxSpeed = (grounded ? 320 : 245) * speedMultiplier
  bird.reboundTimer = Math.max(0, bird.reboundTimer - dt)
  const reboundMaxSpeed = Math.min(Math.abs(bird.vx), 620 * speedMultiplier)
  const maxSpeed = bird.reboundTimer > 0 ? Math.max(normalMaxSpeed, reboundMaxSpeed) : normalMaxSpeed
  bird.vx = Math.max(-maxSpeed, Math.min(maxSpeed, bird.vx))
  if (input.flap) flapBird(bird)
  bird.flapCooldown = Math.max(0, bird.flapCooldown - dt)
  bird.collisionCooldown = Math.max(0, bird.collisionCooldown - dt)
  bird.invulnerability = Math.max(0, bird.invulnerability - dt)
  bird.vy = Math.min(MAX_FALL_SPEED, bird.vy + GRAVITY * dt)
  bird.x += bird.vx * dt
  bird.y += bird.vy * dt

  if (bird.x < -BIRD_RADIUS) bird.x = GAME_WIDTH + BIRD_RADIUS
  if (bird.x > GAME_WIDTH + BIRD_RADIUS) bird.x = -BIRD_RADIUS
  if (bird.y < BIRD_RADIUS + 5) {
    bird.y = BIRD_RADIUS + 5
    bird.vy = Math.max(90, Math.abs(bird.vy) * 0.42)
  }

  landOnPlatforms(bird, previousY, platforms)
}

function loseLife(game: GameState, message: string) {
  game.player.lives -= 1
  game.message = game.player.lives > 0 ? message : 'GAME OVER'
  game.messageTimer = 1.5

  if (game.player.lives <= 0) {
    game.player.lives = 0
    game.mode = 'gameover'
    return
  }

  Object.assign(game.player, makeBird(GAME_WIDTH / 2, 118, 1), {
    score: game.player.score,
    lives: game.player.lives,
    invulnerability: 1.3,
  })
}

function updateEnemy(game: GameState, enemy: Enemy, dt: number) {
  const deltaX = enemy.kind === 'pterodactyl' ? game.player.x - enemy.x : wrappedDelta(enemy.x, game.player.x)
  let horizontal = Math.abs(deltaX) < 20 ? Math.sin(game.time * 2 + enemy.id) : Math.sign(deltaX)
  let shouldFlap = !isGrounded(enemy, game.platforms)
  const platformUnderEnemy = game.platforms.find((platform) =>
    Math.abs(enemy.y + BIRD_RADIUS - platform.y) <= 1 &&
    enemy.x >= platform.x - BIRD_RADIUS &&
    enemy.x <= platform.x + platform.width + BIRD_RADIUS,
  )

  if (platformUnderEnemy && game.player.y > platformUnderEnemy.y + BIRD_RADIUS &&
      game.player.x >= platformUnderEnemy.x && game.player.x <= platformUnderEnemy.x + platformUnderEnemy.width) {
    const distanceToLeft = enemy.x - platformUnderEnemy.x
    const distanceToRight = platformUnderEnemy.x + platformUnderEnemy.width - enemy.x
    horizontal = distanceToLeft < distanceToRight ? -1 : 1
    shouldFlap = false
  }

  const flapBias = enemy.kind === 'pterodactyl' ? -0.1 : enemy.hatchLevel > 0 ? 0.1 : 0.35
  const flap = shouldFlap && (enemy.y > game.player.y + 6 || Math.sin(game.time * 1.7 + enemy.id * 0.8) > flapBias)
  const speedMultiplier = enemy.kind === 'pterodactyl' ? 1.4 : 1 + enemy.hatchLevel * 0.18
  moveBird(enemy, { left: horizontal < -0.2, right: horizontal > 0.2, flap }, dt, game.platforms, speedMultiplier)
}

function dropEgg(game: GameState, enemy: Enemy) {
  game.eggs.push({
    id: game.nextEggId++,
    x: enemy.x,
    y: enemy.y,
    vx: enemy.vx * 0.25,
    vy: -45,
    timer: EGG_HATCH_TIME,
    hatchLevel: enemy.hatchLevel,
  })
}

function hatchEgg(game: GameState, egg: Egg) {
  const facing: -1 | 1 = wrappedDelta(egg.x, game.player.x) < 0 ? -1 : 1
  game.enemies.push({
    ...makeBird(egg.x, Math.max(BIRD_RADIUS + 10, egg.y - BIRD_RADIUS), facing),
    id: game.nextEnemyId++,
    kind: 'rider',
    hatchLevel: egg.hatchLevel + 1,
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
    id: game.nextEnemyId++,
    kind: 'pterodactyl',
    hatchLevel: 0,
  })
  game.message = 'PTERODACTYL INBOUND'
  game.messageTimer = 1.4
  game.timeSinceKill = 0
}

function checkJousts(game: GameState) {
  if (game.player.invulnerability > 0) return

  for (let index = game.enemies.length - 1; index >= 0; index -= 1) {
    const enemy = game.enemies[index]
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
      game.enemies.splice(index, 1)
      if (enemy.kind === 'rider') dropEgg(game, enemy)
      game.timeSinceKill = 0
      continue
    }

    if (result === 'enemy') {
      loseLife(game, 'STRIKE LOST')
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

  if (game.mode === 'title') {
    if (input.start) startGame(game)
    return
  }
  if (game.mode === 'gameover') {
    if (input.start) startGame(game)
    return
  }

  moveBird(game.player, input, dt, game.platforms)
  for (const enemy of game.enemies) updateEnemy(game, enemy, dt)
  game.timeSinceKill += dt

  for (let index = game.enemies.length - 1; index >= 0; index -= 1) {
    if (game.enemies[index].y + BIRD_RADIUS >= LAVA_Y) game.enemies.splice(index, 1)
  }

  if (game.timeSinceKill >= PTERODACTYL_DELAY) spawnPterodactyl(game)
  updateEggs(game, dt)

  if ((game.player.y + BIRD_RADIUS >= LAVA_Y && isOverLava(game.player.x)) || game.player.y > GAME_HEIGHT + BIRD_RADIUS) {
    loseLife(game, 'FELL INTO THE LAVA')
  } else {
    checkJousts(game)
  }

  if (game.mode !== 'playing') return
  if (game.enemies.length === 0 && game.eggs.length === 0) {
    game.waveDelay += dt
    if (game.waveDelay >= 1.1) spawnWave(game)
  } else {
    game.waveDelay = 0
  }
}