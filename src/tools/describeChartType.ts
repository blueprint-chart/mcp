import { z } from 'zod'
import { getChartOptions, samples } from '@blueprint-chart/lib'
import type { ChartOptionDef } from '@blueprint-chart/lib'
import { getDoc, listDocs } from '@blueprint-chart/docs'
import { aliasesFor, canonicalChartType, listCanonicalChartTypes } from '../dsl/chartTypes'
import { nearestSuggestion } from '../dsl/suggest'
import { UNIVERSAL_PROPERTIES, UNIVERSAL_PROPERTY_META } from '../dsl/universalProperties'
import { ErrorCode, toolError, toolOk, type ToolResult } from '../errors'
import { publicDocUrl } from '../resources/docsReader'
import { lookupCapability, statusOf, type CapabilityStatus } from '../dsl/capabilityMatrix'

export const DescribeChartTypeInputSchema = z.object({
  chartType: z.string().describe('A chart type or alias to describe, e.g. "bar-horizontal" or "line".'),
}).strict()
export type DescribeChartTypeInput = z.infer<typeof DescribeChartTypeInputSchema>

export const DescribeChartTypeOutputSchema = z.object({
  name: z.string().describe('Canonical chart-type identifier.'),
  aliases: z.array(z.string()).describe('Accepted alias names.'),
  summary: z.string().describe('One-line description.'),
  whenToUse: z.array(z.string()).describe('Situations this chart type fits.'),
  whenNotToUse: z.array(z.string()).describe('Situations to avoid it.'),
  properties: z.array(z.object({
    key: z.string().describe('Property name.'),
    type: z.string().describe('Property value type.'),
    description: z.string().optional().describe('What the property does.'),
    choices: z.array(z.string()).optional().describe('Allowed values, for enum properties.'),
    default: z.unknown().optional().describe('Default value, if any.'),
  })).describe('Supported chart properties.'),
  directives: z.array(z.object({
    name: z.string().describe('Directive name (e.g. highlight, annotation).'),
    status: z.enum(['supported', 'not-implemented', 'inapplicable']).describe('Capability status for this chart type (CapabilityStatus).'),
    description: z.string().describe('What the directive does.'),
    note: z.string().optional().describe('Caveat or detail.'),
  })).describe('Supported directives.'),
  dataShape: z.object({
    kind: z.enum(['single-series', 'multi-series', 'unknown']).describe('Expected data shape.'),
    example: z.string().describe('Example data block.'),
  }).describe('The data shape this chart type expects.'),
  exampleSlug: z.string().optional().describe('Id of a canonical sample for this type.'),
  docsUrl: z.string().optional().describe('Public docs URL.'),
})

export interface ChartTypeProperty {
  key: string
  type: string
  description?: string
  choices?: string[]
  default?: unknown
}

export interface ChartTypeDirective {
  name: string
  status: CapabilityStatus
  description: string
  note?: string
}

export interface ChartTypeDataShape {
  kind: 'single-series' | 'multi-series' | 'unknown'
  example: string
}

export interface DescribeChartTypeOutput {
  name: string
  aliases: string[]
  summary: string
  whenToUse: string[]
  whenNotToUse: string[]
  properties: ChartTypeProperty[]
  directives: ChartTypeDirective[]
  dataShape: ChartTypeDataShape
  exampleSlug?: string
  docsUrl?: string
}

function extractDocSections(name: string): {
  summary: string
  whenToUse: string[]
  whenNotToUse: string[]
  example: string
} {
  const entries = listDocs('charts')
  const entry = entries.find(e => e.slug === name)
  if (!entry) {
    return { summary: '', whenToUse: [], whenNotToUse: [], example: '' }
  }

  let content: string
  try {
    content = getDoc('charts', name).content
  }
  catch {
    return { summary: '', whenToUse: [], whenNotToUse: [], example: '' }
  }

  const summary = content.match(/^>\s*(.+)$/m)?.[1]?.trim() ?? ''

  const sectionBullets = (heading: string): string[] => {
    const re = new RegExp(`##\\s+${heading}[\\s\\S]*?(?=^##\\s+|\\Z)`, 'm')
    const block = content.match(re)?.[0] ?? ''
    return Array.from(block.matchAll(/^-\s+(.+)$/gm)).map(m => m[1]!.trim())
  }

  const example = content.match(/```bpc\n([\s\S]*?)```/)?.[1]?.trim() ?? ''

  return {
    summary,
    whenToUse: sectionBullets('When to use'),
    whenNotToUse: sectionBullets('When NOT to use'),
    example,
  }
}

