import './sprite-inspector.css'
import { spriteAnimations, spriteAtlases, validateSpriteDefinitions, type Facing, type MountClass, type SpriteFrame } from '../src/game/sprite-data'

if (import.meta.hot) {
  import.meta.hot.accept('../src/game/sprite-data', () => {})
}

type DocumentKey = 'atlas-joust' | 'animation-player' | 'animation-bounder' | 'animation-hunter'
type EditorMode = 'animation' | 'atlas' | 'font'
const PLATFORM_SPRITE_NAMES = [
  'platformStandard',
  'platformCover',
  'platformAlternate',
  'platformSpawnWide',
  'platformSpawnNarrow',
  'platformSpawnTall',
  'platformNoSpawn',
  'platformShortRight',
  'platformShortLeft',
  'platformLong',
] as const
type PlatformSpriteName = typeof PLATFORM_SPRITE_NAMES[number]
type InspectorMount = MountClass | 'pterodactyl' | 'egg' | PlatformSpriteName
type EditPath = string[]

interface UndoEntry {
  document: DocumentKey
  path: EditPath
  value: number
}

interface SaveEditorSession {
  mode: EditorMode
  mount: InspectorMount
  facing: Facing
  motion: 'walk' | 'fly'
  frameIndex: number
  isPlaying: boolean
  resumeAfterEdit: boolean
  zoom: number
  grid: boolean
  composition: boolean
  atlasFrame: string
  documents: Partial<Record<DocumentKey, unknown>>
}

const SAVE_EDITOR_SESSION_KEY = 'joust-sprite-inspector-save-session'
const draftAtlases = structuredClone(spriteAtlases)
const draftAnimations = structuredClone(spriteAnimations)
const originalDocuments: Record<DocumentKey, unknown> = {
  'atlas-joust': structuredClone(draftAtlases.joust),
  'animation-player': structuredClone(draftAnimations.player),
  'animation-bounder': structuredClone(draftAnimations.bounder),
  'animation-hunter': structuredClone(draftAnimations.hunter),
}
const modifiedDocuments = new Set<DocumentKey>()
const undoEntries: UndoEntry[] = []
const pendingInputEdits = new WeakSet<HTMLInputElement>()
const atlas = draftAtlases.joust
const canvas = document.querySelector<HTMLCanvasElement>('#sprite-canvas')!
const context = canvas.getContext('2d')!
const controls = {
  viewport: document.querySelector<HTMLElement>('#canvas-viewport')!,
  animation: document.querySelector<HTMLElement>('#animation-controls')!,
  atlas: document.querySelector<HTMLElement>('#atlas-controls')!,
  font: document.querySelector<HTMLElement>('#font-controls')!,
  mount: document.querySelector<HTMLSelectElement>('#mount-select')!,
  motion: document.querySelector<HTMLElement>('#motion-controls')!,
  motionLabel: document.querySelector<HTMLElement>('#motion-label')!,
  facing: document.querySelector<HTMLElement>('#facing-controls')!,
  facingLabel: document.querySelector<HTMLElement>('#facing-label')!,
  compositionRow: document.querySelector<HTMLElement>('#composition-row')!,
  frameSelect: document.querySelector<HTMLSelectElement>('#atlas-frame-select')!,
  fontGlyph: document.querySelector<HTMLSelectElement>('#font-glyph-select')!,
  frameRange: document.querySelector<HTMLInputElement>('#frame-range')!,
  frameCounter: document.querySelector<HTMLOutputElement>('#frame-counter')!,
  zoom: document.querySelector<HTMLInputElement>('#zoom-range')!,
  zoomValue: document.querySelector<HTMLOutputElement>('#zoom-value')!,
  imageFile: document.querySelector<HTMLInputElement>('#image-file')!,
  imageStatus: document.querySelector<HTMLElement>('#image-status')!,
  emptyState: document.querySelector<HTMLElement>('#empty-state')!,
  grid: document.querySelector<HTMLInputElement>('#grid-toggle')!,
  composition: document.querySelector<HTMLInputElement>('#composition-toggle')!,
  play: document.querySelector<HTMLButtonElement>('#play-toggle')!,
  title: document.querySelector<HTMLElement>('#preview-title')!,
  kicker: document.querySelector<HTMLElement>('#preview-kicker')!,
  kind: document.querySelector<HTMLElement>('#asset-kind')!,
  detailsTitle: document.querySelector<HTMLElement>('#details-title')!,
  details: document.querySelector<HTMLElement>('#mapping-details')!,
  sourceFile: document.querySelector<HTMLElement>('#source-file')!,
  compositionNote: document.querySelector<HTMLElement>('#composition-note')!,
  dimensions: document.querySelector<HTMLElement>('#image-dimensions')!,
  atlasReference: document.querySelector<HTMLElement>('#atlas-reference')!,
  previewNote: document.querySelector<HTMLElement>('#preview-note')!,
  undo: document.querySelector<HTMLButtonElement>('#undo-button')!,
  save: document.querySelector<HTMLButtonElement>('#save-button')!,
  editorStatus: document.querySelector<HTMLElement>('#editor-status')!,
}

let mode: EditorMode = 'animation'
let facing: Facing = 1
let motion: 'walk' | 'fly' = 'walk'
let frameIndex = 0
let isPlaying = true
let image: HTMLImageElement | undefined
let objectUrl: string | undefined
let lastFrameTime = 0
let resumeTimer: number | undefined
let shouldResumeAfterEdit = false

function updatePlaybackButton() {
  controls.play.textContent = isPlaying ? 'Pause' : 'Play'
  controls.play.setAttribute('aria-label', isPlaying ? 'Pause animation' : 'Play animation')
}

function pauseForMappingEdit() {
  if (!isPlaying) return
  shouldResumeAfterEdit = true
  isPlaying = false
  updatePlaybackButton()
}

