import { JSDOM, type DOMWindow } from 'jsdom'

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

export function createJsdomEnv(opts: JsdomEnvOptions): JsdomEnv {
  const dom = new JSDOM(
    `<!DOCTYPE html><html><body><div id="root" style="width:${opts.width}px;height:${opts.height}px"></div></body></html>`,
    { pretendToBeVisual: true },
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
