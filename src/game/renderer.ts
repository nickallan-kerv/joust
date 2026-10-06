import { BIRD_MATERIALIZE_DURATION, BIRD_RADIUS, EGG_HATCH_TIME, EGG_RADIUS, GAME_HEIGHT, GAME_WIDTH, isGrounded, LAVA_BURN_LEFT_STOP_X, LAVA_BURN_RIGHT_STOP_X, LAVA_PITS, LAVA_PLATFORM_DISSOLVE_DURATION, LAVA_TROLL_ANIMATION_FPS, LAVA_TROLL_GRAB_START_FRAME, LAVA_Y, MOUNT_DEPARTURE_DURATION, PLATFORM_CONTACT_RADIUS } from './simulation'
import { getLavaBubblePosition, LAVA_BUBBLE_INTERVAL, LAVA_BUBBLE_LIFETIME, LAVA_BUBBLE_SPAWN_CHANCE } from './lava-effects'
import { getBounderStandingFrame, getEggFrame, getEggSpritePose, getFontGlyph, getKnockOffExplosionFrame, getLavaFireFrame, getLavaTrollFrame, getLavaTrollOverlayOffset, getMountFrame, getPlayerIconFrame, getPlatformFrame, getPterodactylFrame, getRiderFrame, getRiderHorizontalOffset, getRiderSpriteFacing, getSpriteAtlasImage, getSpriteAtlasWidth, getSpriteBlendMode, getSpriteComposition, type MountClass } from './sprite-mapping'
import type { Bird, Egg, Enemy, GameState, MountDeparture } from './types'

const PLATFORM_COLOR = '#91c6a1'
const LAVA_FIRE_LIFETIME = 0.85
const LAVA_FIRE_FRAMES_PER_SECOND = 8
const LAVA_FIRE_RANDOM_SEED = Math.random() * 43758.5453

let spriteAtlas: HTMLImageElement | undefined
const titleArtwork = new Image()
titleArtwork.src = `${import.meta.env.BASE_URL}assets/joust-title.webp`
const tintedGlyphs = new Map<string, HTMLCanvasElement>()
let tintedPlayerIcon: HTMLCanvasElement | undefined

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

interface MaterializationReveal {
  shift: number
}

function clipToMaterialization(context: CanvasRenderingContext2D, bird: Bird, topOffset: number, height: number): MaterializationReveal | undefined {
  if (bird.materializeTimer <= 0) return undefined
  const progress = Math.max(0, Math.min(1, 1 - bird.materializeTimer / BIRD_MATERIALIZE_DURATION))
  const visibleHeight = Math.max(1, Math.ceil(height * progress))
  const visibleTop = bird.y + topOffset + height - visibleHeight
  context.save()
  context.beginPath()
  context.rect(0, visibleTop, GAME_WIDTH, visibleHeight)
  context.clip()
  const flashPhase = Math.floor((BIRD_MATERIALIZE_DURATION - bird.materializeTimer) * 10)
  if (flashPhase % 2 === 0) context.globalAlpha = 0.18
  return { shift: height - visibleHeight }
}

function beginMaterializationDraw(context: CanvasRenderingContext2D, reveal: MaterializationReveal | undefined) {
  if (!reveal) return
  context.save()
  context.translate(0, reveal.shift)
}

function finishMaterializationDraw(context: CanvasRenderingContext2D, reveal: MaterializationReveal | undefined) {
  if (!reveal) return
  context.restore()
  context.restore()
}

function getTintedGlyph(character: string, color: string): HTMLCanvasElement | undefined {
  if (!spriteAtlas) return undefined
  const frame = getFontGlyph(character)
  if (!frame) return undefined
  const key = `${character}:${color}`
  const cached = tintedGlyphs.get(key)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = frame.width
  canvas.height = frame.height
  const glyphContext = canvas.getContext('2d')
  if (!glyphContext) return undefined
  glyphContext.fillStyle = color
  glyphContext.fillRect(0, 0, frame.width, frame.height)
  glyphContext.globalCompositeOperation = 'multiply'
  glyphContext.drawImage(spriteAtlas, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height)
  tintedGlyphs.set(key, canvas)
  return canvas
}

