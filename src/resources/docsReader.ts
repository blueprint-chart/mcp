import { getDoc, listDocs, type DocGroup, type DocEntry } from '@blueprint-chart/docs'
import { getDocsBaseUrl } from '../links/editorConfig'
import { buildDocUrl, type DocUrlGroup } from '../links/buildUrls'

export interface UriResource {
  uri: string
  name: string
  description?: string
  mimeType: string
  docsUrl?: string
}

const GROUP_TO_URI: Record<DocGroup, string> = {
  'handbook': 'bpc://handbook/',
  'guide': 'bpc://guide/',
  'charts': 'bpc://chart-types/',
  'reference/dsl': 'bpc://reference/dsl/',
  'reference/api': 'bpc://reference/api/',
}

const URI_TO_GROUP: Array<{ prefix: string, group: DocGroup }> = (
  Object.entries(GROUP_TO_URI) as Array<[DocGroup, string]>
).map(([group, prefix]) => ({ prefix, group }))

const GRAMMAR_URI = 'bpc://grammar'

/** Public docs page URL for a docs group + slug, or undefined when docs base is unset. */
export function publicDocUrl(group: DocGroup, slug: string): string | undefined {
  const base = getDocsBaseUrl()
  if (!base) {
    return undefined
  }
  return buildDocUrl(group as DocUrlGroup, slug, base)
}

export function listAllResources(): UriResource[] {
  const groups = Object.keys(GROUP_TO_URI) as DocGroup[]
  const docResources = groups.flatMap(group =>
    listDocs(group).map((entry) => {
      const resource: UriResource = {
        uri: `${GROUP_TO_URI[group]}${entry.slug}`,
        name: entry.title,
        description: entry.blurb,
        mimeType: 'text/markdown',
      }
      const docsUrl = publicDocUrl(group, entry.slug)
      if (docsUrl) {
        resource.docsUrl = docsUrl
      }
      return resource
    }),
  )
  return [
    {
      uri: GRAMMAR_URI,
      name: 'BPC Grammar (aggregate)',
      description: 'Full DSL grammar reference, concatenated from reference/dsl pages.',
      mimeType: 'text/markdown',
    },
    ...docResources,
  ]
}

export function readResource(uri: string): { uri: string, mimeType: string, text: string } {
  if (uri === GRAMMAR_URI) {
    const pages = listDocs('reference/dsl')
    const sections = pages.map((entry) => {
      const { content } = getDoc('reference/dsl', entry.slug)
      return `# ${entry.title}\n\n${content}`
    })
    return { uri, mimeType: 'text/markdown', text: sections.join('\n\n---\n\n') }
  }
  for (const { prefix, group } of URI_TO_GROUP) {
    if (uri.startsWith(prefix)) {
      const slug = uri.slice(prefix.length)
      const { content } = getDoc(group, slug)
      return { uri, mimeType: 'text/markdown', text: content }
    }
  }
  throw new Error(`Unknown resource URI: ${uri}`)
}

export function resourceEntries(): DocEntry[] {
  const groups = Object.keys(GROUP_TO_URI) as DocGroup[]
  return groups.flatMap(g => listDocs(g))
}
