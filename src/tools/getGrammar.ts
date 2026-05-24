import { z } from 'zod'
import { getDoc, listDocs } from '@blueprint-chart/docs'
import { ErrorCode, toolError, toolOk, type ToolResult } from '../errors'

const SectionSchema = z.enum(['all', 'chart', 'properties', 'scenes', 'annotations']).default('all')

export const GetGrammarInputSchema = z.object({
  section: SectionSchema.optional(),
}).strict()
export type GetGrammarInput = z.infer<typeof GetGrammarInputSchema>

export interface GetGrammarOutput {
  section: z.infer<typeof SectionSchema>
  text: string
}

const SECTION_TO_SLUG: Record<Exclude<GetGrammarOutput['section'], 'all'>, string> = {
  chart: 'index',
  properties: 'properties',
  scenes: 'scenes-and-transforms',
  annotations: 'annotations',
}

export function getGrammar(input: unknown): ToolResult<GetGrammarOutput> {
  const parsed = GetGrammarInputSchema.safeParse(input)
  if (!parsed.success) {
    return toolError(
      ErrorCode.E_INPUT,
      parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
    )
  }
  const section = parsed.data.section ?? 'all'

  if (section === 'all') {
    const pages = listDocs('reference/dsl')
    const text = pages.map((entry) => {
      const { content } = getDoc('reference/dsl', entry.slug)
      return `# ${entry.title}\n\n${content}`
    }).join('\n\n---\n\n')
    return toolOk({ section: 'all', text })
  }

  const slug = SECTION_TO_SLUG[section]
  try {
    const { content } = getDoc('reference/dsl', slug)
    return toolOk({ section, text: content })
  }
  catch (err) {
    return toolError(ErrorCode.E_INPUT, [{
      message: `Grammar section "${section}" not found: ${err instanceof Error ? err.message : String(err)}`,
    }])
  }
}
