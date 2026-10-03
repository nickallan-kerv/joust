import { BIRD_RADIUS, EGG_HATCH_TIME, EGG_RADIUS, GAME_HEIGHT, GAME_WIDTH, isGrounded, LAVA_PITS, LAVA_Y, PLATFORM_CONTACT_RADIUS, SPAWN_POINTS } from './simulation'
import { getMountFrame, getPlatformFrame, getRiderFrame, getRiderHorizontalOffset, getRiderSpriteFacing, getSpriteAtlasImage, getSpriteAtlasWidth, getSpriteBlendMode, getSpriteComposition, type MountClass } from './sprite-mapping'
import type { Bird, Egg, Enemy, GameState } from './types'

const PLATFORM_COLOR = '#91c6a1'

let spriteAtlas: HTMLImageElement | undefined

const spriteImage = new Image()
spriteImage.onload = () => {
  spriteAtlas = spriteImage
}
spriteImage.src = getSpriteAtlasImage()

function drawAtlasFrame(
  context: CanvasRenderingContext2D,
  source: { x: number; y: number; width: number; height: number },
  x: number,
  y: number,
  mirrorHorizontally: boolean,
  width: number,
  height: number,
) {
  if (!spriteAtlas) return false
  context.save()
  context.globalCompositeOperation = getSpriteBlendMode()
  if (mirrorHorizontally) {
    context.translate(x, y)
    context.scale(-1, 1)
    context.drawImage(
      spriteAtlas,
      source.x,
      source.y,
      source.width,
      source.height,
      -width / 2,
      -height / 2,
      width,
      height,
    )
  } else {
    context.drawImage(
      spriteAtlas,
      source.x,
      source.y,
      source.width,
      source.height,
      x - width / 2,
      y - height / 2,
      width,
      height,
    )
  }
  context.restore()
  return true
}

function drawBackground(context: CanvasRenderingContext2D) {
  context.fillStyle = '#0b2b25'
  context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

  context.fillStyle = '#103b33'
  context.beginPath()
  context.moveTo(0, 345)
  context.lineTo(145, 310)
  context.lineTo(282, 348)
  context.lineTo(450, 300)
  context.lineTo(624, 348)
  context.lineTo(800, 304)
  context.lineTo(960, 337)
  context.lineTo(960, 540)
  context.lineTo(0, 540)
  context.closePath()
  context.fill()

  context.fillStyle = '#16473d'
  context.beginPath()
  context.moveTo(0, 412)
  context.lineTo(182, 377)
  context.lineTo(344, 418)
  context.lineTo(524, 374)
  context.lineTo(728, 416)
  context.lineTo(860, 380)
  context.lineTo(960, 403)
  context.lineTo(960, 540)
  context.lineTo(0, 540)
  context.closePath()
  context.fill()

  context.strokeStyle = 'rgba(185, 224, 173, 0.08)'
  context.lineWidth = 1
  for (let y = 42; y < 500; y += 42) {
    context.beginPath()
    context.moveTo(0, y)
    context.lineTo(GAME_WIDTH, y)
    context.stroke()
  }

  for (let index = 0; index < 42; index += 1) {
    const x = (index * 173 + 37) % GAME_WIDTH
    const y = (index * 97 + 21) % 310
    context.fillStyle = index % 4 === 0 ? 'rgba(217, 238, 101, 0.7)' : 'rgba(210, 234, 203, 0.38)'
    context.fillRect(x, y, index % 4 === 0 ? 2 : 1, index % 4 === 0 ? 2 : 1)
  }
}

