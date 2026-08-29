import { parse, astToDefinition, resolveScene, getChart } from '@blueprint-chart/lib'
import type { ChartNode } from '@blueprint-chart/lib'
import { canonicalChartType, listCanonicalChartTypes } from '../dsl/chartTypes'
import { nearestSuggestion } from '../dsl/suggest'
import { sceneCount, toLibSceneIndex } from './scenes'

export type RenderDiagnosticCode =
  | 'E_PARSE'
  | 'E_UNKNOWN_CHART_TYPE'
  | 'E_NO_DATA'
  | 'E_NO_RESOLVED_SERIES'
  | 'E_UNKNOWN_SCENE_INDEX'
  | 'E_UNRESOLVED_COLORIZE'
  | 'E_UNRESOLVED_HIGHLIGHT'

export interface RenderDiagnostic {
  code: RenderDiagnosticCode
  path: string
  message: string
  context?: Record<string, unknown>
  suggestion?: string
}

export interface DiagnoseOptions {
  sceneIndex?: number
}

type DiagnoseResult =
  | { ok: true }
  | { ok: false, diagnostics: RenderDiagnostic[] }

function colorizeTargets(ast: ChartNode): string[] {
  return (ast.colorizes ?? []).map(c => c.target)
}

function highlightTargets(ast: ChartNode): string[] {
  return (ast.highlights ?? []).map(h => h.target)
}

export function diagnoseRender(source: string, opts: DiagnoseOptions = {}): DiagnoseResult {
  let ast: ChartNode
  try {
    ast = parse(source)
  }
  catch (err) {
    return {
      ok: false,
      diagnostics: [{
        code: 'E_PARSE',
        path: 'source',
        message: err instanceof Error ? err.message : String(err),
      }],
    }
  }

  const diagnostics: RenderDiagnostic[] = []

  // Unknown chart type — silent no-op in render-chart.ts:52-55
  const canonical = canonicalChartType(ast.chartType)
  if (!canonical || !getChart(canonical)) {
    const known = listCanonicalChartTypes()
    diagnostics.push({
      code: 'E_UNKNOWN_CHART_TYPE',
      path: 'chart',
      message: `No renderer registered for chart type "${ast.chartType}".`,
      context: { got: ast.chartType, known },
      suggestion: nearestSuggestion(ast.chartType, known),
    })
    return { ok: false, diagnostics }
  }

  const definition = astToDefinition(ast)

  // Empty data — silent return in render-chart.ts:25-31
  if (definition.data.labels.length === 0) {
    diagnostics.push({
      code: 'E_NO_DATA',
      path: 'data',
      message: 'Chart has no parsed data rows. Add quoted-string labels with numeric values to the data block.',
    })
  }

  // Scene number out of range
  const available = sceneCount(ast)
  if (opts.sceneIndex !== undefined && (opts.sceneIndex < 1 || opts.sceneIndex > available)) {
    diagnostics.push({
      code: 'E_UNKNOWN_SCENE_INDEX',
      path: 'scene',
      message: `Requested scene ${opts.sceneIndex} but chart has ${available} scene(s), numbered 1 to ${available}. Scene 1 is the base chart.`,
      context: { requested: opts.sceneIndex, availableSceneCount: available },
    })
  }

  // Unresolved colorize/highlight targets
  const labels = new Set(definition.data.labels)
  const seriesNames = new Set<string>()
  for (const s of definition.data.series ?? []) {
    if (s.name) {
      seriesNames.add(s.name)
    }
  }

  for (const target of colorizeTargets(ast)) {
    if (!labels.has(target) && !seriesNames.has(target)) {
      diagnostics.push({
        code: 'E_UNRESOLVED_COLORIZE',
        path: 'colorize',
        message: `colorize "${target}" does not match any data label or series name.`,
        context: { target, availableLabels: [...labels], availableSeries: [...seriesNames] },
        suggestion: nearestSuggestion(target, [...labels, ...seriesNames]),
      })
    }
  }
  for (const target of highlightTargets(ast)) {
    if (!labels.has(target) && !seriesNames.has(target)) {
      diagnostics.push({
        code: 'E_UNRESOLVED_HIGHLIGHT',
        path: 'highlight',
        message: `highlight "${target}" does not match any data label or series name.`,
        context: { target, availableLabels: [...labels], availableSeries: [...seriesNames] },
        suggestion: nearestSuggestion(target, [...labels, ...seriesNames]),
      })
    }
  }

  // Resolve scene (defensive — surfaces internal errors)
  try {
    resolveScene(definition, toLibSceneIndex(opts.sceneIndex))
  }
  catch (err) {
    diagnostics.push({
      code: 'E_NO_RESOLVED_SERIES',
      path: 'scene',
      message: `Failed to resolve scene state: ${err instanceof Error ? err.message : String(err)}`,
    })
  }

  return diagnostics.length === 0 ? { ok: true } : { ok: false, diagnostics }
}
