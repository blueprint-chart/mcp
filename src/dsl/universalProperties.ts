import { listThemes } from '@blueprint-chart/lib'

/**
 * Metadata for a universal chart property (type, description, and optional
 * choice list). Consumed by `describeChartType` to build the properties list.
 */
export interface UniversalPropertyMeta {
  type: string
  description?: string
  choices?: string[]
}

/**
 * Chart properties the library reads from its frame and layout code instead of
 * registering per chart type, so they are absent from `getChartOptions` yet
 * valid on every chart. Mirrors the library's own frame-key allowlist, minus
 * the editor player chrome and the scene-level `type` switch.
 *
 * Anything `getChartOptions` already registers belongs there and must not be
 * repeated here: the axis, grid and value-label families are per-type options,
 * and listing them here advertised axis properties on pie and donut.
 */
export const UNIVERSAL_PROPERTY_META: Readonly<Record<string, UniversalPropertyMeta>> = {
  // Attribution metadata
  title: { type: 'text', description: 'Chart title' },
  description: { type: 'text', description: 'Chart description / subtitle' },
  byline: { type: 'text', description: 'Byline / author credit' },
  source: { type: 'text', description: 'Data source label' },
  sourceUrl: { type: 'text', description: 'Data source URL' },
  note: { type: 'text', description: 'Footer note' },

  // Sort directives
  sort: { type: 'select', description: 'Sort direction for categories', choices: ['ascending', 'descending', 'none'] },
  sortMode: { type: 'select', description: 'Sort mode for grouped/stacked charts', choices: ['total', 'within-groups', 'none'] },

  // Frame
  theme: { type: 'select', description: 'Visual theme name', choices: listThemes().map(t => t.name) },
  padding: { type: 'text', description: 'Frame padding (CSS shorthand)' },
  transparentBackground: { type: 'boolean', description: 'Draw the chart without the frame background' },

  // Layout. `sizing` takes the DSL vocabulary, which is deliberately not the
  // renderer's FrameSizing names: `sizing = standard` is not valid DSL.
  sizing: { type: 'select', description: 'How the frame sizes itself horizontally', choices: ['responsive', 'fixed', 'max-width'] },
  fixedWidth: { type: 'text', description: 'Frame width in pixels, when sizing is "fixed"' },
  maxWidth: { type: 'text', description: 'Maximum frame width in pixels, when sizing is "max-width"' },
  heightMode: { type: 'select', description: 'How the frame height is decided', choices: ['auto', 'fixed', 'aspect-ratio'] },
  fixedHeight: { type: 'text', description: 'Frame height in pixels, when heightMode is "fixed"' },
  aspectRatio: { type: 'text', description: 'Aspect ratio (width / height), when heightMode is "aspect-ratio"' },
}

/**
 * Property keys recognized at the chart top level regardless of chart type.
 *
 * Derived from the keys of UNIVERSAL_PROPERTY_META to keep membership and
 * metadata in lockstep. Validation does not read this set: `validateAst`
 * delegates the allowlist to the library's `validateChart`.
 */
export const UNIVERSAL_PROPERTIES: ReadonlySet<string> = new Set(Object.keys(UNIVERSAL_PROPERTY_META))

export function isUniversalProperty(key: string): boolean {
  return UNIVERSAL_PROPERTIES.has(key)
}
