import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SHAPE_COUNT,
  MAX_SHAPE_COUNT,
  MIN_SHAPE_COUNT,
  isPluginMessage,
  isUIMessage,
  normalizeShapeCount,
  normalizeShapeCountInput,
} from '../../shared/messages'

describe('normalizeShapeCount', () => {
  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'uses the default for non-finite input %s',
    (value) => {
      expect(normalizeShapeCount(value)).toBe(DEFAULT_SHAPE_COUNT)
    },
  )

  it.each([
    [-10, MIN_SHAPE_COUNT],
    [0, MIN_SHAPE_COUNT],
    [1, MIN_SHAPE_COUNT],
    [1.9, MIN_SHAPE_COUNT],
    [5.9, 5],
    [MAX_SHAPE_COUNT, MAX_SHAPE_COUNT],
    [MAX_SHAPE_COUNT + 1, MAX_SHAPE_COUNT],
  ])('normalizes %s to %s', (value, expected) => {
    expect(normalizeShapeCount(value)).toBe(expected)
  })
})

describe('normalizeShapeCountInput', () => {
  it.each([
    ['', DEFAULT_SHAPE_COUNT],
    ['   ', DEFAULT_SHAPE_COUNT],
    ['not-a-number', DEFAULT_SHAPE_COUNT],
    ['0', MIN_SHAPE_COUNT],
    ['1.9', MIN_SHAPE_COUNT],
    ['5.9', 5],
    ['101', MAX_SHAPE_COUNT],
  ])('normalizes %j to %s', (value, expected) => {
    expect(normalizeShapeCountInput(value)).toBe(expected)
  })
})

describe('isUIMessage', () => {
  it.each([
    { type: 'cancel' },
    { type: 'create-shapes', count: MIN_SHAPE_COUNT },
    { type: 'create-shapes', count: MAX_SHAPE_COUNT },
  ])('accepts %j', (message) => {
    expect(isUIMessage(message)).toBe(true)
  })

  it.each([
    null,
    [],
    {},
    { type: 'unknown' },
    { type: 'create-shapes' },
    { type: 'create-shapes', count: Number.NaN },
    { type: 'create-shapes', count: 1.5 },
    { type: 'create-shapes', count: MIN_SHAPE_COUNT - 1 },
    { type: 'create-shapes', count: MAX_SHAPE_COUNT + 1 },
  ])('rejects %j', (message) => {
    expect(isUIMessage(message)).toBe(false)
  })
})

describe('isPluginMessage', () => {
  it.each([
    { type: 'shapes-created', count: MIN_SHAPE_COUNT },
    { type: 'shapes-created', count: MAX_SHAPE_COUNT },
    { type: 'shapes-creation-failed' },
  ])('accepts %j', (message) => {
    expect(isPluginMessage(message)).toBe(true)
  })

  it.each([
    null,
    [],
    {},
    { type: 'unknown' },
    { type: 'shapes-created' },
    { type: 'shapes-created', count: 1.5 },
    { type: 'shapes-created', count: MIN_SHAPE_COUNT - 1 },
    { type: 'shapes-created', count: MAX_SHAPE_COUNT + 1 },
  ])('rejects %j', (message) => {
    expect(isPluginMessage(message)).toBe(false)
  })
})
