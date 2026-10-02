import { describe, expect, it, vi } from 'vitest'
import { createGameAudio } from './audio'

function createMockAudioContext() {
  const oscillator = {
    type: 'sine' as OscillatorType,
    frequency: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }
  const gain = {
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  }
  const context = {
    currentTime: 2,
    destination: {},
    createOscillator: vi.fn(() => oscillator),
    createGain: vi.fn(() => gain),
    resume: vi.fn().mockResolvedValue(undefined),
  }

  return { context, oscillator, gain }
}

describe('synthesized game audio', () => {
  it('creates and schedules an oscillator for a gameplay cue', () => {
    const audioContext = createMockAudioContext()
    const createContext = vi.fn(() => audioContext.context as unknown as AudioContext)
    const audio = createGameAudio(createContext)

    audio.play('flap')

    expect(createContext).toHaveBeenCalledOnce()
    expect(audioContext.context.createOscillator).toHaveBeenCalledOnce()
    expect(audioContext.context.createGain).toHaveBeenCalledOnce()
    expect(audioContext.oscillator.connect).toHaveBeenCalledWith(audioContext.gain)
    expect(audioContext.gain.connect).toHaveBeenCalledWith(audioContext.context.destination)
    expect(audioContext.oscillator.start).toHaveBeenCalledWith(2)
    expect(audioContext.oscillator.stop).toHaveBeenCalled()
    expect(audioContext.context.resume).toHaveBeenCalledOnce()
  })

  it('reuses one audio context for multiple cues', () => {
    const audioContext = createMockAudioContext()
    const createContext = vi.fn(() => audioContext.context as unknown as AudioContext)
    const audio = createGameAudio(createContext)

    audio.play('clash')
    audio.play('egg')

    expect(createContext).toHaveBeenCalledOnce()
    expect(audioContext.context.createOscillator).toHaveBeenCalledTimes(2)
  })

  it('does not throw when Web Audio is unavailable', () => {
    vi.stubGlobal('AudioContext', undefined)
    const audio = createGameAudio()

    expect(() => audio.play('flap')).not.toThrow()

    vi.unstubAllGlobals()
  })

  it('creates the browser AudioContext when no test factory is supplied', () => {
    const audioContext = createMockAudioContext()
    const nativeConstructor = vi.fn(function MockAudioContext() {
      return audioContext.context as unknown as AudioContext
    })
    vi.stubGlobal('AudioContext', nativeConstructor)
    const audio = createGameAudio()

    audio.play('egg')

    expect(nativeConstructor).toHaveBeenCalledOnce()
    expect(audioContext.context.createOscillator).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })
})