/// <reference types="@figma/plugin-typings" />
import { isUIMessage, type PluginMessage } from '@shared/messages'

figma.showUI(__html__, {
  width: 360,
  height: 440,
  themeColors: true,
})

function createRectangles(count: number, nodes: SceneNode[]): SceneNode[] {
  const size = 100
  const gap = 24
  const columns = Math.min(5, Math.ceil(Math.sqrt(count)))
  const rows = Math.ceil(count / columns)
  const gridWidth = columns * size + (columns - 1) * gap
  const gridHeight = rows * size + (rows - 1) * gap
  const originX = figma.viewport.center.x - gridWidth / 2
  const originY = figma.viewport.center.y - gridHeight / 2

  for (let index = 0; index < count; index += 1) {
    const rectangle = figma.createRectangle()
    nodes.push(rectangle)
    rectangle.name = `Rectangle ${index + 1}`
    rectangle.x = originX + (index % columns) * (size + gap)
    rectangle.y = originY + Math.floor(index / columns) * (size + gap)
    rectangle.resize(size, size)
    rectangle.cornerRadius = 12
    rectangle.fills = [{ type: 'SOLID', color: { r: 1, g: 0.45, b: 0.1 } }]
  }

  return nodes
}

function rollbackCreate(nodes: SceneNode[], previousSelection: SceneNode[]) {
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    try {
      if (!nodes[index].removed) {
        nodes[index].remove()
      }
    } catch (error) {
      console.error('Failed to remove a partially created rectangle.', error)
    }
  }

  try {
    figma.currentPage.selection = previousSelection
  } catch (error) {
    console.error('Failed to restore the previous selection.', error)
  }
}

figma.ui.onmessage = (message: unknown) => {
  if (!isUIMessage(message)) {
    return
  }

  if (message.type === 'cancel') {
    figma.closePlugin()
    return
  }

  const previousSelection = [...figma.currentPage.selection]
  const nodes: SceneNode[] = []

  try {
    createRectangles(message.count, nodes)
    figma.currentPage.selection = nodes
    figma.viewport.scrollAndZoomIntoView(nodes)
    figma.commitUndo()
  } catch (error) {
    console.error('Failed to create rectangles.', error)
    rollbackCreate(nodes, previousSelection)

    const response: PluginMessage = { type: 'shapes-creation-failed' }
    figma.ui.postMessage(response)
    return
  }

  const response: PluginMessage = {
    type: 'shapes-created',
    count: nodes.length,
  }
  figma.ui.postMessage(response)
}
