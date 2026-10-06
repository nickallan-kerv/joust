import { GAME_WIDTH, LAVA_PITS } from './simulation'

export const LAVA_BUBBLE_INTERVAL = 0.28
export const LAVA_BUBBLE_LIFETIME = 1.5
export const LAVA_BUBBLE_RISE_SPEED = 36
export const LAVA_BUBBLE_SPAWN_CHANCE = 0.82
export const LAVA_BUBBLE_BURST_HEIGHT = 6

interface LavaBubblePositionOptions {
  wave: number
  surfaceY: number
  age: number
  frameWidth: number
  frameHeight: number
  scale: number
  horizontalRoll: number
  pitRoll: number
  depthRoll: number
}

export function getLavaBubblePosition({
  wave,
  surfaceY,
  age,
  frameWidth,
  frameHeight,
  scale,
  horizontalRoll,
  pitRoll,
  depthRoll,
}: LavaBubblePositionOptions): { x: number; y: number; visible: boolean } {
  const halfWidth = frameWidth * scale / 2
  const position = Math.max(0, Math.min(1, horizontalRoll))
  let x: number
  if (wave < 3) {
    x = halfWidth + position * (GAME_WIDTH - halfWidth * 2)
  } else {
    const pitIndex = Math.min(LAVA_PITS.length - 1, Math.floor(Math.max(0, pitRoll) * LAVA_PITS.length))
    const pit = LAVA_PITS[pitIndex]
    x = pit.x + halfWidth + position * (pit.width - halfWidth * 2)
  }

  const halfHeight = frameHeight * scale / 2
  const maxDepth = Math.max(0, 540 - surfaceY - halfHeight * 2)
  const depth = Math.max(0, Math.min(1, depthRoll))
  const startY = surfaceY + halfHeight + maxDepth * depth
  const y = startY - LAVA_BUBBLE_RISE_SPEED * age
  return {
    x,
    y,
    visible: y + halfHeight > surfaceY - LAVA_BUBBLE_BURST_HEIGHT,
  }
}