function drawPlatforms(context: CanvasRenderingContext2D, game: GameState) {
  for (const platform of game.platforms) {
    if (spriteAtlas) {
      const source = getPlatformFrame(Boolean(platform.burnsAway))
      const sourceScaleX = GAME_WIDTH / getSpriteAtlasWidth()
      const tileWidth = source.width * sourceScaleX
      const destinationHeight = platform.height
      let x = platform.x

      context.save()
      context.globalCompositeOperation = getSpriteBlendMode()
      context.imageSmoothingEnabled = false
      while (x < platform.x + platform.width) {
        const width = Math.min(tileWidth, platform.x + platform.width - x)
        const sourceWidth = width / sourceScaleX
        context.drawImage(
          spriteAtlas,
          source.x,
          source.y,
          sourceWidth,
          source.height,
          x,
          platform.y,
          width,
          destinationHeight,
        )
        x += tileWidth
      }
      context.restore()
      continue
    }

    context.fillStyle = 'rgba(4, 20, 18, 0.36)'
    context.fillRect(platform.x, platform.y + platform.height, platform.width, 7)
    context.fillStyle = platform.burnsAway ? '#765c3d' : '#23594c'
    context.fillRect(platform.x, platform.y, platform.width, platform.height)
    context.fillStyle = platform.burnsAway ? '#e3ad4b' : PLATFORM_COLOR
    context.fillRect(platform.x, platform.y, platform.width, 3)
    context.fillStyle = platform.burnsAway ? '#f0c66b' : '#d9ee65'
    context.fillRect(platform.x + 9, platform.y + 5, Math.max(0, platform.width - 18), 2)
    context.fillStyle = platform.burnsAway ? '#493d30' : '#092923'
    for (let x = platform.x + 18; x < platform.x + platform.width - 8; x += 31) {
      context.fillRect(x, platform.y + 10, 4, 2)
    }
  }
}

function drawSpawnPoints(context: CanvasRenderingContext2D) {
  for (const point of SPAWN_POINTS) {
    context.fillStyle = '#f5f0d9'
    context.fillRect(point.x - 38, point.markerY - 3, 76, 7)
    context.strokeStyle = 'rgba(9, 41, 35, 0.8)'
    context.lineWidth = 1
    context.strokeRect(point.x - 38, point.markerY - 3, 76, 7)
  }
}

function drawLava(context: CanvasRenderingContext2D, time: number) {
  for (const pit of LAVA_PITS) {
    context.fillStyle = '#9f4937'
    context.fillRect(pit.x, 443, pit.width, GAME_HEIGHT - 443)
    context.fillStyle = '#e96e4b'
    context.fillRect(pit.x + 4, LAVA_Y, pit.width - 8, GAME_HEIGHT - LAVA_Y)
    for (let index = 0; index < 4; index += 1) {
      const drift = (time * 34 + index * 27) % (pit.width + 22)
      context.fillStyle = index % 2 === 0 ? '#f29a54' : '#d95742'
      context.fillRect(pit.x + drift - 12, 459 + index * 19, 17, 3)
    }
    context.fillStyle = '#d9ee65'
    context.fillRect(pit.x + 8, LAVA_Y - 2, pit.width - 16, 2)
  }
}

function drawEgg(context: CanvasRenderingContext2D, egg: Egg) {
  context.fillStyle = 'rgba(2, 15, 13, 0.35)'
  context.beginPath()
  context.ellipse(egg.x, egg.y + EGG_RADIUS + 3, EGG_RADIUS + 3, 3, 0, 0, Math.PI * 2)
  context.fill()

  context.fillStyle = '#f1e4b8'
  context.beginPath()
  context.ellipse(egg.x, egg.y, EGG_RADIUS, EGG_RADIUS + 3, 0, 0, Math.PI * 2)
  context.fill()
  context.strokeStyle = '#d9ee65'
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(egg.x - 2, egg.y - 3)
  context.lineTo(egg.x + 1, egg.y)
  context.lineTo(egg.x - 1, egg.y + 3)
  context.lineTo(egg.x + 3, egg.y + 5)
  context.stroke()

  context.fillStyle = '#274a3f'
  context.fillRect(egg.x - 10, egg.y - 15, 20, 2)
  context.fillStyle = '#d9ee65'
  context.fillRect(egg.x - 10, egg.y - 15, 20 * Math.max(0, egg.timer / EGG_HATCH_TIME), 2)
}

