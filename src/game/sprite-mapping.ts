export type MountClass = 'player' | 'bounder' | 'hunter'
export type Facing = -1 | 1

export interface SpriteFrame {
  x: number
  y: number
  width: number
  height: number
}

interface FrameStrip {
  x: number
  y: number
  width: number
  height: number
  count: number
}

interface MountAnimation {
  walkRight: FrameStrip
  flyRight: FrameStrip
  walkLeft: FrameStrip
  flyLeft: FrameStrip
}

const MOUNT_ANIMATIONS: Record<MountClass, MountAnimation> = {
  player: {
    walkRight: { x: 378, y: 67, width: 42, height: 40, count: 5 },
    flyRight: { x: 0, y: 117, width: 42, height: 40, count: 2 },
    walkLeft: { x: 84, y: 117, width: 42, height: 40, count: 5 },
    flyLeft: { x: 294, y: 117, width: 42, height: 40, count: 2 },
  },
  bounder: {
    walkRight: { x: 378, y: 117, width: 42, height: 40, count: 5 },
    flyRight: { x: 0, y: 167, width: 42, height: 40, count: 2 },
    walkLeft: { x: 84, y: 167, width: 42, height: 40, count: 5 },
    flyLeft: { x: 294, y: 167, width: 42, height: 40, count: 2 },
  },
  hunter: {
    walkRight: { x: 378, y: 167, width: 42, height: 40, count: 5 },
    flyRight: { x: 0, y: 217, width: 42, height: 32, count: 2 },
    walkLeft: { x: 84, y: 217, width: 42, height: 32, count: 5 },
    flyLeft: { x: 294, y: 217, width: 42, height: 32, count: 2 },
  },
}

const RIDER_FRAMES: Record<MountClass, Record<'left' | 'right', SpriteFrame>> = {
  player: {
    left: { x: 530, y: 386, width: 12, height: 18 },
    right: { x: 530, y: 386, width: 12, height: 18 },
  },
  bounder: {
    left: { x: 108, y: 250, width: 34, height: 38 },
    right: { x: 70, y: 250, width: 34, height: 38 },
  },
  hunter: {
    left: { x: 182, y: 250, width: 34, height: 38 },
    right: { x: 144, y: 250, width: 34, height: 38 },
  },
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
    ? facing > 0 ? animation.flyRight : animation.flyLeft
    : facing > 0 ? animation.walkRight : animation.walkLeft
  const frameIndex = moving ? animationTick % strip.count : Math.floor((strip.count - 1) / 2)
  return {
    x: strip.x + frameIndex * strip.width,
    y: strip.y,
    width: strip.width,
    height: strip.height,
  }
}

export function getRiderFrame(mountClass: MountClass, facing: Facing): SpriteFrame {
  return RIDER_FRAMES[mountClass][facing < 0 ? 'left' : 'right']
}

export function getRiderSpriteFacing(mountClass: MountClass, facing: Facing): Facing {
  return mountClass === 'player' ? facing : 1
}