function getTintedPlayerIcon(): HTMLCanvasElement | undefined {
  if (!spriteAtlas) return undefined
  if (tintedPlayerIcon) return tintedPlayerIcon
  const frame = getPlayerIconFrame()
  const canvas = document.createElement('canvas')
  canvas.width = frame.width
  canvas.height = frame.height
  const iconContext = canvas.getContext('2d')
  if (!iconContext) return undefined
  iconContext.fillStyle = '#d9ee65'
  iconContext.fillRect(0, 0, frame.width, frame.height)
  iconContext.globalCompositeOperation = 'multiply'
  iconContext.drawImage(spriteAtlas, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height)
  tintedPlayerIcon = canvas
  return canvas
}

function drawGameText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  height: number,
  color: string,
  fallbackFont: string,
  maxWidth = GAME_WIDTH - 48,
) {
  if (!spriteAtlas) {
    context.font = fallbackFont
    context.fillStyle = color
    context.textBaseline = 'middle'
    context.fillText(text, x, y, maxWidth)
    return
  }

  const tokens = text.toUpperCase().match(/./gu) ?? []
  const glyphs = tokens.map((token) => {
    const normalized = token === '←' ? '<' : token === '→' ? '>' : token
    const frame = normalized === '+' ? undefined : getFontGlyph(normalized)
    if (normalized !== ' ' && normalized !== '+' && !frame) return undefined
    const width = frame ? frame.width * height / frame.height : normalized === '+' ? height * 0.62 : height * 0.45
    return { token: normalized, frame, width, advance: width + (normalized === ' ' ? 0 : height * 0.14) }
  })
  if (glyphs.some((glyph) => !glyph)) {
    context.font = fallbackFont
    context.fillStyle = color
    context.textBaseline = 'middle'
    context.fillText(text, x, y, maxWidth)
    return
  }

  const glyphItems = glyphs as Array<{ token: string; frame: ReturnType<typeof getFontGlyph>; width: number; advance: number }>
  const naturalWidth = glyphItems.reduce((width, glyph) => width + glyph.advance, 0)
  const scale = Math.min(1, maxWidth / Math.max(naturalWidth, 1))
  const totalWidth = naturalWidth * scale
  let cursorX = context.textAlign === 'center' ? x - totalWidth / 2 : context.textAlign === 'right' ? x - totalWidth : x
  const top = y - height * scale / 2

  context.save()
  context.globalCompositeOperation = 'screen'
  context.imageSmoothingEnabled = false
  for (const glyph of glyphItems) {
    if (glyph.frame) {
      const tinted = getTintedGlyph(glyph.token, color)
      if (tinted) context.drawImage(tinted, cursorX, top, glyph.width * scale, height * scale)
    } else if (glyph.token === '+') {
      const thickness = Math.max(1, height * scale * 0.11)
      const plusWidth = glyph.width * scale
      context.fillStyle = color
      context.fillRect(cursorX + plusWidth * 0.42, top + height * scale * 0.2, thickness, height * scale * 0.6)
      context.fillRect(cursorX + plusWidth * 0.18, top + height * scale * 0.42, plusWidth * 0.62, thickness)
    }
    cursorX += glyph.advance * scale
  }
  context.restore()
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
    context.save()
    if (platform.dissolveTimer !== undefined) {
      context.globalAlpha = Math.max(0, platform.dissolveTimer / LAVA_PLATFORM_DISSOLVE_DURATION)
      if (platform.dissolveTimer < 1 && Math.floor(game.time * 12) % 2 === 0) context.globalAlpha *= 0.35
    }

    if (spriteAtlas) {
      const source = getPlatformFrame(platform.sprite ?? Boolean(platform.burnsAway))
      const sourceScaleX = GAME_WIDTH / getSpriteAtlasWidth()
      if (platform.sprite && !platform.burnsAway) {
        context.save()
        context.globalCompositeOperation = getSpriteBlendMode()
        context.imageSmoothingEnabled = false
        context.drawImage(spriteAtlas, source.x, source.y, source.width, source.height, platform.x, platform.y, platform.width, platform.height)
        context.restore()
        context.restore()
        continue
      }
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
    context.restore()
  }
}

function drawLava(context: CanvasRenderingContext2D, game: GameState) {
  const surfaceY = game.lavaSurfaceY
  context.fillStyle = '#9f4937'
  context.fillRect(0, surfaceY, GAME_WIDTH, GAME_HEIGHT - surfaceY)
  context.fillStyle = '#d9ee65'
  context.fillRect(0, surfaceY, GAME_WIDTH, 2)

  drawLavaBubbles(context, game, surfaceY)
  drawLavaFire(context, game)
}

