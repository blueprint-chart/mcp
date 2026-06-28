import { z } from 'zod'

// Mirrors WarningIssue (src/tools/validate.ts:38 → src/dsl/semanticWarnings.ts:10,
// = ValidationIssue with code widened to string).
export const IssueSchema = z.object({
  code: z.string().describe('Machine-readable issue code (e.g. E_UNKNOWN_PROPERTY, W_NO_EFFECT).'),
  path: z.string().describe('Dotted path to the offending node, or empty string.'),
  message: z.string().describe('Human-readable explanation of the issue.'),
  suggestion: z.string().optional().describe('Actionable fix, when one is known.'),
}).describe('A validation error or warning entry.')

// Mirrors FrameMetadata (src/render/frame.ts:3).
export const FrameMetadataSchema = z.object({
  title: z.string().optional().describe('Chart title.'),
  description: z.string().optional().describe('Chart subtitle/description.'),
  byline: z.string().optional().describe('Author credit.'),
  source: z.string().optional().describe('Data source label.'),
  sourceUrl: z.string().optional().describe('Data source URL.'),
  note: z.string().optional().describe('Footnote.'),
}).describe('Frame metadata extracted from the chart.')

// Mirrors RenderUrls (src/links/buildUrls.ts:27).
export const RenderUrlsSchema = z.object({
  png: z.string().describe('Stateless hosted PNG render URL.'),
  svg: z.string().describe('Stateless hosted SVG render URL.'),
  bpc: z.string().describe('Stateless hosted .bpc source URL.'),
}).describe('Stateless hosted render URLs (present only when MCP_PUBLIC_URL is set).')

// Mirrors ChartRecommendation (packages/lib/src/recommendations/types.ts:5).
export const ChartRecommendationSchema = z.object({
  chartType: z.string().describe('Canonical chart-type identifier.'),
  label: z.string().describe('Human-readable chart-type label.'),
  fitness: z.string().describe('Fitness rating for the data shape (RecommendationFitness union).'),
  reason: z.string().describe('Why this chart type fits (or does not).'),
}).describe('A ranked chart-type recommendation.')
