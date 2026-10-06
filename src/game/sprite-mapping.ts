import { spriteAnimations, spriteAtlases, type Facing, type MountClass, type SpriteFrame } from './sprite-data'
import type { PlatformSpriteName } from './types'

export type { Facing, MountClass, SpriteFrame } from './sprite-data'

const MOUNT_ANIMATIONS = spriteAnimations
const joustAtlas = spriteAtlases.joust
export type EggSpritePose = 'stationary' | 'rollingRight' | 'rollingLeft' | 'hatching1' | 'hatching2' | 'hatching3'
const EGG_HATCH_ANIMATION_DURATION = 0.6
const EGG_HATCH_ANIMATION_FPS = 5
const EGG_ROLL_SPEED_THRESHOLD = 1

const pterodactylFrames = [
  joustAtlas.frames.pterodactylFlyLeft1,
  joustAtlas.frames.pterodactylFlyLeft2,
  joustAtlas.frames.pterodactylFlyLeft3,
]
const lavaFireFrames = Array.from({ length: 7 }, (_, index) => joustAtlas.frames[`animatedFire${index + 1}`])
const lavaTrollFrames = Array.from({ length: 6 }, (_, index) => joustAtlas.frames[`lavaTroll${index + 1}`])

export function getFontGlyph(character: string): SpriteFrame | undefined {
  return joustAtlas.font?.glyphs[character.toUpperCase()]
}

export function getPlayerIconFrame(): SpriteFrame {
  return joustAtlas.frames.playerIcon
}

export function getBounderStandingFrame(): SpriteFrame {
  return joustAtlas.frames.riderBounderStanding
}

export function getPterodactylFrame(animationTick: number): SpriteFrame {
  return pterodactylFrames[((animationTick % pterodactylFrames.length) + pterodactylFrames.length) % pterodactylFrames.length]
}

export function getLavaFireFrame(animationTick: number): SpriteFrame {
  return lavaFireFrames[((animationTick % lavaFireFrames.length) + lavaFireFrames.length) % lavaFireFrames.length]
}

export function getLavaTrollFrame(animationTick: number): SpriteFrame {
  return lavaTrollFrames[((animationTick % lavaTrollFrames.length) + lavaTrollFrames.length) % lavaTrollFrames.length]
}

export function getLavaTrollOverlayOffset(): { x: number; y: number } {
  return joustAtlas.lavaTrollOverlayOffset ?? { x: 0, y: -18 }
}

export function getKnockOffExplosionFrame(frameIndex: number): SpriteFrame {
  return joustAtlas.frames[frameIndex <= 0 ? 'knockOffExplosion1' : 'knockOffExplosion2']
}

export function getEggFrame(pose: EggSpritePose): SpriteFrame {
  return joustAtlas.frames[`egg${pose[0].toUpperCase()}${pose.slice(1)}`]
}

export function getEggSpritePose(horizontalVelocity: number, hatchTimer: number, animationTime = 0): EggSpritePose {
  if (hatchTimer <= EGG_HATCH_ANIMATION_DURATION) {
    const elapsed = EGG_HATCH_ANIMATION_DURATION - Math.max(0, hatchTimer)
    const frame = Math.min(2, Math.floor((elapsed + 1e-6) * EGG_HATCH_ANIMATION_FPS))
    return `hatching${frame + 1}` as EggSpritePose
  }
  if (Math.abs(horizontalVelocity) > EGG_ROLL_SPEED_THRESHOLD) {
    const rollPhase = Math.floor(animationTime * 8) % 4
    const cycle: EggSpritePose[] = horizontalVelocity > 0
      ? ['rollingRight', 'stationary', 'rollingLeft', 'stationary']
      : ['rollingLeft', 'stationary', 'rollingRight', 'stationary']
    return cycle[rollPhase]
  }
  return 'stationary'
}

export function getMountFrame(
  mountClass: MountClass,
  facing: Facing,
  flying: boolean,
  moving: boolean,
  animationTick: number,
): SpriteFrame {
  const animation = MOUNT_ANIMATIONS[mountClass]
  const strip = flying
    ? facing > 0 ? animation.strips.flyRight : animation.strips.flyLeft
    : facing > 0 ? animation.strips.walkRight : animation.strips.walkLeft
  const frameIndex = moving
    ? animationTick % strip.count
    : flying ? Math.floor((strip.count - 1) / 2) : animation.idleWalkFrame
  return {
    x: strip.x + frameIndex * strip.frameWidth,
    y: strip.y,
    width: strip.frameWidth,
    height: strip.frameHeight,
  }
}

export function getRiderFrame(mountClass: MountClass, facing: Facing): SpriteFrame {
  const animation = MOUNT_ANIMATIONS[mountClass]
  const direction = facing < 0 ? 'left' : 'right'
  return spriteAtlases[animation.atlas].frames[animation.riderFrames[direction]]
}

export function getRiderSpriteFacing(mountClass: MountClass, facing: Facing): Facing {
  return MOUNT_ANIMATIONS[mountClass].riderFacing === 'mount' ? facing : 1
}

export function getRiderHorizontalOffset(mountClass: MountClass, facing: Facing): number {
  return MOUNT_ANIMATIONS[mountClass].riderOffset[facing < 0 ? 'left' : 'right']
}

export function getPlatformFrame(platform: boolean | PlatformSpriteName): SpriteFrame {
  return typeof platform === 'boolean'
    ? platform ? joustAtlas.frames.platformCover : joustAtlas.frames.platformStandard
    : joustAtlas.frames[platform]
}

export function getSpriteAtlasImage(): string {
  return `${import.meta.env.BASE_URL}${joustAtlas.image.replace(/^\/+/, '')}`
}

export function getSpriteAtlasWidth(): number {
  return joustAtlas.width
}

export function getSpriteBlendMode(): GlobalCompositeOperation {
  return joustAtlas.blendMode
}

export function getSpriteComposition(mountClass: MountClass) {
  return MOUNT_ANIMATIONS[mountClass].composition
}