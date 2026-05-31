import { z } from 'zod'
import { listPalettes } from '@blueprint-chart/lib'
import { toolOk, type ToolResult } from '../errors'

export const ListPalettesInputSchema = z.object({}).strict()
export type ListPalettesInput = z.infer<typeof ListPalettesInputSchema>

export interface PaletteSummary {
  name: string
  label: string
  colors: string[]
}

export interface ListPalettesOutput {
  palettes: PaletteSummary[]
}

export function listPalettesTool(): ToolResult<ListPalettesOutput> {
  const palettes = listPalettes().map(p => ({
    name: p.name,
    label: p.label,
    colors: [...p.colors],
  }))
  return toolOk({ palettes })
}