function drawPterodactyl(context: CanvasRenderingContext2D, enemy: Enemy, time: number, flying: boolean) {
  context.save()
  context.translate(enemy.x, enemy.y)
  if (enemy.facing < 0) context.scale(-1, 1)
  const wing = flying ? Math.sin(time * 16 + enemy.id) * 6 : -6
  context.fillStyle = '#c3d79a'
  context.beginPath()
  context.ellipse(0, 2, 20, 8, 0, 0, Math.PI * 2)
  context.fill()
  context.beginPath()
  context.moveTo(-3, 1)
  context.lineTo(-25, -15 - wing)
  context.lineTo(-16, 4)
  context.lineTo(-28, 13 + wing)
  context.lineTo(-2, 8)
  context.closePath()
  context.fill()
  context.fillRect(-14, -5, 29, 2)
  context.fillStyle = '#e96e4b'
  context.beginPath()
  context.moveTo(17, -2)
  context.lineTo(31, 2)
  context.lineTo(17, 5)
  context.closePath()
  context.fill()
  context.fillStyle = '#d9ee65'
  context.fillRect(11, -4, 2, 2)
  context.restore()
}

function drawBird(
  context: CanvasRenderingContext2D,
  bird: Bird,
  color: string,
  time: number,
  isPlayer: boolean,
  flying: boolean,
  mountClass: MountClass,
) {
  const composition = getSpriteComposition(mountClass)
  const moving = Math.abs(bird.vx) > 8
  const frame = getMountFrame(mountClass, bird.facing, flying, moving, Math.floor(time * (flying ? 10 : 8)))
  if (drawAtlasFrame(context, frame, bird.x, bird.y, false, composition.mountSize.width, composition.mountSize.height)) {
    const rider = getRiderFrame(mountClass, bird.facing)
    const riderX = bird.x + getRiderHorizontalOffset(mountClass, bird.facing)
    const riderSize = composition.riderSize
    drawAtlasFrame(context, rider, riderX, bird.y + composition.riderYOffset, getRiderSpriteFacing(mountClass, bird.facing) < 0, riderSize.width, riderSize.height)
    return
  }

  context.save()
  context.translate(bird.x, bird.y)
  if (bird.facing < 0) context.scale(-1, 1)

  const wingLift = flying ? Math.sin(time * 18 + bird.x * 0.015) * 7 : -7
  context.fillStyle = 'rgba(3, 15, 14, 0.3)'
  context.beginPath()
  context.ellipse(0, 23, 27, 7, 0, 0, Math.PI * 2)
  context.fill()

  context.fillStyle = color
  context.beginPath()
  context.ellipse(-2, 5, 23, 13, -0.08, 0, Math.PI * 2)
  context.fill()

  context.fillStyle = isPlayer ? '#f6e5b7' : '#d5d9c5'
  context.beginPath()
  context.ellipse(1, 2, 14, 6 + wingLift * 0.22, -0.2, 0, Math.PI * 2)
  context.fill()

  context.fillStyle = color
  context.beginPath()
  context.ellipse(-4, -11 - wingLift, 15, 5, -0.18, 0, Math.PI * 2)
  context.fill()

  context.fillStyle = isPlayer ? '#e96e4b' : '#263b45'
  context.beginPath()
  context.ellipse(-2, -18, 9, 8, 0, Math.PI, Math.PI * 2)
  context.lineTo(7, -17)
  context.lineTo(-11, -17)
  context.closePath()
  context.fill()
  context.fillStyle = '#f6e5b7'
  context.fillRect(-4, -19, 6, 2)

  context.fillStyle = '#d9ee65'
  context.fillRect(18, -16, 22, 3)
  context.beginPath()
  context.moveTo(40, -16)
  context.lineTo(47, -14.5)
  context.lineTo(40, -13)
  context.closePath()
  context.fill()

  context.fillStyle = '#162b28'
  context.fillRect(-15, 15, 7, 4)
  context.fillRect(6, 15, 7, 4)
  context.restore()
}