function resumeAfterEditDelay() {
  if (!shouldResumeAfterEdit) return
  if (resumeTimer !== undefined) window.clearTimeout(resumeTimer)
  resumeTimer = window.setTimeout(() => {
    resumeTimer = undefined
    if (shouldResumeAfterEdit) {
      isPlaying = true
      updatePlaybackButton()
    }
    shouldResumeAfterEdit = false
  }, 500)
}

function selectedMount(): InspectorMount {
  return controls.mount.value as InspectorMount
}

function isPlatformSprite(mount = selectedMount()): mount is PlatformSpriteName {
  return PLATFORM_SPRITE_NAMES.includes(mount as PlatformSpriteName)
}

function pterodactylFrames(): SpriteFrame[] {
  return Object.keys(atlas.frames)
    .filter((name) => name.startsWith('pterodactylFlyLeft'))
    .sort()
    .map((name) => atlas.frames[name])
}

const eggFrameNames = [
  'eggStationary',
  'eggRollingRight',
  'eggRollingLeft',
  'eggHatching1',
  'eggHatching2',
  'eggHatching3',
]
const eggPoseLabels = ['Stationary', 'Rolling right', 'Rolling left', 'Hatching 1', 'Hatching 2', 'Hatching 3']

function eggFrames(): SpriteFrame[] {
  return eggFrameNames.map((name) => atlas.frames[name])
}

function formatFrameName(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function getDocument(key: DocumentKey): unknown {
  if (key === 'atlas-joust') return draftAtlases.joust
  return draftAnimations[key.replace('animation-', '') as MountClass]
}

function getPathValue(document: unknown, path: EditPath): unknown {
  let value = document as Record<string, unknown>
  for (const segment of path) value = value[segment] as Record<string, unknown>
  return value
}

function setPathValue(document: unknown, path: EditPath, value: number) {
  let target = document as Record<string, unknown>
  for (const segment of path.slice(0, -1)) target = target[segment] as Record<string, unknown>
  target[path[path.length - 1]] = value
}

function updateModifiedDocument(key: DocumentKey) {
  if (JSON.stringify(getDocument(key)) === JSON.stringify(originalDocuments[key])) {
    modifiedDocuments.delete(key)
  } else {
    modifiedDocuments.add(key)
  }
  controls.save.disabled = modifiedDocuments.size === 0
  controls.undo.disabled = undoEntries.length === 0
  controls.editorStatus.textContent = modifiedDocuments.size === 0
    ? 'No unsaved edits'
    : `${modifiedDocuments.size} JSON file${modifiedDocuments.size === 1 ? '' : 's'} changed`
}

function captureSaveEditorSession(): SaveEditorSession {
  return {
    mode,
    mount: selectedMount(),
    facing,
    motion,
    frameIndex,
    isPlaying,
    resumeAfterEdit: shouldResumeAfterEdit,
    zoom: Number(controls.zoom.value),
    grid: controls.grid.checked,
    composition: controls.composition.checked,
    atlasFrame: controls.frameSelect.value,
    documents: Object.fromEntries([...modifiedDocuments].map((key) => [key, structuredClone(getDocument(key))])),
  }
}

function restoreSaveEditorSession() {
  const serialized = sessionStorage.getItem(SAVE_EDITOR_SESSION_KEY)
  if (!serialized) return
  sessionStorage.removeItem(SAVE_EDITOR_SESSION_KEY)

  try {
    const state = JSON.parse(serialized) as SaveEditorSession
    if (!['animation', 'atlas', 'font'].includes(state.mode) || ![
      'player', 'bounder', 'hunter', 'pterodactyl', 'egg', ...PLATFORM_SPRITE_NAMES,
    ].includes(state.mount)) return

    for (const key of Object.keys(originalDocuments) as DocumentKey[]) {
      const document = state.documents[key]
      if (document && typeof document === 'object') {
        Object.assign(getDocument(key) as object, structuredClone(document))
      }
    }
    validateSpriteDefinitions(Object.values(draftAtlases), Object.values(draftAnimations))

    mode = state.mode
    facing = state.facing
    motion = state.mount === 'pterodactyl' ? 'fly' : state.motion
    frameIndex = state.frameIndex
    isPlaying = state.isPlaying || state.resumeAfterEdit
    controls.mount.value = state.mount
    controls.zoom.value = String(state.zoom)
    controls.zoomValue.textContent = `${state.zoom}×`
    controls.grid.checked = state.grid
    controls.composition.checked = state.composition
    if (state.atlasFrame && [...controls.frameSelect.options].some((option) => option.value === state.atlasFrame)) {
      controls.frameSelect.value = state.atlasFrame
    }
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
      button.setAttribute('aria-selected', String(button.dataset.mode === mode))
    }
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-motion]')) {
      button.setAttribute('aria-pressed', String(button.dataset.motion === motion))
    }
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-facing]')) {
      button.setAttribute('aria-pressed', String(Number(button.dataset.facing) === facing))
    }
    updatePlaybackButton()

    for (const key of Object.keys(state.documents) as DocumentKey[]) updateModifiedDocument(key)
    if (modifiedDocuments.size === 0) {
      const savedCount = Object.keys(state.documents).length
      controls.editorStatus.textContent = `Restored after Save; ${savedCount} JSON file${savedCount === 1 ? '' : 's'} backed up`
    }
  } catch {
    sessionStorage.removeItem(SAVE_EDITOR_SESSION_KEY)
  }
}

function selectedStripName() {
  return `${motion}${facing > 0 ? 'Right' : 'Left'}` as keyof typeof draftAnimations.player.strips
}

