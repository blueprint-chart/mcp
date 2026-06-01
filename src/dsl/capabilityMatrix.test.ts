import { describe, expect, it } from 'vitest'
import { samples } from '@blueprint-chart/lib'
import { canonicalChartType } from './chartTypes'
import { lookupCapability, statusOf } from './capabilityMatrix'

describe('capabilityMatrix', () => {
  it('defaults unknown cells to supported', () => {
    expect(statusOf(lookupCapability('bar-vertical', 'title'))).toBe('supported')
    expect(statusOf(lookupCapability('bar-vertical', 'some-unknown-key'))).toBe('supported')
  })

  it('marks sort on donut as inapplicable with a note', () => {
    const cell = lookupCapability('donut', 'sort')
    expect(statusOf(cell)).toBe('inapplicable')
    expect(cell.note).toBeTruthy()
  })

  it('marks colorize on donut as not-implemented (renderer ignores it today)', () => {
    expect(statusOf(lookupCapability('donut', 'colorize'))).toBe('not-implemented')
  })

  it('marks highlight inapplicable on single-series line/area, supported on multi-series (W1b)', () => {
    expect(statusOf(lookupCapability('line', 'highlight'))).toBe('inapplicable')
    expect(lookupCapability('line', 'highlight').note).toBeTruthy()
    expect(statusOf(lookupCapability('area', 'highlight'))).toBe('inapplicable')
    // multi-series variants got highlight dimming in W1b → default supported
    expect(statusOf(lookupCapability('line-multi', 'highlight'))).toBe('supported')
    expect(statusOf(lookupCapability('area-stacked', 'highlight'))).toBe('supported')
    expect(statusOf(lookupCapability('donut', 'highlight'))).toBe('supported')
  })

  it('does not flag any bundled sample property as inapplicable', () => {
    const offenders: string[] = []
    for (const s of samples) {
      const type = canonicalChartType(s.chartType) ?? s.chartType
      // matches bare-word "key =" property assignments (the only form bundled samples use)
      const keys = Array.from(s.dsl.matchAll(/^\s*([A-Za-z][A-Za-z0-9]*)\s*=/gm)).map(m => m[1]!)
      for (const key of keys) {
        if (statusOf(lookupCapability(type, key)) === 'inapplicable') {
          offenders.push(`${s.id} (${type}): ${key}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
