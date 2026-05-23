import { describe, expect, it } from 'vitest'
import { samples } from '@blueprint-chart/lib'
import { listSampleResources, readSampleResource } from './samples'

describe('samples resources', () => {
  it('lists one resource per lib sample', () => {
    const list = listSampleResources()
    expect(list.length).toBe(samples.length)
  })

  it('reads a sample as text/plain bpc', () => {
    const first = listSampleResources()[0]!
    const doc = readSampleResource(first.uri)
    expect(doc.mimeType).toBe('text/plain')
    expect(doc.text.length).toBeGreaterThan(20)
  })

  it('throws on unknown sample id', () => {
    expect(() => readSampleResource('bpc://samples/does-not-exist')).toThrow()
  })
})
