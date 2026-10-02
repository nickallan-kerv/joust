export type SoundCue = 'flap' | 'clash' | 'riderDown' | 'egg' | 'pterodactyl' | 'lifeLost'

type AudioContextFactory = () => AudioContext

const CUE_TONES: Record<SoundCue, { start: number; end: number; duration: number; wave: OscillatorType; volume: number }> = {
  flap: { start: 270, end: 120, duration: 0.07, wave: 'triangle', volume: 0.055 },
  clash: { start: 190, end: 72, duration: 0.2, wave: 'square', volume: 0.07 },
  riderDown: { start: 330, end: 620, duration: 0.16, wave: 'triangle', volume: 0.055 },
  egg: { start: 520, end: 960, duration: 0.18, wave: 'sine', volume: 0.055 },
  pterodactyl: { start: 460, end: 220, duration: 0.32, wave: 'sawtooth', volume: 0.045 },
  lifeLost: { start: 260, end: 58, duration: 0.38, wave: 'triangle', volume: 0.075 },
}

export function createGameAudio(factory?: AudioContextFactory) {
  let audioContext: AudioContext | undefined

  return {
    play(cue: SoundCue) {
      if (!audioContext) {
        if (factory) audioContext = factory()
        else if (typeof AudioContext !== 'undefined') audioContext = new AudioContext()
        else return
      }

      const settings = CUE_TONES[cue]
      const startTime = audioContext.currentTime
      const oscillator = audioContext.createOscillator()
      const gain = audioContext.createGain()
      oscillator.type = settings.wave
      oscillator.frequency.setValueAtTime(settings.start, startTime)
      oscillator.frequency.exponentialRampToValueAtTime(settings.end, startTime + settings.duration)
      gain.gain.setValueAtTime(0.001, startTime)
      gain.gain.exponentialRampToValueAtTime(settings.volume, startTime + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + settings.duration)
      oscillator.connect(gain)
      gain.connect(audioContext.destination)
      oscillator.start(startTime)
      oscillator.stop(startTime + settings.duration + 0.01)
      void audioContext.resume().catch(() => undefined)
    },
  }
}