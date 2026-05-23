import { renderBpc } from '@blueprint-chart/lib'
import { createJsdomEnv } from './jsdomEnv'
import { installTextShim } from './textShim'

export interface RenderSceneStateOptions {
  sceneIndex?: number
  width: number
  height: number
  theme?: string
}

/**
 * Globals that `@blueprint-chart/lib` (and the D3 code it bundles) reads at
 * call time. Verified against `node_modules/@blueprint-chart/lib/dist/index.js`
 * via:
 *
 *   grep -oE '\b(Element|getComputedStyle|requestAnimationFrame|window|document)\b' \
 *     node_modules/@blueprint-chart/lib/dist/index.js | sort -u
 *
 * The lib bundle has no top-level uses of these names — they are only invoked
 * inside functions reached from `renderBpc` — so swapping the globals around
 * the call and restoring them in `finally` is sufficient. No module-load
 * `globals.ts` shim is required.
 */
const FORWARDED_GLOBALS = [
  'window',
  'document',
  'Element',
  'getComputedStyle',
  'requestAnimationFrame',
] as const

type ForwardedKey = (typeof FORWARDED_GLOBALS)[number]
type GlobalsBag = Record<ForwardedKey, unknown>

/**
 * Render a `.bpc` source string to SVG markup in a headless jsdom environment.
 *
 * Composition:
 *  - `createJsdomEnv` provisions a window + container + serialize/cleanup hooks.
 *  - `installTextShim` patches `window.SVGElement.prototype` so D3 layout
 *    primitives (axes, legends, annotations) read realistic text widths from
 *    `@napi-rs/canvas` instead of jsdom's zero defaults.
 *  - `renderBpc` from `@blueprint-chart/lib` parses the source, resolves the
 *    requested scene, and mounts SVG into the container via D3.
 *
 * Throws when `renderBpc` cannot produce SVG output (invalid source, etc.) —
 * callers (the `render` tool) catch and translate to a structured ToolResult.
 */
export function renderSceneState(source: string, opts: RenderSceneStateOptions): string {
  const env = createJsdomEnv({ width: opts.width, height: opts.height })
  try {
    installTextShim(env.window)
    const jsdomWindow = env.window as unknown as GlobalsBag
    const globals = globalThis as unknown as Partial<GlobalsBag>
    const prev: Partial<GlobalsBag> = {}
    for (const key of FORWARDED_GLOBALS) {
      prev[key] = globals[key]
      globals[key] = jsdomWindow[key]
    }
    try {
      renderBpc(env.container, source, {
        sceneIndex: opts.sceneIndex,
        thumbnail: true,
        transition: false,
        theme: opts.theme,
      })
    } finally {
      for (const key of FORWARDED_GLOBALS) {
        globals[key] = prev[key]
      }
    }
    const svg = env.serialize()
    if (!svg) throw new Error('renderBpc produced no SVG output')
    return svg
  } finally {
    env.cleanup()
  }
}
