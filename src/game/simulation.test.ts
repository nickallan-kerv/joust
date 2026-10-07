import { describe, expect, it } from 'vitest'
import {
  createGameState,
  BIRD_RADIUS,
  EGG_HATCH_TIME,
  flapBird,
  GAME_WIDTH,
  isGrounded,
  BIRD_MATERIALIZE_DURATION,
  LAVA_Y,
  LAVA_PLATFORM_DISSOLVE_DURATION,
  LAVA_RISE_SPEED,
  LAVA_BURN_LEFT_STOP_X,
  LAVA_BURN_RIGHT_STOP_X,
  LAVA_SURFACE_START_Y,
  LAVA_SURFACE_WAVE2_Y,
  LAVA_SURFACE_WAVE3_Y,
  MOUNT_DEPARTURE_DURATION,
  PLAYER_SPAWN_POINT,
  PTERODACTYL_DELAY,
  PLATFORM_CONTACT_RADIUS,
  WAVE_TRANSITION_PAUSE,
  SPAWN_POINTS,
  resolveJoust,
  startGame as startGameWithMaterialization,
  stepGame,
} from './simulation'

const noInput = { left: false, right: false, flap: false, start: false }

function startGame(game: ReturnType<typeof createGameState>) {
  startGameWithMaterialization(game)
  game.player.materializeTimer = 0
  for (const enemy of game.enemies) enemy.materializeTimer = 0
}

