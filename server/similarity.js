import sharp from 'sharp';

const HASH_WIDTH = 9;
const HASH_HEIGHT = 8;
const HASH_BITS = 64; // 8 comparisons per row × 8 rows

/**
 * Compute a 64-bit dHash from a row-major grayscale pixel array produced by
 * decoding an image at HASH_WIDTH × HASH_HEIGHT. Each bit records whether a
 * pixel is darker than its right-hand neighbour, so the hash survives
 * rescaling, recompression and small crops.
 */
export const dHashFromGray = (gray) => {
    if (!ArrayBuffer.isView(gray) || gray.length !== HASH_WIDTH * HASH_HEIGHT) {
        throw new Error(`Expected ${HASH_WIDTH * HASH_HEIGHT} grayscale values, got ${gray?.length ?? 'none'}`);
    }

    let hex = '';
    for (let i = 0; i < HASH_BITS; i += 4) {
        let nibble = 0;
        for (let j = 0; j < 4; j++) {
            const bitIndex = i + j;
            const y = Math.floor(bitIndex / (HASH_WIDTH - 1));
            const x = bitIndex % (HASH_WIDTH - 1);
            nibble = (nibble << 1) | (gray[y * HASH_WIDTH + x] < gray[y * HASH_WIDTH + x + 1] ? 1 : 0);
        }
        hex += nibble.toString(16);
    }
    return hex;
};

/**
 * Decode any supported image (file path or raw buffer) into its 64-bit dHash.
 */
const hashPipeline = (input) =>
    sharp(input)
        .resize(HASH_WIDTH, HASH_HEIGHT, { fit: 'fill' })
        .grayscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

export const dHashFromFile = async (filePath) =>
    dHashFromGray((await hashPipeline(filePath)).data);

export const dHashFromBuffer = async (buffer) =>
    dHashFromGray((await hashPipeline(buffer)).data);

/**
 * Number of differing bits between two hex hashes (0 = identical, 64 = opposite).
 */
export const hammingDistance = (hashA, hashB) => {
    let distance = 0;
    for (let i = 0; i < hashA.length; i++) {
        let xor = parseInt(hashA[i], 16) ^ parseInt(hashB[i], 16);
        while (xor) {
            distance += xor & 1;
            xor >>= 1;
        }
    }
    return distance;
};

/**
 * Map a Hamming distance to a friendly 0-100 similarity score.
 */
export const similarityPercent = (distance) =>
    Math.max(0, Math.round(((HASH_BITS - distance) / HASH_BITS) * 100));

/**
 * Cache of computed hashes keyed by file path, invalidated whenever a file's
 * size or mtime changes so edited images are re-hashed on the next request.
 */
const hashCache = new Map();

export const getHash = async (filePath, stat) => {
    const mtimeMs = stat.mtime instanceof Date ? stat.mtime.getTime() : stat.mtimeMs;
    const cached = hashCache.get(filePath);
    if (cached && cached.size === stat.size && cached.mtimeMs === mtimeMs) {
        return cached.hash;
    }

    const hash = await dHashFromFile(filePath);
    hashCache.set(filePath, { size: stat.size, mtimeMs, hash });
    return hash;
};

export const clearHashCache = () => hashCache.clear();

/**
 * Hash a batch of image entries (as returned by getImages) with bounded
 * concurrency. Undecodable files are skipped rather than failing the batch.
 * Returns a Map of path -> hash.
 */
export const hashImages = async (images, concurrency = 8) => {
    const hashes = new Map();
    let index = 0;

    const workers = Array.from(
        { length: Math.min(concurrency, images.length) },
        async () => {
            while (index < images.length) {
                const img = images[index++];
                try {
                    hashes.set(img.path, await getHash(img.path, img));
                } catch (err) {
                    console.error(`Failed to hash ${img.path}:`, err.message);
                }
            }
        },
    );

    await Promise.all(workers);
    return hashes;
};
