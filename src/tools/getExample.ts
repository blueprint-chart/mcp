import { z } from 'zod'
import { samples } from '@blueprint-chart/lib'
import { canonicalChartType } from '../dsl/chartTypes'
import { ErrorCode, toolError, toolOk, type ToolResult } from '../errors'

export const GetExampleInputSchema = z.object({
  chartType: z.string().optional().describe('Return the first canonical sample for this chart type (or alias).'),
  name: z.string().optional().describe('Return a specific sample by its id, e.g. "co2-emissions".'),
}).strict()
export type GetExampleInput = z.infer<typeof GetExampleInputSchema>

export const GetExampleOutputSchema = z.object({
  id: z.string().describe('Sample id.'),
  title: z.string().describe('Sample title.'),
  chartType: z.string().describe('Chart type of the sample.'),
  dsl: z.string().describe('The full .bpc source of the sample.'),
})

export interface GetExampleOutput {
  id: string
  title: string
  chartType: string
  dsl: string
}

const STARTER_SAMPLE_ID = 'letter-frequency'

export function getExample(input: unknown): ToolResult<GetExampleOutput> {
  const parsed = GetExampleInputSchema.safeParse(input)
  if (!parsed.success) {
    return toolError(
      ErrorCode.E_INPUT,
      parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
    )
  }
  const { chartType, name } = parsed.data

  if (name) {
    const found = samples.find(s => s.id === name)
    if (!found) {
      return toolError(ErrorCode.E_INPUT, [{
        code: 'E_UNKNOWN_SAMPLE',
        path: 'name',
        message: `No sample with id "${name}". Try one of: ${samples.map(s => s.id).join(', ')}.`,
        context: { knownIds: samples.map(s => s.id) },
      }])
    }
    return toolOk({ id: found.id, title: found.title, chartType: found.chartType, dsl: found.dsl })
  }

  if (chartType) {
    const canonical = canonicalChartType(chartType)
    if (!canonical) {
      return toolError(ErrorCode.E_INPUT, [{
        code: 'E_UNKNOWN_CHART_TYPE',
        path: 'chartType',
        message: `Unknown chart type "${chartType}".`,
        context: { got: chartType },
      }])
    }
    const found = samples.find(s => s.chartType === canonical)
    if (!found) {
      return toolError(ErrorCode.E_INPUT, [{
        code: 'E_NO_SAMPLE_FOR_TYPE',
        path: 'chartType',
        message: `No sample is shipped for chart type "${canonical}".`,
      }])
    }
    return toolOk({ id: found.id, title: found.title, chartType: found.chartType, dsl: found.dsl })
  }

  const starter = samples.find(s => s.id === STARTER_SAMPLE_ID) ?? samples[0]
  if (!starter) {
    return toolError(ErrorCode.E_INTERNAL, [{
      message: 'No samples available — lib export is empty.',
    }])
  }
  return toolOk({ id: starter.id, title: starter.title, chartType: starter.chartType, dsl: starter.dsl })
}
