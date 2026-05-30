import { samples } from '@blueprint-chart/lib'

const PREFIX = 'bpc://samples/'

export interface SampleResource {
  uri: string
  name: string
  description?: string
  mimeType: string
}

export function listSampleResources(): SampleResource[] {
  return samples.map(s => ({
    uri: `${PREFIX}${s.id}`,
    name: s.title,
    description: s.description,
    mimeType: 'text/plain',
  }))
}

export function readSampleResource(uri: string): { uri: string, mimeType: string, text: string } {
  if (!uri.startsWith(PREFIX)) {
    throw new Error(`Not a sample URI: ${uri}`)
  }
  const id = uri.slice(PREFIX.length)
  const sample = samples.find(s => s.id === id)
  if (!sample) {
    throw new Error(`Unknown sample: ${id}`)
  }
  return { uri, mimeType: 'text/plain', text: sample.dsl }
}
