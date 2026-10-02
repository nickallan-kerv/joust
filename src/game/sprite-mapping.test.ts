import { describe, expect, it } from 'vitest'
import { getMountFrame, getRiderFrame, getRiderSpriteFacing } from './sprite-mapping'

describe('Joust sprite atlas mappings', () => {
  it('maps five player walk frames and two flight frames per direction', () => {
    expect(getMountFrame('player', 1, false, true, 0)).toEqual({ x: 378, y: 67, width: 42, height: 40 })
    expect(getMountFrame('player', 1, false, true, 4)).toEqual({ x: 546, y: 67, width: 42, height: 40 })
    expect(getMountFrame('player', -1, false, true, 0)).toEqual({ x: 84, y: 117, width: 42, height: 40 })
    expect(getMountFrame('player', 1, true, true, 1)).toEqual({ x: 42, y: 117, width: 42, height: 40 })
    expect(getMountFrame('player', -1, true, true, 1)).toEqual({ x: 336, y: 117, width: 42, height: 40 })
  })

  it('maps Bounder and Hunter animation strips separately', () => {
    expect(getMountFrame('bounder', 1, false, true, 0).y).toBe(117)
    expect(getMountFrame('bounder', 1, true, true, 0).y).toBe(167)
    expect(getMountFrame('hunter', 1, false, true, 0).y).toBe(167)
    expect(getMountFrame('hunter', 1, true, true, 0).y).toBe(217)
  })

  it('uses one static rider overlay rectangle per class', () => {
    expect(getRiderFrame('player', -1)).toEqual({ x: 530, y: 386, width: 12, height: 18 })
    expect(getRiderFrame('player', 1)).toEqual({ x: 530, y: 386, width: 12, height: 18 })
    expect(getRiderFrame('bounder', -1)).toEqual({ x: 108, y: 250, width: 34, height: 38 })
    expect(getRiderFrame('bounder', 1)).toEqual({ x: 70, y: 250, width: 34, height: 38 })
    expect(getRiderFrame('hunter', -1)).toEqual({ x: 182, y: 250, width: 34, height: 38 })
    expect(getRiderFrame('hunter', 1)).toEqual({ x: 144, y: 250, width: 34, height: 38 })
  })

  it('mirrors the single player standing crop but uses native enemy facing crops', () => {
    expect(getRiderSpriteFacing('player', -1)).toBe(-1)
    expect(getRiderSpriteFacing('player', 1)).toBe(1)
    expect(getRiderSpriteFacing('bounder', -1)).toBe(1)
    expect(getRiderSpriteFacing('hunter', -1)).toBe(1)
  })

  it('holds on a planted walking pose instead of cycling while idle', () => {
    expect(getMountFrame('bounder', 1, false, false, 0)).toEqual(
      getMountFrame('bounder', 1, false, false, 4),
    )
  })
})