import type { ChartNode } from '@blueprint-chart/lib'
import { astToDefinition, resolveScene } from '@blueprint-chart/lib'
import { toLibSceneIndex } from './scenes'

export interface FrameMetadata {
  title?: string
  description?: string
  byline?: string
  source?: string
  sourceUrl?: string
  note?: string
}

const FRAME_KEYS = ['title', 'description', 'byline', 'source', 'sourceUrl', 'note'] as const

/**
 * Frame metadata for the scene that was actually rendered. The library folds a
 * scene's own attribution over the base frame, so reading the raw AST instead
 * would report the base chart's title for every scene.
 */
export function extractFrameMetadata(ast: ChartNode, scene?: number): FrameMetadata {
  const resolved = resolveScene(astToDefinition(ast), toLibSceneIndex(scene)).frame ?? {}
  const frame: FrameMetadata = {}
  for (const key of FRAME_KEYS) {
    const value = resolved[key]
    if (typeof value === 'string' && value !== '') {
      frame[key] = value
    }
  }
  return frame
}
