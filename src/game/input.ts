import type { InputState } from './types'

export function createKeyboardInput() {
  const pressedKeys = new Set<string>()
  const preventedKeys = new Set(['ArrowLeft', 'ArrowRight', 'Space'])
  let startQueued = false
  let flapQueued = false

  function onKeyDown(event: KeyboardEvent) {
    if (preventedKeys.has(event.code)) event.preventDefault()
    if (event.code === 'Enter' && !event.repeat) startQueued = true
    if (event.code === 'Space' && !event.repeat && !pressedKeys.has('Space')) flapQueued = true
    pressedKeys.add(event.code)
  }

  function onKeyUp(event: KeyboardEvent) {
    pressedKeys.delete(event.code)
  }

  function clear() {
    pressedKeys.clear()
    startQueued = false
    flapQueued = false
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  return {
    read(): InputState {
      const start = startQueued
      const flap = flapQueued
      startQueued = false
      flapQueued = false
      return {
        left: pressedKeys.has('ArrowLeft') || pressedKeys.has('KeyA'),
        right: pressedKeys.has('ArrowRight') || pressedKeys.has('KeyD'),
        flap,
        start,
      }
    },
    clear,
    dispose() {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      clear()
    },
  }
}