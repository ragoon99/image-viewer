import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { isTheme, resolveInitialTheme, THEME_STORAGE_KEY } from './theme.js'

const fakeStorage = (value) => ({
  getItem: (key) => (key === THEME_STORAGE_KEY ? value : null),
})

const throwingStorage = {
  getItem() {
    throw new Error('SecurityError')
  },
}

describe('isTheme', () => {
  test('accepts supported theme names', () => {
    assert.equal(isTheme('light'), true)
    assert.equal(isTheme('dark'), true)
  })

  test('rejects anything else', () => {
    assert.equal(isTheme('system'), false)
    assert.equal(isTheme(''), false)
    assert.equal(isTheme(null), false)
    assert.equal(isTheme(undefined), false)
  })
})

describe('resolveInitialTheme', () => {
  test('prefers an explicitly stored theme', () => {
    assert.equal(resolveInitialTheme({ storage: fakeStorage('dark'), prefersDark: false }), 'dark')
    assert.equal(resolveInitialTheme({ storage: fakeStorage('light'), prefersDark: true }), 'light')
  })

  test('follows the system preference when nothing is stored', () => {
    assert.equal(resolveInitialTheme({ storage: fakeStorage(null), prefersDark: true }), 'dark')
    assert.equal(resolveInitialTheme({ storage: fakeStorage(null), prefersDark: false }), 'light')
  })

  test('ignores invalid stored values and uses the system preference', () => {
    assert.equal(resolveInitialTheme({ storage: fakeStorage('purple'), prefersDark: true }), 'dark')
    assert.equal(resolveInitialTheme({ storage: fakeStorage('system'), prefersDark: false }), 'light')
  })

  test('falls back to the system preference when storage throws', () => {
    assert.equal(resolveInitialTheme({ storage: throwingStorage, prefersDark: true }), 'dark')
  })

  test('defaults to light without storage or a dark preference', () => {
    assert.equal(resolveInitialTheme(), 'light')
    assert.equal(resolveInitialTheme({}), 'light')
  })
})
