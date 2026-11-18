import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;
const IMAGE_DIR = process.env.IMAGE_DIR || './images';
const IMAGE_EXT_RE = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i;

// Directories the client has explicitly scanned. Only images inside one of
// these roots may be served by /uploads.
const allowedRoots = new Set([path.resolve(IMAGE_DIR)]);

const isWithinRoot = (filePath, root) => {
    const relative = path.relative(root, filePath);
    return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
};

const isServableImage = (filePath, roots = allowedRoots) => {
    if (!IMAGE_EXT_RE.test(filePath)) return false;
    for (const root of roots) {
        if (isWithinRoot(filePath, root)) return true;
    }
    return false;
};

app.get('/uploads', (req, res) => {
    const filePath = req.query.path;
    if (typeof filePath !== 'string' || !filePath) {
        return res.status(400).send('Invalid path');
    }

    try {
        const resolved = path.resolve(filePath);
        if (!isServableImage(resolved) || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
            return res.status(404).send('File not found');
        }
        res.sendFile(resolved);
    } catch (err) {
        console.error('Upload error:', err.message);
        res.status(400).send('Invalid path');
    }
});

const getImages = (dir, fileList = [], depth = 0) => {
    const MAX_DEPTH = 10; // Prevent infinite recursion
    if (depth > MAX_DEPTH) return fileList;

    try {
        if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
            return fileList;
        }

        const files = fs.readdirSync(dir);
        files.forEach(file => {
            try {
                const filePath = path.join(dir, file);
                const stats = fs.statSync(filePath);

                if (stats.isDirectory()) {
                    getImages(filePath, fileList, depth + 1);
                } else if (IMAGE_EXT_RE.test(file)) {
                    fileList.push({ 
                        name: file, 
                        path: filePath,
                        size: stats.size,
                        mtime: stats.mtime
                    });
                }
            } catch (err) {
                console.error(`Error processing ${file}:`, err.message);
                // Continue to next file
            }
        });
    } catch (err) {
        console.error(`Error reading directory ${dir}:`, err.message);
    }
    return fileList;
};

app.get('/api/images', (req, res) => {
    try {
        let dir = req.query.dir || IMAGE_DIR;
        
        // Handle relative paths and normalize
        dir = path.resolve(dir);

        if (!fs.existsSync(dir)) {
            return res.status(404).json({ error: 'Directory not found' });
        }

        if (!fs.statSync(dir).isDirectory()) {
            return res.status(400).json({ error: 'Provided path is not a directory' });
        }

        // Register this directory so /uploads can serve its images
        allowedRoots.add(dir);

        const allImages = getImages(dir);
        // Sort by modified time descending (newest first)
        allImages.sort((a, b) => b.mtime - a.mtime);

        // Folders are always derived from the full scan so the sidebar stays stable while searching
        const folders = [...new Set(allImages.map(img => path.dirname(img.path)))].sort();

        // Server-side search across every image, not just the currently loaded page
        const query = String(req.query.q || '').trim().toLowerCase();
        const matches = query
            ? allImages.filter(img =>
                img.name.toLowerCase().includes(query) ||
                img.path.toLowerCase().includes(query)
              )
            : allImages;

        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit) || 100));
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;

        res.json({
            images: matches.slice(startIndex, endIndex),
            folders,
            total: matches.length,
            hasMore: endIndex < matches.length
        });
    } catch (err) {
        console.error('API Error:', err);
        res.status(500).json({ error: 'Internal server error during image scan' });
    }
});

const isMainModule = process.argv[1] &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMainModule) {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

export { app, getImages, isWithinRoot, isServableImage, allowedRoots, PORT, IMAGE_DIR };
