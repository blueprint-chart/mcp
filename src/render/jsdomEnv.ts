import { JSDOM, VirtualConsole, type DOMWindow } from 'jsdom'

export interface JsdomEnv {
  window: DOMWindow
  container: HTMLElement
  serialize: () => string
  cleanup: () => void
}

export interface JsdomEnvOptions {
  width: number
  height: number
}

// @blueprint-chart/lib internally calls `canvas.getContext('2d')` for text
// measurement before falling back to declared widths. jsdom logs that as a
// "Not implemented" error to stderr even though the lib handles the null
// return gracefully. Drop just those messages; forward anything else.
function createQuietVirtualConsole(): VirtualConsole {
  const vc = new VirtualConsole()
  vc.on('jsdomError', (err: Error) => {
    if (err.message && err.message.startsWith('Not implemented')) {
      return
    }
    console.error(err)
  })
  return vc
}

export function createJsdomEnv(opts: JsdomEnvOptions): JsdomEnv {
  const dom = new JSDOM(
    `<!DOCTYPE html><html><body><div id="root" style="width:${opts.width}px;height:${opts.height}px"></div></body></html>`,
    { pretendToBeVisual: true, virtualConsole: createQuietVirtualConsole() },
  )
  const container = dom.window.document.getElementById('root') as HTMLElement
  return {
    window: dom.window,
    container,
    serialize: () => {
      const svg = container.querySelector('svg')
      return svg ? svg.outerHTML : ''
    },
    cleanup: () => dom.window.close(),
  }
}