function drawLavaBubbles(context: CanvasRenderingContext2D, game: GameState, surfaceY: number) {
  if (game.mode !== 'playing') return
  const lastSpawn = Math.floor(game.time / LAVA_BUBBLE_INTERVAL)
  const firstSpawn = Math.max(0, lastSpawn - Math.ceil(LAVA_BUBBLE_LIFETIME / LAVA_BUBBLE_INTERVAL))
  const frame = getLavaFireFrame(6)
  const scale = Math.min(GAME_WIDTH / getSpriteAtlasWidth(), (GAME_HEIGHT - surfaceY) * 0.75 / frame.height)
  if (scale <= 0) return

  for (let spawn = firstSpawn; spawn <= lastSpawn; spawn += 1) {
    const birthTime = spawn * LAVA_BUBBLE_INTERVAL
    const age = game.time - birthTime
    if (age < 0 || age >= LAVA_BUBBLE_LIFETIME || lavaRandom(spawn, 7) >= LAVA_BUBBLE_SPAWN_CHANCE) continue
    const position = getLavaBubblePosition({
      wave: game.wave,
      surfaceY,
      age,
      frameWidth: frame.width,
      frameHeight: frame.height,
      scale,
      horizontalRoll: lavaRandom(spawn, 9),
      pitRoll: lavaRandom(spawn, 8),
      depthRoll: lavaRandom(spawn, 10),
    })
    if (!position.visible) continue
    context.save()
    context.globalAlpha = 1 - Math.min(1, age / LAVA_BUBBLE_LIFETIME)
    drawAtlasFrame(context, frame, position.x, position.y, false, frame.width * scale, frame.height * scale)
    context.restore()
  }
}

function drawLavaBurnFronts(context: CanvasRenderingContext2D, game: GameState) {
  if (game.mode !== 'playing' || game.wave !== 2 || game.lavaBurnProgress <= 0 ||
      !game.platforms.some((platform) => platform.burnsAway)) return

  const frame = getLavaFireFrame(Math.floor(game.time * LAVA_FIRE_FRAMES_PER_SECOND))
  const scale = GAME_WIDTH / getSpriteAtlasWidth()
  const halfWidth = frame.width * scale / 2
  const leftStart = halfWidth
  const leftStop = LAVA_BURN_LEFT_STOP_X - halfWidth
  const rightStart = GAME_WIDTH - halfWidth
  const rightStop = LAVA_BURN_RIGHT_STOP_X + halfWidth
  const leftX = leftStart + (leftStop - leftStart) * game.lavaBurnProgress
  const rightX = rightStart + (rightStop - rightStart) * game.lavaBurnProgress

  drawAtlasFrame(context, frame, leftX, 442, false, frame.width * scale, frame.height * scale)
  drawAtlasFrame(context, frame, rightX, 442, true, frame.width * scale, frame.height * scale)
}

function lavaRandom(second: number, salt: number): number {
  const value = Math.sin((second + 1) * 127.1 + salt * 311.7 + LAVA_FIRE_RANDOM_SEED) * 43758.5453
  return value - Math.floor(value)
}

function drawLavaFire(context: CanvasRenderingContext2D, game: GameState) {
  if (game.mode !== 'playing') return
  const second = Math.floor(game.time)
  const elapsed = game.time - second
  if (elapsed >= LAVA_FIRE_LIFETIME || lavaRandom(second, 1) >= 1 / 3) return

  const horizontalPosition = lavaRandom(second, 3)
  const x = game.wave < 3
    ? 20 + horizontalPosition * (GAME_WIDTH - 40)
    : (() => {
      const pit = LAVA_PITS[Math.floor(lavaRandom(second, 2) * LAVA_PITS.length)]
      return pit.x + 20 + horizontalPosition * (pit.width - 40)
    })()
  const frame = getLavaFireFrame(Math.floor(elapsed * LAVA_FIRE_FRAMES_PER_SECOND))
  const scale = GAME_WIDTH / getSpriteAtlasWidth()
  drawAtlasFrame(context, frame, x, game.lavaSurfaceY - frame.height * scale / 2, false, frame.width * scale, frame.height * scale)
}

function drawLavaTroll(context: CanvasRenderingContext2D, trollX: number, frameIndex: number) {
  const frame = getLavaTrollFrame(frameIndex)
  const scale = GAME_WIDTH / getSpriteAtlasWidth()
  const trollY = LAVA_Y - frame.height * scale / 2
  drawAtlasFrame(context, frame, trollX, trollY, false, frame.width * scale, frame.height * scale)
  return trollY
}

