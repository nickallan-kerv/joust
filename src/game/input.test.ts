import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createKeyboardInput } from './input'

type KeyboardHandler = (event: KeyboardEvent) => void

let handlers: Map<string, KeyboardHandler>
let originalWindow: PropertyDescriptor | undefined
let addEventListener: ReturnType<typeof vi.fn>
let removeEventListener: ReturnType<typeof vi.fn>

function dispatch(type: string, code: string, repeat = false) {
  const preventDefault = vi.fn()
  handlers.get(type)?.({ code, repeat, preventDefault } as unknown as KeyboardEvent)
  return preventDefault
}

beforeEach(() => {
  handlers = new Map()
  originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  addEventListener = vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
    handlers.set(type, listener as unknown as KeyboardHandler)
  })
  removeEventListener = vi.fn((type: string) => {
    handlers.delete(type)
  })

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { addEventListener, removeEventListener },
  })
})

afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
  else Reflect.deleteProperty(globalThis, 'window')
})

describe('keyboard input', () => {
  it('emits one flap per Z press, not for held-key repeat events', () => {
    const input = createKeyboardInput()

    dispatch('keydown', 'Space')
    expect(input.read().flap).toBe(false)
    dispatch('keyup', 'Space')

    dispatch('keydown', 'KeyZ')
    expect(input.read().flap).toBe(true)
    expect(input.read().flap).toBe(false)

    dispatch('keydown', 'KeyZ', true)
    expect(input.read().flap).toBe(false)

    dispatch('keyup', 'KeyZ')
    dispatch('keydown', 'KeyZ')
    expect(input.read().flap).toBe(true)
  })

  it('holds movement while a direction key is down and prevents arrow scrolling', () => {
    const input = createKeyboardInput()
    const preventDefault = dispatch('keydown', 'ArrowLeft')

    expect(preventDefault).toHaveBeenCalledOnce()
    expect(input.read().left).toBe(true)
    expect(input.read().left).toBe(true)

    dispatch('keyup', 'ArrowLeft')
    expect(input.read().left).toBe(false)
  })

  it('latches facing for a direction tap released before the simulation reads it', () => {
    const input = createKeyboardInput()
    dispatch('keydown', 'ArrowLeft')
    dispatch('keyup', 'ArrowLeft')

    const tap = input.read()
    expect(tap.left).toBe(false)
    expect(tap.facingPress).toBe(-1)
    expect(input.read().facingPress).toBeUndefined()
  })

  it('emits Enter as a one-shot start event', () => {
    const input = createKeyboardInput()
    dispatch('keydown', 'Enter')
    expect(input.read().start).toBe(true)
    expect(input.read().start).toBe(false)
    dispatch('keydown', 'Enter', true)
    expect(input.read().start).toBe(false)
  })

  it('clears held and queued input on blur and detaches listeners on disposal', () => {
    const input = createKeyboardInput()
    dispatch('keydown', 'ArrowRight')
    dispatch('keydown', 'KeyZ')
    input.clear()
    expect(input.read()).toEqual({ left: false, right: false, flap: false, start: false })

    input.dispose()
    expect(removeEventListener).toHaveBeenCalledTimes(2)
    expect(handlers.size).toBe(0)
  })
})