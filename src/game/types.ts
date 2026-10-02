export type GameMode = 'title' | 'playing' | 'gameover'

export interface Bird {
  x: number
  y: number
  vx: number
  vy: number
  facing: -1 | 1
  flapCooldown: number
  collisionCooldown: number
  reboundTimer: number
  invulnerability: number
}

export interface Player extends Bird {
  score: number
  lives: number
}

export interface Enemy extends Bird {
  id: number
  kind: 'rider' | 'pterodactyl'
  hatchLevel: number
}

export interface Egg {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  timer: number
  hatchLevel: number
}

export interface Platform {
  x: number
  y: number
  width: number
  height: number
  burnsAway?: boolean
}

export interface GameState {
  mode: GameMode
  time: number
  wave: number
  waveDelay: number
  player: Player
  enemies: Enemy[]
  eggs: Egg[]
  platforms: Platform[]
  message: string
  messageTimer: number
  nextEnemyId: number
  nextEggId: number
  timeSinceKill: number
}

export interface InputState {
  left: boolean
  right: boolean
  flap: boolean
  start: boolean
}