function selectedAnimationFrame(): SpriteFrame {
  if (isPlatformSprite()) return atlas.frames[selectedMount()]
  if (selectedMount() === 'egg') return eggFrames()[frameIndex]
  if (selectedMount() === 'pterodactyl') return pterodactylFrames()[frameIndex]
  const animation = draftAnimations[selectedMount()]
  const strip = animation.strips[selectedStripName()]
  return {
    x: strip.x + frameIndex % strip.count * strip.frameWidth,
    y: strip.y,
    width: strip.frameWidth,
    height: strip.frameHeight,
  }
}

function selectedRiderFrame(): SpriteFrame {
  const animation = draftAnimations[selectedMount()]
  const direction = facing < 0 ? 'left' : 'right'
  return draftAtlases[animation.atlas].frames[animation.riderFrames[direction]]
}

function selectedAtlasFrame(): SpriteFrame {
  return atlas.frames[controls.frameSelect.value]
}

function selectedFontGlyph(): SpriteFrame {
  return atlas.font!.glyphs[controls.fontGlyph.value]
}

function isEntireAtlasSelected(): boolean {
  return controls.frameSelect.value === '__atlas__'
}

function currentFrame(): SpriteFrame {
  if (mode === 'animation') return selectedAnimationFrame()
  if (mode === 'font') return selectedFontGlyph()
  return isEntireAtlasSelected()
    ? { x: 0, y: 0, width: atlas.width, height: atlas.height }
    : selectedAtlasFrame()
}

function updateFrameControls() {
  if (mode === 'atlas' || (mode === 'animation' && isPlatformSprite())) {
    controls.frameRange.disabled = true
    controls.frameCounter.textContent = 'STATIC'
    return
  }
  const mount = selectedMount()
  const count = mount === 'egg'
    ? eggFrames().length
    : mount === 'pterodactyl'
      ? pterodactylFrames().length
      : draftAnimations[mount].strips[selectedStripName()].count
  frameIndex = Math.min(frameIndex, count - 1)
  controls.frameRange.disabled = false
  controls.frameRange.max = String(count - 1)
  controls.frameRange.value = String(frameIndex)
  controls.frameCounter.textContent = `${String(frameIndex + 1).padStart(2, '0')} / ${String(count).padStart(2, '0')}`
}

function updateControlVisibility() {
  controls.animation.hidden = mode !== 'animation'
  controls.atlas.hidden = mode !== 'atlas'
  controls.font.hidden = mode !== 'font'
  const mount = selectedMount()
  const fixedAnimation = mode === 'animation' && (mount === 'pterodactyl' || mount === 'egg' || isPlatformSprite(mount))
  const egg = mode === 'animation' && mount === 'egg'
  const platform = mode === 'animation' && isPlatformSprite(mount)
  controls.motion.hidden = fixedAnimation
  controls.motionLabel.hidden = fixedAnimation
  controls.facing.hidden = egg || platform
  controls.facingLabel.hidden = egg || platform
  controls.compositionRow.hidden = fixedAnimation
  controls.composition.disabled = mode !== 'animation' || fixedAnimation
  controls.play.disabled = mode !== 'animation' || platform
  updateFrameControls()
}

interface MappingRow {
  label: string
  value?: string
  summary?: string
  editor?: { document: DocumentKey; path: EditPath; value: number; min: number; max?: number }
}

