import { describe, it, expect } from 'vitest'
import { formatToolResult } from '../toolContent'
import { toolOk, toolError, ErrorCode } from '../errors'
import { IssueSchema, FrameMetadataSchema, RenderUrlsSchema, ChartRecommendationSchema } from './outputSchemas'

describe('structuredContent plumbing', () => {
  it('attaches structuredContent on success and omits it on error', () => {
    const ok = formatToolResult(toolOk({ a: 1 }))
    expect(ok.structuredContent).toEqual({ a: 1 })
    const err = formatToolResult(toolError(ErrorCode.E_INPUT, [{ message: 'x' }]))
    expect(err.structuredContent).toBeUndefined()
    expect(err.isError).toBe(true)
  })
})

describe('shared sub-schemas parse representative data', () => {
  it('accepts well-formed values', () => {
    expect(() => IssueSchema.parse({ code: 'E_X', path: '', message: 'm' })).not.toThrow()
    expect(() => FrameMetadataSchema.parse({ title: 't' })).not.toThrow()
    expect(() => RenderUrlsSchema.parse({ png: 'p', svg: 's', bpc: 'b' })).not.toThrow()
    expect(() => ChartRecommendationSchema.parse({ chartType: 'line', label: 'Line', fitness: 'ideal', reason: 'r' })).not.toThrow()
  })
})
