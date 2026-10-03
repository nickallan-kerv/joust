const jsonFiles = import.meta.glob<unknown>('./sprites/*.json', { eager: true, import: 'default' })

export type MountClass = 'player' | 'bounder' | 'hunter'
export type Facing = -1 | 1

export interface SpriteFrame {
  x: number
  y: number
  width: number
  height: number
}

export interface FrameStrip {
  x: number
  y: number
  frameWidth: number
  frameHeight: number
  count: number
}

export interface SpriteAtlasDefinition {
  id: string
  image: string
  width: number
  height: number
  blendMode: 'screen' | 'source-over'
  frames: Record<string, SpriteFrame>
}

export interface SpriteAnimationDefinition {
  id: MountClass
  atlas: string
  strips: Record<'walkRight' | 'flyRight' | 'walkLeft' | 'flyLeft', FrameStrip>
  idleWalkFrame: number
  riderFrames: Record<'left' | 'right', string>
  riderFacing: 'mount' | 'native'
  riderOffset: Record<'left' | 'right', number>
  composition: {
    mountSize: { width: number; height: number }
    riderSize: { width: number; height: number }
    riderYOffset: number
  }
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
  return value as Record<string, unknown>
}

function requireInteger(value: unknown, label: string, minimum = 0): number {
  if (!Number.isInteger(value) || (value as number) < minimum) {
    throw new Error(`${label} must be an integer greater than or equal to ${minimum}.`)
  }
  return value as number
}

function requireSize(value: unknown, label: string) {
  const size = asRecord(value, label)
  requireInteger(size.width, `${label}.width`, 1)
  requireInteger(size.height, `${label}.height`, 1)
}

function readJsonFile(path: string): unknown {
  const key = `./sprites/${path}`
  const value = jsonFiles[key]
  if (value === undefined) throw new Error(`Sprite manifest references missing file "${path}".`)
  return value
}

function readManifest() {
  const manifest = asRecord(readJsonFile('manifest.json'), 'Sprite manifest')
  if (!Array.isArray(manifest.atlases) || !Array.isArray(manifest.animations)) {
    throw new Error('Sprite manifest must contain atlas and animation file arrays.')
  }
  for (const path of [...manifest.atlases, ...manifest.animations]) {
    if (typeof path !== 'string' || !path.endsWith('.json')) {
      throw new Error('Sprite manifest entries must be JSON file names.')
    }
  }
  return manifest as { atlases: string[]; animations: string[] }
}

