import { describe, expect, it } from 'vitest'
import { ErrorCode, toolError, toolOk, isToolError, type ToolErrorEntry } from './errors'

describe('errors', () => {
  it('toolOk wraps data', () => {
    const r = toolOk({ x: 1 })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data).toEqual({ x: 1 })
    }
  })

  it('toolError wraps code + errors[]', () => {
    const r = toolError(ErrorCode.E_PARSE, [{ line: 2, column: 3, message: 'oops' }])
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.code).toBe('E_PARSE')
      expect(r.errors[0]).toMatchObject({ line: 2, column: 3 })
    }
  })

  it('isToolError narrows the union', () => {
    const r = toolError(ErrorCode.E_INTERNAL, [{ message: 'x' }])
    expect(isToolError(r)).toBe(true)
  })
})

describe('ToolErrorEntry structured fields', () => {
  it('accepts code, context, and suggestion on a tool-error entry', () => {
    const entry: ToolErrorEntry = {
      code: 'E_UNKNOWN_CHART_TYPE',
      path: 'chart',
      message: 'Unknown chart type "bar"',
      context: { got: 'bar', knownTypes: ['bar-vertical'] },
      suggestion: 'bar-vertical',
    }
    const r = toolError(ErrorCode.E_SEMANTIC, [entry])
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors[0]!.code).toBe('E_UNKNOWN_CHART_TYPE')
      expect(r.errors[0]!.context).toEqual({ got: 'bar', knownTypes: ['bar-vertical'] })
      expect(r.errors[0]!.suggestion).toBe('bar-vertical')
    }
  })
})
