import { describe, expect, it } from 'vitest'
import { ErrorCode, toolError, toolOk, isToolError } from './errors'

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
