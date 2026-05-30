import { describe, it, expect } from 'vitest'
import { parse } from '@blueprint-chart/lib'
import { extractFrameMetadata } from './frame'

describe('extractFrameMetadata', () => {
  it('pulls frame keys off the chart AST and strips surrounding quotes', () => {
    const ast = parse('chart bar-vertical {\n  title = "Hi"\n  source = "ICIJ"\n  data {\n    "A" = 1\n  }\n}\n')
    const frame = extractFrameMetadata(ast)
    expect(frame.title).toBe('Hi')
    expect(frame.source).toBe('ICIJ')
    expect(frame.byline).toBeUndefined()
  })
})