function drawCapturedCharacter(context: CanvasRenderingContext2D, bird: Bird | Enemy, time: number, trollY: number) {
  const offset = getLavaTrollOverlayOffset()
  const capturedBird = {
    ...bird,
    x: (bird.lavaGrab?.trollX ?? bird.x) + offset.x,
    y: trollY + offset.y,
  }

  if ('kind' in bird && bird.kind === 'pterodactyl') {
    drawPterodactyl(context, { ...bird, x: capturedBird.x, y: capturedBird.y }, time, true)
    return
  }

  const isPlayer = !('kind' in bird)
  const mountClass: MountClass = isPlayer ? 'player' : bird.hatchLevel > 0 ? 'hunter' : 'bounder'
  drawBird(context, capturedBird, isPlayer ? '#44bda1' : '#d55f49', time, isPlayer, true, mountClass)
}

function drawEgg(context: CanvasRenderingContext2D, egg: Egg, time: number) {
  context.fillStyle = 'rgba(2, 15, 13, 0.35)'
  context.beginPath()
  context.ellipse(egg.x, egg.y + EGG_RADIUS + 3, EGG_RADIUS + 3, 3, 0, 0, Math.PI * 2)
  context.fill()

  const frame = getEggFrame(getEggSpritePose(egg.vx, egg.timer, time))
  const scale = GAME_WIDTH / getSpriteAtlasWidth()
  const drawn = drawAtlasFrame(context, frame, egg.x, egg.y, false, frame.width * scale, frame.height * scale)
  if (!drawn) {
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
  }

  context.fillStyle = '#274a3f'
  context.fillRect(egg.x - 10, egg.y - 15, 20, 2)
  context.fillStyle = '#d9ee65'
  context.fillRect(egg.x - 10, egg.y - 15, 20 * Math.max(0, egg.timer / EGG_HATCH_TIME), 2)
}

