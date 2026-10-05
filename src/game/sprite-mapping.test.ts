import { describe, expect, it } from 'vitest'
import { spriteAnimations, spriteAtlases, validateSpriteDefinitions } from './sprite-data'
import { getBounderStandingFrame, getEggFrame, getEggSpritePose, getFontGlyph, getKnockOffExplosionFrame, getMountFrame, getPlayerIconFrame, getPlatformFrame, getPterodactylFrame, getRiderFrame, getRiderHorizontalOffset, getRiderSpriteFacing, getSpriteAtlasImage, getSpriteAtlasWidth, getSpriteBlendMode, getSpriteComposition } from './sprite-mapping'

describe('Joust sprite atlas mappings', () => {
  it('maps the HUD player icon to its configured atlas crop', () => {
    expect(getPlayerIconFrame()).toEqual(spriteAtlases.joust.frames.playerIcon)
  })

  it('uses the swapped Bounder rider crops', () => {
    expect(getRiderFrame('bounder', -1)).toEqual({ x: 3, y: 255, width: 24, height: 14 })
    expect(getRiderFrame('bounder', 1)).toEqual({ x: 557, y: 217, width: 24, height: 14 })
    expect(getRiderFrame('hunter', -1)).toEqual({ x: 109, y: 255, width: 24, height: 14 })
    expect(getRiderFrame('hunter', 1)).toEqual({ x: 71, y: 255, width: 24, height: 14 })
  })

  it('maps the Bounder standing crop immediately after Bounder Left', () => {
    expect(getBounderStandingFrame()).toEqual({ x: 39, y: 255, width: 16, height: 24 })
  })

  it('maps both knock-off explosion frames immediately before the Pterodactyl sprites', () => {
    expect(getKnockOffExplosionFrame(0)).toEqual({ x: 259, y: 295, width: 18, height: 18 })
    expect(getKnockOffExplosionFrame(1)).toEqual({ x: 289, y: 294, width: 22, height: 23 })
  })

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

  it('shifts riders toward the mount by their tuned offsets', () => {
    expect(getRiderHorizontalOffset('bounder', 1)).toBe(15)
    expect(getRiderHorizontalOffset('bounder', -1)).toBe(-10)
    expect(getRiderHorizontalOffset('hunter', 1)).toBe(5)
    expect(getRiderHorizontalOffset('hunter', -1)).toBe(-7)
    expect(getRiderHorizontalOffset('player', 1)).toBe(12)
    expect(getRiderHorizontalOffset('player', -1)).toBe(-7)
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

  it('maps the additional platform artwork from the top atlas rows', () => {
    const frames = spriteAtlases.joust.frames
    expect(frames.platformAlternate).toEqual({ x: 79, y: 1, width: 94, height: 14 })
    expect(frames.platformSpawnWide).toEqual({ x: 185, y: 1, width: 176, height: 18 })
    expect(frames.platformSpawnNarrow).toEqual({ x: 373, y: 1, width: 126, height: 16 })
    expect(frames.platformSpawnTall).toEqual({ x: 1, y: 29, width: 116, height: 22 })
    expect(frames.platformNoSpawn).toEqual({ x: 233, y: 29, width: 128, height: 16 })
    expect(frames.platformShortRight).toEqual({ x: 371, y: 29, width: 32, height: 26 })
    expect(frames.platformShortLeft).toEqual({ x: 413, y: 29, width: 32, height: 24 })
    expect(frames.platformLong).toEqual({ x: 0, y: 67, width: 374, height: 4 })
  })

  it('cycles through the three pterodactyl flight poses', () => {
    const frames = ['pterodactylFlyLeft1', 'pterodactylFlyLeft2', 'pterodactylFlyLeft3']
      .map((name) => spriteAtlases.joust.frames[name])
    expect(getPterodactylFrame(0)).toEqual(frames[0])
    expect(getPterodactylFrame(1)).toEqual(frames[1])
    expect(getPterodactylFrame(2)).toEqual(frames[2])
    expect(getPterodactylFrame(3)).toEqual(frames[0])
  })

  it('maps the six egg poses to their named atlas crops', () => {
    const poses = ['stationary', 'rollingRight', 'rollingLeft', 'hatching1', 'hatching2', 'hatching3'] as const
    for (const pose of poses) {
      expect(getEggFrame(pose)).toEqual(spriteAtlases.joust.frames[`egg${pose[0].toUpperCase()}${pose.slice(1)}`])
    }
  })

  it('selects directional rolling and all three hatch poses from egg motion and timer', () => {
    expect(getEggSpritePose(0, 2)).toBe('stationary')
    expect(getEggSpritePose(1, 2)).toBe('stationary')
    expect(getEggSpritePose(8, 2)).toBe('rollingRight')
    expect(getEggSpritePose(-8, 2)).toBe('rollingLeft')
    expect(getEggSpritePose(0, 0.6)).toBe('hatching1')
    expect(getEggSpritePose(0, 0.4)).toBe('hatching2')
    expect(getEggSpritePose(0, 0.2)).toBe('hatching3')
  })

  it('uses rolling poses for egg velocity inherited from a rider moving slowly', () => {
    expect(getEggSpritePose(4, 2)).toBe('rollingRight')
    expect(getEggSpritePose(-4, 2)).toBe('rollingLeft')
  })

  it('animates both rolling lean frames in the direction of travel', () => {
    expect(getEggSpritePose(4, 2, 0)).toBe('rollingRight')
    expect(getEggSpritePose(4, 2, 0.13)).toBe('stationary')
    expect(getEggSpritePose(4, 2, 0.26)).toBe('rollingLeft')
    expect(getEggSpritePose(4, 2, 0.39)).toBe('stationary')
    expect(getEggSpritePose(-4, 2, 0)).toBe('rollingLeft')
    expect(getEggSpritePose(-4, 2, 0.13)).toBe('stationary')
    expect(getEggSpritePose(-4, 2, 0.26)).toBe('rollingRight')
    expect(getEggSpritePose(-4, 2, 0.39)).toBe('stationary')
  })

  it('maps bitmap-font glyphs from their atlas rows and honors pixel overrides', () => {
    const glyphs = spriteAtlases.joust.font!.glyphs
    const rows = spriteAtlases.joust.font!.rows
    expect(getFontGlyph('0')).toEqual(glyphs['0'])
    expect(getFontGlyph('4')).toEqual(glyphs['4'])
    expect(getFontGlyph('W')).toEqual(glyphs.W)
    expect(getFontGlyph('F')).toEqual(glyphs.F)
    expect(getFontGlyph('>')).toEqual({ x: 507, y: 389, width: 10, height: 10 })
    expect(getFontGlyph('000')).toEqual(glyphs['000'])
    expect(glyphs['000'].y).toBe(rows[3].y)
    expect(getFontGlyph('a')).toEqual(getFontGlyph('A'))
    expect(getFontGlyph('~')).toBeUndefined()
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