describe('flight simulation', () => {
  it('flapping gives the rider upward velocity', () => {
    const bird = createGameState().player
    flapBird(bird)
    expect(bird.vy).toBeLessThan(0)
  })

  it('gives each flap a stronger upward launch for more lift', () => {
    const bird = createGameState().player
    flapBird(bird)
    expect(bird.vy).toBe(-520)
  })

  it('respects flap cooldown instead of stacking rapid flap impulses', () => {
    const bird = createGameState().player
    flapBird(bird)
    const velocityAfterFlap = bird.vy

    flapBird(bird)

    expect(bird.vy).toBe(velocityAfterFlap)
  })

  it('accepts another player flap after the shorter cooldown', () => {
    const game = createGameState()
    startGame(game)
    game.enemies = []
    game.player.invulnerability = 1

    stepGame(game, { ...noInput, flap: true }, 1 / 60)
    for (let frame = 0; frame < 91; frame += 1) stepGame(game, noInput, 1 / 60)
    const velocityBeforeSecondFlap = game.player.vy
    stepGame(game, { ...noInput, flap: true }, 1 / 60)

    expect(game.player.vy).toBeLessThan(velocityBeforeSecondFlap)
  })

  it('gravity increases downward velocity when the rider does not flap', () => {
    const game = createGameState()
    startGame(game)
    game.player.materializeTimer = 0
    game.player.y = 250
    const initialVelocity = game.player.vy
    stepGame(game, noInput, 1 / 60)
    expect(game.player.vy).toBeGreaterThan(initialVelocity)
  })

  it('bounces a rider downward after striking a platform from below', () => {
    const game = createGameState()
    startGame(game)
    game.enemies = []
    game.player.x = 480
    game.player.y = 370
    game.player.vy = -220

    stepGame(game, noInput, 0.1)

    const platform = game.platforms.find(({ sprite }) => sprite === 'platformNoSpawn')
    if (!platform) throw new Error('Expected a center platform.')
    expect(game.player.y).toBe(platform.y + platform.height + PLATFORM_CONTACT_RADIUS)
    expect(game.player.vy).toBeGreaterThan(0)
  })

  it('blocks a rider crossing a platform from the left side', () => {
    const game = createGameState()
    startGame(game)
    game.enemies = []
    game.platforms = [{ x: 400, y: 200, width: 120, height: 15 }]
    game.player.x = 400 - 19 - 4
    game.player.y = 207
    game.player.vx = 190

    stepGame(game, noInput, 0.1)

    expect(game.player.x).toBe(400 - 19)
    expect(game.player.vx).toBe(0)
  })

  it('blocks a rider crossing a platform from the right side', () => {
    const game = createGameState()
    startGame(game)
    game.enemies = []
    game.platforms = [{ x: 400, y: 200, width: 120, height: 15 }]
    game.player.x = 520 + 19 + 4
    game.player.y = 207
    game.player.vx = -190

    stepGame(game, noInput, 0.1)

    expect(game.player.x).toBe(520 + 19)
    expect(game.player.vx).toBe(0)
  })

  it('blocks a rider crossing Platform Spawn Tall from the right side', () => {
    const game = createGameState()
    startGame(game)
    game.enemies = []
    const platform = game.platforms.find(({ sprite }) => sprite === 'platformSpawnTall')!
    const standard = game.platforms.find(({ sprite }) => sprite === 'platformStandard')!
    game.player.x = platform.x + platform.width + BIRD_RADIUS + 4
    game.player.y = standard.y - PLATFORM_CONTACT_RADIUS
    game.player.vx = -190
    expect(isGrounded(game.player, game.platforms)).toBe(true)

    stepGame(game, noInput, 0.1)

    expect(game.player.x).toBe(platform.x + platform.width + BIRD_RADIUS)
    expect(game.player.vx).toBe(0)
    expect(game.player.y).toBe(standard.y - PLATFORM_CONTACT_RADIUS)
    expect(game.player.vy).toBe(0)
    expect(isGrounded(game.player, game.platforms)).toBe(true)
  })

  it('lands on a platform when running onto its top from the edge', () => {
    const game = createGameState()
    startGame(game)
    game.enemies = []
    game.platforms = [{ x: 400, y: 200, width: 120, height: 15 }]
    game.player.x = 400 - 19 - 0.2
    game.player.y = 200 - PLATFORM_CONTACT_RADIUS

    stepGame(game, { ...noInput, right: true }, 0.1)

    expect(game.player.y).toBe(200 - PLATFORM_CONTACT_RADIUS)
    expect(game.player.vy).toBe(0)
    expect(isGrounded(game.player, game.platforms)).toBe(true)
  })

  it('uses distinct atlas crops and source-scaled heights for the stage platforms', () => {
    const platforms = createGameState().platforms
    const stablePlatforms = platforms.filter((platform) => !platform.burnsAway)
    expect(stablePlatforms).toHaveLength(10)
    expect(new Set(stablePlatforms.map((platform) => platform.sprite ?? 'platformStandard')).size).toBe(10)
    expect(stablePlatforms.map(({ height }) => height)).toEqual([7, 22, 22, 28, 25, 35, 25, 22, 38, 41])
    expect(platforms.filter((platform) => platform.burnsAway).every(({ height }) => height === 15)).toBe(true)
  })

  it('places Platform Cover top-left and Platform Alternate top-right at native scale', () => {
    const platforms = createGameState().platforms
    expect(platforms.find(({ y, x }) => y === 125 && x < 480)).toMatchObject({
      x: 0,
      width: 104,
      height: 22,
      sprite: 'platformCover',
    })
    expect(platforms.find(({ y, x }) => y === 125 && x > 480)).toMatchObject({
      x: 812,
      width: 148,
      height: 22,
      sprite: 'platformAlternate',
    })
    expect(platforms.find(({ sprite }) => sprite === 'platformSpawnWide')?.y).toBe(145)
  })

  it('places Platform Standard below and right of Platform Spawn Tall', () => {
    const platforms = createGameState().platforms
    expect(platforms.find((platform) => platform.sprite === 'platformNoSpawn')).toMatchObject({
      x: 327,
      y: 312,
      width: 202,
      height: 25,
    })
    expect(platforms.find((platform) => platform.sprite === 'platformStandard')).toMatchObject({
      x: 815,
      y: 292,
      width: 145,
      height: 22,
    })
    const spawnTall = platforms.find((platform) => platform.sprite === 'platformSpawnTall')!
    const standard = platforms.find((platform) => platform.sprite === 'platformStandard')!
    expect(spawnTall).toMatchObject({ x: 660, y: 256, width: 184, height: 35 })
    expect(spawnTall.x + spawnTall.width - standard.x).toBe(29)
    expect(spawnTall.y + spawnTall.height).toBeLessThan(standard.y)
    expect(standard.y).toBe(platforms.find((platform) => platform.sprite === 'platformSpawnNarrow')?.y)
  })

  it('bounces downward after hitting the top of the screen', () => {
    const game = createGameState()
    startGame(game)
    game.enemies = []
    game.player.y = 25
    game.player.vy = -260

    stepGame(game, noInput, 1 / 60)

    expect(game.player.y).toBe(24)
    expect(game.player.vy).toBeGreaterThan(90)
  })

  it('spawns enemy riders at the reference spawn points', () => {
    const game = createGameState()
    startGame(game)

    expect(game.enemies.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 378, y: 117 },
      { x: 86, y: 264 },
    ])
    expect({ x: game.player.x, y: game.player.y }).toEqual({ x: PLAYER_SPAWN_POINT.x, y: PLAYER_SPAWN_POINT.y })
    expect(new Set([game.player, ...game.enemies].map(({ x, y }) => `${x},${y}`)).size).toBe(game.enemies.length + 1)
  })

  it('gives the player and maximum enemy wave distinct spawn points', () => {
    const game = createGameState()
    startGame(game)
    game.enemies = []
    game.wave = 4
    game.waveDelay = WAVE_TRANSITION_PAUSE
    game.lavaSurfaceY = LAVA_SURFACE_WAVE3_Y
    game.lavaRiseStarted = true

    stepGame(game, noInput, 1 / 60)

    expect(game.enemies).toHaveLength(SPAWN_POINTS.length - 1)
    expect(new Set([game.player, ...game.enemies].map(({ x, y }) => `${x},${y}`)).size).toBe(game.enemies.length + 1)
  })

  it('matches the four spawn points to spawn-marked platform art', () => {
    const platforms = createGameState().platforms
    const spawnPlatforms = platforms.filter((platform) => platform.spawnMarkerArt)
    expect(spawnPlatforms.map((platform) => platform.sprite).sort()).toEqual([
      'platformLong',
      'platformSpawnNarrow',
      'platformSpawnTall',
      'platformSpawnWide',
    ])
    for (const point of SPAWN_POINTS) {
      expect(point.y + PLATFORM_CONTACT_RADIUS).toBe(point.markerY)
      expect(spawnPlatforms.some((platform) =>
        platform.y === point.markerY && point.x >= platform.x && point.x <= platform.x + platform.width,
      )).toBe(true)
    }
    const playerSpawnPlatform = platforms.find((platform) => platform.sprite === 'platformLong')!
    expect(PLAYER_SPAWN_POINT).toMatchObject({
      x: Math.round(playerSpawnPlatform.x + playerSpawnPlatform.width * 160 / 374),
      y: playerSpawnPlatform.y - PLATFORM_CONTACT_RADIUS,
      markerY: playerSpawnPlatform.y,
    })
    const markerOffsets = [
      { sprite: 'platformSpawnWide', sourceX: 68, sourceWidth: 176 },
      { sprite: 'platformSpawnNarrow', sourceX: 54, sourceWidth: 126 },
      { sprite: 'platformSpawnTall', sourceX: 71, sourceWidth: 116 },
      { sprite: 'platformLong', sourceX: 160, sourceWidth: 374 },
    ]
    markerOffsets.forEach(({ sprite, sourceX, sourceWidth }, index) => {
      const platform = spawnPlatforms.find((candidate) => candidate.sprite === sprite)!
      expect(SPAWN_POINTS[index].x).toBe(Math.round(platform.x + platform.width * sourceX / sourceWidth))
    })
    expect(spawnPlatforms.find((platform) => platform.sprite === 'platformSpawnNarrow')).toMatchObject({ x: 0, width: 200, y: 292 })
    expect(spawnPlatforms.find((platform) => platform.sprite === 'platformSpawnTall')).toMatchObject({ x: 660, width: 184, y: 256 })
  })

  it('keeps rider wings grounded until a flap launches them', () => {
    const game = createGameState()
    startGame(game)
    const enemy = game.enemies[0]
    if (!enemy) throw new Error('Expected a spawned enemy.')
    enemy.x = 100
    enemy.y = 292 - PLATFORM_CONTACT_RADIUS
    enemy.vy = 0

    expect(isGrounded(enemy, game.platforms)).toBe(true)
    stepGame(game, noInput, 1 / 60)
    expect(enemy.vy).toBe(0)
    expect(isGrounded(enemy, game.platforms)).toBe(true)
  })

  it('takes a grounded Bounder into the sky after a short idle stretch', () => {
    const game = createGameState()
    startGame(game)
    const enemy = game.enemies[0]
    if (!enemy) throw new Error('Expected a spawned enemy.')
    const floor = game.platforms.find(({ sprite }) => sprite === 'platformLong')!
    enemy.x = 480
    enemy.y = floor.y - PLATFORM_CONTACT_RADIUS
    enemy.vx = 0
    enemy.vy = 0
    enemy.flapCooldown = 0
    game.player.x = 100
    game.player.y = 100

    expect(isGrounded(enemy, game.platforms)).toBe(true)
    for (let frame = 0; frame < 132; frame += 1) stepGame(game, noInput, 1 / 60)

    expect(enemy.y).toBeLessThan(floor.y - PLATFORM_CONTACT_RADIUS - 30)
  })

  it('makes a Bounder leave the tie lane and strike a stationary ground player', () => {
    const game = createGameState()
    startGame(game)
    const enemy = game.enemies[0]
    if (!enemy) throw new Error('Expected a spawned enemy.')
    game.enemies = [enemy]
    const floor = game.platforms.find(({ sprite }) => sprite === 'platformLong')!
    game.player.x = 480
    game.player.y = floor.y - PLATFORM_CONTACT_RADIUS
    game.player.vx = 0
    game.player.vy = 0
    enemy.materializeTimer = 0
    let tieClashes = 0

    for (let frame = 0; frame < 12 * 60 && game.player.lives === 4; frame += 1) {
      stepGame(game, noInput, 1 / 60)
      if (game.message === 'LANCES CLASH' && game.messageTimer > 0.64) tieClashes += 1
    }

    expect(game.player.lives).toBeLessThan(4)
    expect(tieClashes).toBeLessThanOrEqual(1)
  })

  it('flaps a grounded enemy when Platform Spawn Tall blocks its path', () => {
    const game = createGameState()
    startGame(game)
    const enemy = game.enemies[0]
    if (!enemy) throw new Error('Expected a spawned enemy.')
    const tall = game.platforms.find(({ sprite }) => sprite === 'platformSpawnTall')!
    const standard = game.platforms.find(({ sprite }) => sprite === 'platformStandard')!
    game.enemies = [enemy]
    game.player.x = 100
    game.player.y = 100
    enemy.x = tall.x + tall.width + BIRD_RADIUS
    enemy.y = standard.y - PLATFORM_CONTACT_RADIUS
    enemy.vx = 0
    enemy.vy = 0
    enemy.facing = -1
    enemy.flightDirection = -1
    enemy.flightTimer = 5
    enemy.flapCooldown = 0

    for (let frame = 0; frame < 30; frame += 1) stepGame(game, noInput, 1 / 60)

    expect(enemy.y + PLATFORM_CONTACT_RADIUS).toBe(tall.y)
    for (let frame = 0; frame < 30; frame += 1) stepGame(game, noInput, 1 / 60)
    expect(enemy.x).toBeLessThan(tall.x + tall.width + BIRD_RADIUS)
  })

  it('moves a grounded enemy toward a platform edge when the player is below', () => {
    const game = createGameState()
    startGame(game)
    const enemy = game.enemies[0]
    if (!enemy) throw new Error('Expected a spawned enemy.')
    enemy.x = 480
    enemy.y = 145 - PLATFORM_CONTACT_RADIUS
    enemy.vx = 0
    enemy.vy = 0
    enemy.flapCooldown = 1
    game.player.x = 480
    game.player.y = 240

    stepGame(game, noInput, 1 / 60)

    expect(enemy.vx).toBeGreaterThan(0)
    expect(enemy.y).toBeLessThan(145)
  })

  it('keeps an enemy flying in its current direction when a nearby target is behind it', () => {
    const game = createGameState()
    startGame(game)
    const enemy = game.enemies[0]
    if (!enemy) throw new Error('Expected a spawned enemy.')
    game.player.x = 450
    game.player.y = 100
    game.enemies = [{ ...enemy, x: 480, y: 250, vx: 40, vy: 0, facing: 1, flightDirection: 1, flightTimer: 1.5, flightDecision: 2, flapCooldown: 1 }]

    stepGame(game, noInput, 1 / 60)

    expect(game.enemies[0].facing).toBe(1)
    expect(game.enemies[0].vx).toBeGreaterThan(40)
    expect(game.enemies[0].flightTimer).toBeLessThan(1.5)
  })

  it('turns an enemy back toward a target after it gets farther behind', () => {
    const game = createGameState()
    startGame(game)
    const enemy = game.enemies[0]
    if (!enemy) throw new Error('Expected a spawned enemy.')
    game.player.x = 250
    game.player.y = 100
    game.enemies = [{ ...enemy, x: 480, y: 250, vx: 40, vy: 0, facing: 1, hatchLevel: 1, flightDirection: 1, flightTimer: 0, flightDecision: 2, flapCooldown: 1 }]

    stepGame(game, noInput, 1 / 60)

    expect(game.enemies[0].facing).toBe(-1)
    expect(game.enemies[0].vx).toBeGreaterThan(0)
    expect(game.enemies[0].vx).toBeLessThan(40)
  })

  it('gives co-located enemies different movement when pursuing the same target', () => {
    const game = createGameState()
    startGame(game)
    const firstEnemy = game.enemies[0]
    if (!firstEnemy) throw new Error('Expected a spawned enemy.')
    game.player.x = 360
    game.player.y = 100
    game.player.invulnerability = 10
    game.enemies = [
      { ...firstEnemy, id: 20, x: 480, y: 250, vx: 60, vy: 0, facing: 1, flapCooldown: 1 },
      { ...firstEnemy, id: 21, x: 480, y: 250, vx: 60, vy: 0, facing: 1, flapCooldown: 1 },
    ]

    stepGame(game, noInput, 1 / 60)

    expect(game.enemies[0].vx).not.toBe(game.enemies[1].vx)
    expect(game.enemies[0].x).not.toBe(game.enemies[1].x)
    expect(game.enemies[0].flightTimer).not.toBe(game.enemies[1].flightTimer)
  })

  it('lets a committed enemy heading carry through a screen wrap', () => {
    const game = createGameState()
    startGame(game)
    game.player.x = 500
    game.player.y = 150
    game.player.invulnerability = 10
    const enemy = game.enemies[0]
    if (!enemy) throw new Error('Expected a spawned enemy.')
    game.enemies = [{
      ...enemy,
      x: 958,
      y: 100,
      vx: 190,
      vy: 0,
      facing: 1,
      flightDirection: 1,
      flightTimer: 2,
      flightDecision: 1,
      flapCooldown: 1,
    }]

    stepGame(game, noInput, 0.2)

    expect(game.enemies[0].x).toBe(-BIRD_RADIUS)
    expect(game.enemies[0].facing).toBe(1)
  })

  it('sustains vertical flapping while a rider is below the player', () => {
    const game = createGameState()
    startGame(game)
    game.player.x = 600
    game.player.y = 150
    game.player.invulnerability = 10
    const enemy = game.enemies[0]
    if (!enemy) throw new Error('Expected a spawned enemy.')
    game.enemies = [{ ...enemy, x: 600, y: 250, vx: 0, vy: 0, flapCooldown: 0, flightTimer: 2, flightDirection: 1 }]

    for (let frame = 0; frame < 24; frame += 1) stepGame(game, noInput, 1 / 60)

    expect(game.enemies[0].y).toBeLessThan(220)
  })

  it('does not flap again on simulation frames without a new flap press', () => {
    const game = createGameState()
    startGame(game)
    game.enemies = []
    game.player.x = 600
    game.player.y = 250
    game.player.invulnerability = 1
    stepGame(game, { ...noInput, flap: true }, 1 / 60)
    const velocityAfterPress = game.player.vy

    for (let frame = 0; frame < 12; frame += 1) stepGame(game, noInput, 1 / 60)

    expect(game.player.vy).toBeGreaterThan(velocityAfterPress)
    expect(game.player.vy).toBeLessThan(velocityAfterPress + 300)
  })

  it('awards a joust to the rider at the higher screen position', () => {
    expect(resolveJoust(100, 130)).toBe('player')
    expect(resolveJoust(150, 110)).toBe('enemy')
  })

  it('bounces riders apart when their heights are nearly equal', () => {
    expect(resolveJoust(120, 126)).toBe('tie')
  })

  it('preserves the strong horizontal rebound after a tied joust', () => {
    const game = createGameState()
    startGame(game)
    const enemy = game.enemies[0]
    if (!enemy) throw new Error('Expected a spawned enemy.')
    game.enemies = [{ ...enemy, x: game.player.x, y: game.player.y, flapCooldown: 1 }]

    stepGame(game, noInput, 1 / 60)

    expect(Math.abs(game.player.vx)).toBe(620)
    expect(Math.abs(game.enemies[0].vx)).toBe(620)
    expect(game.player.vy).toBe(-460)
    expect(game.enemies[0].vy).toBe(-460)

    stepGame(game, noInput, 1 / 60)

    expect(Math.abs(game.player.vx)).toBeGreaterThan(580)
    expect(Math.abs(game.enemies[0].vx)).toBeGreaterThan(580)
  })

  it('rebounds tied riders far enough apart to prevent an immediate reattack', () => {
    const game = createGameState()
    startGame(game)
    const enemy = game.enemies[0]
    if (!enemy) throw new Error('Expected a spawned enemy.')
    game.player.x = 480
    game.player.y = 260
    game.player.vy = 0
    game.player.invulnerability = 0
    game.enemies = [{ ...enemy, x: 480, y: 260, vx: 0, vy: 0, flapCooldown: 1 }]

    stepGame(game, noInput, 1 / 60)
    for (let frame = 0; frame < 18; frame += 1) stepGame(game, noInput, 1 / 60)

    const rawDistance = Math.abs(game.player.x - game.enemies[0].x)
    const wrappedDistance = Math.min(rawDistance, 960 - rawDistance)
    expect(wrappedDistance).toBeGreaterThan(200)
  })

  it('skids before reversing direction while running on a platform', () => {
    const game = createGameState()
    startGame(game)
    game.player.x = 480
    game.player.y = 442 - PLATFORM_CONTACT_RADIUS
    game.player.vx = 200
    game.player.vy = 0

    stepGame(game, { ...noInput, left: true }, 0.1)

    expect(game.player.vx).toBeGreaterThan(0)
    expect(game.player.vx).toBeLessThan(200)
  })

  it('applies strong horizontal friction while standing on a platform', () => {
    const game = createGameState()
    startGame(game)
    game.player.x = 480
    game.player.y = 442 - PLATFORM_CONTACT_RADIUS
    game.player.vx = 200
    game.player.vy = 0

    stepGame(game, noInput, 0.25)

    expect(game.player.vx).toBeLessThan(30)
    expect(game.player.vx).toBeGreaterThan(0)
  })

  it('accelerates faster horizontally on a platform than in the air', () => {
    const groundedGame = createGameState()
    startGame(groundedGame)
    groundedGame.player.x = 480
    groundedGame.player.y = 442 - PLATFORM_CONTACT_RADIUS
    groundedGame.player.vy = 0

    const airborneGame = createGameState()
    startGame(airborneGame)
    airborneGame.player.x = 480
    airborneGame.player.y = 250
    airborneGame.player.vy = 0

    stepGame(groundedGame, { ...noInput, right: true }, 0.1)
    stepGame(airborneGame, { ...noInput, right: true }, 0.1)

    expect(groundedGame.player.vx).toBeGreaterThan(airborneGame.player.vx * 2)
  })

  it('updates player facing when a short direction press is released before a tick', () => {
    const game = createGameState()
    startGame(game)
    game.player.invulnerability = 1

    stepGame(game, { ...noInput, facingPress: -1 }, 1 / 60)

    expect(game.player.facing).toBe(-1)
  })

  it('reaches a higher sustained horizontal speed on the ground than in the air', () => {
    const groundedGame = createGameState()
    startGame(groundedGame)
    groundedGame.enemies = []
    groundedGame.player.x = 480
    groundedGame.player.y = 442 - PLATFORM_CONTACT_RADIUS
    groundedGame.player.vy = 0

    const airborneGame = createGameState()
    startGame(airborneGame)
    airborneGame.enemies = []
    airborneGame.player.x = 480
    airborneGame.player.y = 250
    airborneGame.player.vy = 0

    const rightInput = { ...noInput, right: true }
    for (let frame = 0; frame < 18; frame += 1) {
      stepGame(groundedGame, rightInput, 1 / 60)
      stepGame(airborneGame, rightInput, 1 / 60)
    }

    expect(groundedGame.player.vx).toBe(320)
    expect(airborneGame.player.vx).toBeLessThan(groundedGame.player.vx)
    expect(airborneGame.player.vx).toBeLessThanOrEqual(245)
  })

  it('stays on the title screen until start is pressed', () => {
    const game = createGameState()
    stepGame(game, noInput, 1 / 60)
    expect(game.mode).toBe('title')
    expect(game.wave).toBe(0)

    stepGame(game, { ...noInput, start: true }, 1 / 60)
    expect(game.mode).toBe('playing')
    expect(game.wave).toBe(1)
  })

  it('starts a fresh run from the game-over state', () => {
    const game = createGameState()
    startGame(game)
    game.mode = 'gameover'
    game.player.score = 700
    game.player.lives = 0

    stepGame(game, { ...noInput, start: true }, 1 / 60)

    expect(game.mode).toBe('playing')
    expect(game.player.score).toBe(0)
    expect(game.player.lives).toBe(4)
    expect(game.wave).toBe(1)
  })

  it('materializes the player and spawned riders over one second', () => {
    const game = createGameState()
    startGameWithMaterialization(game)
    game.player.invulnerability = 10
    const playerSpawn = { x: game.player.x, y: game.player.y }
    const enemySpawns = game.enemies.map(({ x, y }) => ({ x, y }))
    expect(game.player.materializeTimer).toBe(BIRD_MATERIALIZE_DURATION)
    expect(game.enemies.every((enemy) => enemy.materializeTimer === BIRD_MATERIALIZE_DURATION)).toBe(true)

    for (let frame = 0; frame < 30; frame += 1) stepGame(game, noInput, 1 / 60)
    expect(game.player.materializeTimer).toBeCloseTo(0.5, 1)
    expect({ x: game.player.x, y: game.player.y }).toEqual(playerSpawn)
    expect(game.enemies.map(({ x, y }) => ({ x, y }))).toEqual(enemySpawns)
    expect(game.enemies.every((enemy) => enemy.materializeTimer > 0 && enemy.materializeTimer < 1)).toBe(true)

    for (let frame = 0; frame < 30; frame += 1) stepGame(game, noInput, 1 / 60)
    expect(game.player.materializeTimer).toBe(0)
    expect(game.enemies.every((enemy) => enemy.materializeTimer === 0)).toBe(true)
    expect({ x: game.player.x, y: game.player.y }).toEqual(playerSpawn)
  })

  it('ignores movement and flap input while the player is materializing', () => {
    const game = createGameState()
    startGameWithMaterialization(game)
    const player = game.player
    const startingPosition = { x: player.x, y: player.y }
    const startingFacing = player.facing
    player.vx = 80
    player.vy = -120

    stepGame(game, { ...noInput, left: true, flap: true }, 1 / 60)

    expect({ x: player.x, y: player.y }).toEqual(startingPosition)
    expect(player.facing).toBe(startingFacing)
    expect(player.vx).toBe(0)
    expect(player.vy).toBe(0)
  })

  it('scores and removes an enemy defeated from above', () => {
    const game = createGameState()
    startGame(game)
    const firstEnemy = game.enemies[0]
    if (!firstEnemy) throw new Error('Expected a spawned enemy.')
    game.enemies = [{ ...firstEnemy, x: game.player.x, y: game.player.y + 28, flightDirection: 1, flightTimer: 1, flapCooldown: 0.16 }]

    stepGame(game, noInput, 1 / 60)

    expect(game.player.score).toBe(100)
    expect(game.enemies).toHaveLength(0)
    expect(game.eggs).toHaveLength(1)
    expect(game.eggs[0].vx).toBeGreaterThan(100)
    expect(game.mountDepartures).toHaveLength(1)
    expect(game.mountDepartures[0].mountClass).toBe('bounder')
  })

  it('knocks a defeated rider egg away from the player', () => {
    const game = createGameState()
    startGame(game)
    const firstEnemy = game.enemies[0]
    if (!firstEnemy) throw new Error('Expected a spawned enemy.')
    game.enemies = [{ ...firstEnemy, x: game.player.x + 20, y: game.player.y + 28, flightDirection: 1, flightTimer: 1, flapCooldown: 0.16, vx: 0 }]

    stepGame(game, noInput, 1 / 60)

    expect(game.player.score).toBe(100)
    expect(game.eggs[0]?.vx).toBeGreaterThan(200)
  })

  it('nudges eggs from stationary defeated riders in their facing direction', () => {
    const game = createGameState()
    startGame(game)
    const enemy = game.enemies[0]
    if (!enemy) throw new Error('Expected a spawned enemy.')
    game.enemies = [{ ...enemy, x: game.player.x, y: game.player.y + 28, facing: -1, flightDirection: -1, flightTimer: 1, vx: 0, flapCooldown: 0.16 }]

    stepGame(game, noInput, 1 / 60)

    expect(game.eggs).toHaveLength(1)
    expect(game.eggs[0].vx).toBeLessThan(-100)
  })

  it('removes a life when the enemy has the higher lance', () => {
    const game = createGameState()
    startGame(game)
    const firstEnemy = game.enemies[0]
    if (!firstEnemy) throw new Error('Expected a spawned enemy.')
    game.enemies = [{ ...firstEnemy, x: game.player.x, y: game.player.y - 28, flapCooldown: 0.16 }]

    stepGame(game, noInput, 1 / 60)

    expect(game.player.lives).toBe(3)
    expect(game.mode).toBe('playing')
    expect(game.playerRespawnTimer).toBe(MOUNT_DEPARTURE_DURATION)
    expect(game.mountDepartures).toHaveLength(1)
    expect(game.mountDepartures[0].mountClass).toBe('player')

    stepGame(game, noInput, 0.2)
    expect(game.playerRespawnTimer).toBeCloseTo(MOUNT_DEPARTURE_DURATION - 0.2)
    expect(game.player.lives).toBe(3)

    for (let frame = 0; frame < 63; frame += 1) stepGame(game, noInput, 1 / 60)
    expect(game.playerRespawnTimer).toBe(0)
    expect(game.mountDepartures).toHaveLength(0)
    expect(game.player.y).toBeCloseTo(PLAYER_SPAWN_POINT.y, 0)
    expect(game.player.invulnerability).toBeGreaterThan(1)
    expect(game.player.materializeTimer).toBeGreaterThan(0.9)
  })

  it('ends the run when the player loses their final life', () => {
    const game = createGameState()
    startGame(game)
    const enemy = game.enemies[0]
    if (!enemy) throw new Error('Expected a spawned enemy.')
    game.player.lives = 1
    game.player.invulnerability = 0
    game.enemies = [{ ...enemy, x: game.player.x, y: game.player.y - 28, flapCooldown: 1 }]

    stepGame(game, noInput, 1 / 60)

    expect(game.player.lives).toBe(0)
    expect(game.mode).toBe('gameover')
    expect(game.mountDepartures).toHaveLength(1)
    expect(game.mountDepartures[0].mountClass).toBe('player')
  })

  it('advances to another wave after the arena is cleared', () => {
    const game = createGameState()
    startGame(game)
    game.enemies = []
    const transitionFrames = Math.ceil((LAVA_SURFACE_START_Y - LAVA_SURFACE_WAVE3_Y) / LAVA_RISE_SPEED * 60) +
      Math.ceil(WAVE_TRANSITION_PAUSE * 60)
    for (let frame = 0; frame < transitionFrames; frame += 1) stepGame(game, noInput, 1 / 60)
    expect(game.wave).toBe(2)
    expect(game.enemies.length).toBeGreaterThan(0)
  })

  it('resets score, lives, and wave when a new run starts', () => {
    const game = createGameState()
    startGame(game)
    game.player.score = 900
    game.player.lives = 1
    startGame(game)
    expect(game.player.score).toBe(0)
    expect(game.player.lives).toBe(4)
    expect(game.wave).toBe(1)
  })

  it('awards a bonus and removes an egg collected before it hatches', () => {
    const game = createGameState()
    startGame(game)
    game.player.x = 180
    game.player.y = 120
    game.enemies = []
    game.eggs = [{ id: 0, x: 180, y: 120, vx: 0, vy: 0, timer: EGG_HATCH_TIME, hatchLevel: 0 }]

    stepGame(game, noInput, 1 / 60)

    expect(game.player.score).toBe(250)
    expect(game.eggs).toHaveLength(0)
  })

  it('hatches an ignored egg into a tougher rider', () => {
    const game = createGameState()
    startGame(game)
    game.eggs = [{ id: 0, x: 160, y: 140, vx: 0, vy: 0, timer: 0.01, hatchLevel: 0 }]

    stepGame(game, noInput, 1 / 60)

    expect(game.eggs).toHaveLength(0)
    expect(game.enemies.some((enemy) => enemy.kind === 'rider' && enemy.hatchLevel === 1)).toBe(true)
    const hatchedRider = game.enemies.find((enemy) => enemy.hatchLevel === 1)!
    expect(hatchedRider.materializeTimer).toBe(0)
    expect(hatchedRider).toMatchObject({ mountArrivalX: 0, mountArrivalDirection: 1 })
  })

  it('defeats a stationary hatched rider without dropping an egg while its mount flies in', () => {
    const game = createGameState()
    startGame(game)
    game.eggs = [{ id: 1, x: 160, y: 140, vx: 0, vy: 0, timer: 0.01, hatchLevel: 0 }]
    stepGame(game, noInput, 1 / 60)

    const hatchedRider = game.enemies.find((enemy) => enemy.hatchLevel === 1)!
    expect(hatchedRider).toMatchObject({ mountArrivalX: GAME_WIDTH, mountArrivalDirection: -1, materializeTimer: 0 })
    expect(hatchedRider.mountArrivalX).toBeGreaterThan(hatchedRider.x)

    game.player.x = hatchedRider.x
    game.player.y = hatchedRider.y + 12
    game.player.invulnerability = 0
    game.player.collisionCooldown = 0
    stepGame(game, noInput, 1 / 60)

    expect(game.enemies).not.toContain(hatchedRider)
    expect(game.eggs).toHaveLength(0)
  })

  it('mounts a hatched rider after the incoming mount reaches them', () => {
    const game = createGameState()
    startGame(game)
    game.player.x = 700
    game.player.y = 100
    game.eggs = [{ id: 0, x: 160, y: 140, vx: 0, vy: 0, timer: 0.01, hatchLevel: 0 }]
    stepGame(game, noInput, 1 / 60)
    const hatchedRider = game.enemies.find((enemy) => enemy.hatchLevel === 1)!

    for (let frame = 0; frame < 240 && hatchedRider.mountArrivalX !== undefined; frame += 1) {
      stepGame(game, noInput, 1 / 60)
    }

    expect(hatchedRider.mountArrivalX).toBeUndefined()
    expect(hatchedRider.mountArrivalDirection).toBeUndefined()
  })

  it('lands a falling egg on a platform instead of passing through it', () => {
    const game = createGameState()
    startGame(game)
    game.enemies = []
    game.player.x = 700
    game.player.y = 120
    game.eggs = [{ id: 0, x: 480, y: 270, vx: 0, vy: 120, timer: 4, hatchLevel: 0 }]

    stepGame(game, noInput, 0.2)

    expect(game.eggs).toHaveLength(1)
    expect(game.eggs[0].y).toBe(312 - 8)
    expect(game.eggs[0].vy).toBe(0)
  })

  it('slows a rolling egg before it can roll off the center platform into lava', () => {
    const game = createGameState()
    startGame(game)
    game.enemies = []
    game.platforms = game.platforms.filter((platform) => !platform.burnsAway)
    game.player.x = 480
    game.player.y = 100
    game.eggs = [{ id: 0, x: 690, y: 442 - 8, vx: 150, vy: 0, timer: 4, hatchLevel: 0 }]

    for (let frame = 0; frame < 120; frame += 1) stepGame(game, noInput, 1 / 60)

    expect(game.eggs).toHaveLength(1)
    expect(game.eggs[0].x).toBeLessThan(728)
    expect(game.eggs[0].vx).toBeLessThan(1)
  })

  it('removes an egg that falls into a lava pool', () => {
    const game = createGameState()
    startGame(game)
    game.player.x = 480
    game.eggs = [{ id: 0, x: 120, y: 503, vx: 0, vy: 0, timer: 4, hatchLevel: 0 }]

    stepGame(game, noInput, 1 / 60)

    expect(game.eggs).toHaveLength(0)
  })

  it('costs a life when the player reaches the lava', () => {
    const game = createGameState()
    startGame(game)
    game.enemies = []
    game.platforms = game.platforms.filter((platform) => !platform.burnsAway)
    game.wave = 3
    game.player.x = 120
    game.player.y = LAVA_Y - 18
    game.player.vy = 60

    stepGame(game, noInput, 1 / 60)

    expect(game.player.lives).toBe(3)
    expect(game.player.y).toBe(PLAYER_SPAWN_POINT.y)
  })

  it('starts the Troll warning only when lava is exposed and grabs on frame five', () => {
    const game = createGameState()
    startGame(game)
    const enemy = game.enemies[0]
    if (!enemy) throw new Error('Expected a spawned enemy.')
    game.enemies = []
    game.player.x = 120
    game.player.y = LAVA_Y - BIRD_RADIUS - 108
    game.player.vy = 0
    game.player.invulnerability = 10
    game.player.x = 480
    stepGame(game, noInput, 1 / 60)
    expect(game.player.lavaTrollWarning).toBeUndefined()
    expect(game.player.lavaGrab).toBeUndefined()

    game.platforms = game.platforms.filter((platform) => !platform.burnsAway)
    game.player.x = 120
    game.player.y = LAVA_Y - BIRD_RADIUS - 108
    game.player.vy = 0
    stepGame(game, noInput, 1 / 60)
    expect(game.player.lavaTrollWarning).toBeDefined()
    expect(game.player.lavaGrab).toBeUndefined()
    const warningStartY = game.player.y
    for (let frame = 0; frame < 19; frame += 1) stepGame(game, noInput, 1 / 60)
    expect(game.player.lavaGrab).toBeUndefined()
    expect(game.player.y).toBeGreaterThan(warningStartY)
    stepGame(game, noInput, 1 / 60)
    expect(game.player.lavaGrab).toBeDefined()
    expect(game.player.lavaTrollWarning).toBeUndefined()
  })

  it('does not repeatedly retry a declined Lava Troll grab while a character stays low', () => {
    const game = createGameState()
    startGame(game)
    const enemy = game.enemies[0]
    if (!enemy) throw new Error('Expected a spawned enemy.')
    game.enemies = [enemy]
    game.platforms = game.platforms.filter((platform) => !platform.burnsAway)
    game.player.x = 480
    game.player.y = 100
    enemy.id = 1
    enemy.x = 120
    enemy.y = LAVA_Y - BIRD_RADIUS - 35
    enemy.vy = 0
    enemy.flapCooldown = 1

    stepGame(game, noInput, 1 / 60)
    expect(enemy.lavaTrollAttempted).toBe(true)
    expect(enemy.lavaGrab).toBeUndefined()
    stepGame(game, noInput, 1 / 60)
    expect(enemy.lavaGrab).toBeUndefined()
  })

  it('lets the Lava Troll drag the player and enemies into exposed lava', () => {
    const game = createGameState()
    startGame(game)
    const enemy = game.enemies[0]
    if (!enemy) throw new Error('Expected a spawned enemy.')
    game.enemies = [enemy]
    game.platforms = game.platforms.filter((platform) => !platform.burnsAway)
    game.player.x = 120
    game.player.y = LAVA_Y - BIRD_RADIUS - 108
    game.player.vy = 0
    game.player.invulnerability = 10
    enemy.x = 800
    enemy.y = LAVA_Y - BIRD_RADIUS - 108
    enemy.vy = 0
    enemy.flapCooldown = 1

    stepGame(game, noInput, 1 / 60)
    expect(game.player.lavaTrollWarning).toBeDefined()
    expect(enemy.lavaTrollWarning).toBeDefined()
    for (let frame = 0; frame < 20; frame += 1) stepGame(game, noInput, 1 / 60)
    expect(game.player.lavaGrab).toBeDefined()
    expect(enemy.lavaGrab).toBeDefined()
    for (let frame = 0; frame < 36; frame += 1) stepGame(game, noInput, 1 / 60)

    expect(game.player.lives).toBe(3)
    expect(game.enemies).toHaveLength(0)
  })

  it('covers both edge lava pools through wave two, then removes the covers', () => {
    const game = createGameState()
    startGame(game)
    expect(game.platforms.filter((platform) => platform.burnsAway)).toHaveLength(2)
    expect(game.platforms.filter((platform) => platform.burnsAway).every((platform) => platform.sprite === 'platformCover')).toBe(true)

    game.wave = 2
    game.enemies = []
    game.player.x = 480
    game.player.y = 442 - PLATFORM_CONTACT_RADIUS
    game.player.vy = 0
    stepGame(game, noInput, 1 / 60)

    expect(game.wave).toBe(2)
    expect(game.message).toBe('LAVA PLATFORMS CRUMBLING')
    expect(game.platforms.filter((platform) => platform.burnsAway).every((platform) =>
      platform.dissolveTimer === LAVA_PLATFORM_DISSOLVE_DURATION,
    )).toBe(true)

    for (let frame = 0; frame < 90; frame += 1) stepGame(game, noInput, 1 / 60)
    expect(game.platforms.filter((platform) => platform.burnsAway)).toHaveLength(2)
    expect(game.platforms.filter((platform) => platform.burnsAway).every((platform) => platform.dissolveTimer! < 1.6)).toBe(true)
    expect(LAVA_SURFACE_WAVE2_Y).toBe(451)
    expect(game.lavaSurfaceY).toBeGreaterThan(LAVA_SURFACE_WAVE2_Y)
    expect(game.lavaSurfaceY).toBeLessThan(LAVA_SURFACE_START_Y)
    expect(game.lavaBurnProgress).toBeGreaterThan(0.4)
    expect(game.lavaBurnProgress).toBeLessThan(1)
    const shortLeft = game.platforms.find((platform) => platform.sprite === 'platformShortLeft')!
    const shortRight = game.platforms.find((platform) => platform.sprite === 'platformShortRight')!
    expect(LAVA_BURN_LEFT_STOP_X).toBe(shortLeft.x)
    expect(LAVA_BURN_RIGHT_STOP_X).toBe(shortRight.x + shortRight.width)

    for (let frame = 0; frame < 91; frame += 1) stepGame(game, noInput, 1 / 60)

    expect(game.wave).toBe(2)
    expect(game.platforms.filter((platform) => platform.burnsAway)).toHaveLength(0)
    expect(game.lavaBurnProgress).toBe(1)
    expect(game.lavaSurfaceY).toBe(LAVA_SURFACE_WAVE2_Y)
    for (let frame = 0; frame < Math.ceil(WAVE_TRANSITION_PAUSE * 60); frame += 1) stepGame(game, noInput, 1 / 60)
    expect(game.wave).toBe(3)
    const centerPlatform = game.platforms.find((platform) => platform.y === 442)
    expect(centerPlatform?.x).toBe(240)
    expect(centerPlatform?.width).toBe(480)
    expect(centerPlatform?.sprite).toBe('platformLong')
  })

  it('raises lava to the lowest platform top, then pauses before the next wave', () => {
    const game = createGameState()
    startGame(game)
    game.wave = 3
    game.enemies = []
    game.eggs = []
    game.player.x = 480
    game.player.y = 442 - PLATFORM_CONTACT_RADIUS
    game.player.vy = 0
    const floor = game.platforms.find((platform) => platform.sprite === 'platformLong')!

    for (let frame = 0; frame < Math.ceil((LAVA_SURFACE_START_Y - LAVA_SURFACE_WAVE3_Y) / LAVA_RISE_SPEED * 60); frame += 1) {
      stepGame(game, noInput, 1 / 60)
    }
    expect(LAVA_SURFACE_WAVE3_Y).toBe(475)
    expect(game.lavaSurfaceY).toBe(LAVA_SURFACE_WAVE3_Y)
    expect(game.lavaSurfaceY).toBeGreaterThan(floor.y)
    expect(game.lavaSurfaceY).toBe(475)
    expect(game.wave).toBe(3)
    expect(game.waveDelay).toBeLessThan(WAVE_TRANSITION_PAUSE)

    for (let frame = 0; frame < Math.ceil(WAVE_TRANSITION_PAUSE * 60); frame += 1) stepGame(game, noInput, 1 / 60)
    expect(game.lavaSurfaceY).toBe(LAVA_SURFACE_WAVE3_Y)
    expect(game.wave).toBe(4)
    expect(game.lavaSurfaceY).toBe(LAVA_SURFACE_WAVE3_Y)
  })

  it('never lowers the lava after Wave 3 has reached a higher surface', () => {
    const game = createGameState()
    startGame(game)
    game.wave = 3
    game.enemies = []
    game.eggs = []
    game.lavaSurfaceY = LAVA_SURFACE_WAVE2_Y
    game.player.x = 480
    game.player.y = 442 - PLATFORM_CONTACT_RADIUS
    game.player.vy = 0

    for (let frame = 0; frame < Math.ceil(WAVE_TRANSITION_PAUSE * 60); frame += 1) {
      stepGame(game, noInput, 1 / 60)
      expect(game.lavaSurfaceY).toBe(LAVA_SURFACE_WAVE2_Y)
    }
    expect(game.wave).toBe(4)

    game.enemies = []
    for (let frame = 0; frame < Math.ceil(WAVE_TRANSITION_PAUSE * 60); frame += 1) {
      stepGame(game, noInput, 1 / 60)
      expect(game.lavaSurfaceY).toBe(LAVA_SURFACE_WAVE2_Y)
    }
    expect(game.wave).toBe(5)
  })

  it('keeps lava monotonic through seven accelerated wave transitions', () => {
    const game = createGameState()
    startGame(game)
    game.enemies = []
    game.eggs = []
    game.player.x = 480
    game.player.y = 442 - PLATFORM_CONTACT_RADIUS
    game.player.vy = 0
    game.player.invulnerability = 1000
    let highestSurfaceY = game.lavaSurfaceY
    const surfaceAtWave = new Map<number, number>([[game.wave, game.lavaSurfaceY]])

    for (let frame = 0; frame < 2000 && game.wave < 7; frame += 1) {
      game.enemies = []
      game.eggs = []
      game.timeSinceKill = 0
      const previousWave = game.wave
      stepGame(game, noInput, 1 / 60)
      expect(game.lavaSurfaceY).toBeLessThanOrEqual(highestSurfaceY)
      highestSurfaceY = game.lavaSurfaceY
      if (game.wave !== previousWave) surfaceAtWave.set(game.wave, game.lavaSurfaceY)
    }

    expect(game.wave).toBe(7)
    expect(surfaceAtWave.get(2)).toBe(LAVA_SURFACE_WAVE3_Y)
    expect(surfaceAtWave.get(3)).toBe(LAVA_SURFACE_WAVE2_Y)
    for (let wave = 4; wave <= 7; wave += 1) {
      expect(surfaceAtWave.get(wave)).toBe(LAVA_SURFACE_WAVE2_Y)
    }
  })

  it('spawns a pterodactyl after the inactivity timer expires', () => {
    const game = createGameState()
    startGame(game)
    game.timeSinceKill = PTERODACTYL_DELAY - 1 / 120

    stepGame(game, noInput, 1 / 60)

    expect(game.enemies.some((enemy) => enemy.kind === 'pterodactyl')).toBe(true)
    expect(game.enemies.find((enemy) => enemy.kind === 'pterodactyl')?.materializeTimer).toBe(0)
  })

  it('moves the pterodactyl toward the player after spawning', () => {
    const game = createGameState()
    startGame(game)
    game.player.x = 700
    game.enemies = []
    game.timeSinceKill = PTERODACTYL_DELAY

    stepGame(game, noInput, 1 / 60)
    const pterodactyl = game.enemies.find((enemy) => enemy.kind === 'pterodactyl')
    if (!pterodactyl) throw new Error('Expected a spawned pterodactyl.')
    const initialX = pterodactyl.x
    stepGame(game, noInput, 0.2)

    expect(pterodactyl.x).toBeGreaterThan(initialX)
  })

  it('keeps the Pterodactyl above a stationary ground player through its attack', () => {
    const game = createGameState()
    startGame(game)
    game.enemies = []
    game.player.x = 480
    const floor = game.platforms.find(({ sprite }) => sprite === 'platformLong')!
    game.player.y = floor.y - PLATFORM_CONTACT_RADIUS
    game.player.vy = 0
    game.timeSinceKill = PTERODACTYL_DELAY

    stepGame(game, noInput, 1 / 60)
    const pterodactyl = game.enemies.find((enemy) => enemy.kind === 'pterodactyl')
    if (!pterodactyl) throw new Error('Expected a spawned Pterodactyl.')

    for (let frame = 0; frame < 8 * 60 && game.player.lives === 4; frame += 1) {
      stepGame(game, noInput, 1 / 60)
    }

    expect(game.player.lives).toBeLessThan(4)
    expect(game.enemies).toContain(pterodactyl)
  })

  it('lets a higher player joust a pterodactyl for bonus points', () => {
    const game = createGameState()
    startGame(game)
    game.player.invulnerability = 0
    game.enemies = [{
      ...game.enemies[0],
      x: game.player.x,
      y: game.player.y + 28,
      id: 99,
      kind: 'pterodactyl',
      hatchLevel: 0,
      flapCooldown: 1,
    }]

    stepGame(game, noInput, 1 / 60)

    expect(game.player.score).toBe(500)
    expect(game.enemies).toHaveLength(0)
    expect(game.eggs).toHaveLength(0)
    expect(game.mountDepartures).toHaveLength(0)
  })

  it('waits for unresolved eggs before starting the next wave', () => {
    const game = createGameState()
    startGame(game)
    game.enemies = []
    game.eggs = [{ id: 0, x: 160, y: 327, vx: 0, vy: 0, timer: 3, hatchLevel: 0 }]

    stepGame(game, noInput, 1 / 60)

    expect(game.wave).toBe(1)
    expect(game.eggs).toHaveLength(1)
  })
})