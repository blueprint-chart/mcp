import type { ChartNode } from '@blueprint-chart/lib'

export interface FrameMetadata {
  title?: string
  description?: string
  byline?: string
  source?: string
  sourceUrl?: string
  note?: string
}

const FRAME_KEYS = ['title', 'description', 'byline', 'source', 'sourceUrl', 'note'] as const

export function extractFrameMetadata(ast: ChartNode): FrameMetadata {
  const frame: FrameMetadata = {}
  for (const prop of ast.properties ?? []) {
    if ((FRAME_KEYS as readonly string[]).includes(prop.key)) {
      frame[prop.key as keyof FrameMetadata] = String(prop.value).replace(/^"|"$/g, '')
    }
  }
  return frame
}
