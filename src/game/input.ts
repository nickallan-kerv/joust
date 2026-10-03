import type { InputState } from './types'

export function createKeyboardInput() {
  const pressedKeys = new Set<string>()
  const preventedKeys = new Set(['ArrowLeft', 'ArrowRight', 'Space', 'KeyZ'])
  let startQueued = false
  let flapQueued = false
  let facingQueued: -1 | 1 | undefined

  function onKeyDown(event: KeyboardEvent) {
    if (preventedKeys.has(event.code)) event.preventDefault()
    if (event.code === 'Enter' && !event.repeat) startQueued = true
    if (event.code === 'KeyZ' && !event.repeat && !pressedKeys.has('KeyZ')) flapQueued = true
    if (!event.repeat && (event.code === 'ArrowLeft' || event.code === 'KeyA')) facingQueued = -1
    if (!event.repeat && (event.code === 'ArrowRight' || event.code === 'KeyD')) facingQueued = 1
    pressedKeys.add(event.code)
  }

  function onKeyUp(event: KeyboardEvent) {
    pressedKeys.delete(event.code)
  }

  function clear() {
    pressedKeys.clear()
    startQueued = false
    flapQueued = false
    facingQueued = undefined
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  return {
    read(): InputState {
      const start = startQueued
      const flap = flapQueued
      const facingPress = facingQueued
      startQueued = false
      flapQueued = false
      facingQueued = undefined
      const state: InputState = {
        left: pressedKeys.has('ArrowLeft') || pressedKeys.has('KeyA'),
        right: pressedKeys.has('ArrowRight') || pressedKeys.has('KeyD'),
        flap,
        start,
      }
      if (facingPress !== undefined) state.facingPress = facingPress
      return state
    },
    clear,
    dispose() {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      clear()
    },
  }
}