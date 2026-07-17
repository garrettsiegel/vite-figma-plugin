export const MIN_SHAPE_COUNT = 1
export const MAX_SHAPE_COUNT = 100
export const DEFAULT_SHAPE_COUNT = 5

export type UIMessage =
  { type: 'create-shapes'; count: number } | { type: 'cancel' }

export type PluginMessage =
  { type: 'shapes-created'; count: number } | { type: 'shapes-creation-failed' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isValidShapeCount(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_SHAPE_COUNT &&
    value <= MAX_SHAPE_COUNT
  )
}

export function normalizeShapeCount(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_SHAPE_COUNT
  }

  return Math.min(MAX_SHAPE_COUNT, Math.max(MIN_SHAPE_COUNT, Math.trunc(value)))
}

export function normalizeShapeCountInput(value: string): number {
  const parsedValue = value.trim() === '' ? Number.NaN : Number(value)
  return normalizeShapeCount(parsedValue)
}

export function isUIMessage(value: unknown): value is UIMessage {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return false
  }

  if (value.type === 'cancel') {
    return true
  }

  return value.type === 'create-shapes' && isValidShapeCount(value.count)
}

export function isPluginMessage(value: unknown): value is PluginMessage {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return false
  }

  if (value.type === 'shapes-creation-failed') {
    return true
  }

  return value.type === 'shapes-created' && isValidShapeCount(value.count)
}
