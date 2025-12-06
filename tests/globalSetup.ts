export async function setup() {
  const resizableDescriptor = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')
  if (!resizableDescriptor || typeof resizableDescriptor.get !== 'function') {
    Object.defineProperty(ArrayBuffer.prototype, 'resizable', {
      get() {
        return false
      },
      configurable: true,
    })
  }

  if (typeof SharedArrayBuffer !== 'undefined') {
    const sabGrowableDescriptor = Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype, 'growable')
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
