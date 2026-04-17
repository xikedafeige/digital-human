import * as PIXI from 'pixi.js'

type Cubism4Module = typeof import('pixi-live2d-display/cubism4')

let cubismCoreTask: Promise<void> | null = null
let cubism4ModuleTask: Promise<Cubism4Module> | null = null

const scriptRegistry = new Map<string, Promise<void>>()

const loadScript = (url: string) => {
  if (scriptRegistry.has(url)) {
    return scriptRegistry.get(url)!
  }

  const task = new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Live2D runtime can only be loaded in the browser.'))
      return
    }

    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${url}"]`)
    if (existingScript && (window as typeof window & { Live2DCubismCore?: unknown }).Live2DCubismCore) {
      resolve()
      return
    }

    const script = existingScript ?? document.createElement('script')
    script.src = url
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load Live2D core script: ${url}`))

    if (!existingScript) {
      document.head.appendChild(script)
    }
  })

  scriptRegistry.set(url, task)
  return task
}

export const ensureCubism4Runtime = async (coreScriptUrl: string): Promise<Cubism4Module> => {
  ;(window as typeof window & { PIXI?: typeof PIXI }).PIXI = PIXI

  if (!cubismCoreTask) {
    cubismCoreTask = loadScript(coreScriptUrl)
  }

  await cubismCoreTask

  if (!cubism4ModuleTask) {
    cubism4ModuleTask = import('pixi-live2d-display/cubism4').then((module) => {
      module.Live2DModel.registerTicker(PIXI.Ticker)
      return module
    })
  }

  return cubism4ModuleTask
}

export { PIXI }
