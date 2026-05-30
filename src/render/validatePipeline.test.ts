import { describe, it, expect } from 'vitest'
import { validatePipeline } from './validatePipeline'
import { ErrorCode } from '../errors'

describe('validatePipeline', () => {
  it('returns ok with the parsed AST for a valid source', () => {
    const result = validatePipeline('chart bar-vertical {\n  data {\n    "A" = 1\n  }\n}\n')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.ast.chartType).toBe('bar-vertical')
    }
  })

  it('returns E_PARSE on a syntax error', () => {
    const result = validatePipeline('chart bar-vertical {')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe(ErrorCode.E_PARSE)
    }
  })

  it('returns E_SEMANTIC for an unknown chart type', () => {
    const result = validatePipeline('chart not-a-chart {\n  data {\n    "A" = 1\n  }\n}\n')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe(ErrorCode.E_SEMANTIC)
      expect(result.error.errors[0]?.suggestion).toBeDefined()
    }
  })

  it('returns E_RENDER when a render diagnostic fails (unresolved highlight)', () => {
    const result = validatePipeline('chart bar-vertical {\n  highlight "Z"\n  data {\n    "A" = 1\n  }\n}\n')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe(ErrorCode.E_RENDER)
    }
  })
})
