import '@testing-library/jest-dom'

// jsdom lacks a canvas 2d context (the graph explorer uses one) and matchMedia.
// Stub just enough so components mount without throwing during tests.
if (!HTMLCanvasElement.prototype.getContext) {
  HTMLCanvasElement.prototype.getContext = () => ({
    clearRect() {}, beginPath() {}, arc() {}, moveTo() {}, lineTo() {}, stroke() {},
    fill() {}, fillRect() {}, fillText() {}, measureText: () => ({ width: 0 }),
    setLineDash() {}, save() {}, restore() {}, translate() {}, scale() {},
    set fillStyle(_) {}, set strokeStyle(_) {}, set lineWidth(_) {}, set font(_) {},
    set textAlign(_) {}, set globalAlpha(_) {},
  })
}
if (!window.matchMedia) {
  window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })
}
window.scrollTo = window.scrollTo || (() => {})
