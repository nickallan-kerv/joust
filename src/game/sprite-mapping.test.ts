import { describe, expect, it } from 'vitest'
import { spriteAnimations, spriteAtlases, validateSpriteDefinitions } from './sprite-data'
import { getMountFrame, getPlatformFrame, getRiderFrame, getRiderHorizontalOffset, getRiderSpriteFacing, getSpriteAtlasImage, getSpriteAtlasWidth, getSpriteBlendMode, getSpriteComposition } from './sprite-mapping'

describe('Joust sprite atlas mappings', () => {
  it('uses configured Player strips for walking and flight frames', () => {
    const animation = spriteAnimations.player
    const toFrame = (strip: typeof animation.strips.walkRight, index: number) => ({
      x: strip.x + index * strip.frameWidth,
      y: strip.y,
      width: strip.frameWidth,
      height: strip.frameHeight,
    })
    expect(getMountFrame('player', 1, false, true, 0)).toEqual(toFrame(animation.strips.walkRight, 0))
    expect(getMountFrame('player', 1, false, true, animation.strips.walkRight.count - 1)).toEqual(
      toFrame(animation.strips.walkRight, animation.strips.walkRight.count - 1),
    )
    expect(getMountFrame('player', -1, false, true, 0)).toEqual(toFrame(animation.strips.walkLeft, 0))
    expect(getMountFrame('player', 1, true, true, animation.strips.flyRight.count - 1)).toEqual(
      toFrame(animation.strips.flyRight, animation.strips.flyRight.count - 1),
    )
    expect(getMountFrame('player', -1, true, true, animation.strips.flyLeft.count - 1)).toEqual(
      toFrame(animation.strips.flyLeft, animation.strips.flyLeft.count - 1),
    )
  })

  it('selects native reverse strips rather than reusing the forward strip', () => {
    for (const mountClass of ['player', 'bounder', 'hunter'] as const) {
      expect(getMountFrame(mountClass, -1, false, true, 0).x).not.toBe(
        getMountFrame(mountClass, 1, false, true, 0).x,
      )
      expect(getMountFrame(mountClass, -1, true, true, 0).x).not.toBe(
        getMountFrame(mountClass, 1, true, true, 0).x,
      )
    }
  })

  it('maps Bounder and Hunter animation strips separately', () => {
    for (const mountClass of ['bounder', 'hunter'] as const) {
      const animation = spriteAnimations[mountClass]
      for (const [flying, stripName] of [[false, 'walkRight'], [true, 'flyRight']] as const) {
        const strip = animation.strips[stripName]
        expect(getMountFrame(mountClass, 1, flying, true, 0)).toEqual({
          x: strip.x,
          y: strip.y,
          width: strip.frameWidth,
          height: strip.frameHeight,
        })
      }
    }
  })

  it('maps native-facing Player rider crops separately from enemy overlays', () => {
    for (const mountClass of ['player', 'bounder', 'hunter'] as const) {
      const animation = spriteAnimations[mountClass]
      const atlas = spriteAtlases[animation.atlas]
      expect(getRiderFrame(mountClass, -1)).toEqual(atlas.frames[animation.riderFrames.left])
      expect(getRiderFrame(mountClass, 1)).toEqual(atlas.frames[animation.riderFrames.right])
    }
  })

  it('uses native facing crops for Player and enemy riders', () => {
    expect(getRiderSpriteFacing('player', -1)).toBe(1)
    expect(getRiderSpriteFacing('player', 1)).toBe(1)
    expect(getRiderSpriteFacing('bounder', -1)).toBe(1)
    expect(getRiderSpriteFacing('hunter', -1)).toBe(1)
  })

  it('shifts only right-facing enemy riders toward the mount', () => {
    expect(getRiderHorizontalOffset('bounder', 1)).toBe(5)
    expect(getRiderHorizontalOffset('hunter', 1)).toBe(5)
    expect(getRiderHorizontalOffset('bounder', -1)).toBe(0)
    expect(getRiderHorizontalOffset('player', 1)).toBe(0)
  })

  it('holds on a planted walking pose instead of cycling while idle', () => {
    expect(getMountFrame('bounder', 1, false, false, 0)).toEqual(
      getMountFrame('bounder', 1, false, false, 4),
    )
  })

  it('maps the standard platform strip and temporary lava-cover tile', () => {
    expect(getPlatformFrame(false)).toEqual(spriteAtlases.joust.frames.platformStandard)
    expect(getPlatformFrame(true)).toEqual(spriteAtlases.joust.frames.platformCover)
  })

  it('exposes atlas and composition metadata from JSON', () => {
    expect(getSpriteAtlasImage()).toBe(spriteAtlases.joust.image)
    expect(getSpriteAtlasWidth()).toBe(spriteAtlases.joust.width)
    expect(getSpriteBlendMode()).toBe(spriteAtlases.joust.blendMode)
    expect(getSpriteComposition('player')).toEqual(spriteAnimations.player.composition)
    expect(getSpriteComposition('bounder')).toEqual(spriteAnimations.bounder.composition)
    expect(getSpriteComposition('hunter')).toEqual(spriteAnimations.hunter.composition)
  })

  it('validates all manifest-loaded sprite definitions', () => {
    expect(() => validateSpriteDefinitions(Object.values(spriteAtlases), Object.values(spriteAnimations))).not.toThrow()
  })

  it('rejects crops and animation strips outside the atlas bounds', () => {
    const atlas = structuredClone(spriteAtlases.joust)
    atlas.frames.platformStandard.x = atlas.width
    expect(() => validateSpriteDefinitions([atlas], Object.values(spriteAnimations))).toThrow(/exceeds atlas/)

    const validAtlas = structuredClone(spriteAtlases.joust)
    const animation = structuredClone(spriteAnimations.player)
    animation.strips.walkRight.x = validAtlas.width
    expect(() => validateSpriteDefinitions([validAtlas], [animation, spriteAnimations.bounder, spriteAnimations.hunter])).toThrow(/exceeds atlas/)
  })
})