export function validateSpriteDefinitions(
  atlasValues: unknown[],
  animationValues: unknown[],
): { atlases: Record<string, SpriteAtlasDefinition>; animations: Record<MountClass, SpriteAnimationDefinition> } {
  const atlases: Record<string, SpriteAtlasDefinition> = {}
  for (const value of atlasValues) {
    const atlas = asRecord(value, 'Atlas')
    if (typeof atlas.id !== 'string' || atlas.id.length === 0) throw new Error('Atlas id must be a non-empty string.')
    if (typeof atlas.image !== 'string' || atlas.image.length === 0) throw new Error(`Atlas "${atlas.id}" must declare an image.`)
    const width = requireInteger(atlas.width, `Atlas "${atlas.id}" width`, 1)
    const height = requireInteger(atlas.height, `Atlas "${atlas.id}" height`, 1)
    if (atlas.blendMode !== 'screen' && atlas.blendMode !== 'source-over') {
      throw new Error(`Atlas "${atlas.id}" has an invalid blend mode.`)
    }
    const frames = asRecord(atlas.frames, `Atlas "${atlas.id}" frames`)
    if (atlases[atlas.id]) throw new Error(`Duplicate atlas id "${atlas.id}".`)

    for (const [frameName, frameValue] of Object.entries(frames)) {
      const frame = asRecord(frameValue, `Frame "${frameName}"`)
      const x = requireInteger(frame.x, `Frame "${frameName}" x`)
      const y = requireInteger(frame.y, `Frame "${frameName}" y`)
      const frameWidth = requireInteger(frame.width, `Frame "${frameName}" width`, 1)
      const frameHeight = requireInteger(frame.height, `Frame "${frameName}" height`, 1)
      if (x + frameWidth > width || y + frameHeight > height) {
        throw new Error(`Frame "${frameName}" exceeds atlas "${atlas.id}" bounds.`)
      }
    }
    atlases[atlas.id] = atlas as unknown as SpriteAtlasDefinition
  }

  const animations: Partial<Record<MountClass, SpriteAnimationDefinition>> = {}
  const stripNames = ['walkRight', 'flyRight', 'walkLeft', 'flyLeft'] as const
  for (const value of animationValues) {
    const animation = asRecord(value, 'Animation')
    if (!['player', 'bounder', 'hunter'].includes(animation.id as string)) {
      throw new Error(`Unknown mount animation id "${String(animation.id)}".`)
    }
    const id = animation.id as MountClass
    if (animations[id]) throw new Error(`Duplicate animation id "${id}".`)
    if (typeof animation.atlas !== 'string' || !atlases[animation.atlas]) {
      throw new Error(`Animation "${id}" references an unknown atlas.`)
    }
    const idleWalkFrame = requireInteger(animation.idleWalkFrame, `Animation "${id}" idle walk frame`)

    const atlas = atlases[animation.atlas]
    const strips = asRecord(animation.strips, `Animation "${id}" strips`)
    const stripCounts: Partial<Record<typeof stripNames[number], number>> = {}
    for (const stripName of stripNames) {
      const strip = asRecord(strips[stripName], `Animation "${id}" strip "${stripName}"`)
      const x = requireInteger(strip.x, `Animation "${id}" ${stripName}.x`)
      const y = requireInteger(strip.y, `Animation "${id}" ${stripName}.y`)
      const frameWidth = requireInteger(strip.frameWidth, `Animation "${id}" ${stripName}.frameWidth`, 1)
      const frameHeight = requireInteger(strip.frameHeight, `Animation "${id}" ${stripName}.frameHeight`, 1)
      const count = requireInteger(strip.count, `Animation "${id}" ${stripName}.count`, 1)
      stripCounts[stripName] = count
      if (x + frameWidth * count > atlas.width || y + frameHeight > atlas.height) {
        throw new Error(`Animation "${id}" strip "${stripName}" exceeds atlas "${atlas.id}" bounds.`)
      }
    }
    if (idleWalkFrame >= Math.min(stripCounts.walkRight!, stripCounts.walkLeft!)) {
      throw new Error(`Animation "${id}" idle walk frame is outside its walking strips.`)
    }

    const riderFrames = asRecord(animation.riderFrames, `Animation "${id}" rider frames`)
    for (const facing of ['left', 'right'] as const) {
      if (typeof riderFrames[facing] !== 'string' || !atlas.frames[riderFrames[facing] as string]) {
        throw new Error(`Animation "${id}" references an unknown ${facing}-facing rider frame.`)
      }
    }
    if (animation.riderFacing !== 'mount' && animation.riderFacing !== 'native') {
      throw new Error(`Animation "${id}" has an invalid rider facing mode.`)
    }
    const riderOffset = asRecord(animation.riderOffset, `Animation "${id}" rider offset`)
    for (const facing of ['left', 'right'] as const) {
      if (typeof riderOffset[facing] !== 'number' || !Number.isFinite(riderOffset[facing])) {
        throw new Error(`Animation "${id}" ${facing} rider offset must be finite.`)
      }
    }

    const composition = asRecord(animation.composition, `Animation "${id}" composition`)
    requireSize(composition.mountSize, `Animation "${id}" composition.mountSize`)
    requireSize(composition.riderSize, `Animation "${id}" composition.riderSize`)
    if (typeof composition.riderYOffset !== 'number' || !Number.isFinite(composition.riderYOffset)) {
      throw new Error(`Animation "${id}" rider Y offset must be finite.`)
    }
    animations[id] = animation as unknown as SpriteAnimationDefinition
  }

  for (const id of ['player', 'bounder', 'hunter'] as const) {
    if (!animations[id]) throw new Error(`Missing required mount animation "${id}".`)
  }
  return { atlases, animations: animations as Record<MountClass, SpriteAnimationDefinition> }
}

const manifest = readManifest()
const loaded = validateSpriteDefinitions(
  manifest.atlases.map(readJsonFile),
  manifest.animations.map(readJsonFile),
)

export const spriteAtlases = loaded.atlases
export const spriteAnimations = loaded.animations