function drawPterodactyl(context: CanvasRenderingContext2D, enemy: Enemy, time: number, flying: boolean) {
  const materialization = clipToMaterialization(context, enemy, -19, 38)
  beginMaterializationDraw(context, materialization)
  const frame = getPterodactylFrame(flying ? Math.floor(time * 8) : 1)
  if (drawAtlasFrame(context, frame, enemy.x, enemy.y, enemy.facing > 0, 76, 38)) {
    finishMaterializationDraw(context, materialization)
    return
  }

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
  finishMaterializationDraw(context, materialization)
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
  const topOffset = Math.min(-composition.mountSize.height / 2, composition.riderYOffset - composition.riderSize.height / 2)
  const bottomOffset = Math.max(composition.mountSize.height / 2, composition.riderYOffset + composition.riderSize.height / 2)
  const materialization = clipToMaterialization(context, bird, topOffset, bottomOffset - topOffset)
  beginMaterializationDraw(context, materialization)
  const moving = Math.abs(bird.vx) > 8 || Math.abs(bird.vy) > 8
  const frame = getMountFrame(mountClass, bird.facing, flying, moving, Math.floor(time * (flying ? 10 : 8)))
  if (drawAtlasFrame(context, frame, bird.x, bird.y, false, composition.mountSize.width, composition.mountSize.height)) {
    const rider = getRiderFrame(mountClass, bird.facing)
    const riderX = bird.x + getRiderHorizontalOffset(mountClass, bird.facing)
    const riderSize = composition.riderSize
    drawAtlasFrame(context, rider, riderX, bird.y + composition.riderYOffset, getRiderSpriteFacing(mountClass, bird.facing) < 0, riderSize.width, riderSize.height)
    finishMaterializationDraw(context, materialization)
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
  finishMaterializationDraw(context, materialization)
}

function drawMountDeparture(context: CanvasRenderingContext2D, departure: MountDeparture, time: number) {
  const x = departure.x + departure.facing * GAME_WIDTH * departure.age / MOUNT_DEPARTURE_DURATION
  const y = departure.y - 56 * departure.age + Math.sin(departure.age * 12) * 3

  if (departure.mountClass === 'pterodactyl') {
    const frame = getPterodactylFrame(Math.floor(time * 8))
    drawAtlasFrame(context, frame, x, y, departure.facing > 0, 76, 38)
    return
  }

  const mountClass = departure.mountClass
  const composition = getSpriteComposition(mountClass)
  const frame = getMountFrame(mountClass, departure.facing, true, true, Math.floor(time * 10))
  if (!drawAtlasFrame(context, frame, x, y, false, composition.mountSize.width, composition.mountSize.height)) {
    context.save()
    context.translate(x, y)
    if (departure.facing < 0) context.scale(-1, 1)
    context.fillStyle = mountClass === 'player' ? '#44bda1' : '#d55f49'
    context.beginPath()
    context.ellipse(0, 2, 23, 12, 0, 0, Math.PI * 2)
    context.fill()
    context.beginPath()
    context.moveTo(-4, 0)
    context.lineTo(-26, -18)
    context.lineTo(-15, 3)
    context.lineTo(-27, 16)
    context.lineTo(-2, 8)
    context.closePath()
    context.fill()
    context.restore()
  }

  const explosionFrameIndex = Math.floor(departure.age / 0.12)
  if (explosionFrameIndex < 2) {
    const explosion = getKnockOffExplosionFrame(explosionFrameIndex)
    const scale = GAME_WIDTH / getSpriteAtlasWidth()
    drawAtlasFrame(context, explosion, departure.x, departure.y - 10, false, explosion.width * scale, explosion.height * scale)
  }
}

function drawHatchedRider(context: CanvasRenderingContext2D, enemy: Enemy, time: number) {
  const mountDirection = enemy.mountArrivalDirection ?? enemy.facing
  const mountClass: MountClass = enemy.hatchLevel > 0 ? 'hunter' : 'bounder'
  const composition = getSpriteComposition(mountClass)
  const mountFrame = getMountFrame(mountClass, mountDirection, true, true, Math.floor(time * 10))
  if (enemy.mountArrivalX !== undefined) {
    drawAtlasFrame(
      context,
      mountFrame,
      enemy.mountArrivalX,
      enemy.y,
      false,
      composition.mountSize.width,
      composition.mountSize.height,
    )
  }

  const standingFrame = getBounderStandingFrame()
  drawAtlasFrame(
    context,
    standingFrame,
    enemy.x,
    enemy.y + PLATFORM_CONTACT_RADIUS - standingFrame.height / 2,
    enemy.facing < 0,
    standingFrame.width,
    standingFrame.height,
  )
}

function drawHud(context: CanvasRenderingContext2D, game: GameState) {
  context.fillStyle = 'rgba(5, 23, 20, 0.58)'
  context.fillRect(293, 451, 374, 37)
  context.textAlign = 'left'
  drawGameText(context, 'SCORE', 304, 460, 9, '#a9c2ae', "500 11px 'DM Mono', monospace", 48)
  drawGameText(context, String(game.player.score).padStart(5, '0'), 354, 460, 10, '#d9ee65', "500 12px 'DM Mono', monospace", 74)
  context.textAlign = 'right'
  drawGameText(context, `WAVE ${String(game.wave).padStart(2, '0')}`, 656, 460, 10, '#d9ee65', "500 11px 'DM Mono', monospace", 108)
  context.textAlign = 'left'
  const playerIcon = getTintedPlayerIcon()
  if (playerIcon) {
    context.save()
    context.globalCompositeOperation = getSpriteBlendMode()
    context.imageSmoothingEnabled = false
    for (let index = 0; index < game.player.lives; index += 1) {
      context.drawImage(playerIcon, 306 + index * 16, 468, 12, 16)
    }
    context.restore()
  }
  context.textAlign = 'left'
}

function drawOverlay(context: CanvasRenderingContext2D, game: GameState) {
  context.fillStyle = 'rgba(5, 23, 20, 0.72)'
  context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
  context.textAlign = 'center'

  if (game.mode === 'title') {
    if (titleArtwork.complete && titleArtwork.naturalWidth > 0) {
      const width = Math.min(titleArtwork.naturalWidth, GAME_WIDTH - 80)
      const height = titleArtwork.naturalHeight * width / titleArtwork.naturalWidth
      context.imageSmoothingEnabled = true
      context.drawImage(titleArtwork, (GAME_WIDTH - width) / 2, 224 - height / 2, width, height)
      context.imageSmoothingEnabled = false
    }
    drawGameText(context, 'FLAP TO CLIMB. STRIKE FROM ABOVE.', GAME_WIDTH / 2, 312, 13, '#9fc6af', "500 13px 'DM Mono', monospace", 820)
    drawGameText(context, '← / → MOVE     Z FLAP     ENTER START', GAME_WIDTH / 2, 357, 12, '#d9ee65', "500 12px 'DM Mono', monospace", 760)
  } else {
    drawGameText(context, 'THY JOUST IS OVER', GAME_WIDTH / 2, 205, 13, '#e96e4b', "500 13px 'DM Mono', monospace", 760)
    drawGameText(context, 'GAME OVER', GAME_WIDTH / 2, 282, 76, '#f1f0d9', "700 76px 'Barlow Condensed', Impact, sans-serif", 780)
    drawGameText(context, `FINAL SCORE  ${String(game.player.score).padStart(5, '0')}`, GAME_WIDTH / 2, 330, 15, '#d9ee65', "500 15px 'DM Mono', monospace", 760)
    drawGameText(context, 'PRESS ENTER TO FLY AGAIN', GAME_WIDTH / 2, 376, 12, '#9fc6af', "500 12px 'DM Mono', monospace", 760)
  }

  context.textAlign = 'left'
}

export function renderGame(context: CanvasRenderingContext2D, game: GameState) {
  context.imageSmoothingEnabled = false
  context.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
  drawBackground(context)
  drawLava(context, game)
  drawPlatforms(context, game)
  drawLavaBurnFronts(context, game)

  for (const egg of game.eggs) drawEgg(context, egg, game.time)
  for (const enemy of game.enemies) {
    if (enemy.lavaTrollWarning) {
      drawLavaTroll(context, enemy.lavaTrollWarning.trollX, Math.floor(enemy.lavaTrollWarning.age * LAVA_TROLL_ANIMATION_FPS))
    } else if (enemy.lavaGrab) {
      const grabFrame = LAVA_TROLL_GRAB_START_FRAME + Math.min(1, Math.floor(enemy.lavaGrab.age * LAVA_TROLL_ANIMATION_FPS))
      drawLavaTroll(context, enemy.lavaGrab.trollX, grabFrame)
    }
  }
  let playerTrollY: number | undefined
  if (game.player.lavaTrollWarning) {
    drawLavaTroll(context, game.player.lavaTrollWarning.trollX, Math.floor(game.player.lavaTrollWarning.age * LAVA_TROLL_ANIMATION_FPS))
  } else if (game.player.lavaGrab) {
    const grabFrame = LAVA_TROLL_GRAB_START_FRAME + Math.min(1, Math.floor(game.player.lavaGrab.age * LAVA_TROLL_ANIMATION_FPS))
    playerTrollY = drawLavaTroll(context, game.player.lavaGrab.trollX, grabFrame)
  }
  for (const enemy of game.enemies) {
    if (enemy.lavaGrab) {
      const trollY = LAVA_Y - getLavaTrollFrame(Math.floor(game.time * 12)).height * (GAME_WIDTH / getSpriteAtlasWidth()) / 2
      drawCapturedCharacter(context, enemy, game.time, trollY)
      continue
    }
    const platformContactRadius = enemy.kind === 'pterodactyl' ? BIRD_RADIUS : PLATFORM_CONTACT_RADIUS
    const flying = !isGrounded(enemy, game.platforms, platformContactRadius)
    if (enemy.kind === 'pterodactyl') drawPterodactyl(context, enemy, game.time, flying)
    else if (enemy.mountArrivalX !== undefined) drawHatchedRider(context, enemy, game.time)
    else drawBird(context, enemy, '#d55f49', game.time, false, flying, enemy.hatchLevel > 0 ? 'hunter' : 'bounder')
  }
  if (game.mode !== 'gameover' && game.playerRespawnTimer <= 0 && (game.player.invulnerability <= 0 || Math.floor(game.time * 14) % 2 === 0)) {
    if (playerTrollY !== undefined) drawCapturedCharacter(context, game.player, game.time, playerTrollY)
    else drawBird(context, game.player, '#44bda1', game.time, true, !isGrounded(game.player, game.platforms), 'player')
  }
  for (const departure of game.mountDepartures) drawMountDeparture(context, departure, game.time)

  if (game.mode === 'playing') drawHud(context, game)
  if (game.mode !== 'playing') drawOverlay(context, game)

  if (game.mode === 'playing' && game.messageTimer > 0 && game.message) {
    context.textAlign = 'center'
    drawGameText(context, game.message, GAME_WIDTH / 2, 88, 14, '#d9ee65', "500 14px 'DM Mono', monospace", 900)
    context.textAlign = 'left'
  }
}