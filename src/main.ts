import './style.css'
import { createGameAudio } from './game/audio'
import { createKeyboardInput } from './game/input'
import { renderGame } from './game/renderer'
import { createGameState, GAME_HEIGHT, GAME_WIDTH, stepGame } from './game/simulation'

function getCanvas(): HTMLCanvasElement {
  const element = document.querySelector<HTMLCanvasElement>('#gameCanvas')
  if (!element) throw new Error('Game canvas was not found.')
  return element
}

function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const canvasContext = canvas.getContext('2d')
  if (!canvasContext) throw new Error('Canvas rendering is unavailable.')
  return canvasContext
}

const canvas = getCanvas()
const context = getContext(canvas)

const game = createGameState()
const keyboard = createKeyboardInput()
const audio = createGameAudio()
const fixedStep = 1 / 60
let previousTime = 0
let accumulator = 0
let lastAccessibleState = ''

function updateAccessibleState() {
  const state = `Joust flight duel. Mode: ${game.mode}. Wave ${game.wave}; score ${game.player.score}; lives ${game.player.lives}; eggs ${game.eggs.length}. Use left and right arrows or A and D to steer, Space to flap once per press, and Enter to start or restart.`
  if (state === lastAccessibleState) return
  canvas.setAttribute('aria-label', state)
  lastAccessibleState = state
}

function resizeCanvas() {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(window.innerWidth * pixelRatio)
  canvas.height = Math.round(window.innerHeight * pixelRatio)
  context.setTransform(canvas.width / GAME_WIDTH, 0, 0, canvas.height / GAME_HEIGHT, 0, 0)
}

function frame(now: number) {
  const elapsed = previousTime === 0 ? 0 : Math.min((now - previousTime) / 1000, 0.08)
  previousTime = now
  accumulator += elapsed

  while (accumulator >= fixedStep) {
    const input = keyboard.read()
    const previousScore = game.player.score
    const previousLives = game.player.lives
    const previousMessage = game.message
    const canFlap = game.player.flapCooldown <= 0
    stepGame(game, input, fixedStep)
    updateAccessibleState()

    if (input.flap && canFlap && game.player.flapCooldown > 0) audio.play('flap')
    if (game.player.lives < previousLives) audio.play('lifeLost')
    else if (game.player.score > previousScore) {
      audio.play(game.message.startsWith('EGG COLLECTED') ? 'egg' : 'riderDown')
    } else if (game.message !== previousMessage) {
      if (game.message === 'LANCES CLASH') audio.play('clash')
      if (game.message === 'PTERODACTYL INBOUND') audio.play('pterodactyl')
    }

    accumulator -= fixedStep
  }

  renderGame(context, game)
  requestAnimationFrame(frame)
}

window.addEventListener('resize', resizeCanvas)
window.addEventListener('blur', keyboard.clear)

resizeCanvas()
canvas.focus({ preventScroll: true })
requestAnimationFrame(frame)
