import { z } from 'zod'
import { getChartOptions, samples } from '@blueprint-chart/lib'
import type { ChartOptionDef } from '@blueprint-chart/lib'
import { getDoc, listDocs } from '@blueprint-chart/docs'
import { aliasesFor, canonicalChartType, listCanonicalChartTypes } from '../dsl/chartTypes'
import { nearestSuggestion } from '../dsl/suggest'
import { UNIVERSAL_PROPERTIES, UNIVERSAL_PROPERTY_META } from '../dsl/universalProperties'
import { ErrorCode, toolError, toolOk, type ToolResult } from '../errors'

export const DescribeChartTypeInputSchema = z.object({
  name: z.string(),
}).strict()
export type DescribeChartTypeInput = z.infer<typeof DescribeChartTypeInputSchema>

export interface ChartTypeProperty {
  key: string
  type: string
  description?: string
  choices?: string[]
  default?: unknown
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
  dataShape: ChartTypeDataShape
  exampleSlug?: string
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
  if (example.includes('_series')) {
    return { kind: 'multi-series', example }
  }
  if (example.includes('data')) {
    return { kind: 'single-series', example }
  }
  return { kind: 'unknown', example: 'data {\n  "Label" = 1.0\n}' }
}

export function describeChartType(input: unknown): ToolResult<DescribeChartTypeOutput> {
  const parsed = DescribeChartTypeInputSchema.safeParse(input)
  if (!parsed.success) {
    return toolError(
      ErrorCode.E_INPUT,
      parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
    )
  }
  const canonical = canonicalChartType(parsed.data.name)
  if (!canonical) {
    const known = listCanonicalChartTypes()
    return toolError(ErrorCode.E_INPUT, [{
      code: 'E_UNKNOWN_CHART_TYPE',
      path: 'name',
      message: `Unknown chart type "${parsed.data.name}". Known types: ${known.join(', ')}.`,
      suggestion: nearestSuggestion(parsed.data.name, known),
      context: { got: parsed.data.name, known },
    }])
  }

  const doc = extractDocSections(canonical)
  const properties = buildProperties(canonical)
  const sample = samples.find(s => s.chartType === canonical)
  const exampleText = doc.example || sample?.dsl || ''

  return toolOk({
    name: canonical,
    aliases: aliasesFor(canonical),
    summary: doc.summary,
    whenToUse: doc.whenToUse,
    whenNotToUse: doc.whenNotToUse,
    properties,
    dataShape: inferDataShape(canonical, exampleText),
    exampleSlug: sample?.id,
  })
}
