const resizableDescriptor = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')
if (!resizableDescriptor || typeof resizableDescriptor.get !== 'function') {
  Object.defineProperty(ArrayBuffer.prototype, 'resizable', {
    get() {
      return false
    },
    configurable: true,
  })
}

const sabGrowableDescriptor =
  typeof SharedArrayBuffer !== 'undefined'
    ? Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype, 'growable')
    : undefined

if (typeof SharedArrayBuffer !== 'undefined' && (!sabGrowableDescriptor || typeof sabGrowableDescriptor.get !== 'function')) {
  Object.defineProperty(SharedArrayBuffer.prototype, 'growable', {
    get() {
      return false
    },
    configurable: true,
  })
}