function updateDetails() {
  const rows: MappingRow[] = []
  const addEdit = (label: string, value: number, document: DocumentKey, path: EditPath, min = 0, max?: number) => {
    rows.push({ label, editor: { document, path, value, min, max } })
  }
  const addSummary = (label: string, value: string, summary?: string) => rows.push({ label, value, summary })

  if (mode === 'animation' && isPlatformSprite()) {
    const frameName = selectedMount() as PlatformSpriteName
    const frame = selectedAnimationFrame()
    const framePath = ['frames', frameName]
    addSummary('Sprite', formatFrameName(frameName))
    addSummary('Start', `(${frame.x}, ${frame.y})`, 'start')
    addEdit('Start X', frame.x, 'atlas-joust', [...framePath, 'x'])
    addEdit('Start Y', frame.y, 'atlas-joust', [...framePath, 'y'])
    addSummary('Stop, exclusive', `(${frame.x + frame.width}, ${frame.y + frame.height})`, 'stop')
    addSummary('Crop size', `${frame.width} × ${frame.height} px`, 'frame-size')
    addEdit('Crop width', frame.width, 'atlas-joust', [...framePath, 'width'], 1)
    addEdit('Crop height', frame.height, 'atlas-joust', [...framePath, 'height'], 1)
    controls.sourceFile.textContent = 'atlas-joust.json'
    controls.detailsTitle.textContent = formatFrameName(frameName)
    controls.compositionNote.hidden = true
  } else if (mode === 'animation' && (selectedMount() === 'pterodactyl' || selectedMount() === 'egg')) {
    const frames = pterodactylFrames()
    const egg = selectedMount() === 'egg'
    const activeFrames = egg ? eggFrames() : frames
    const frame = selectedAnimationFrame()
    const frameName = egg ? eggFrameNames[frameIndex] : `pterodactylFlyLeft${frameIndex + 1}`
    const framePath = ['frames', frameName]
    addSummary(egg ? 'Sequence' : 'Animation', egg ? eggPoseLabels[frameIndex] : `Fly ${facing > 0 ? 'right' : 'left'}`)
    addSummary('Frame', frameName)
    addSummary('Current frame', `${frameIndex} of ${activeFrames.length - 1}`)
    addSummary('Start', `(${frame.x}, ${frame.y})`, 'start')
    addEdit('Start X', frame.x, 'atlas-joust', [...framePath, 'x'])
    addEdit('Start Y', frame.y, 'atlas-joust', [...framePath, 'y'])
    addSummary('Stop, exclusive', `(${frame.x + frame.width}, ${frame.y + frame.height})`, 'stop')
    addSummary('Frame size', `${frame.width} × ${frame.height} px`, 'frame-size')
    addEdit('Frame width', frame.width, 'atlas-joust', [...framePath, 'width'], 1)
    addEdit('Frame height', frame.height, 'atlas-joust', [...framePath, 'height'], 1)
    addSummary('Source rect', `${frame.x}, ${frame.y}, ${frame.width} × ${frame.height} px`, 'source-rect')
    controls.sourceFile.textContent = 'atlas-joust.json'
    controls.detailsTitle.textContent = egg ? `Egg ${eggPoseLabels[frameIndex].toLowerCase()}` : `Pterodactyl fly ${facing > 0 ? 'right' : 'left'}`
    controls.compositionNote.hidden = true
  } else if (mode === 'animation') {
    const mount = selectedMount()
    const animation = draftAnimations[mount]
    const stripName = selectedStripName()
    const strip = animation.strips[stripName]
    const animationDocument = `animation-${mount}` as DocumentKey
    const direction = facing < 0 ? 'left' : 'right'
    const stripPath = ['strips', stripName]
    const frame = selectedAnimationFrame()

    addSummary('Strip', stripName)
    addSummary('Start', `(${strip.x}, ${strip.y})`, 'start')
    addEdit('Start X', strip.x, animationDocument, [...stripPath, 'x'])
    addEdit('Start Y', strip.y, animationDocument, [...stripPath, 'y'])
    addSummary('Stop, exclusive', `(${strip.x + strip.frameWidth * strip.count}, ${strip.y + strip.frameHeight})`, 'stop')
    addSummary('Frame size', `${strip.frameWidth} × ${strip.frameHeight} px`, 'frame-size')
    addEdit('Frame width', strip.frameWidth, animationDocument, [...stripPath, 'frameWidth'], 1)
    addEdit('Frame height', strip.frameHeight, animationDocument, [...stripPath, 'frameHeight'], 1)
    addEdit('Frame count', strip.count, animationDocument, [...stripPath, 'count'], 1)
    addSummary('Current frame', `${frameIndex} of ${strip.count - 1}`)
    addSummary('Source rect', `${frame.x}, ${frame.y}, ${frame.width} × ${frame.height} px`, 'source-rect')
    if (motion === 'walk') addEdit('Idle walk frame', animation.idleWalkFrame, animationDocument, ['idleWalkFrame'], 0, strip.count - 1)

    if (controls.composition.checked) {
      const riderName = animation.riderFrames[direction]
      const rider = draftAtlases[animation.atlas].frames[riderName]
      const riderPath = ['frames', riderName]
      addSummary('Rider frame', riderName, 'rider-frame')
      addEdit('Rider X', rider.x, 'atlas-joust', [...riderPath, 'x'])
      addEdit('Rider Y', rider.y, 'atlas-joust', [...riderPath, 'y'])
      addEdit('Rider crop width', rider.width, 'atlas-joust', [...riderPath, 'width'], 1)
      addEdit('Rider crop height', rider.height, 'atlas-joust', [...riderPath, 'height'], 1)
      addEdit('Rider offset X', animation.riderOffset[direction], animationDocument, ['riderOffset', direction], -1000)
      addEdit('Rider offset Y', animation.composition.riderYOffset, animationDocument, ['composition', 'riderYOffset'], -1000)
      addEdit('Mount draw width', animation.composition.mountSize.width, animationDocument, ['composition', 'mountSize', 'width'], 1)
      addEdit('Mount draw height', animation.composition.mountSize.height, animationDocument, ['composition', 'mountSize', 'height'], 1)
      addEdit('Rider draw width', animation.composition.riderSize.width, animationDocument, ['composition', 'riderSize', 'width'], 1)
      addEdit('Rider draw height', animation.composition.riderSize.height, animationDocument, ['composition', 'riderSize', 'height'], 1)
    }
    controls.sourceFile.textContent = `animation-${mount}.json + atlas-joust.json`
    controls.detailsTitle.textContent = `${mount[0].toUpperCase()}${mount.slice(1)} ${motion} ${facing > 0 ? 'right' : 'left'}`
    controls.compositionNote.hidden = mount !== 'player'
  } else if (mode === 'font') {
    const character = controls.fontGlyph.value
    const glyph = selectedFontGlyph()
    const glyphPath = ['font', 'glyphs', character]
    addSummary('Character', character === '000' ? '000 · single glyph' : character)
    addSummary('Start', `(${glyph.x}, ${glyph.y})`, 'start')
    addEdit('Start X', glyph.x, 'atlas-joust', [...glyphPath, 'x'])
    addEdit('Start Y', glyph.y, 'atlas-joust', [...glyphPath, 'y'])
    addSummary('Stop, exclusive', `(${glyph.x + glyph.width}, ${glyph.y + glyph.height})`, 'stop')
    addSummary('Crop size', `${glyph.width} × ${glyph.height} px`, 'frame-size')
    addEdit('Crop width', glyph.width, 'atlas-joust', [...glyphPath, 'width'], 1)
    addEdit('Crop height', glyph.height, 'atlas-joust', [...glyphPath, 'height'], 1)
    controls.sourceFile.textContent = 'atlas-joust.json'
    controls.detailsTitle.textContent = character === '000' ? 'Glyph 000 · single character' : `Glyph ${character}`
    controls.compositionNote.hidden = true
  } else if (isEntireAtlasSelected()) {
    const animationFrameCount = Object.values(draftAnimations).reduce((total, animation) => (
      total + Object.values(animation.strips).reduce((count, strip) => count + strip.count, 0)
    ), 0)
    addSummary('Static crops', String(Object.keys(atlas.frames).length))
    addSummary('Animation frames', String(animationFrameCount))
    addEdit('Atlas width', atlas.width, 'atlas-joust', ['width'], 1)
    addEdit('Atlas height', atlas.height, 'atlas-joust', ['height'], 1)
    controls.sourceFile.textContent = 'atlas-joust.json + animation-*.json'
    controls.detailsTitle.textContent = 'Entire Atlas'
    controls.compositionNote.hidden = true
  } else {
    const frameName = controls.frameSelect.value
    const frame = selectedAtlasFrame()
    const framePath = ['frames', frameName]
    addSummary('Start', `(${frame.x}, ${frame.y})`, 'start')
    addEdit('Start X', frame.x, 'atlas-joust', [...framePath, 'x'])
    addEdit('Start Y', frame.y, 'atlas-joust', [...framePath, 'y'])
    addSummary('Stop, exclusive', `(${frame.x + frame.width}, ${frame.y + frame.height})`, 'stop')
    addSummary('Crop size', `${frame.width} × ${frame.height} px`, 'frame-size')
    addEdit('Crop width', frame.width, 'atlas-joust', [...framePath, 'width'], 1)
    addEdit('Crop height', frame.height, 'atlas-joust', [...framePath, 'height'], 1)
    controls.sourceFile.textContent = 'atlas-joust.json'
    controls.detailsTitle.textContent = formatFrameName(frameName)
    controls.compositionNote.hidden = true
  }

  controls.details.classList.toggle(
    'rider-layout',
    mode === 'animation' && controls.composition.checked && !['egg', 'pterodactyl'].includes(selectedMount()) && !isPlatformSprite(),
  )
  controls.details.replaceChildren(...rows.flatMap((row) => {
    const term = document.createElement('dt')
    const description = document.createElement('dd')
    term.textContent = row.label
    if (row.summary) description.dataset.summary = row.summary
    if (row.editor) {
      const editor = row.editor
      const editorDocument = getDocument(editor.document)
      const stepper = document.createElement('div')
      stepper.className = 'number-editor'
      const input = document.createElement('input')
      input.type = 'number'
      input.step = '1'
      input.min = String(row.editor.min)
      if (row.editor.max !== undefined) input.max = String(row.editor.max)
      input.value = String(row.editor.value)
      input.className = 'mapping-input'
      input.setAttribute('aria-label', row.label)
      const decrement = document.createElement('button')
      decrement.type = 'button'
      decrement.className = 'step-button'
      decrement.textContent = '←'
      decrement.setAttribute('aria-label', `Decrease ${row.label} by one`)
      decrement.title = `Decrease ${row.label} by one`
      const increment = document.createElement('button')
      increment.type = 'button'
      increment.className = 'step-button'
      increment.textContent = '→'
      increment.setAttribute('aria-label', `Increase ${row.label} by one`)
      increment.title = `Increase ${row.label} by one`
      const stepBy = (amount: number) => {
        const previous = Number(getPathValue(editorDocument, editor.path))
        const next = previous + amount
        if (next < editor.min || (editor.max !== undefined && next > editor.max)) return
        pauseForMappingEdit()
        undoEntries.push({ document: editor.document, path: editor.path, value: previous })
        setPathValue(editorDocument, editor.path, next)
        input.value = String(next)
        input.dataset.previous = String(next)
        updateModifiedDocument(editor.document)
        updateMappingSummaries()
        render(false)
        resumeAfterEditDelay()
      }
      decrement.addEventListener('click', () => stepBy(-1))
      increment.addEventListener('click', () => stepBy(1))
      for (const button of [decrement, increment]) {
        // Stop playback re-rendering the panel between pointerdown and click.
        button.addEventListener('pointerdown', pauseForMappingEdit)
        button.addEventListener('pointerup', resumeAfterEditDelay)
        button.addEventListener('pointercancel', resumeAfterEditDelay)
      }
      input.addEventListener('focus', () => {
        input.dataset.previous = String(getPathValue(editorDocument, editor.path))
        pauseForMappingEdit()
      })
      input.addEventListener('input', () => {
        if (!input.value || !Number.isFinite(input.valueAsNumber)) return
        pauseForMappingEdit()
        const previous = Number(input.dataset.previous)
        if (Number.isFinite(previous) && previous !== input.valueAsNumber && !pendingInputEdits.has(input)) {
          undoEntries.push({ document: editor.document, path: editor.path, value: previous })
          pendingInputEdits.add(input)
        }
        setPathValue(editorDocument, editor.path, input.valueAsNumber)
        if (editor.path[0] === 'idleWalkFrame') frameIndex = input.valueAsNumber
        updateModifiedDocument(editor.document)
        controls.undo.disabled = undoEntries.length === 0
        updateMappingSummaries()
        render(false)
        resumeAfterEditDelay()
      })
      input.addEventListener('change', () => {
        input.dataset.previous = input.value
        pendingInputEdits.delete(input)
        updateMappingSummaries()
      })
      stepper.append(decrement, input, increment)
      description.append(stepper)
    } else {
      description.textContent = row.value ?? ''
    }
    return [term, description]
  }))
}

