import { listAllResources as listDocsResources, readResource as readDocsResource } from './docsReader'
import { listSampleResources, readSampleResource } from './samples'

export function listResources() {
  return [...listDocsResources(), ...listSampleResources()]
}

export function readResource(uri: string) {
  if (uri.startsWith('bpc://samples/')) {
    return readSampleResource(uri)
  }
  return readDocsResource(uri)
}
