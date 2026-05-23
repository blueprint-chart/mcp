import { describe, expect, it } from 'vitest'
import { parse } from '@blueprint-chart/lib'
import { listDocs } from '@blueprint-chart/docs'

describe('smoke', () => {
  it('@blueprint-chart/lib parse() is importable', () => {
    expect(typeof parse).toBe('function')
  })

  it('@blueprint-chart/docs listDocs() returns entries', () => {
    expect(listDocs('handbook').length).toBeGreaterThan(0)
  })
})
