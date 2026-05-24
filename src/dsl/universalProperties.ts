/**
 * Property keys recognized at the chart top level regardless of chart type.
 *
 * Derived by inspecting every `.bpc` in `@blueprint-chart/lib`'s samples and
 * collecting keys that appear across multiple chart types and are not in
 * any `getChartOptions(<type>)` result — these are the keys consumed by
 * `astToDefinition` directly rather than by per-type option resolution.
 *
 * If a new universal property is added to the lib, add it here too. The
 * sample-roundtrip test (added in Task 6) catches drift: if a sample uses a
 * key we don't know about, the validator will error on it and that test
 * will fail.
 */
export const UNIVERSAL_PROPERTIES: ReadonlySet<string> = new Set([
  // Attribution metadata
  'title',
  'description',
  'byline',
  'source',
  'sourceUrl',
  'note',

  // Sort directives
  'sort',
  'sortMode',

  // Theme + palette (apply to every chart type)
  'theme',
  'colorPalette',
  'colors',

  // Frame / layout
  'padding',
  'background',
  'frameSizing',
  'aspectRatio',

  // Value-label toggles (shared across bar/column variants but used universally
  // in samples; per-type registry overrides when stricter)
  'valueLabels',
  'verticalLabelPosition',
  'horizontalLabelPosition',
  'verticalGridStyle',
  'horizontalGridStyle',

  // TODO(lib): expose heightMode on area-stacked via getChartOptions
  'heightMode',
])

export function isUniversalProperty(key: string): boolean {
  return UNIVERSAL_PROPERTIES.has(key)
}