function updateMappingSummaries() {
  const values: Record<string, string> = {}
  if (mode === 'animation' && isPlatformSprite()) {
    const frame = selectedAnimationFrame()
    values.start = `(${frame.x}, ${frame.y})`
    values.stop = `(${frame.x + frame.width}, ${frame.y + frame.height})`
    values['frame-size'] = `${frame.width} × ${frame.height} px`
  } else if (mode === 'animation' && (selectedMount() === 'pterodactyl' || selectedMount() === 'egg')) {
    const frame = selectedAnimationFrame()
    values.start = `(${frame.x}, ${frame.y})`
    values.stop = `(${frame.x + frame.width}, ${frame.y + frame.height})`
    values['frame-size'] = `${frame.width} × ${frame.height} px`
    values['source-rect'] = `${frame.x}, ${frame.y}, ${frame.width} × ${frame.height} px`
  } else if (mode === 'animation') {
    const animation = draftAnimations[selectedMount() as MountClass]
    const strip = animation.strips[selectedStripName()]
    const frame = selectedAnimationFrame()
    values.start = `(${strip.x}, ${strip.y})`
    values.stop = `(${strip.x + strip.frameWidth * strip.count}, ${strip.y + strip.frameHeight})`
    values['frame-size'] = `${strip.frameWidth} × ${strip.frameHeight} px`
    values['source-rect'] = `${frame.x}, ${frame.y}, ${frame.width} × ${frame.height} px`
  } else if (mode === 'font') {
    const glyph = selectedFontGlyph()
    values.start = `(${glyph.x}, ${glyph.y})`
    values.stop = `(${glyph.x + glyph.width}, ${glyph.y + glyph.height})`
    values['frame-size'] = `${glyph.width} × ${glyph.height} px`
  } else if (!isEntireAtlasSelected()) {
    const frame = selectedAtlasFrame()
    values.start = `(${frame.x}, ${frame.y})`
    values.stop = `(${frame.x + frame.width}, ${frame.y + frame.height})`
    values['frame-size'] = `${frame.width} × ${frame.height} px`
  }
  for (const [key, value] of Object.entries(values)) {
    const element = controls.details.querySelector<HTMLElement>(`[data-summary="${key}"]`)
    if (element) element.textContent = value
  }
}

