import { builtinEnvironments, type Environment } from 'vitest/environments'

function ensureBufferFlags() {
  const resizableDescriptor = Object.getOwnPropertyDescriptor(
    ArrayBuffer.prototype,
    'resizable',
  )
  if (!resizableDescriptor || typeof resizableDescriptor.get !== 'function') {
    Object.defineProperty(ArrayBuffer.prototype, 'resizable', {
      get() {
        return false
      },
      configurable: true,
    })
  }

  if (typeof SharedArrayBuffer !== 'undefined') {
    const sabGrowableDescriptor = Object.getOwnPropertyDescriptor(
      SharedArrayBuffer.prototype,
      'growable',
    )
    if (!sabGrowableDescriptor || typeof sabGrowableDescriptor.get !== 'function') {
      Object.defineProperty(SharedArrayBuffer.prototype, 'growable', {
        get() {
          return false
        },
        configurable: true,
      })
    }
  }
}

const jsdomEnv = builtinEnvironments.jsdom

const PatchedJsdomEnvironment: Environment = {
  name: 'patched-jsdom',
  // jsdom is a browser-like environment, so we use 'web'
  transformMode: 'web',
  async setup(global, options) {
    ensureBufferFlags()
    // Delegate to the built-in jsdom environment
    return jsdomEnv.setup(global, options)
  },
}

export default PatchedJsdomEnvironment