function mapOption(opt: ChartOptionDef): ChartTypeProperty {
  const prop: ChartTypeProperty = {
    key: opt.key,
    type: String(opt.type),
  }
  if (opt.label) {
    prop.description = opt.label
  }
  if (opt.choices !== undefined && opt.choices.length > 0) {
    prop.choices = opt.choices.map(c => String(c.value))
  }
  if (opt.default !== undefined) {
    prop.default = opt.default
  }
  return prop
}

function buildProperties(canonical: string): ChartTypeProperty[] {
  const registeredOptions = getChartOptions(canonical)
  const registeredKeys = new Set(registeredOptions.map(o => o.key))
  const props: ChartTypeProperty[] = registeredOptions.map(mapOption)

  // Merge in universal properties that are not already present in the
  // per-type registry. This ensures discoverable properties like `sort`,
  // `title`, and `colors` appear for every chart type.
  for (const key of UNIVERSAL_PROPERTIES) {
    if (!registeredKeys.has(key)) {
      const meta = UNIVERSAL_PROPERTY_META[key]
      if (meta) {
        props.push({ key, ...meta })
      }
      else {
        props.push({ key, type: 'text' })
      }
    }
  }

  return props
}

function inferDataShape(name: string, example: string): ChartTypeDataShape {
  if (example.includes('series = ')) {
    return { kind: 'multi-series', example }
  }
  if (example.includes('data')) {
    return { kind: 'single-series', example }
  }
  return { kind: 'unknown', example: 'data {\n  "Label" = 1.0\n}' }
}

const DIRECTIVE_DOCS: ReadonlyArray<{ name: string, description: string }> = [
  { name: 'highlight', description: 'Emphasise one category/series, e.g. `highlight "China"`.' },
  { name: 'colorize', description: 'Override colour for a category/series, e.g. `colorize "China" { color = "#f00" }`.' },
  { name: 'annotation', description: 'Attach a callout to a data point, e.g. `annotation "2009" { text = "…" }`.' },
  { name: 'transform', description: 'Reshape data, e.g. `transform sort { column = "value" direction = descending }`.' },
  { name: 'scene', description: 'Add a narrative step that overrides data/properties, e.g. `scene "Step 2" { … }`.' },
]

function buildDirectives(canonical: string): ChartTypeDirective[] {
  return DIRECTIVE_DOCS.map((d) => {
    const cell = lookupCapability(canonical, d.name)
    const directive: ChartTypeDirective = {
      name: d.name,
      status: statusOf(cell),
      description: d.description,
    }
    if (cell.note) {
      directive.note = cell.note
    }
    return directive
  })
}

export function describeChartType(input: unknown): ToolResult<DescribeChartTypeOutput> {
  const parsed = DescribeChartTypeInputSchema.safeParse(input)
  if (!parsed.success) {
    return toolError(
      ErrorCode.E_INPUT,
      parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
    )
  }
  const canonical = canonicalChartType(parsed.data.chartType)
  if (!canonical) {
    const known = listCanonicalChartTypes()
    return toolError(ErrorCode.E_INPUT, [{
      code: 'E_UNKNOWN_CHART_TYPE',
      path: 'chartType',
      message: `Unknown chart type "${parsed.data.chartType}". Known types: ${known.join(', ')}.`,
      suggestion: nearestSuggestion(parsed.data.chartType, known),
      context: { got: parsed.data.chartType, known },
    }])
  }

  const doc = extractDocSections(canonical)
  const properties = buildProperties(canonical)
  const directives = buildDirectives(canonical)
  const sample = samples.find(s => s.chartType === canonical)
  const exampleText = doc.example || sample?.dsl || ''

  const output: DescribeChartTypeOutput = {
    name: canonical,
    aliases: aliasesFor(canonical),
    summary: doc.summary,
    whenToUse: doc.whenToUse,
    whenNotToUse: doc.whenNotToUse,
    properties,
    directives,
    dataShape: inferDataShape(canonical, exampleText),
    exampleSlug: sample?.id,
  }
  const docsUrl = publicDocUrl('charts', canonical)
  if (docsUrl) {
    output.docsUrl = docsUrl
  }
  return toolOk(output)
}