function undoLastChange() {
  const entry = undoEntries.pop()
  if (!entry) return
  setPathValue(getDocument(entry.document), entry.path, entry.value)
  updateModifiedDocument(entry.document)
  controls.editorStatus.textContent = `Undid ${entry.path.at(-1)} edit`
  render()
  resumeAfterEditDelay()
}

async function saveEditedDocuments() {
  const keys = [...modifiedDocuments]
  if (keys.length === 0) return
  try {
    validateSpriteDefinitions(Object.values(draftAtlases), Object.values(draftAnimations))
  } catch (error) {
    controls.editorStatus.textContent = error instanceof Error ? error.message : 'Sprite mapping is invalid.'
    return
  }

  try {
    sessionStorage.setItem(SAVE_EDITOR_SESSION_KEY, JSON.stringify(captureSaveEditorSession()))
    controls.editorStatus.textContent = 'Saving JSON and creating backups…'
    const response = await fetch('/__sprite-inspector/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: keys.map((key) => ({ filename: `${key}.json`, contents: getDocument(key) })),
      }),
    })
    const result = await response.json() as { backups?: string[]; error?: string }
    if (!response.ok) throw new Error(result.error ?? `Save failed with status ${response.status}.`)
  } catch (error) {
    controls.editorStatus.textContent = `Save failed: ${error instanceof Error ? error.message : String(error)}`
    return
  }

  for (const key of keys) {
    originalDocuments[key] = structuredClone(getDocument(key))
    modifiedDocuments.delete(key)
  }
  undoEntries.length = 0
  controls.undo.disabled = true
  controls.save.disabled = true
  controls.editorStatus.textContent = `Saved ${keys.length} JSON file${keys.length === 1 ? '' : 's'}; .json.bak backup${keys.length === 1 ? '' : 's'} created`
  window.setTimeout(() => sessionStorage.removeItem(SAVE_EDITOR_SESSION_KEY), 5000)
}

function drawCrop(frame: SpriteFrame, x: number, y: number, width: number, height: number, mirror = false) {
  if (!image) return
  context.save()
  context.globalCompositeOperation = 'screen'
  context.imageSmoothingEnabled = false
  if (mirror) {
    context.translate(x + width, y)
    context.scale(-1, 1)
    context.drawImage(image, frame.x, frame.y, frame.width, frame.height, 0, 0, width, height)
  } else {
    context.drawImage(image, frame.x, frame.y, frame.width, frame.height, x, y, width, height)
  }
  context.restore()
}

function drawGrid(scale: number, insetX: number, insetY: number, width: number, height: number) {
  if (!controls.grid.checked) return
  context.save()
  context.strokeStyle = 'rgba(247, 242, 213, 0.25)'
  context.lineWidth = 1
  context.beginPath()
  for (let x = 0; x <= width; x += scale) {
    context.moveTo(insetX + x + 0.5, insetY)
    context.lineTo(insetX + x + 0.5, insetY + height)
  }
  for (let y = 0; y <= height; y += scale) {
    context.moveTo(insetX, insetY + y + 0.5)
    context.lineTo(insetX + width, insetY + y + 0.5)
  }
  context.stroke()
  context.restore()
}

function drawAtlasBounds(scale: number, insetX: number, insetY: number) {
  context.save()
  context.lineWidth = 1
  context.strokeStyle = 'rgba(233, 110, 75, 0.95)'
  for (const frame of Object.values(atlas.frames)) {
    context.strokeRect(insetX + frame.x * scale + 0.5, insetY + frame.y * scale + 0.5, frame.width * scale, frame.height * scale)
  }

  const classColors: Record<MountClass, string> = {
    player: 'rgba(217, 238, 101, 0.95)',
    bounder: 'rgba(111, 203, 183, 0.95)',
    hunter: 'rgba(227, 162, 99, 0.95)',
  }
  context.font = '10px "DM Mono", monospace'
  for (const [mount, animation] of Object.entries(draftAnimations) as Array<[MountClass, typeof draftAnimations[MountClass]]>) {
    context.strokeStyle = classColors[mount]
    for (const [stripName, strip] of Object.entries(animation.strips)) {
      for (let index = 0; index < strip.count; index += 1) {
        context.strokeRect(
          insetX + (strip.x + index * strip.frameWidth) * scale + 0.5,
          insetY + strip.y * scale + 0.5,
          strip.frameWidth * scale,
          strip.frameHeight * scale,
        )
      }
      const label = `${mount} ${stripName}`
      context.fillStyle = '#0d2522'
      context.fillRect(insetX + strip.x * scale, insetY + strip.y * scale - 12, context.measureText(label).width + 6, 11)
      context.fillStyle = classColors[mount]
      context.fillText(label, insetX + strip.x * scale + 3, insetY + strip.y * scale - 3)
    }
  }
  context.restore()
}

