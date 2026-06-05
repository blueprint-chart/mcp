import { describe, it, expect, afterEach } from 'vitest'
import { getEditorBaseUrl, getDocsBaseUrl, getPublicBaseUrl } from './editorConfig'

afterEach(() => {
  delete process.env.BLUEPRINT_CHART_EDITOR_URL
  delete process.env.BLUEPRINT_CHART_DOCS_URL
  delete process.env.MCP_PUBLIC_URL
})

describe('getEditorBaseUrl', () => {
  it('returns undefined when unset', () => {
    expect(getEditorBaseUrl()).toBeUndefined()
  })

  it('returns undefined when blank/whitespace', () => {
    process.env.BLUEPRINT_CHART_EDITOR_URL = '   '
    expect(getEditorBaseUrl()).toBeUndefined()
  })

  it('strips trailing slashes and trims', () => {
    process.env.BLUEPRINT_CHART_EDITOR_URL = '  https://blueprintchart.com//  '
    expect(getEditorBaseUrl()).toBe('https://blueprintchart.com')
  })
})

describe('getDocsBaseUrl', () => {
  it('returns undefined when unset', () => {
    expect(getDocsBaseUrl()).toBeUndefined()
  })

  it('normalizes a set value', () => {
    process.env.BLUEPRINT_CHART_DOCS_URL = 'https://docs.blueprintchart.com/'
    expect(getDocsBaseUrl()).toBe('https://docs.blueprintchart.com')
  })
})

describe('getPublicBaseUrl', () => {
  it('returns undefined when unset', () => {
    expect(getPublicBaseUrl()).toBeUndefined()
  })

  it('normalizes trailing slashes', () => {
    process.env.MCP_PUBLIC_URL = 'https://mcp.blueprintchart.com///'
    expect(getPublicBaseUrl()).toBe('https://mcp.blueprintchart.com')
  })
})
