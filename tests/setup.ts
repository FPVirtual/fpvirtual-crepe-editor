// Polyfills mínimos de APIs de navegador que jsdom no implementa y que usan
// los nodeViews de Crepe (CodeMirror, tooltips). No afectan a la serialización.

class NoopObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): [] {
    return []
  }
}

const g = globalThis as Record<string, unknown>
g.IntersectionObserver ??= NoopObserver
g.ResizeObserver ??= NoopObserver
g.matchMedia ??= () => ({
  matches: false,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
})

const emptyRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] })
const zeroRect = () => ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON() {} })
for (const proto of [Range.prototype, Element.prototype] as unknown as Record<string, unknown>[]) {
  proto.getClientRects ??= emptyRects
  proto.getBoundingClientRect ??= zeroRect
}
document.elementFromPoint ??= () => null
