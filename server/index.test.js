import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { app, getImages, isServableImage, isWithinRoot } from './index.js'

let server
let baseUrl
let root
let outsideRoot

const writeFile = (filePath, contents = 'fake-image') => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, contents)
}

const setMtime = (filePath, seconds) => {
  const date = new Date((1_500_000_000 + seconds) * 1000)
  fs.utimesSync(filePath, date, date)
}

const buildUrl = (pathname, params = {}) => {
  const url = new URL(pathname, baseUrl)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value))
  }
  return url
}

const getJson = async (pathname, params) => {
  const res = await fetch(buildUrl(pathname, params))
  return { status: res.status, body: await res.json() }
}

const fetchUpload = (filePath) => fetch(buildUrl('/uploads', { path: filePath }))

before(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'image-viewer-test-'))
  outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'image-viewer-outside-'))

  const alpha = path.join(root, 'alpha.png')
  const beta = path.join(root, 'beta.jpg')
  const spring = path.join(root, 'campaigns', 'spring.png')
  const winter = path.join(root, 'campaigns', 'winter.png')
  const shoe = path.join(root, 'products', 'shoe.webp')

  writeFile(alpha)
  writeFile(beta)
  writeFile(spring)
  writeFile(winter)
  writeFile(shoe)
  writeFile(path.join(root, 'notes.txt'), 'not an image')
  writeFile(path.join(outsideRoot, 'outside.png'))

  setMtime(alpha, 1)
  setMtime(beta, 2)
  setMtime(spring, 3)
  setMtime(winter, 4)
  setMtime(shoe, 5) // newest first

  server = app.listen(0)
  await once(server, 'listening')
  baseUrl = `http://127.0.0.1:${server.address().port}`

  // The client always scans a directory before requesting its images, which
  // also registers it as an allowed root for /uploads.
  const { status } = await getJson('/api/images', { dir: root })
  assert.equal(status, 200)
})

after(async () => {
  await new Promise(resolve => server.close(resolve))
  fs.rmSync(root, { recursive: true, force: true })
  fs.rmSync(outsideRoot, { recursive: true, force: true })
})

describe('getImages', () => {
  test('collects supported image types recursively and ignores other files', () => {
    const names = getImages(root)
      .map(img => img.name)
      .sort()
    assert.deepEqual(names, ['alpha.png', 'beta.jpg', 'shoe.webp', 'spring.png', 'winter.png'])
  })

  test('returns an empty list for a missing directory', () => {
    assert.deepEqual(getImages(path.join(root, 'does-not-exist')), [])
  })
})

describe('GET /api/images', () => {
  test('returns images newest-first with folders and totals', async () => {
    const { status, body } = await getJson('/api/images', { dir: root })

    assert.equal(status, 200)
    assert.equal(body.total, 5)
    assert.equal(body.hasMore, false)
    assert.deepEqual(
      body.images.map(img => img.name),
      ['shoe.webp', 'winter.png', 'spring.png', 'beta.jpg', 'alpha.png'],
    )
    assert.deepEqual(body.folders, [
      root,
      path.join(root, 'campaigns'),
      path.join(root, 'products'),
    ].sort())
  })

  test('searches all images by name, case-insensitively', async () => {
    const { body } = await getJson('/api/images', { dir: root, q: 'SPRING' })

    assert.equal(body.total, 1)
    assert.equal(body.hasMore, false)
    assert.deepEqual(body.images.map(img => img.name), ['spring.png'])
  })

  test('searches by directory path', async () => {
    const { body } = await getJson('/api/images', { dir: root, q: 'campaigns' })

    assert.equal(body.total, 2)
    assert.deepEqual(body.images.map(img => img.name).sort(), ['spring.png', 'winter.png'])
  })

  test('keeps the full folder list while searching', async () => {
    const { body } = await getJson('/api/images', { dir: root, q: 'campaigns' })

    assert.equal(body.folders.length, 3)
  })

  test('returns an empty result for a term that matches nothing', async () => {
    const { status, body } = await getJson('/api/images', { dir: root, q: 'no-such-image' })

    assert.equal(status, 200)
    assert.equal(body.total, 0)
    assert.equal(body.hasMore, false)
    assert.deepEqual(body.images, [])
  })

  test('paginates search results without gaps', async () => {
    const first = await getJson('/api/images', { dir: root, q: 'campaigns', page: 1, limit: 1 })
    const second = await getJson('/api/images', { dir: root, q: 'campaigns', page: 2, limit: 1 })

    assert.equal(first.body.total, 2)
    assert.equal(first.body.hasMore, true)
    assert.equal(second.body.hasMore, false)

    const names = [...first.body.images, ...second.body.images].map(img => img.name)
    assert.deepEqual(names, ['winter.png', 'spring.png'])
  })

  test('does not repeat assets across pages (double-asset regression)', async () => {
    const pages = await Promise.all([1, 2, 3].map(page =>
      getJson('/api/images', { dir: root, page, limit: 2 })
    ))

    assert.equal(pages[0].body.hasMore, true)
    assert.equal(pages[1].body.hasMore, true)
    assert.equal(pages[2].body.hasMore, false)

    const paths = pages.flatMap(page => page.body.images.map(img => img.path))
    assert.equal(paths.length, 5)
    assert.equal(new Set(paths).size, paths.length)
  })

  test('rejects a missing directory with 404', async () => {
    const { status, body } = await getJson('/api/images', {
      dir: path.join(root, 'does-not-exist'),
    })

    assert.equal(status, 404)
    assert.match(body.error, /not found/i)
  })

  test('rejects a file path with 400', async () => {
    const { status, body } = await getJson('/api/images', {
      dir: path.join(root, 'alpha.png'),
    })

    assert.equal(status, 400)
    assert.match(body.error, /not a directory/i)
  })
})

