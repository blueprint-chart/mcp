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
 * Static metadata for universal properties that are consumed by astToDefinition
 * directly rather than registered per chart type via getChartOptions. These
 * appear in chart DSL across all chart types (e.g. sort, title, colors).
 *
 * This is the single source of truth for both the metadata and the membership
 * of the universal-properties set. `UNIVERSAL_PROPERTIES` is derived from the
 * keys of this object so the two cannot drift apart.
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

  // Theme + palette (apply to every chart type)
  theme: { type: 'text', description: 'Visual theme name' },
  colorPalette: { type: 'text', description: 'Named color palette' },
  colors: { type: 'colors', description: 'Custom color list' },

  // Frame / layout
  padding: { type: 'text', description: 'Frame padding (CSS shorthand)' },
  background: { type: 'text', description: 'Background color' },
  frameSizing: { type: 'select', description: 'Frame sizing mode', choices: ['auto', 'standard', 'aspect-ratio'] },
  aspectRatio: { type: 'text', description: 'Aspect ratio (width / height)' },

  // Value-label toggles (shared across bar/column variants but used universally
  // in samples; per-type registry overrides when stricter)
  valueLabels: { type: 'boolean', description: 'Show value labels on bars/segments' },
  verticalLabelPosition: { type: 'select', description: 'Vertical axis label position', choices: ['auto', 'inside', 'outside', 'off'] },
  horizontalLabelPosition: { type: 'select', description: 'Horizontal axis label position', choices: ['auto', 'inside', 'outside', 'off'] },
  verticalGridStyle: { type: 'select', description: 'Vertical grid line style', choices: ['solid', 'dashed', 'dotted', 'none'] },
  horizontalGridStyle: { type: 'select', description: 'Horizontal grid line style', choices: ['solid', 'dashed', 'dotted', 'none'] },

  // TODO(lib): expose heightMode on area-stacked via getChartOptions
  heightMode: { type: 'text', description: 'Height mode for stacked area charts' },
}

/**
 * Property keys recognized at the chart top level regardless of chart type.
 *
 * Derived from the keys of UNIVERSAL_PROPERTY_META to keep membership and
 * metadata in lockstep. If a new universal property is added to the lib,
 * add it to UNIVERSAL_PROPERTY_META above. The sample-roundtrip test (added
 * in Task 6) catches drift: if a sample uses a key we don't know about, the
 * validator will error on it and that test will fail.
 */
export const UNIVERSAL_PROPERTIES: ReadonlySet<string> = new Set(Object.keys(UNIVERSAL_PROPERTY_META))

export function isUniversalProperty(key: string): boolean {
  return UNIVERSAL_PROPERTIES.has(key)
}
