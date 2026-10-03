import { spriteAnimations, spriteAtlases, type Facing, type MountClass, type SpriteFrame } from './sprite-data'

export type { Facing, MountClass, SpriteFrame } from './sprite-data'

const MOUNT_ANIMATIONS = spriteAnimations
const joustAtlas = spriteAtlases.joust

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

export function getPlatformFrame(burnsAway: boolean): SpriteFrame {
  return burnsAway ? joustAtlas.frames.platformCover : joustAtlas.frames.platformStandard
}

export function getSpriteAtlasImage(): string {
  return joustAtlas.image
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