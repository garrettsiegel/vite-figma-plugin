import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type RectangleStub = RectangleNode & {
  remove: ReturnType<typeof vi.fn>
  resize: ReturnType<typeof vi.fn>
}

type RuntimeHarness = {
  closePlugin: ReturnType<typeof vi.fn>
  commitUndo: ReturnType<typeof vi.fn>
  createRectangle: ReturnType<typeof vi.fn>
  handler: (message: unknown) => void
  postMessage: ReturnType<typeof vi.fn>
  previousSelection: SceneNode[]
  rectangles: RectangleStub[]
  scrollAndZoomIntoView: ReturnType<typeof vi.fn>
  showUI: ReturnType<typeof vi.fn>
  runtime: PluginAPI
}

function createRectangleStub(): RectangleStub {
  let removed = false
  const rectangle = {
    cornerRadius: 0,
    fills: [],
    name: '',
    remove: vi.fn(() => {
      removed = true
    }),
    get removed() {
      return removed
    },
    resize: vi.fn(),
    x: 0,
    y: 0,
  }

  return rectangle as unknown as RectangleStub
}

async function loadRuntime(
  configure?: (runtime: Record<string, unknown>) => void,
): Promise<RuntimeHarness> {
  const rectangles: RectangleStub[] = []
  const previousSelection = [
    { removed: false, id: 'previous' } as unknown as SceneNode,
  ]
  const showUI = vi.fn()
  const postMessage = vi.fn()
  const closePlugin = vi.fn()
  const commitUndo = vi.fn()
  const scrollAndZoomIntoView = vi.fn()
  const createRectangle = vi.fn(() => {
    const rectangle = createRectangleStub()
    rectangles.push(rectangle)
    return rectangle
  })
  const ui: {
    onmessage?: (message: unknown) => void
    postMessage: ReturnType<typeof vi.fn>
  } = { postMessage }
  const currentPage = { selection: previousSelection }
  const runtime: Record<string, unknown> = {
    closePlugin,
    commitUndo,
    createRectangle,
    currentPage,
    showUI,
    ui,
    viewport: {
      center: { x: 500, y: 400 },
      scrollAndZoomIntoView,
    },
  }

  configure?.(runtime)
  vi.stubGlobal('figma', runtime)
  vi.stubGlobal('__html__', '<!doctype html><html></html>')
  await import('../../lib/code')

  if (!ui.onmessage) {
    throw new Error('Plugin did not register a UI message handler')
  }

  return {
    closePlugin,
    commitUndo,
    createRectangle,
    handler: ui.onmessage,
    postMessage,
    previousSelection,
    rectangles,
    runtime: runtime as unknown as PluginAPI,
    scrollAndZoomIntoView,
    showUI,
  }
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Figma sandbox runtime', () => {
  it('opens the compact themed UI', async () => {
    const harness = await loadRuntime()

    expect(harness.showUI).toHaveBeenCalledWith(
      '<!doctype html><html></html>',
      { width: 360, height: 440, themeColors: true },
    )
  })

  it.each([1, 100])('creates and reports %s rectangles', async (count) => {
    const harness = await loadRuntime()

    harness.handler({ type: 'create-shapes', count })

    expect(harness.createRectangle).toHaveBeenCalledTimes(count)
    expect(harness.runtime.currentPage.selection).toEqual(harness.rectangles)
    expect(harness.scrollAndZoomIntoView).toHaveBeenCalledWith(
      harness.rectangles,
    )
    expect(harness.commitUndo).toHaveBeenCalledOnce()
    expect(harness.postMessage).toHaveBeenCalledWith({
      type: 'shapes-created',
      count,
    })
  })

  it('centers the generated grid around the viewport', async () => {
    const harness = await loadRuntime()

    harness.handler({ type: 'create-shapes', count: 4 })

    expect(harness.rectangles.map(({ x, y }) => [x, y])).toEqual([
      [388, 288],
      [512, 288],
      [388, 412],
      [512, 412],
    ])
    for (const rectangle of harness.rectangles) {
      expect(rectangle.resize).toHaveBeenCalledWith(100, 100)
    }
  })

  it('commits each repeated Create as a separate undo operation', async () => {
    const harness = await loadRuntime()

    harness.handler({ type: 'create-shapes', count: 2 })
    harness.handler({ type: 'create-shapes', count: 3 })

    expect(harness.createRectangle).toHaveBeenCalledTimes(5)
    expect(harness.commitUndo).toHaveBeenCalledTimes(2)
    expect(harness.postMessage).toHaveBeenNthCalledWith(1, {
      type: 'shapes-created',
      count: 2,
    })
    expect(harness.postMessage).toHaveBeenNthCalledWith(2, {
      type: 'shapes-created',
      count: 3,
    })
  })

  it('ignores malformed and out-of-range messages', async () => {
    const harness = await loadRuntime()

    harness.handler(null)
    harness.handler({ type: 'unknown' })
    harness.handler({ type: 'create-shapes', count: 0 })
    harness.handler({ type: 'create-shapes', count: 101 })

    expect(harness.createRectangle).not.toHaveBeenCalled()
    expect(harness.postMessage).not.toHaveBeenCalled()
    expect(harness.commitUndo).not.toHaveBeenCalled()
  })

  it('closes the plugin on cancel', async () => {
    const harness = await loadRuntime()

    harness.handler({ type: 'cancel' })

    expect(harness.closePlugin).toHaveBeenCalledOnce()
    expect(harness.createRectangle).not.toHaveBeenCalled()
  })

  it('rolls back partial work and reports a safe failure', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const harness = await loadRuntime()
    harness.createRectangle
      .mockImplementationOnce(() => {
        const rectangle = createRectangleStub()
        harness.rectangles.push(rectangle)
        return rectangle
      })
      .mockImplementationOnce(() => {
        throw new Error('sensitive Figma detail')
      })

    harness.handler({ type: 'create-shapes', count: 2 })

    expect(harness.rectangles[0].remove).toHaveBeenCalledOnce()
    expect(harness.runtime.currentPage.selection).toEqual(
      harness.previousSelection,
    )
    expect(harness.commitUndo).not.toHaveBeenCalled()
    expect(harness.postMessage).toHaveBeenCalledWith({
      type: 'shapes-creation-failed',
    })
    expect(harness.postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.anything() }),
    )
    expect(consoleError).toHaveBeenCalled()
  })

  it('rolls back in reverse order when viewport work fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const harness = await loadRuntime()
    harness.scrollAndZoomIntoView.mockImplementationOnce(() => {
      throw new Error('viewport failed')
    })

    harness.handler({ type: 'create-shapes', count: 3 })

    const removalOrder = harness.rectangles.map(
      (rectangle) => rectangle.remove.mock.invocationCallOrder[0],
    )
    expect(removalOrder[2]).toBeLessThan(removalOrder[1])
    expect(removalOrder[1]).toBeLessThan(removalOrder[0])
    expect(harness.runtime.currentPage.selection).toEqual(
      harness.previousSelection,
    )
    expect(harness.commitUndo).not.toHaveBeenCalled()
    expect(harness.postMessage).toHaveBeenCalledWith({
      type: 'shapes-creation-failed',
    })
    expect(consoleError).toHaveBeenCalled()
  })
})