function drawPreview() {
  if (!image) return
  const scale = Number(controls.zoom.value)
  const mount = selectedMount()
  const animation = draftAnimations[mount === 'pterodactyl' || mount === 'egg' || isPlatformSprite(mount) ? 'player' : mount]
  const showComposition = mode === 'animation' && mount !== 'pterodactyl' && mount !== 'egg' && !isPlatformSprite(mount) && controls.composition.checked
  const compositionDirection = facing < 0 ? 'left' : 'right'
  const compositionOffsetX = animation.riderOffset[compositionDirection]
  const width = mode === 'animation' && showComposition
    ? Math.max(animation.composition.mountSize.width, animation.composition.riderSize.width + Math.abs(compositionOffsetX) * 2)
    : currentFrame().width
  const height = mode === 'animation' && showComposition
    ? Math.max(animation.composition.mountSize.height, animation.composition.riderSize.height) + Math.abs(animation.composition.riderYOffset)
    : currentFrame().height
  const inset = 64
  canvas.width = Math.max(controls.viewport.clientWidth, width * scale + inset * 2)
  canvas.height = Math.max(controls.viewport.clientHeight, height * scale + inset * 2)
  context.clearRect(0, 0, canvas.width, canvas.height)

  const centerX = canvas.width / 2
  const centerY = canvas.height / 2
  if (mode === 'animation' && showComposition) {
    const mountSize = animation.composition.mountSize
    drawCrop(selectedAnimationFrame(), centerX - mountSize.width * scale / 2, centerY - mountSize.height * scale / 2, mountSize.width * scale, mountSize.height * scale)

    const riderFrame = selectedRiderFrame()
    const riderSize = animation.composition.riderSize
    const riderX = centerX + compositionOffsetX * scale
    const riderY = centerY + animation.composition.riderYOffset * scale
    if ((animation.riderFacing === 'mount' ? facing : 1) < 0) {
      context.save()
      context.translate(riderX, riderY)
      context.scale(-1, 1)
      drawCrop(riderFrame, -riderSize.width * scale / 2, -riderSize.height * scale / 2, riderSize.width * scale, riderSize.height * scale)
      context.restore()
    } else {
      drawCrop(riderFrame, riderX - riderSize.width * scale / 2, riderY - riderSize.height * scale / 2, riderSize.width * scale, riderSize.height * scale)
    }
    drawGrid(scale, centerX - mountSize.width * scale / 2, centerY - mountSize.height * scale / 2, mountSize.width * scale, mountSize.height * scale)
  } else {
    const frame = currentFrame()
    const drawnWidth = frame.width * scale
    const drawnHeight = frame.height * scale
    drawCrop(frame, centerX - drawnWidth / 2, centerY - drawnHeight / 2, drawnWidth, drawnHeight, mode === 'animation' && mount === 'pterodactyl' && facing > 0)
    if (mode === 'atlas' && isEntireAtlasSelected()) {
      drawAtlasBounds(scale, centerX - drawnWidth / 2, centerY - drawnHeight / 2)
    } else {
      drawGrid(scale, centerX - drawnWidth / 2, centerY - drawnHeight / 2, drawnWidth, drawnHeight)
    }
  }
  controls.dimensions.textContent = `ATLAS ${atlas.width} × ${atlas.height}`
}

function updateStepperStates() {
  for (const editor of controls.details.querySelectorAll<HTMLElement>('.number-editor')) {
    const input = editor.querySelector<HTMLInputElement>('input')!
    const [decrement, increment] = editor.querySelectorAll<HTMLButtonElement>('button')
    decrement.disabled = input.valueAsNumber <= Number(input.min)
    increment.disabled = input.max !== '' && input.valueAsNumber >= Number(input.max)
  }
}

function render(refreshDetails = true) {
  updateControlVisibility()
  if (refreshDetails) updateDetails()
  updateStepperStates()
  drawPreview()
  controls.title.textContent = mode === 'animation'
    ? isPlatformSprite()
      ? formatFrameName(selectedMount())
      : selectedMount() === 'egg'
      ? `Egg ${eggPoseLabels[frameIndex].toLowerCase()}`
      : selectedMount() === 'pterodactyl' ? 'Pterodactyl fly' : `${selectedMount()[0].toUpperCase()}${selectedMount().slice(1)} ${motion}`
    : mode === 'font'
      ? controls.fontGlyph.value === '000' ? 'Glyph 000' : `Glyph ${controls.fontGlyph.value}`
      : isEntireAtlasSelected() ? 'Entire atlas' : 'Atlas crop'
  controls.kicker.textContent = mode === 'animation'
    ? isPlatformSprite()
      ? `PLATFORM / ${selectedMount().replace('platform', '').toUpperCase()}`
      : selectedMount() === 'egg'
      ? `EGG / ${eggPoseLabels[frameIndex].toUpperCase()}`
      : selectedMount() === 'pterodactyl'
        ? `PTERODACTYL / FLY / ${facing > 0 ? 'RIGHT' : 'LEFT'}`
        : `${selectedMount().toUpperCase()} / ${motion.toUpperCase()} / ${facing > 0 ? 'RIGHT' : 'LEFT'}`
    : mode === 'font'
      ? `FONT / PIXEL MAP / ${controls.fontGlyph.value}`
      : isEntireAtlasSelected() ? 'JOUST / FULL ATLAS MAP' : 'JOUST / NAMED ATLAS FRAME'
  controls.kind.textContent = mode.toUpperCase()
  controls.previewNote.textContent = mode === 'font'
    ? 'Glyph crop · nearest-neighbor scaling · pixel grid'
    : mode === 'atlas' && isEntireAtlasSelected()
      ? 'Mapped crops outlined by atlas and mount class'
      : mode === 'animation' && isPlatformSprite()
        ? 'Platform crop · nearest-neighbor scaling'
        : mode === 'animation' && selectedMount() === 'egg'
          ? 'Egg sequence · nearest-neighbor scaling'
          : mode === 'animation' && selectedMount() !== 'pterodactyl' && controls.composition.checked && selectedMount() !== 'player'
            ? 'Game composition · nearest-neighbor scaling'
            : 'Source pixels enlarged with nearest-neighbor scaling'
}

