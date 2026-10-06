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
  materializeTimer: number
  lavaGrab?: { trollX: number; age: number }
  lavaTrollWarning?: { trollX: number; age: number }
  lavaTrollAttempted?: boolean
}

export interface Player extends Bird {
  score: number
  lives: number
}

export interface Enemy extends Bird {
  id: number
  kind: 'rider' | 'pterodactyl'
  hatchLevel: number
  flightDirection?: -1 | 1
  flightTimer?: number
  flightDecision?: number
  groundedTime?: number
  attackClimbing?: boolean
  mountArrivalX?: number
  mountArrivalDirection?: -1 | 1
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

export interface MountDeparture {
  x: number
  y: number
  facing: -1 | 1
  mountClass: 'player' | 'bounder' | 'hunter' | 'pterodactyl'
  age: number
}

export type PlatformSpriteName =
  | 'platformStandard'
  | 'platformCover'
  | 'platformAlternate'
  | 'platformSpawnWide'
  | 'platformSpawnNarrow'
  | 'platformSpawnTall'
  | 'platformNoSpawn'
  | 'platformShortRight'
  | 'platformShortLeft'
  | 'platformLong'

export interface Platform {
  x: number
  y: number
  width: number
  height: number
  burnsAway?: boolean
  sprite?: PlatformSpriteName
  spawnMarkerArt?: boolean
  dissolveTimer?: number
}

export interface GameState {
  mode: GameMode
  time: number
  wave: number
  waveDelay: number
  player: Player
  enemies: Enemy[]
  eggs: Egg[]
  mountDepartures: MountDeparture[]
  playerRespawnTimer: number
  platforms: Platform[]
  lavaSurfaceY: number
  lavaRiseStarted: boolean
  lavaBurnProgress: number
  message: string
  messageTimer: number
  nextEnemyId: number
  nextEggId: number
  timeSinceKill: number
}

export interface InputState {
  left: boolean
  right: boolean
  facingPress?: -1 | 1
  flap: boolean
  start: boolean
}