import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_COLUMNS,
  getParentFolder,
  matchesSearch,
  mergeUniqueImages,
  parseColumnCount,
  readStoredRecentDirs,
} from './gallery.js'

const fakeStorage = (value) => ({
  getItem: (key) => (key === 'recentDirs' ? value : null),
})

describe('readStoredRecentDirs', () => {
  test('returns valid directory strings', () => {
    const dirs = readStoredRecentDirs(fakeStorage('["/a","/b"]'))
    assert.deepEqual(dirs, ['/a', '/b'])
  })

  test('drops non-string and blank entries', () => {
    const dirs = readStoredRecentDirs(fakeStorage('["/a", 42, null, "   ", "/b"]'))
    assert.deepEqual(dirs, ['/a', '/b'])
  })

  test('returns an empty array for corrupted JSON', () => {
    assert.deepEqual(readStoredRecentDirs(fakeStorage('{not json')), [])
  })

  test('returns an empty array when the stored value is not an array', () => {
    assert.deepEqual(readStoredRecentDirs(fakeStorage('{"dir":"/a"}')), [])
  })

  test('returns an empty array when nothing is stored', () => {
    assert.deepEqual(readStoredRecentDirs(fakeStorage(null)), [])
  })

  test('returns an empty array when storage access throws', () => {
    const throwingStorage = {
      getItem() {
        throw new Error('SecurityError')
      },
    }
    assert.deepEqual(readStoredRecentDirs(throwingStorage), [])
  })

  test('does not throw when no storage exists', () => {
    assert.deepEqual(readStoredRecentDirs(null), [])
  })
})

describe('parseColumnCount', () => {
  test('accepts values inside the supported range', () => {
    assert.equal(parseColumnCount('4'), 4)
    assert.equal(parseColumnCount('6'), 6)
    assert.equal(parseColumnCount(10), 10)
  })

  test('falls back to the default for out-of-range values', () => {
    assert.equal(parseColumnCount('3'), DEFAULT_COLUMNS)
    assert.equal(parseColumnCount('11'), DEFAULT_COLUMNS)
    assert.equal(parseColumnCount(0), DEFAULT_COLUMNS)
  })

  test('falls back to the default for malformed values', () => {
    assert.equal(parseColumnCount('abc'), DEFAULT_COLUMNS)
    assert.equal(parseColumnCount(null), DEFAULT_COLUMNS)
    assert.equal(parseColumnCount(undefined), DEFAULT_COLUMNS)
    assert.equal(parseColumnCount(6.5), DEFAULT_COLUMNS)
  })
})

describe('mergeUniqueImages', () => {
  test('appends new images in order', () => {
    const existing = [{ path: '/a.png' }, { path: '/b.png' }]
    const incoming = [{ path: '/c.png' }]
    assert.deepEqual(
      mergeUniqueImages(existing, incoming).map(img => img.path),
      ['/a.png', '/b.png', '/c.png'],
    )
  })

  test('does not add an asset that is already loaded', () => {
    // Regression: the old page-size mismatch re-sent items 50-99 as page 2.
    const existing = [{ path: '/a.png' }, { path: '/b.png' }]
    const incoming = [{ path: '/b.png' }, { path: '/c.png' }]
    assert.deepEqual(
      mergeUniqueImages(existing, incoming).map(img => img.path),
      ['/a.png', '/b.png', '/c.png'],
    )
  })

  test('deduplicates repeated paths within one page', () => {
    const incoming = [{ path: '/a.png' }, { path: '/a.png' }]
    assert.deepEqual(mergeUniqueImages([], incoming).map(img => img.path), ['/a.png'])
  })

  test('ignores nullish entries', () => {
    const incoming = [null, { path: '/a.png' }, undefined]
    assert.deepEqual(mergeUniqueImages([], incoming).map(img => img.path), ['/a.png'])
  })
})

describe('getParentFolder', () => {
  test('returns the containing directory', () => {
    assert.equal(getParentFolder('/root/sub/photo.png'), '/root/sub')
  })

  test('returns the filesystem root for top-level files', () => {
    assert.equal(getParentFolder('/photo.png'), '/')
    assert.equal(getParentFolder('photo.png'), '/')
  })

  test('handles an empty value', () => {
    assert.equal(getParentFolder(''), '/')
    assert.equal(getParentFolder(undefined), '/')
  })
})

describe('matchesSearch', () => {
  const img = { name: 'Holiday.JPG', path: '/photos/2024/Holiday.JPG' }

  test('matches by file name, case-insensitively', () => {
    assert.equal(matchesSearch(img, 'holiday'), true)
    assert.equal(matchesSearch(img, 'HOLIDAY'), true)
  })

  test('matches by path', () => {
    assert.equal(matchesSearch(img, '2024'), true)
  })

  test('treats an empty filter as a match', () => {
    assert.equal(matchesSearch(img, ''), true)
    assert.equal(matchesSearch(img, undefined), true)
  })

  test('rejects non-matching terms', () => {
    assert.equal(matchesSearch(img, 'sunset'), false)
  })
})
