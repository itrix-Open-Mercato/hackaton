import '@testing-library/jest-dom'

if (typeof window !== 'undefined' && window.location) {
  try {
    delete (window.location as { reload?: unknown }).reload
  } catch {
    // Ignore locked properties in jsdom.
  }

  try {
    Object.defineProperty(window.location, 'reload', {
      configurable: true,
      writable: true,
      value: jest.fn(),
    })
  } catch {
    // Ignore if jsdom prevents redefining reload.
  }
}
