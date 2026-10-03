import { describe, expect, it } from 'vitest'
import {
  createGameState,
  EGG_HATCH_TIME,
  flapBird,
  isGrounded,
  LAVA_Y,
  PTERODACTYL_DELAY,
  PLATFORM_CONTACT_RADIUS,
  resolveJoust,
  startGame,
  stepGame,
} from './simulation'

const noInput = { left: false, right: false, flap: false, start: false }

describe('flight simulation', () => {
  it('flapping gives the rider upward velocity', () => {
    const bird = createGameState().player
    flapBird(bird)
    expect(bird.vy).toBeLessThan(0)
  })

  it('respects flap cooldown instead of stacking rapid flap impulses', () => {
    const bird = createGameState().player
    flapBird(bird)
    const velocityAfterFlap = bird.vy

    flapBird(bird)

    expect(bird.vy).toBe(velocityAfterFlap)
  })

  it('gravity increases downward velocity when the rider does not flap', () => {
    const game = createGameState()
    startGame(game)
    const initialVelocity = game.player.vy
    stepGame(game, noInput, 1 / 60)
    expect(game.player.vy).toBeGreaterThan(initialVelocity)
  })

  it('bounces a rider downward after striking a platform from below', () => {
    const game = createGameState()
    startGame(game)
    game.enemies = []
    game.player.x = 480
    game.player.y = 380
    game.player.vy = -220

    stepGame(game, noInput, 0.1)

    const platform = game.platforms.find(({ y }) => y === 330)
    if (!platform) throw new Error('Expected a center platform.')
    expect(game.player.y).toBe(platform.y + platform.height + PLATFORM_CONTACT_RADIUS)
    expect(game.player.vy).toBeGreaterThan(0)
  })

  it('uses the atlas height for platform and lava-cover colliders', () => {
    expect(createGameState().platforms.every(({ height }) => height === 15)).toBe(true)
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
      { x: 410, y: 150 },
      { x: 105, y: 257 },
    ])
  })

  it('extends the upper and middle side platforms to both screen edges', () => {
    const platforms = createGameState().platforms
    expect(platforms.some((platform) => platform.y === 165 && platform.x === 0)).toBe(true)
    expect(platforms.some((platform) => platform.y === 165 && platform.x + platform.width === 960)).toBe(true)
    expect(platforms.some((platform) => platform.y === 292 && platform.x === 0)).toBe(true)
    expect(platforms.some((platform) => platform.y === 276 && platform.x + platform.width === 960)).toBe(true)
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

  it('moves a grounded enemy toward a platform edge when the player is below', () => {
    const game = createGameState()
    startGame(game)
    const enemy = game.enemies[0]
    if (!enemy) throw new Error('Expected a spawned enemy.')
    enemy.x = 480
    enemy.y = 185 - PLATFORM_CONTACT_RADIUS
    enemy.vx = 0
    enemy.vy = 0
    enemy.flapCooldown = 1
    game.player.x = 480
    game.player.y = 260

    stepGame(game, noInput, 1 / 60)

    expect(enemy.vx).toBeGreaterThan(0)
    expect(enemy.y).toBeLessThan(185)
  })

  it('does not flap again on simulation frames without a new flap press', () => {
    const game = createGameState()
    startGame(game)
    game.player.invulnerability = 1
    stepGame(game, { ...noInput, flap: true }, 1 / 60)
    const velocityAfterPress = game.player.vy

    for (let frame = 0; frame < 12; frame += 1) stepGame(game, noInput, 1 / 60)

    expect(game.player.vy).toBeGreaterThan(velocityAfterPress)
    expect(game.player.vy).toBeLessThan(velocityAfterPress + 200)
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
    expect(game.player.lives).toBe(3)
    expect(game.wave).toBe(1)
  })

  it('scores and removes an enemy defeated from above', () => {
    const game = createGameState()
    startGame(game)
    const firstEnemy = game.enemies[0]
    if (!firstEnemy) throw new Error('Expected a spawned enemy.')
    game.enemies = [{ ...firstEnemy, x: game.player.x, y: game.player.y + 28, flapCooldown: 0.16 }]

    stepGame(game, noInput, 1 / 60)

    expect(game.player.score).toBe(100)
    expect(game.enemies).toHaveLength(0)
    expect(game.eggs).toHaveLength(1)
  })

  it('removes a life when the enemy has the higher lance', () => {
    const game = createGameState()
    startGame(game)
    const firstEnemy = game.enemies[0]
    if (!firstEnemy) throw new Error('Expected a spawned enemy.')
    game.enemies = [{ ...firstEnemy, x: game.player.x, y: game.player.y - 28, flapCooldown: 0.16 }]

    stepGame(game, noInput, 1 / 60)

    expect(game.player.lives).toBe(2)
    expect(game.mode).toBe('playing')
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
  })

  it('advances to another wave after the arena is cleared', () => {
    const game = createGameState()
    startGame(game)
    game.enemies = []
    stepGame(game, noInput, 1.1)
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
    expect(game.player.lives).toBe(3)
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
  })

  it('lands a falling egg on a platform instead of passing through it', () => {
    const game = createGameState()
    startGame(game)
    game.eggs = [{ id: 0, x: 480, y: 300, vx: 0, vy: 120, timer: 4, hatchLevel: 0 }]

    stepGame(game, noInput, 0.2)

    expect(game.eggs).toHaveLength(1)
    expect(game.eggs[0].y).toBe(330 - 8)
    expect(game.eggs[0].vy).toBe(0)
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

    expect(game.player.lives).toBe(2)
    expect(game.player.y).toBe(118)
  })

  it('covers both edge lava pools through wave two, then removes the covers', () => {
    const game = createGameState()
    startGame(game)
    expect(game.platforms.filter((platform) => platform.burnsAway)).toHaveLength(2)

    game.wave = 2
    game.enemies = []
    game.player.x = 480
    game.player.y = 442 - PLATFORM_CONTACT_RADIUS
    game.player.vy = 0
    stepGame(game, noInput, 1.1)

    expect(game.wave).toBe(3)
    expect(game.platforms.filter((platform) => platform.burnsAway)).toHaveLength(0)
    const centerPlatform = game.platforms.find((platform) => platform.y === 442)
    expect(centerPlatform?.x).toBe(240)
    expect(centerPlatform?.width).toBe(480)
  })

  it('spawns a pterodactyl after the inactivity timer expires', () => {
    const game = createGameState()
    startGame(game)
    game.timeSinceKill = PTERODACTYL_DELAY - 1 / 120

    stepGame(game, noInput, 1 / 60)

    expect(game.enemies.some((enemy) => enemy.kind === 'pterodactyl')).toBe(true)
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