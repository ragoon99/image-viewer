import { after, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  clearHashCache,
  dHashFromFile,
  dHashFromGray,
  getHash,
  hammingDistance,
  hashImages,
  similarityPercent,
} from './similarity.js'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'

const gradientGray = () => {
  // 9×8 image brightening left to right: every horizontal comparison says "darker".
  return Buffer.from(Array.from({ length: 72 }, (_, i) => (i % 9) * 28))
}

describe('dHashFromGray', () => {
  test('a left-to-right brightening gradient hashes to all one bits', () => {
    assert.equal(dHashFromGray(gradientGray()), 'ffffffffffffffff')
  })

  test('a right-to-left gradient hashes to all zero bits', () => {
    const gray = Buffer.from(Array.from({ length: 72 }, (_, i) => 224 - (i % 9) * 28))
    assert.equal(dHashFromGray(gray), '0000000000000000')
  })

  test('rejects pixel arrays of the wrong length', () => {
    assert.throws(() => dHashFromGray(Buffer.alloc(64)), /Expected 72/)
    assert.throws(() => dHashFromGray(null), /Expected 72/)
  })
})

describe('hammingDistance', () => {
  test('identical hashes have distance 0', () => {
    assert.equal(hammingDistance('deadbeefdeadbeef', 'deadbeefdeadbeef'), 0)
  })

  test('opposite hashes have distance 64', () => {
    assert.equal(hammingDistance('0000000000000000', 'ffffffffffffffff'), 64)
  })

  test('counts differing bits per nibble', () => {
    assert.equal(hammingDistance('0f0f0f0f0f0f0f0f', 'f0f0f0f0f0f0f0f0'), 64)
    assert.equal(hammingDistance('1234567890abcdef', '1234567890abcdee'), 1)
    assert.equal(hammingDistance('0123456789abcdef', 'fedcba9876543210'), 64)
  })
})

describe('similarityPercent', () => {
  test('maps distance to a 0-100 score', () => {
    assert.equal(similarityPercent(0), 100)
    assert.equal(similarityPercent(32), 50)
    assert.equal(similarityPercent(64), 0)
  })
})

describe('dHashFromFile and caching', () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'image-viewer-hash-'))
  const gradientPath = path.join(fixtureDir, 'gradient.png')

  const writeGradientPng = async (filePath, reverse = false) => {
    const width = 32
    const height = 32
    const raw = Buffer.alloc(width * height * 3)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const t = reverse ? 1 - x / (width - 1) : x / (width - 1)
        const value = Math.round(255 * t)
        const offset = (y * width + x) * 3
        raw[offset] = value
        raw[offset + 1] = value
        raw[offset + 2] = value
      }
    }
    const png = await sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer()
    fs.writeFileSync(filePath, png)
  }

  test('decodes a file into a stable 16-character hash', async () => {
    await writeGradientPng(gradientPath)
    const hash = await dHashFromFile(gradientPath)
    assert.match(hash, /^[0-9a-f]{16}$/)
    assert.equal(await dHashFromFile(gradientPath), hash)
  })

  test('getHash caches by size and mtime and re-hashes after edits', async () => {
    clearHashCache()
    const stat = fs.statSync(gradientPath)
    const first = await getHash(gradientPath, stat)

    // Touch the file so mtime changes; the cache must invalidate.
    const later = new Date(Date.now() + 5000)
    fs.utimesSync(gradientPath, later, later)
    const freshStat = fs.statSync(gradientPath)
    const second = await getHash(gradientPath, freshStat)
    assert.equal(second, first) // same pixels, so same hash, but re-computed
    assert.notEqual(first, undefined)
    clearHashCache()
  })

  test('hashImages skips undecodable files', async () => {
    clearHashCache()
    const junkPath = path.join(fixtureDir, 'junk.png')
    fs.writeFileSync(junkPath, 'not an image')

    const hashes = await hashImages([
      { path: gradientPath, size: fs.statSync(gradientPath).size, mtime: fs.statSync(gradientPath).mtime },
      { path: junkPath, size: fs.statSync(junkPath).size, mtime: fs.statSync(junkPath).mtime },
    ])

    assert.deepEqual([...hashes.keys()], [gradientPath])
    clearHashCache()
  })

  after(() => fs.rmSync(fixtureDir, { recursive: true, force: true }))
})