function setImage(source: string, label: string) {
  const nextImage = new Image()
  nextImage.onload = () => {
    image = nextImage
    controls.emptyState.hidden = true
    controls.imageStatus.textContent = `${label} · ${nextImage.naturalWidth} × ${nextImage.naturalHeight}`
    const dimensionsMatch = nextImage.naturalWidth === atlas.width && nextImage.naturalHeight === atlas.height
    controls.atlasReference.textContent = `${atlas.width} × ${atlas.height} px · ${dimensionsMatch ? 'image dimensions match' : `loaded image is ${nextImage.naturalWidth} × ${nextImage.naturalHeight} px`}`
    render()
  }
  nextImage.onerror = () => {
    image = undefined
    controls.imageStatus.textContent = `${label} · failed to load`
    controls.emptyState.hidden = false
    context.clearRect(0, 0, canvas.width, canvas.height)
  }
  nextImage.src = source
}

function changeFrame(step: number) {
  if (mode !== 'animation' || isPlatformSprite()) return
  const mount = selectedMount()
  const count = mount === 'egg'
    ? eggFrames().length
    : mount === 'pterodactyl'
      ? pterodactylFrames().length
      : draftAnimations[mount].strips[selectedStripName()].count
  frameIndex = (frameIndex + step + count) % count
  render()
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
  button.addEventListener('click', () => {
    mode = button.dataset.mode as EditorMode
    controls.zoom.value = mode === 'atlas' ? '1' : mode === 'font' ? '12' : '6'
    controls.zoomValue.textContent = `${controls.zoom.value}×`
    if (mode === 'atlas') controls.frameSelect.value = '__atlas__'
    if (mode === 'font') controls.grid.checked = true
    for (const tab of document.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
      tab.setAttribute('aria-selected', String(tab === button))
    }
    render()
  })
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-motion]')) {
  button.addEventListener('click', () => {
    motion = button.dataset.motion as 'walk' | 'fly'
    frameIndex = 0
    for (const option of document.querySelectorAll<HTMLButtonElement>('[data-motion]')) {
      option.setAttribute('aria-pressed', String(option === button))
    }
    render()
  })
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-facing]')) {
  button.addEventListener('click', () => {
    facing = Number(button.dataset.facing) as Facing
    frameIndex = 0
    for (const option of document.querySelectorAll<HTMLButtonElement>('[data-facing]')) {
      option.setAttribute('aria-pressed', String(option === button))
    }
    render()
  })
}

const entireAtlasOption = document.createElement('option')
entireAtlasOption.value = '__atlas__'
entireAtlasOption.textContent = 'Entire atlas'
controls.frameSelect.append(entireAtlasOption)
for (const name of Object.keys(atlas.frames)) {
  if (name.startsWith('glyph_')) continue
  const option = document.createElement('option')
  option.value = name
  option.textContent = formatFrameName(name)
  controls.frameSelect.append(option)
}
for (const character of Object.keys(atlas.font?.glyphs ?? {})) {
  const option = document.createElement('option')
  option.value = character
  option.textContent = character === '000' ? '000 · single glyph' : character === ' ' ? 'Space' : character
  controls.fontGlyph.append(option)
}

controls.mount.addEventListener('change', () => {
  frameIndex = 0
  if (selectedMount() === 'pterodactyl') {
    motion = 'fly'
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-motion]')) {
      button.setAttribute('aria-pressed', String(button.dataset.motion === motion))
    }
  }
  render()
})
controls.frameSelect.addEventListener('change', () => {
  controls.zoom.value = isEntireAtlasSelected() ? '1' : '6'
  controls.zoomValue.textContent = `${controls.zoom.value}×`
  render()
})
controls.fontGlyph.addEventListener('change', render)
controls.frameRange.addEventListener('input', () => {
  frameIndex = Number(controls.frameRange.value)
  render()
})
controls.zoom.addEventListener('input', () => {
  controls.zoomValue.textContent = `${controls.zoom.value}×`
  render()
})
controls.grid.addEventListener('change', render)
controls.composition.addEventListener('change', render)
controls.play.addEventListener('click', () => {
  if (resumeTimer !== undefined) window.clearTimeout(resumeTimer)
  resumeTimer = undefined
  shouldResumeAfterEdit = false
  isPlaying = !isPlaying
  updatePlaybackButton()
})
controls.undo.addEventListener('click', undoLastChange)
controls.save.addEventListener('click', saveEditedDocuments)
window.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    if (document.activeElement instanceof HTMLInputElement) document.activeElement.blur()
    undoLastChange()
  }
})
document.querySelector('#previous-frame')!.addEventListener('click', () => changeFrame(-1))
document.querySelector('#next-frame')!.addEventListener('click', () => changeFrame(1))
controls.imageFile.addEventListener('change', () => {
  const file = controls.imageFile.files?.[0]
  if (!file) return
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  objectUrl = URL.createObjectURL(file)
  setImage(objectUrl, file.name)
})

function animate(time: number) {
  if (isPlaying && mode === 'animation' && time - lastFrameTime >= 180) {
    lastFrameTime = time
    changeFrame(1)
  }
  requestAnimationFrame(animate)
}

restoreSaveEditorSession()
render()
setImage(atlas.image, 'Configured atlas')
requestAnimationFrame(animate)