function drawHud(context: CanvasRenderingContext2D, game: GameState) {
  context.fillStyle = 'rgba(5, 23, 20, 0.58)'
  context.fillRect(18, 17, 150, 42)
  context.fillRect(GAME_WIDTH - 258, 17, 240, 42)
  context.font = "500 11px 'DM Mono', monospace"
  context.textBaseline = 'middle'
  context.fillStyle = '#a9c2ae'
  context.fillText('SCORE', 30, 29)
  context.fillStyle = '#d9ee65'
  context.font = "500 14px 'DM Mono', monospace"
  context.fillText(String(game.player.score).padStart(5, '0'), 30, 43)
  context.font = "500 11px 'DM Mono', monospace"
  context.fillStyle = '#a9c2ae'
  context.textAlign = 'right'
  context.fillText(`WAVE ${String(game.wave).padStart(2, '0')}`, GAME_WIDTH - 30, 29)
  context.fillStyle = '#d9ee65'
  context.font = "500 11px 'DM Mono', monospace"
  context.fillText(`LIVES ${game.player.lives}   EGGS ${String(game.eggs.length).padStart(2, '0')}`, GAME_WIDTH - 30, 45)
  context.textAlign = 'left'
}

function drawOverlay(context: CanvasRenderingContext2D, game: GameState) {
  context.fillStyle = 'rgba(5, 23, 20, 0.72)'
  context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
  context.textAlign = 'center'

  if (game.mode === 'title') {
    context.fillStyle = '#d9ee65'
    context.font = "500 13px 'DM Mono', monospace"
    context.fillText('AERIAL COMBAT / ONE PLAYER', GAME_WIDTH / 2, 177)
    context.fillStyle = '#f1f0d9'
    context.font = "700 82px 'Barlow Condensed', Impact, sans-serif"
    context.fillText('HIGHER WINS', GAME_WIDTH / 2, 250)
    context.fillStyle = '#9fc6af'
    context.font = "500 13px 'DM Mono', monospace"
    context.fillText('FLAP TO CLIMB. STRIKE FROM ABOVE.', GAME_WIDTH / 2, 292)
    context.fillStyle = '#d9ee65'
    context.font = "500 12px 'DM Mono', monospace"
    context.fillText('← / → MOVE     Z FLAP     ENTER START', GAME_WIDTH / 2, 357)
  } else {
    context.fillStyle = '#e96e4b'
    context.font = "500 13px 'DM Mono', monospace"
    context.fillText('FLIGHT LOG CLOSED', GAME_WIDTH / 2, 205)
    context.fillStyle = '#f1f0d9'
    context.font = "700 76px 'Barlow Condensed', Impact, sans-serif"
    context.fillText('GAME OVER', GAME_WIDTH / 2, 282)
    context.fillStyle = '#d9ee65'
    context.font = "500 15px 'DM Mono', monospace"
    context.fillText(`FINAL SCORE  ${String(game.player.score).padStart(5, '0')}`, GAME_WIDTH / 2, 330)
    context.fillStyle = '#9fc6af'
    context.font = "500 12px 'DM Mono', monospace"
    context.fillText('PRESS ENTER TO FLY AGAIN', GAME_WIDTH / 2, 376)
  }

  context.textAlign = 'left'
}

export function renderGame(context: CanvasRenderingContext2D, game: GameState) {
  context.imageSmoothingEnabled = false
  context.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
  drawBackground(context)
  drawLava(context, game.time)
  drawPlatforms(context, game)
  drawSpawnPoints(context)

  for (const egg of game.eggs) drawEgg(context, egg)
  for (const enemy of game.enemies) {
    const platformContactRadius = enemy.kind === 'pterodactyl' ? BIRD_RADIUS : PLATFORM_CONTACT_RADIUS
    const flying = !isGrounded(enemy, game.platforms, platformContactRadius)
    if (enemy.kind === 'pterodactyl') drawPterodactyl(context, enemy, game.time, flying)
    else drawBird(context, enemy, '#d55f49', game.time, false, flying, enemy.hatchLevel > 0 ? 'hunter' : 'bounder')
  }
  if (game.player.invulnerability <= 0 || Math.floor(game.time * 14) % 2 === 0) {
    drawBird(context, game.player, '#44bda1', game.time, true, !isGrounded(game.player, game.platforms), 'player')
  }

  if (game.mode === 'playing') drawHud(context, game)
  if (game.mode !== 'playing') drawOverlay(context, game)

  if (game.mode === 'playing' && game.messageTimer > 0 && game.message) {
    context.textAlign = 'center'
    context.fillStyle = '#d9ee65'
    context.font = "500 14px 'DM Mono', monospace"
    context.fillText(game.message, GAME_WIDTH / 2, 88)
    context.textAlign = 'left'
  }
}