describe('GET /uploads', () => {
  test('serves an image inside a scanned directory', async () => {
    const res = await fetchUpload(path.join(root, 'alpha.png'))

    assert.equal(res.status, 200)
    assert.equal(res.headers.get('content-type'), 'image/png')
    assert.equal(await res.text(), 'fake-image')
  })

  test('refuses non-image files', async () => {
    const res = await fetchUpload(path.join(root, 'notes.txt'))
    assert.equal(res.status, 404)
  })

  test('refuses images outside any scanned directory', async () => {
    const res = await fetchUpload(path.join(outsideRoot, 'outside.png'))
    assert.equal(res.status, 404)
  })

  test('refuses directory paths', async () => {
    const res = await fetchUpload(root)
    assert.equal(res.status, 404)
  })

  test('refuses a missing path parameter', async () => {
    const res = await fetch(buildUrl('/uploads'))
    assert.equal(res.status, 400)
  })

  test('serves an image from a directory after it is scanned', async () => {
    const freshRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'image-viewer-fresh-'))
    const freshImage = path.join(freshRoot, 'fresh.png')
    writeFile(freshImage)

    try {
      assert.equal((await fetchUpload(freshImage)).status, 404)

      const scan = await getJson('/api/images', { dir: freshRoot })
      assert.equal(scan.status, 200)

      assert.equal((await fetchUpload(freshImage)).status, 200)
    } finally {
      fs.rmSync(freshRoot, { recursive: true, force: true })
    }
  })
})

describe('isWithinRoot', () => {
  const base = path.resolve('/tmp/images')

  test('accepts direct children and nested files', () => {
    assert.equal(isWithinRoot(path.join(base, 'a.png'), base), true)
    assert.equal(isWithinRoot(path.join(base, 'sub', 'a.png'), base), true)
  })

  test('rejects the root itself', () => {
    assert.equal(isWithinRoot(base, base), false)
  })

  test('rejects sibling paths that share a prefix', () => {
    assert.equal(isWithinRoot(path.resolve('/tmp/images-other/a.png'), base), false)
  })

  test('rejects paths that escape the root', () => {
    assert.equal(isWithinRoot(path.resolve('/tmp/images/../secret.png'), base), false)
    assert.equal(isWithinRoot('/etc/passwd', base), false)
  })
})

describe('isServableImage', () => {
  const base = path.resolve('/tmp/images')
  const roots = new Set([base])

  test('accepts supported images inside an allowed root', () => {
    assert.equal(isServableImage(path.join(base, 'a.png'), roots), true)
    assert.equal(isServableImage(path.join(base, 'sub', 'a.JPEG'), roots), true)
  })

  test('rejects non-image extensions', () => {
    assert.equal(isServableImage(path.join(base, 'a.txt'), roots), false)
    assert.equal(isServableImage(path.join(base, 'id_rsa'), roots), false)
  })

  test('rejects images outside every allowed root', () => {
    assert.equal(isServableImage(path.resolve('/tmp/other/a.png'), roots), false)
  })
})
